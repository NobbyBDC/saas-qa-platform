import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { injectAxe } from 'axe-playwright';
import type { AccessibilityResult, AxeViolation, Issue } from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('accessibility-service');

export interface A11yTestInput {
  runId: string;
  previewUrl: string;
}

@Injectable()
export class AccessibilityService {
  async runTests(input: A11yTestInput): Promise<AccessibilityResult> {
    const { runId, previewUrl } = input;

    if (!previewUrl) {
      logger.warn('No previewUrl — skipping accessibility tests', { runId });
      return {
        type: 'accessibility', score: 100, issues: [],
        metadata: { skipped: true, reason: 'No preview URL configured' },
        violations: [], passes: 0, incomplete: 0, wcagLevel: 'AA',
      };
    }

    logger.info('Starting accessibility tests', { runId, previewUrl });

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const allViolations: AxeViolation[] = [];
    const issues: Issue[] = [];
    let passes = 0;
    let incomplete = 0;

    try {
      const page = await browser.newPage();
      await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await injectAxe(page);

      // page.evaluate gives us the full AxeResults object (violations, passes, incomplete)
      const results = await page.evaluate(async () => {
        return (window as any).axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
          },
          reporter: 'v2',
        });
      });

      passes = results.passes?.length ?? 0;
      incomplete = results.incomplete?.length ?? 0;

      for (const violation of results.violations ?? []) {
        const axeViolation: AxeViolation = {
          id: violation.id,
          impact: violation.impact as any,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((n: any) => ({
            html: n.html,
            target: n.target,
            failureSummary: n.failureSummary ?? '',
          })),
          wcagCriteria: violation.tags.filter((t: string) => t.startsWith('wcag')),
        };
        allViolations.push(axeViolation);

        issues.push({
          id: uuid(),
          runId,
          category: 'accessibility',
          severity: violation.impact === 'critical' ? 'critical'
            : violation.impact === 'serious' ? 'high'
            : violation.impact === 'moderate' ? 'medium'
            : 'low',
          title: `A11y: ${violation.help}`,
          description: `${violation.description}\n\nAffects ${violation.nodes.length} element(s). WCAG: ${axeViolation.wcagCriteria.join(', ')}`,
          location: previewUrl,
          suggestedFix: violation.nodes[0]?.failureSummary,
          status: 'open',
          createdAt: new Date(),
        });
      }

      await page.close();
    } finally {
      await browser.close();
    }

    const score = this.calculateA11yScore(allViolations, passes);

    logger.info('Accessibility tests complete', {
      runId,
      violations: allViolations.length,
      passes,
      score,
    });

    return {
      type: 'accessibility',
      score,
      issues,
      metadata: { url: previewUrl, rulesChecked: passes + allViolations.length + incomplete },
      violations: allViolations,
      passes,
      incomplete,
      wcagLevel: score >= 90 ? 'AA' : score >= 70 ? 'A' : 'A',
    };
  }

  private calculateA11yScore(violations: AxeViolation[], passes: number): number {
    if (violations.length === 0) return 100;

    const weights = { critical: 25, serious: 15, moderate: 8, minor: 3 };
    const penalty = violations.reduce(
      (sum, v) => sum + (weights[v.impact] ?? 5) * Math.min(v.nodes.length, 5),
      0,
    );

    const total = passes + violations.length;
    const ratio = passes / total;
    const penaltyScore = Math.max(0, 100 - penalty);

    return Math.round(penaltyScore * 0.6 + ratio * 100 * 0.4);
  }
}
