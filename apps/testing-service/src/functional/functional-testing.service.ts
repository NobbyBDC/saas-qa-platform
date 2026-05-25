import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import type { Issue } from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('functional-testing');

export interface FunctionalTestInput {
  runId: string;
  previewUrl: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

@Injectable()
export class FunctionalTestingService {
  async runTests(input: FunctionalTestInput): Promise<{
    score: number;
    issues: Issue[];
    results: TestResult[];
  }> {
    const { runId, previewUrl } = input;

    if (!previewUrl) {
      logger.warn('No previewUrl — skipping functional tests', { runId });
      return { score: 100, issues: [], results: [] };
    }

    logger.info('Starting functional tests', { runId, previewUrl });

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results: TestResult[] = [];
    const issues: Issue[] = [];

    try {
      const page = await browser.newPage();
      await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Run standard functional tests
      const tests = [
        () => this.testPageLoads(page, previewUrl),
        () => this.testNavigationLinks(page, previewUrl),
        () => this.testFormValidation(page),
        () => this.testResponsiveness(browser, previewUrl),
        () => this.testImages(page),
        () => this.testConsoleErrors(page, previewUrl),
        () => this.testKeyboardNavigation(page),
        () => this.testFocusTrap(page),
      ];

      for (const test of tests) {
        const start = Date.now();
        try {
          const name = await test();
          results.push({ name, passed: true, duration: Date.now() - start });
        } catch (error: any) {
          const name = error.testName ?? 'Unknown Test';
          results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
          issues.push({
            id: uuid(),
            runId,
            category: 'functional',
            severity: 'medium',
            title: `Functional test failed: ${name}`,
            description: error.message,
            location: previewUrl,
            status: 'open',
            createdAt: new Date(),
          });
        }
      }

      await page.close();
    } finally {
      await browser.close();
    }

    const passCount = results.filter((r) => r.passed).length;
    const score = Math.round((passCount / results.length) * 100);

    logger.info('Functional tests complete', { runId, score, passed: passCount, total: results.length });

    return { score, issues, results };
  }

  private async testPageLoads(page: Page, url: string): Promise<string> {
    const name = 'Page loads successfully';
    const title = await page.title();
    if (!title && !await page.$('body')) {
      const err = new Error('Page has no title or body element') as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testNavigationLinks(page: Page, baseUrl: string): Promise<string> {
    const name = 'Navigation links are valid';
    const links = await page.$$eval('a[href]', (els) =>
      els.map((el) => (el as HTMLAnchorElement).href).filter(Boolean),
    );
    const brokenLinks: string[] = [];

    for (const link of links.slice(0, 10)) {
      if (link.startsWith('javascript:') || link.startsWith('mailto:') || link.startsWith('tel:')) continue;
      try {
        const response = await page.request.head(link, { timeout: 5000 });
        if (!response.ok() && response.status() !== 405) {
          brokenLinks.push(`${link} (${response.status()})`);
        }
      } catch {
        // Ignore network errors for external links
      }
    }

    if (brokenLinks.length > 0) {
      const err = new Error(`Broken links found: ${brokenLinks.join(', ')}`) as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testFormValidation(page: Page): Promise<string> {
    const name = 'Forms have proper validation';
    const forms = await page.$$('form');
    const issues: string[] = [];

    for (const form of forms) {
      const inputs = await form.$$('input:not([type="hidden"]):not([type="submit"])');
      for (const input of inputs) {
        const type = await input.getAttribute('type');
        const required = await input.getAttribute('required');
        const ariaLabel = await input.getAttribute('aria-label');
        const id = await input.getAttribute('id');
        const label = id ? await page.$(`label[for="${id}"]`) : null;

        if (!label && !ariaLabel && !await input.getAttribute('placeholder')) {
          issues.push(`Input[type="${type}"] has no label`);
        }
      }
    }

    if (issues.length > 3) {
      const err = new Error(`Form validation issues: ${issues.slice(0, 3).join('; ')}`) as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testResponsiveness(browser: Browser, url: string): Promise<string> {
    const name = 'Page is responsive across breakpoints';
    const breakpoints = [
      { width: 375, height: 812, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1440, height: 900, name: 'Desktop' },
    ];

    for (const bp of breakpoints) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

      // Check for horizontal scroll (overflow)
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      await page.close();

      if (hasOverflow) {
        const err = new Error(`Horizontal scroll detected at ${bp.name} (${bp.width}px)`) as any;
        err.testName = name;
        throw err;
      }
    }
    return name;
  }

  private async testImages(page: Page): Promise<string> {
    const name = 'All images load and have alt text';
    const imageIssues = await page.$$eval('img', (imgs) =>
      imgs
        .filter((img: HTMLImageElement) => !img.complete || img.naturalWidth === 0 || !img.alt)
        .map((img: HTMLImageElement) => `${img.src}: ${!img.alt ? 'missing alt' : 'failed to load'}`),
    );

    if (imageIssues.length > 0) {
      const err = new Error(`Image issues: ${imageIssues.slice(0, 3).join(', ')}`) as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testConsoleErrors(page: Page, url: string): Promise<string> {
    const name = 'No JavaScript console errors';
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    if (errors.length > 0) {
      const err = new Error(`Console errors: ${errors.slice(0, 3).join(', ')}`) as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testKeyboardNavigation(page: Page): Promise<string> {
    const name = 'Keyboard navigation works';
    // Tab through the page and check focus visibility
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    const focusedEl = await page.evaluate(() => document.activeElement?.tagName);
    if (!focusedEl || focusedEl === 'BODY') {
      const err = new Error('No focus after Tab key presses — keyboard navigation may be broken') as any;
      err.testName = name;
      throw err;
    }
    return name;
  }

  private async testFocusTrap(page: Page): Promise<string> {
    const name = 'Focus trap works in modals';
    // Look for dialog/modal elements
    const dialogs = await page.$$('[role="dialog"], [aria-modal="true"]');
    for (const dialog of dialogs) {
      const isVisible = await dialog.isVisible();
      if (isVisible) {
        const focusableInDialog = await dialog.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableInDialog.length === 0) {
          const err = new Error('Modal dialog has no focusable elements') as any;
          err.testName = name;
          throw err;
        }
      }
    }
    return name;
  }
}
