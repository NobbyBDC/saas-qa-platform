import { Injectable } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import type {
  VisualRegressionResult,
  ScreenshotComparison,
  FigmaDesignSchema,
  Issue,
} from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { StorageService } from '../storage/storage.service';
import { v4 as uuid } from 'uuid';

const logger = createLogger('visual-regression');

export interface VisualTestInput {
  runId: string;
  previewUrl: string;
  designSchema: FigmaDesignSchema;
}

@Injectable()
export class VisualRegressionService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async runTests(input: VisualTestInput): Promise<VisualRegressionResult> {
    const { runId, previewUrl, designSchema } = input;

    if (!previewUrl) {
      logger.warn('No previewUrl — skipping visual regression', { runId });
      return {
        type: 'visual_regression', score: 100, issues: [],
        metadata: { skipped: true, reason: 'No preview URL configured' },
        screenshots: [], overallMatchPercent: 100,
      };
    }

    logger.info('Starting visual regression tests', { runId, previewUrl });

    let browser: Browser | null = null;
    const comparisons: ScreenshotComparison[] = [];
    const issues: Issue[] = [];

    try {
      browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const allFrames = designSchema.pages.flatMap((p) => p.frames);

      for (const frame of allFrames) {
        const frameUrl = `${previewUrl}${this.frameToRoute(frame.name)}`;
        const figmaScreenshotKey = (frame as any)._screenshotUrl;

        if (!figmaScreenshotKey) {
          logger.warn('No Figma screenshot for frame, skipping', { frameId: frame.id });
          continue;
        }

        try {
          // Render the generated page
          const renderedBuffer = await this.captureScreenshot(browser, frameUrl, frame.width, frame.height);

          // Download Figma reference screenshot
          const figmaBuffer = await this.storage.download(figmaScreenshotKey);

          // Compare
          const { diffBuffer, matchPercent, pixelDiffCount } = await this.compareImages(
            figmaBuffer,
            renderedBuffer,
            frame.width,
            frame.height,
          );

          // Upload all screenshots
          const [figmaUrl, renderedUrl, diffUrl] = await Promise.all([
            this.storage.upload(`runs/${runId}/visual/${frame.id}-figma.png`, figmaBuffer, 'image/png'),
            this.storage.upload(`runs/${runId}/visual/${frame.id}-rendered.png`, renderedBuffer, 'image/png'),
            this.storage.upload(`runs/${runId}/visual/${frame.id}-diff.png`, diffBuffer, 'image/png'),
          ]);

          comparisons.push({
            componentId: frame.id,
            componentName: frame.name,
            figmaScreenshotUrl: figmaUrl,
            renderedScreenshotUrl: renderedUrl,
            diffScreenshotUrl: diffUrl,
            matchPercent,
            pixelDiffCount,
            width: frame.width,
            height: frame.height,
          });

          // Create issue if match is below threshold
          if (matchPercent < 90) {
            issues.push({
              id: uuid(),
              runId,
              category: 'visual',
              severity: matchPercent < 70 ? 'high' : 'medium',
              title: `Visual mismatch: ${frame.name}`,
              description: `Only ${matchPercent.toFixed(1)}% pixel match vs Figma design (threshold: 90%). ${pixelDiffCount.toLocaleString()} pixels differ.`,
              location: frameUrl,
              screenshotUrl: diffUrl,
              suggestedFix: 'Review the diff image and align CSS properties with the Figma design.',
              status: 'open',
              createdAt: new Date(),
            });
          }

          logger.info('Frame comparison complete', {
            frame: frame.name,
            matchPercent: matchPercent.toFixed(1),
            pixelDiffCount,
          });
        } catch (frameError: any) {
          logger.warn('Frame comparison failed', { frameId: frame.id, error: frameError.message });
        }
      }

      const overallMatchPercent = comparisons.length
        ? comparisons.reduce((sum, c) => sum + c.matchPercent, 0) / comparisons.length
        : 100;

      const score = Math.round(overallMatchPercent);

      return {
        type: 'visual_regression',
        score,
        issues,
        metadata: { totalFrames: allFrames.length, comparedFrames: comparisons.length },
        screenshots: comparisons,
        overallMatchPercent,
      };
    } finally {
      await browser?.close();
    }
  }

  private async captureScreenshot(
    browser: Browser,
    url: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: Math.max(width, 320), height: Math.max(height, 600) });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for fonts and images
      await page.waitForTimeout(1000);

      return await page.screenshot({ type: 'png', fullPage: false }) as Buffer;
    } finally {
      await page.close();
    }
  }

  private async compareImages(
    figmaBuffer: Buffer,
    renderedBuffer: Buffer,
    targetWidth: number,
    targetHeight: number,
  ): Promise<{ diffBuffer: Buffer; matchPercent: number; pixelDiffCount: number }> {
    // Normalize both images to same dimensions
    const normalizedFigma = await sharp(figmaBuffer)
      .resize(targetWidth, targetHeight, { fit: 'contain' })
      .png()
      .toBuffer();

    const normalizedRendered = await sharp(renderedBuffer)
      .resize(targetWidth, targetHeight, { fit: 'contain' })
      .png()
      .toBuffer();

    const img1 = PNG.sync.read(normalizedFigma);
    const img2 = PNG.sync.read(normalizedRendered);

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const pixelDiffCount = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.1,
        includeAA: false,
        alpha: 0.3,
        diffColor: [255, 0, 0],
        diffColorAlt: [0, 255, 0],
      },
    );

    const totalPixels = width * height;
    const matchPercent = ((totalPixels - pixelDiffCount) / totalPixels) * 100;
    const diffBuffer = PNG.sync.write(diff);

    return { diffBuffer, matchPercent, pixelDiffCount };
  }

  private frameToRoute(frameName: string): string {
    const name = frameName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (['home', 'index', 'landing', 'main'].includes(name)) return '/';
    return `/${name}`;
  }
}
