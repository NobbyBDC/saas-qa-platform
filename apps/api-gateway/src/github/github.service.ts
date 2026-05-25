import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubOAuthService } from './github-oauth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import crypto from 'crypto';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GitHubOAuthService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  getAuthUrl(organizationId: string): string {
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64url');
    return this.oauth.getAuthorizationUrl(state);
  }

  async handleCallback(code: string, state: string, userId: string) {
    const { organizationId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { accessToken, login, avatarUrl } = await this.oauth.exchangeCode(code);

    const webhookSecret = crypto.randomBytes(32).toString('hex');

    await this.prisma.gitHubIntegration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        accessToken,
        githubLogin: login,
        githubAvatarUrl: avatarUrl,
        webhookSecret,
        isActive: true,
      },
      update: {
        accessToken,
        githubLogin: login,
        githubAvatarUrl: avatarUrl,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'github.connect',
      resourceType: 'integration',
      metadata: { login },
    });

    return { connected: true, login, avatarUrl };
  }

  async disconnect(organizationId: string, userId: string) {
    await this.prisma.gitHubIntegration.update({
      where: { organizationId },
      data: { isActive: false },
    });
    await this.audit.log({ organizationId, userId, action: 'github.disconnect', resourceType: 'integration' });
    return { disconnected: true };
  }

  async listRepos(organizationId: string) {
    const integration = await this.getActiveIntegration(organizationId);
    return this.oauth.listRepos(integration.accessToken);
  }

  async connectRepo(organizationId: string, repoFullName: string, webhookBaseUrl: string) {
    const integration = await this.getActiveIntegration(organizationId);
    const webhookUrl = `${webhookBaseUrl}/github/webhook`;

    try {
      await this.oauth.createRepoWebhook(
        integration.accessToken,
        repoFullName,
        webhookUrl,
        integration.webhookSecret,
      );
    } catch (err) {
      this.logger.warn(`Webhook may already exist for ${repoFullName}: ${err.message}`);
    }

    const currentRepos = integration.repos as string[];
    if (!currentRepos.includes(repoFullName)) {
      await this.prisma.gitHubIntegration.update({
        where: { organizationId },
        data: { repos: [...currentRepos, repoFullName] },
      });
    }

    return { connected: true };
  }

  async handlePushEvent(organizationId: string, payload: any) {
    const { ref, repository, head_commit: headCommit } = payload;
    const branch = ref?.replace('refs/heads/', '');
    const repoFullName = repository?.full_name;

    this.logger.log(`Push event: ${repoFullName}#${branch} - ${headCommit?.id}`);

    const project = await this.prisma.project.findFirst({
      where: { organizationId, repositoryUrl: { contains: repoFullName } },
    });
    if (!project) return { skipped: true, reason: 'no matching project' };

    const run = await this.prisma.testRun.create({
      data: {
        projectId: project.id,
        organizationId,
        status: 'QUEUED',
        triggeredBy: 'github_push',
        gitBranch: branch,
        gitCommitSha: headCommit?.id,
      },
    });

    this.logger.log(`Triggered run ${run.id} for push to ${branch}`);
    return { runId: run.id, triggered: true };
  }

  async handlePullRequestEvent(organizationId: string, payload: any) {
    const { action, pull_request: pr, repository } = payload;
    if (!['opened', 'synchronize'].includes(action)) return { skipped: true };

    const repoFullName = repository?.full_name;
    const project = await this.prisma.project.findFirst({
      where: { organizationId, repositoryUrl: { contains: repoFullName } },
    });
    if (!project) return { skipped: true, reason: 'no matching project' };

    const run = await this.prisma.testRun.create({
      data: {
        projectId: project.id,
        organizationId,
        status: 'QUEUED',
        triggeredBy: 'github_pr',
        gitBranch: pr.head.ref,
        gitCommitSha: pr.head.sha,
        gitPrNumber: pr.number,
      },
    });

    this.logger.log(`Triggered run ${run.id} for PR #${pr.number}`);
    return { runId: run.id, prNumber: pr.number };
  }

  async postRunResultsToPr(runId: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: { project: true, report: true, issues: { take: 10, orderBy: { severity: 'asc' } } },
    });
    if (!run?.gitPrNumber || !run.project.repositoryUrl) return;

    const integration = await this.getActiveIntegration(run.project.organizationId);
    const repoFullName = run.project.repositoryUrl.replace('https://github.com/', '').replace(/\.git$/, '');

    const statusEmoji = run.status === 'PASSED' ? '✅' : '❌';
    const score = (run.summary as any)?.overallScore ?? 0;
    const criticalCount = run.issues.filter(i => i.severity === 'CRITICAL').length;
    const highCount = run.issues.filter(i => i.severity === 'HIGH').length;

    const body = [
      `## ${statusEmoji} QA Platform Report — Run \`${runId.slice(0, 8)}\``,
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Status | **${run.status}** |`,
      `| QA Score | **${score}%** |`,
      `| Critical Issues | ${criticalCount} |`,
      `| High Issues | ${highCount} |`,
      `| Branch | \`${run.gitBranch}\` |`,
      `| Commit | \`${run.gitCommitSha?.slice(0, 7)}\` |`,
      '',
      run.issues.length > 0
        ? `### Top Issues\n${run.issues.map(i => `- **[${i.severity}]** ${i.title}`).join('\n')}`
        : '### No issues found 🎉',
      '',
      run.report?.htmlUrl ? `[View Full Report](${run.report.htmlUrl})` : '',
    ].join('\n');

    await this.oauth.postPrComment(integration.accessToken, repoFullName, run.gitPrNumber, body);
  }

  async createFixPr(runId: string, issueId: string, patchDiff: string): Promise<string> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: { project: true },
    });
    if (!run?.project.repositoryUrl) throw new NotFoundException('No repository linked to project');

    const integration = await this.getActiveIntegration(run.project.organizationId);
    const repoFullName = run.project.repositoryUrl.replace('https://github.com/', '').replace(/\.git$/, '');
    const baseBranch = run.project.defaultBranch ?? 'main';

    const latestSha = await this.oauth.getLatestCommitSha(integration.accessToken, repoFullName, baseBranch);
    const fixBranch = `qa-auto-fix/${issueId.slice(0, 8)}-${Date.now()}`;
    await this.oauth.createBranch(integration.accessToken, repoFullName, fixBranch, latestSha);

    const prUrl = await this.oauth.createPullRequest(integration.accessToken, repoFullName, {
      title: `fix: AI-generated fix for issue ${issueId.slice(0, 8)}`,
      body: `This PR was auto-generated by QA Platform's AI Copilot.\n\n## Patch\n\`\`\`diff\n${patchDiff}\n\`\`\``,
      head: fixBranch,
      base: baseBranch,
    });

    return prUrl;
  }

  private async getActiveIntegration(organizationId: string) {
    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { organizationId },
    });
    if (!integration?.isActive) throw new NotFoundException('No active GitHub integration');
    return integration;
  }
}
