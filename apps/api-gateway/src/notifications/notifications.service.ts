import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SlackService } from './slack.service';

export type NotificationEvent =
  | 'run_success'
  | 'run_failure'
  | 'security_issue'
  | 'deploy_completed'
  | 'trial_ending'
  | 'invite';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly slack: SlackService,
  ) {}

  async notifyRunCompleted(runId: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        project: { include: { organization: true } },
        report: true,
      },
    });
    if (!run) return;

    const org = run.project.organization;
    const prefs = await this.getPrefs(org.id, run.status === 'PASSED' ? 'run_success' : 'run_failure');
    const reportUrl = run.report?.htmlUrl ?? `${process.env.APP_URL}/report/${runId}`;
    const score = (run.summary as any)?.overallScore ?? 0;

    const slackInt = await this.prisma.slackIntegration.findUnique({ where: { organizationId: org.id } });

    for (const pref of prefs) {
      if (!pref.enabled) continue;

      try {
        if (pref.channel === 'email') {
          const users = await this.prisma.user.findMany({ where: { organizationId: org.id, role: { in: ['ADMIN', 'OWNER'] } } });
          await Promise.all(users.map(u =>
            this.email.sendRunCompleted({
              to: u.email,
              orgName: org.name,
              projectName: run.project.name,
              runId,
              status: run.status,
              score,
              reportUrl,
            })
          ));
        }

        if (pref.channel === 'slack' && slackInt?.isActive) {
          const channel = (pref.config as any)?.channel ?? slackInt.defaultChannel;
          if (channel) {
            await this.slack.sendRunCompleted(
              `https://hooks.slack.com/services/${slackInt.botToken}`,
              { projectName: run.project.name, runId, status: run.status, score, reportUrl, branch: run.gitBranch ?? undefined },
            );
          }
        }

        await this.logNotification(org.id, pref.channel, run.status === 'PASSED' ? 'run_success' : 'run_failure', { runId });
      } catch (err) {
        this.logger.error(`Notification failed [${pref.channel}]: ${err.message}`);
        await this.logNotification(org.id, pref.channel, 'run_failure', { runId }, 'failed', err.message);
      }
    }
  }

  async notifySecurityIssues(runId: string, criticalCount: number) {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: { project: { include: { organization: true } }, report: true },
    });
    if (!run) return;

    const org = run.project.organization;
    const prefs = await this.getPrefs(org.id, 'security_issue');
    const reportUrl = run.report?.htmlUrl ?? `${process.env.APP_URL}/report/${runId}`;
    const slackInt = await this.prisma.slackIntegration.findUnique({ where: { organizationId: org.id } });

    for (const pref of prefs) {
      if (!pref.enabled) continue;
      try {
        if (pref.channel === 'email') {
          const users = await this.prisma.user.findMany({ where: { organizationId: org.id, role: { in: ['ADMIN', 'OWNER'] } } });
          await Promise.all(users.map(u =>
            this.email.sendSecurityAlert({ to: u.email, orgName: org.name, projectName: run.project.name, issueCount: criticalCount, reportUrl })
          ));
        }
        if (pref.channel === 'slack' && slackInt?.isActive) {
          await this.slack.sendSecurityAlert(
            `https://hooks.slack.com/services/${slackInt.botToken}`,
            { projectName: run.project.name, issueCount: criticalCount, severity: 'CRITICAL', reportUrl },
          );
        }
      } catch (err) {
        this.logger.error(`Security notification failed: ${err.message}`);
      }
    }
  }

  async updatePreferences(organizationId: string, prefs: Array<{ channel: string; event: string; enabled: boolean; config?: object }>) {
    await Promise.all(prefs.map(p =>
      this.prisma.notificationPreference.upsert({
        where: { organizationId_channel_event: { organizationId, channel: p.channel, event: p.event } },
        create: { organizationId, channel: p.channel, event: p.event, enabled: p.enabled, config: p.config ?? {} },
        update: { enabled: p.enabled, config: p.config ?? {} },
      })
    ));
    return { updated: true };
  }

  async getPreferences(organizationId: string) {
    return this.prisma.notificationPreference.findMany({ where: { organizationId } });
  }

  private async getPrefs(organizationId: string, event: string) {
    return this.prisma.notificationPreference.findMany({ where: { organizationId, event } });
  }

  private async logNotification(orgId: string, channel: string, event: string, payload: object, status = 'sent', error?: string) {
    await this.prisma.notificationLog.create({
      data: { orgId, channel, event, payload, status, error },
    });
  }
}
