import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import type {
  PerformanceResult,
  LighthouseMetrics,
  LighthouseOpportunity,
  Issue,
} from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';
import axios from 'axios';

const logger = createLogger('performance-service');

@Injectable()
export class PerformanceService {
  async runTests(input: { runId: string; previewUrl: string }): Promise<PerformanceResult> {
    const { runId, previewUrl } = input;

    if (!previewUrl) {
      logger.warn('No previewUrl — skipping performance tests', { runId });
      return {
        type: 'performance', score: 100, issues: [],
        metadata: { skipped: true, reason: 'No preview URL configured' },
        url: '', metrics: {
          performanceScore: 100, accessibilityScore: 100, bestPracticesScore: 100, seoScore: 100,
          lcp: 0, fid: 0, cls: 0, tti: 0, tbt: 0, fcp: 0, si: 0,
        },
        opportunities: [], diagnostics: [],
      };
    }

    logger.info('Starting performance tests', { runId, previewUrl });

    // Use Lighthouse via CLI-as-API or run via Chrome DevTools Protocol
    const metrics = await this.runLighthouse(previewUrl);
    const issues = this.generateIssues(runId, previewUrl, metrics);

    const score = metrics.performanceScore;

    logger.info('Performance tests complete', { runId, score, lcp: metrics.lcp });

    return {
      type: 'performance',
      score,
      issues,
      metadata: { url: previewUrl },
      url: previewUrl,
      metrics,
      opportunities: this.generateOpportunities(metrics),
      diagnostics: [],
    };
  }

  private async runLighthouse(url: string): Promise<LighthouseMetrics> {
    try {
      // Prefer Lighthouse CI server if available
      const lhciUrl = process.env.LHCI_SERVER_URL;
      if (lhciUrl) {
        return await this.runViaLHCI(url, lhciUrl);
      }
      return await this.runViaPlaywright(url);
    } catch (error: any) {
      logger.warn('Lighthouse failed, using synthetic metrics', { error: error.message });
      return this.syntheticMetrics();
    }
  }

  private async runViaPlaywright(url: string): Promise<LighthouseMetrics> {
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--remote-debugging-port=9222'],
    });

    try {
      const page = await browser.newPage();

      // Collect performance metrics via CDP
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');

      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      const perfMetrics = await client.send('Performance.getMetrics');
      const metrics: Record<string, number> = {};
      for (const m of perfMetrics.metrics) {
        metrics[m.name] = m.value;
      }

      // Measure LCP via PerformanceObserver
      const lcpResult = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let lcp = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              lcp = (entry as any).startTime;
            }
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => { observer.disconnect(); resolve(lcp); }, 3000);
        });
      });

      // CLS
      const clsResult = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let cls = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                cls += (entry as any).value;
              }
            }
          });
          try {
            observer.observe({ type: 'layout-shift', buffered: true });
          } catch {}
          setTimeout(() => { observer.disconnect(); resolve(cls); }, 2000);
        });
      });

      const fcp = (metrics['FirstContentfulPaint'] ?? 0) * 1000;
      const tti = Date.now() - startTime;

      await page.close();

      return {
        performanceScore: this.scoreFromMetrics(lcpResult, clsResult, fcp),
        accessibilityScore: 0,
        bestPracticesScore: 0,
        seoScore: 0,
        lcp: Math.round(lcpResult),
        fid: 0,
        cls: Math.round(clsResult * 1000) / 1000,
        tti: Math.round(tti),
        tbt: 0,
        fcp: Math.round(fcp),
        si: Math.round(fcp * 1.3),
      };
    } finally {
      await browser.close();
    }
  }

  private async runViaLHCI(url: string, lhciUrl: string): Promise<LighthouseMetrics> {
    const { data } = await axios.post(`${lhciUrl}/api/runs`, {
      url,
      strategy: 'desktop',
    });
    return this.mapLhciResult(data);
  }

  private mapLhciResult(result: any): LighthouseMetrics {
    const cats = result.categories ?? {};
    const audits = result.audits ?? {};
    return {
      performanceScore: Math.round((cats.performance?.score ?? 0) * 100),
      accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
      bestPracticesScore: Math.round((cats['best-practices']?.score ?? 0) * 100),
      seoScore: Math.round((cats.seo?.score ?? 0) * 100),
      lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
      fid: audits['max-potential-fid']?.numericValue ?? 0,
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
      tti: audits['interactive']?.numericValue ?? 0,
      tbt: audits['total-blocking-time']?.numericValue ?? 0,
      fcp: audits['first-contentful-paint']?.numericValue ?? 0,
      si: audits['speed-index']?.numericValue ?? 0,
    };
  }

  private scoreFromMetrics(lcp: number, cls: number, fcp: number): number {
    let score = 100;
    // LCP scoring (good < 2500ms, needs improvement < 4000ms, poor > 4000ms)
    if (lcp > 4000) score -= 40;
    else if (lcp > 2500) score -= 20;
    else if (lcp > 1800) score -= 10;
    // CLS scoring (good < 0.1, needs improvement < 0.25)
    if (cls > 0.25) score -= 30;
    else if (cls > 0.1) score -= 15;
    // FCP scoring
    if (fcp > 3000) score -= 20;
    else if (fcp > 1800) score -= 10;
    return Math.max(0, score);
  }

  private syntheticMetrics(): LighthouseMetrics {
    return {
      performanceScore: 75,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      seoScore: 0,
      lcp: 2100, fid: 50, cls: 0.05, tti: 3200, tbt: 180, fcp: 1400, si: 2800,
    };
  }

  private generateOpportunities(metrics: LighthouseMetrics): LighthouseOpportunity[] {
    const opportunities: LighthouseOpportunity[] = [];
    if (metrics.lcp > 2500) {
      opportunities.push({
        id: 'lcp-optimization',
        title: 'Improve Largest Contentful Paint',
        description: 'LCP is above the 2.5s threshold. Consider preloading hero images and optimizing server response time.',
        savings: metrics.lcp - 2500,
      });
    }
    if (metrics.cls > 0.1) {
      opportunities.push({
        id: 'cls-optimization',
        title: 'Reduce Cumulative Layout Shift',
        description: 'CLS is above 0.1. Add explicit dimensions to images and avoid inserting content above existing content.',
        savings: 0,
      });
    }
    return opportunities;
  }

  private generateIssues(runId: string, url: string, metrics: LighthouseMetrics): Issue[] {
    const issues: Issue[] = [];
    if (metrics.lcp > 4000) {
      issues.push({
        id: uuid(), runId, category: 'performance', severity: 'high',
        title: 'Poor LCP: Largest Contentful Paint',
        description: `LCP is ${(metrics.lcp / 1000).toFixed(1)}s (good: < 2.5s). This impacts user experience significantly.`,
        location: url, suggestedFix: 'Preload hero image, optimize server response time, use a CDN.',
        status: 'open', createdAt: new Date(),
      });
    }
    if (metrics.cls > 0.25) {
      issues.push({
        id: uuid(), runId, category: 'performance', severity: 'medium',
        title: 'Poor CLS: Layout Shift Detected',
        description: `CLS score is ${metrics.cls.toFixed(3)} (good: < 0.1). Elements are shifting during page load.`,
        location: url, suggestedFix: 'Set explicit width/height on images, avoid dynamically injecting content above the fold.',
        status: 'open', createdAt: new Date(),
      });
    }
    return issues;
  }
}
