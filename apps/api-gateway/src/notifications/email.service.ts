import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'smtp.sendgrid.net'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: config.get('SMTP_USER', 'apikey'),
        pass: config.get('SMTP_PASS', ''),
      },
    });
  }

  async sendRunCompleted(opts: {
    to: string;
    orgName: string;
    projectName: string;
    runId: string;
    status: string;
    score: number;
    reportUrl: string;
  }) {
    const statusEmoji = opts.status === 'PASSED' ? '✅' : '❌';
    await this.send({
      to: opts.to,
      subject: `${statusEmoji} QA Run ${opts.status} — ${opts.projectName}`,
      html: this.buildRunEmail(opts),
    });
  }

  async sendSecurityAlert(opts: { to: string; orgName: string; projectName: string; issueCount: number; reportUrl: string }) {
    await this.send({
      to: opts.to,
      subject: `🔴 Security Alert — ${opts.issueCount} critical issue(s) in ${opts.projectName}`,
      html: this.buildSecurityEmail(opts),
    });
  }

  async sendTrialEnding(opts: { to: string; orgName: string; daysLeft: number; upgradeUrl: string }) {
    await this.send({
      to: opts.to,
      subject: `⏰ Your QA Platform trial ends in ${opts.daysLeft} days`,
      html: this.buildTrialEmail(opts),
    });
  }

  async sendInvite(opts: { to: string; inviterName: string; orgName: string; inviteUrl: string }) {
    await this.send({
      to: opts.to,
      subject: `${opts.inviterName} invited you to ${opts.orgName} on QA Platform`,
      html: this.buildInviteEmail(opts),
    });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    const from = this.config.get('EMAIL_FROM', 'noreply@qaplatform.io');
    try {
      await this.transporter.sendMail({ from, ...opts });
      this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${err.message}`);
      throw err;
    }
  }

  private buildRunEmail(opts: any): string {
    const color = opts.status === 'PASSED' ? '#22c55e' : '#ef4444';
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#e2e8f0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#6366f1;margin:0 0 16px">QA Platform</h1>
    <h2 style="color:${color}">Run ${opts.status}</h2>
    <p>Project: <strong>${opts.projectName}</strong></p>
    <p>Organization: ${opts.orgName}</p>
    <div style="background:#0f172a;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:4px 0">QA Score: <strong style="color:${color}">${opts.score}%</strong></p>
      <p style="margin:4px 0">Run ID: <code>${opts.runId}</code></p>
    </div>
    <a href="${opts.reportUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">View Report →</a>
  </div>
</body></html>`;
  }

  private buildSecurityEmail(opts: any): string {
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#e2e8f0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #ef4444;">
    <h1 style="color:#ef4444">🔴 Security Alert</h1>
    <p><strong>${opts.issueCount} critical issue(s)</strong> found in <strong>${opts.projectName}</strong></p>
    <p>Organization: ${opts.orgName}</p>
    <a href="${opts.reportUrl}" style="display:inline-block;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Review Issues →</a>
  </div>
</body></html>`;
  }

  private buildTrialEmail(opts: any): string {
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#e2e8f0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #f59e0b;">
    <h1 style="color:#f59e0b">⏰ Trial Ending Soon</h1>
    <p>Your trial for <strong>${opts.orgName}</strong> ends in <strong>${opts.daysLeft} days</strong>.</p>
    <p>Upgrade to PRO to keep all your projects, runs, and reports.</p>
    <a href="${opts.upgradeUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Upgrade Now →</a>
  </div>
</body></html>`;
  }

  private buildInviteEmail(opts: any): string {
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0f1e;color:#e2e8f0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#6366f1">QA Platform</h1>
    <p><strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.orgName}</strong>.</p>
    <a href="${opts.inviteUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Accept Invitation →</a>
  </div>
</body></html>`;
  }
}
