import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  async sendRunCompleted(webhookUrl: string, opts: {
    projectName: string;
    runId: string;
    status: string;
    score: number;
    reportUrl: string;
    branch?: string;
  }) {
    const color = opts.status === 'PASSED' ? '#22c55e' : '#ef4444';
    const emoji = opts.status === 'PASSED' ? ':white_check_mark:' : ':x:';

    await this.post(webhookUrl, {
      attachments: [{
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *QA Run ${opts.status}* — ${opts.projectName}`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*QA Score*\n${opts.score}%` },
              { type: 'mrkdwn', text: `*Branch*\n${opts.branch ?? 'unknown'}` },
              { type: 'mrkdwn', text: `*Run ID*\n\`${opts.runId.slice(0, 8)}\`` },
            ],
          },
          {
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'View Report' },
              url: opts.reportUrl,
              style: opts.status === 'PASSED' ? 'primary' : 'danger',
            }],
          },
        ],
      }],
    });
  }

  async sendSecurityAlert(webhookUrl: string, opts: {
    projectName: string;
    issueCount: number;
    severity: string;
    reportUrl: string;
  }) {
    await this.post(webhookUrl, {
      attachments: [{
        color: '#ef4444',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:rotating_light: *Security Alert* — ${opts.projectName}\n${opts.issueCount} ${opts.severity} issue(s) detected`,
            },
          },
          {
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'Review Issues' },
              url: opts.reportUrl,
              style: 'danger',
            }],
          },
        ],
      }],
    });
  }

  async sendDeploymentComplete(webhookUrl: string, opts: {
    projectName: string;
    environment: string;
    deployedBy: string;
    commitSha?: string;
  }) {
    await this.post(webhookUrl, {
      text: `:rocket: *Deployment Complete* — ${opts.projectName} → ${opts.environment} by ${opts.deployedBy}${opts.commitSha ? ` (\`${opts.commitSha.slice(0, 7)}\`)` : ''}`,
    });
  }

  async sendCustomMessage(webhookUrl: string, text: string) {
    await this.post(webhookUrl, { text });
  }

  private async post(webhookUrl: string, payload: object) {
    try {
      await axios.post(webhookUrl, payload);
    } catch (err) {
      this.logger.error(`Slack webhook failed: ${err.message}`);
      throw err;
    }
  }
}
