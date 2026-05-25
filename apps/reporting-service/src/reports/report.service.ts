import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  QAReport,
  RunSummary,
  Issue,
  AccessibilityResult,
  PerformanceResult,
  SecurityResult,
  CodeQualityResult,
} from '@qa-platform/shared-types';
import { calculateOverallScore, scoreToGrade } from '@qa-platform/shared-utils';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { StorageService } from '../storage/storage.service';
import { ReportGenerator } from './report.generator';
import { JiraService } from '../integrations/jira.service';
import { v4 as uuid } from 'uuid';

const logger = createLogger('reporting-service');

export interface GenerateReportInput {
  runId: string;
  projectId: string;
  testResults: Array<any>;
}

@Injectable()
export class ReportService {
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly generator: ReportGenerator,
    private readonly jira: JiraService,
  ) {
    this.openai = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  async generateReport(input: GenerateReportInput): Promise<QAReport> {
    const { runId, projectId, testResults } = input;
    logger.info('Generating QA report', { runId, projectId });

    // Collate results by type
    const accessibility = testResults.find((r) => r?.type === 'accessibility') as AccessibilityResult | undefined;
    const performance = testResults.find((r) => r?.type === 'performance') as PerformanceResult | undefined;
    const security = testResults.find((r) => r?.type === 'security') as SecurityResult | undefined;
    const codeQuality = testResults.find((r) => r?.type === 'code_quality') as CodeQualityResult | undefined;

    // Collect all issues
    const allIssues: Issue[] = [
      ...(accessibility?.issues ?? []),
      ...(performance?.issues ?? []),
      ...(security?.issues ?? []),
      ...(codeQuality?.issues ?? []),
    ];

    // Generate AI fix suggestions for top issues
    const enrichedIssues = await this.enrichIssuesWithAISuggestions(allIssues.slice(0, 10));

    // Calculate scores
    const scores = {
      accessibility: accessibility?.score,
      performance: performance?.score,
      security: security?.score,
      codeQuality: codeQuality?.score,
    };
    const overallScore = calculateOverallScore(scores);

    const criticalIssues = allIssues.filter((i) => ['critical', 'high'].includes(i.severity)).length;
    const warnings = allIssues.filter((i) => ['medium', 'low'].includes(i.severity)).length;

    const summary: RunSummary = {
      overallScore,
      passed: overallScore >= 70 && criticalIssues === 0,
      accessibilityScore: accessibility?.score,
      performanceScore: performance?.score,
      securityScore: security?.score,
      codeQualityScore: codeQuality?.score,
      totalIssues: allIssues.length,
      criticalIssues,
      warnings,
    };

    // Generate HTML report
    const htmlContent = await this.generator.generateHtml({
      runId, projectId, summary, issues: enrichedIssues,
      accessibility, performance, security, codeQuality,
    });

    // Upload HTML report
    const htmlKey = `runs/${runId}/report.html`;
    const htmlUrl = await this.storage.upload(htmlKey, Buffer.from(htmlContent, 'utf-8'), 'text/html');

    // Upload JSON report
    const reportData = { runId, projectId, generatedAt: new Date(), summary, issues: enrichedIssues };
    const jsonUrl = await this.storage.uploadJson(`runs/${runId}/report.json`, reportData);

    // Auto-create Jira tickets for critical/high issues
    const jiraEnabled = this.config.get('JIRA_HOST') && this.config.get('JIRA_API_TOKEN');
    if (jiraEnabled) {
      await this.createJiraTickets(runId, enrichedIssues.filter(i => ['critical', 'high'].includes(i.severity)));
    }

    const report: QAReport = {
      id: uuid(),
      runId,
      projectId,
      generatedAt: new Date(),
      summary,
      accessibilityResult: accessibility,
      performanceResult: performance,
      securityResult: security,
      codeQualityResult: codeQuality,
      issues: enrichedIssues,
      htmlUrl,
      jsonUrl,
    };

    logger.info('Report generated', {
      runId,
      overallScore,
      totalIssues: allIssues.length,
      criticalIssues,
    });

    return report;
  }

  private async enrichIssuesWithAISuggestions(issues: Issue[]): Promise<Issue[]> {
    if (!this.config.get('OPENAI_API_KEY')) return issues;

    const enriched = await Promise.all(
      issues.map(async (issue) => {
        try {
          const response = await this.openai.chat.completions.create({
            model: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
            max_tokens: 512,
            messages: [
              {
                role: 'system',
                content: 'You are a senior engineer providing actionable fix suggestions.',
              },
              {
                role: 'user',
                content: `Issue: ${issue.title}
Category: ${issue.category}
Severity: ${issue.severity}
Description: ${issue.description}
${issue.suggestedFix ? `Initial suggestion: ${issue.suggestedFix}` : ''}

Provide a concise, specific code-level fix in 2-3 sentences. Include a code snippet if applicable. No preamble.`,
              },
            ],
          });

          const text = response.choices[0].message.content;
          if (text) {
            return { ...issue, aiSuggestedFix: text };
          }
          return issue;
        } catch {
          return issue;
        }
      }),
    );

    return enriched;
  }

  private async createJiraTickets(runId: string, issues: Issue[]): Promise<void> {
    const projectKey = this.config.get('JIRA_PROJECT_KEY', 'QA');

    for (const issue of issues.slice(0, 5)) {  // max 5 tickets per run
      try {
        const ticketId = await this.jira.createIssue({
          projectKey,
          summary: `[QA] ${issue.title}`,
          description: `${issue.description}\n\n${issue.aiSuggestedFix ? `AI Fix: ${issue.aiSuggestedFix}` : ''}\n\nRun ID: ${runId}`,
          priority: issue.severity === 'critical' ? 'Critical' : 'High',
          labels: ['qa-platform', issue.category, `run-${runId.slice(0, 8)}`],
        });
        issue.jiraTicketId = ticketId;
      } catch (error: any) {
        logger.warn('Failed to create Jira ticket', { issue: issue.title, error: error.message });
      }
    }
  }
}
