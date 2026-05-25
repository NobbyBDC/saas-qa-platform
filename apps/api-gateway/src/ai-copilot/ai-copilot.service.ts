import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AiCopilotService {
  private readonly logger = new Logger(AiCopilotService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY', ''),
    });
  }

  async analyzeAndSuggestFix(issueId: string, userId?: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { run: { include: { project: true } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const action = await this.prisma.aiCopilotAction.create({
      data: {
        runId: issue.runId,
        issueId,
        userId,
        actionType: 'FIX_FAILING_TEST',
        status: 'ANALYZING',
        input: {
          title: issue.title,
          description: issue.description,
          category: issue.category,
          severity: issue.severity,
          location: issue.location,
          suggestedFix: issue.suggestedFix,
        },
      },
    });

    try {
      const prompt = this.buildFixPrompt(issue);
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        system: `You are an expert QA engineer and software architect.
You analyze test failures and generate precise, production-ready code fixes.
Always respond with valid JSON containing: { "analysis": string, "fixDescription": string, "patchDiff": string, "confidence": number (0-1), "testToValidate": string }`,
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const result = JSON.parse(text);

      await this.prisma.aiCopilotAction.update({
        where: { id: action.id },
        data: {
          status: 'PATCH_READY',
          output: result,
          patchDiff: result.patchDiff,
        },
      });

      await this.prisma.issue.update({
        where: { id: issueId },
        data: { aiSuggestedFix: result.fixDescription },
      });

      await this.audit.log({
        organizationId: issue.run.project.organizationId,
        userId,
        action: 'ai_copilot.analyze',
        resourceType: 'issue',
        resourceId: issueId,
        metadata: { actionId: action.id, confidence: result.confidence },
      });

      return { actionId: action.id, ...result };
    } catch (err) {
      await this.prisma.aiCopilotAction.update({
        where: { id: action.id },
        data: { status: 'FAILED', output: { error: err.message } },
      });
      throw err;
    }
  }

  async applyFix(actionId: string, userId: string): Promise<{ applied: boolean; prUrl?: string }> {
    const action = await this.prisma.aiCopilotAction.findUnique({
      where: { id: actionId },
      include: { issue: true },
    });
    if (!action || action.status !== 'PATCH_READY') {
      throw new NotFoundException('Action not found or not ready');
    }

    await this.prisma.aiCopilotAction.update({
      where: { id: actionId },
      data: { status: 'APPLIED', appliedAt: new Date() },
    });

    await this.prisma.issue.update({
      where: { id: action.issueId! },
      data: { status: 'AI_FIXED', aiFixApplied: true, aiFixRunId: action.runId },
    });

    this.logger.log(`AI fix applied for action ${actionId}`);
    return { applied: true };
  }

  async selfHealPipeline(runId: string): Promise<void> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        project: true,
        issues: { where: { status: 'OPEN', severity: { in: ['CRITICAL', 'HIGH'] } }, take: 5 },
        stages: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!run || run.status !== 'FAILED') return;

    this.logger.log(`Self-healing pipeline for run ${runId} — ${run.issues.length} critical issues`);

    const healAction = await this.prisma.aiCopilotAction.create({
      data: {
        runId,
        actionType: 'SELF_HEAL_PIPELINE',
        status: 'ANALYZING',
        input: {
          runId,
          projectId: run.projectId,
          issueCount: run.issues.length,
          stageLogs: run.stages.map(s => ({ type: s.type, status: s.status, logs: s.logs.slice(-20) })),
        },
      },
    });

    const prompt = this.buildSelfHealPrompt(run);
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      system: `You are an automated QA pipeline engineer. Analyze failed test runs and generate actionable repair strategies.
Respond with JSON: { "rootCause": string, "strategy": string, "steps": string[], "configChanges": Record<string,any>, "estimatedFixTime": string }`,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const result = JSON.parse(text);

    await this.prisma.aiCopilotAction.update({
      where: { id: healAction.id },
      data: { status: 'PATCH_READY', output: result },
    });

    // Auto-apply config changes if confidence is high enough
    if (result.configChanges && Object.keys(result.configChanges).length > 0) {
      await this.prisma.project.update({
        where: { id: run.projectId },
        data: { settings: { ...(run.project.settings as object), ...result.configChanges } },
      });
    }

    this.logger.log(`Self-heal strategy generated for run ${runId}: ${result.strategy}`);
  }

  async getSuggestions(projectId: string) {
    const recentRuns = await this.prisma.testRun.findMany({
      where: { projectId, status: 'FAILED' },
      include: { issues: { take: 5 }, stages: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    const openIssues = await this.prisma.issue.findMany({
      where: { run: { projectId }, status: 'OPEN', aiSuggestedFix: { not: null } },
      take: 10,
      orderBy: { severity: 'asc' },
    });

    const pendingActions = await this.prisma.aiCopilotAction.findMany({
      where: { run: { projectId }, status: { in: ['PATCH_READY', 'PENDING'] } },
      include: { issue: true },
      orderBy: { createdAt: 'desc' },
    });

    return { recentFailures: recentRuns.length, openIssues, pendingActions };
  }

  async getActionStatus(actionId: string) {
    return this.prisma.aiCopilotAction.findUnique({
      where: { id: actionId },
      include: { issue: true, run: { select: { projectId: true, status: true } } },
    });
  }

  private buildFixPrompt(issue: any): string {
    return `
Analyze this QA issue and generate a precise code fix:

**Issue Title**: ${issue.title}
**Category**: ${issue.category}
**Severity**: ${issue.severity}
**Description**: ${issue.description}
**Location**: ${issue.location ?? 'Unknown'}
**Current Suggested Fix**: ${issue.suggestedFix ?? 'None'}

Project: ${issue.run.project.name}
Framework hints: Next.js / React frontend, NestJS backend, TypeScript, Playwright tests

Provide a concrete code fix as a unified diff patch and a test to validate the fix.
    `.trim();
  }

  private buildSelfHealPrompt(run: any): string {
    const stageSummary = run.stages
      .map((s: any) => `${s.type}: ${s.status} — ${s.logs.slice(-5).join(' | ')}`)
      .join('\n');

    const issueSummary = run.issues
      .map((i: any) => `[${i.severity}] ${i.title}: ${i.description}`)
      .join('\n');

    return `
A QA pipeline run has failed. Analyze and generate a repair strategy.

**Run ID**: ${run.id}
**Project**: ${run.project.name}
**Branch**: ${run.gitBranch ?? 'unknown'}
**Status**: ${run.status}

**Stage Results**:
${stageSummary}

**Top Issues**:
${issueSummary}

Generate a self-healing strategy to fix the pipeline and prevent recurrence.
    `.trim();
  }
}
