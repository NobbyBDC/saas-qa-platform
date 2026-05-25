import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { SecurityResult, SecurityAlert, Issue } from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('security-scanner');

export interface SecurityScanInput {
  runId: string;
  previewUrl: string;
}

@Injectable()
export class SecurityScannerService {
  private readonly zapUrl: string;
  private readonly zapApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.zapUrl = config.get('ZAP_API_URL', 'http://zap:8090');
    this.zapApiKey = config.get('ZAP_API_KEY', '');
  }

  async runScan(input: SecurityScanInput): Promise<SecurityResult> {
    const { runId, previewUrl } = input;
    logger.info('Starting security scan', { runId, previewUrl });

    try {
      const zapAvailable = await this.checkZapAvailable();
      if (zapAvailable) {
        return await this.runZapScan(runId, previewUrl);
      }
      logger.warn('ZAP not available, running passive checks only');
      return await this.runPassiveChecks(runId, previewUrl);
    } catch (error: any) {
      logger.error('Security scan failed', { error: error.message });
      return await this.runPassiveChecks(runId, previewUrl);
    }
  }

  // -----------------------------------------------------------------------
  // OWASP ZAP Active Scan
  // -----------------------------------------------------------------------
  private async runZapScan(runId: string, targetUrl: string): Promise<SecurityResult> {
    const headers = { 'X-ZAP-API-Key': this.zapApiKey };

    // Start spider
    logger.info('Starting ZAP spider', { targetUrl });
    const spiderResponse = await axios.get(`${this.zapUrl}/JSON/spider/action/scan/`, {
      headers,
      params: { url: targetUrl, maxChildren: 10, recurse: true },
    });
    const spiderId = spiderResponse.data.scan;

    // Wait for spider to complete
    await this.waitForCompletion(
      async () => {
        const { data } = await axios.get(`${this.zapUrl}/JSON/spider/view/status/`, {
          headers, params: { scanId: spiderId },
        });
        return parseInt(data.status) >= 100;
      },
      60,
    );

    // Start active scan
    logger.info('Starting ZAP active scan');
    const scanResponse = await axios.get(`${this.zapUrl}/JSON/ascan/action/scan/`, {
      headers,
      params: { url: targetUrl, recurse: true, inScopeOnly: false },
    });
    const scanId = scanResponse.data.scan;

    // Wait for active scan
    await this.waitForCompletion(
      async () => {
        const { data } = await axios.get(`${this.zapUrl}/JSON/ascan/view/status/`, {
          headers, params: { scanId },
        });
        return parseInt(data.status) >= 100;
      },
      300, // 5 minutes max
    );

    // Get alerts
    const alertsResponse = await axios.get(`${this.zapUrl}/JSON/core/view/alerts/`, {
      headers,
      params: { baseurl: targetUrl, start: 0, count: 200 },
    });

    const alerts = alertsResponse.data.alerts ?? [];
    return this.processZapAlerts(runId, alerts, targetUrl);
  }

  private processZapAlerts(runId: string, rawAlerts: any[], targetUrl: string): SecurityResult {
    const alerts: SecurityAlert[] = rawAlerts.map((a) => ({
      id: uuid(),
      pluginId: a.pluginId ?? '',
      alertRef: a.alertRef ?? '',
      name: a.name ?? a.alert,
      riskLevel: a.risk,
      confidence: a.confidence,
      description: a.description,
      solution: a.solution,
      url: a.url,
      evidence: a.evidence,
      cweid: a.cweid ? parseInt(a.cweid) : undefined,
      wascid: a.wascid ? parseInt(a.wascid) : undefined,
      count: parseInt(a.count ?? '1'),
    }));

    const issues: Issue[] = alerts
      .filter((a) => ['High', 'Medium'].includes(a.riskLevel))
      .map((a) => ({
        id: uuid(),
        runId,
        category: 'security' as const,
        severity: a.riskLevel === 'High' ? 'high' : 'medium',
        title: `Security: ${a.name}`,
        description: `${a.description}\n\nURL: ${a.url}\n${a.evidence ? `Evidence: ${a.evidence}` : ''}`,
        location: a.url,
        suggestedFix: a.solution,
        status: 'open' as const,
        createdAt: new Date(),
      }));

    const score = this.calculateSecurityScore(alerts);
    const riskLevel = this.calculateRiskLevel(alerts);

    return {
      type: 'security',
      score,
      issues,
      metadata: { targetUrl, totalAlerts: alerts.length, scannedWith: 'OWASP ZAP' },
      alerts,
      riskLevel,
      passedChecks: Math.max(0, 100 - alerts.length),
      failedChecks: alerts.length,
    };
  }

  // -----------------------------------------------------------------------
  // Passive Security Checks (no ZAP)
  // -----------------------------------------------------------------------
  private async runPassiveChecks(runId: string, url: string): Promise<SecurityResult> {
    logger.info('Running passive security checks', { runId, url });
    const alerts: SecurityAlert[] = [];
    const issues: Issue[] = [];

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
      });

      const headers = response.headers;
      const body = response.data as string;

      // Check security headers
      const missingHeaders = this.checkSecurityHeaders(headers as Record<string, string>);
      for (const missing of missingHeaders) {
        alerts.push({
          id: uuid(),
          pluginId: 'missing-header',
          alertRef: missing.id,
          name: `Missing Security Header: ${missing.header}`,
          riskLevel: missing.risk as any,
          confidence: 'High',
          description: missing.description,
          solution: missing.solution,
          url,
          count: 1,
        });
      }

      // Check for common vulnerabilities in response body
      const bodyVulns = this.checkResponseBody(body, url);
      alerts.push(...bodyVulns);

      // Check HTTPS
      if (!url.startsWith('https://')) {
        alerts.push({
          id: uuid(),
          pluginId: 'no-https',
          alertRef: 'no-https',
          name: 'Site Not Using HTTPS',
          riskLevel: 'High',
          confidence: 'High',
          description: 'The application is not using HTTPS which exposes data to interception.',
          solution: 'Configure HTTPS with a valid SSL certificate.',
          url,
          count: 1,
        });
      }

      // Convert high/medium alerts to issues
      for (const alert of alerts) {
        if (['High', 'Medium'].includes(alert.riskLevel)) {
          issues.push({
            id: uuid(),
            runId,
            category: 'security',
            severity: alert.riskLevel === 'High' ? 'high' : 'medium',
            title: `Security: ${alert.name}`,
            description: alert.description,
            location: alert.url,
            suggestedFix: alert.solution,
            status: 'open',
            createdAt: new Date(),
          });
        }
      }
    } catch (error: any) {
      logger.warn('Could not reach preview URL for passive checks', { error: error.message });
    }

    const score = this.calculateSecurityScore(alerts);

    return {
      type: 'security',
      score,
      issues,
      metadata: { targetUrl: url, scannedWith: 'Passive Checks' },
      alerts,
      riskLevel: this.calculateRiskLevel(alerts),
      passedChecks: Math.max(0, 20 - alerts.filter(a => a.riskLevel !== 'Informational').length),
      failedChecks: alerts.filter(a => a.riskLevel !== 'Informational').length,
    };
  }

  private checkSecurityHeaders(headers: Record<string, string>): Array<{
    id: string; header: string; risk: string; description: string; solution: string;
  }> {
    const checks = [
      {
        id: 'csp',
        header: 'Content-Security-Policy',
        risk: 'Medium',
        description: 'Content Security Policy is not set. This allows XSS attacks.',
        solution: "Set a Content-Security-Policy header: `Content-Security-Policy: default-src 'self'`",
      },
      {
        id: 'x-frame-options',
        header: 'X-Frame-Options',
        risk: 'Medium',
        description: 'X-Frame-Options header is not set. The site may be vulnerable to clickjacking.',
        solution: "Set the header: `X-Frame-Options: DENY`",
      },
      {
        id: 'hsts',
        header: 'Strict-Transport-Security',
        risk: 'High',
        description: 'HSTS is not set. Without it, users may be downgraded to HTTP.',
        solution: "Set: `Strict-Transport-Security: max-age=31536000; includeSubDomains`",
      },
      {
        id: 'x-content-type',
        header: 'X-Content-Type-Options',
        risk: 'Low',
        description: 'X-Content-Type-Options header is missing.',
        solution: "Set: `X-Content-Type-Options: nosniff`",
      },
      {
        id: 'referrer-policy',
        header: 'Referrer-Policy',
        risk: 'Low',
        description: 'Referrer-Policy header is not set.',
        solution: "Set: `Referrer-Policy: strict-origin-when-cross-origin`",
      },
      {
        id: 'permissions-policy',
        header: 'Permissions-Policy',
        risk: 'Low',
        description: 'Permissions-Policy header is missing.',
        solution: "Set Permissions-Policy to restrict browser feature access.",
      },
    ];

    return checks.filter(
      (check) => !headers[check.header.toLowerCase()] && !headers[check.header],
    );
  }

  private checkResponseBody(body: string, url: string): SecurityAlert[] {
    const alerts: SecurityAlert[] = [];

    // Check for exposed sensitive patterns
    const patterns = [
      {
        regex: /\b[A-Za-z0-9]{20,40}\b/g,
        name: 'Potential API Key Exposed',
        risk: 'High' as const,
        check: (match: string) => /[A-Z]/.test(match) && /[a-z]/.test(match) && /[0-9]/.test(match),
      },
      {
        regex: /<!--[\s\S]*?-->/g,
        name: 'HTML Comments May Leak Information',
        risk: 'Low' as const,
        check: (match: string) => /TODO|FIXME|password|secret|key|token/i.test(match),
      },
      {
        regex: /eval\s*\(/g,
        name: 'Use of eval() Detected',
        risk: 'Medium' as const,
        check: () => true,
      },
    ];

    for (const pattern of patterns) {
      const matches = body.match(pattern.regex) ?? [];
      const dangerous = matches.filter(pattern.check);
      if (dangerous.length > 0) {
        alerts.push({
          id: uuid(),
          pluginId: 'passive-body-check',
          alertRef: pattern.name.toLowerCase().replace(/\s/g, '-'),
          name: pattern.name,
          riskLevel: pattern.risk,
          confidence: 'Low',
          description: `Pattern detected in response body: ${dangerous[0]?.slice(0, 50)}...`,
          solution: 'Review and remove sensitive data from client-side code.',
          url,
          count: dangerous.length,
        });
      }
    }

    return alerts;
  }

  private calculateSecurityScore(alerts: SecurityAlert[]): number {
    const weights = { High: 20, Medium: 10, Low: 3, Informational: 0 };
    const penalty = alerts.reduce((sum, a) => sum + (weights[a.riskLevel] ?? 0), 0);
    return Math.max(0, 100 - penalty);
  }

  private calculateRiskLevel(alerts: SecurityAlert[]): 'low' | 'medium' | 'high' | 'critical' {
    if (alerts.some(a => a.riskLevel === 'High')) return 'high';
    if (alerts.some(a => a.riskLevel === 'Medium')) return 'medium';
    if (alerts.some(a => a.riskLevel === 'Low')) return 'low';
    return 'low';
  }

  private async checkZapAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.zapUrl}/JSON/core/view/version/`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  private async waitForCompletion(
    checkFn: () => Promise<boolean>,
    timeoutSeconds: number,
  ): Promise<void> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      if (await checkFn()) return;
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Scan timed out');
  }
}
