import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  FigmaDesignSchema,
  FigmaPage,
  FigmaFrame,
  FigmaNode,
  DesignTokens,
  ColorToken,
  TypographyToken,
  SpacingToken,
} from '@qa-platform/shared-types';
import { FigmaParser } from './figma.parser';
import { FigmaScreenshotter } from './figma.screenshotter';
import { StorageService } from './storage.service';
import { createLogger } from '@qa-platform/shared-utils/logger';

const logger = createLogger('figma-service');

export interface ParseFigmaDto {
  runId: string;
  figmaUrl: string;
  figmaFileId: string;
  figmaToken?: string;
}

@Injectable()
export class FigmaService {
  private readonly figmaClient: AxiosInstance;

  constructor(
    private readonly config: ConfigService,
    private readonly parser: FigmaParser,
    private readonly screenshotter: FigmaScreenshotter,
    private readonly storage: StorageService,
  ) {
    this.figmaClient = axios.create({
      baseURL: 'https://api.figma.com/v1',
    });
  }

  async parseFile(dto: ParseFigmaDto): Promise<FigmaDesignSchema> {
    const token = dto.figmaToken ?? this.config.get('FIGMA_API_BASE_TOKEN');
    if (!token) throw new BadRequestException('Figma API token is required');

    logger.info('Parsing Figma file', { fileId: dto.figmaFileId, runId: dto.runId });

    // Fetch sequentially to stay within Figma's rate limits
    const fileData = await this.fetchFile(dto.figmaFileId, token);

    const imagesData = await this.fetchImages(dto.figmaFileId, token).catch((e: any) => {
      logger.warn('fetchImages failed (non-fatal)', { error: e.message });
      return { images: {} };
    });

    const componentsData = await this.fetchComponents(dto.figmaFileId, token).catch((e: any) => {
      logger.warn('fetchComponents failed (non-fatal)', { error: e.message });
      return { meta: { components: [] } };
    });

    // Parse into our schema
    const schema = this.parser.parseFileToSchema(fileData, imagesData, componentsData);

    // Take screenshots of each frame for visual regression (best-effort)
    const frameIds = schema.pages.flatMap(p => p.frames).map(f => f.id);
    let screenshots: Record<string, Buffer> = {};
    try {
      screenshots = await this.screenshotter.captureFrames(dto.figmaFileId, token, frameIds);
    } catch (e: any) {
      logger.warn('Screenshot capture failed (non-fatal)', { error: e.message });
    }

    // Upload screenshots to S3 (best-effort — never let storage failure kill the parse)
    for (const [frameId, imageBuffer] of Object.entries(screenshots)) {
      try {
        const url = await this.storage.upload(
          `runs/${dto.runId}/figma-screenshots/${frameId}.png`,
          imageBuffer,
          'image/png',
        );
        logger.info('Uploaded Figma screenshot', { frameId, url });
      } catch (e: any) {
        logger.warn('Screenshot upload failed (non-fatal)', { frameId, error: e.message });
      }
    }

    schema.pages = schema.pages.map(page => ({
      ...page,
      frames: page.frames.map(frame => ({
        ...frame,
        _screenshotUrl: screenshots[frame.id]
          ? `runs/${dto.runId}/figma-screenshots/${frame.id}.png`
          : undefined,
      } as any)),
    }));

    logger.info('Figma parse complete', {
      fileId: dto.figmaFileId,
      pages: schema.pages.length,
      components: schema.components.length,
      tokens: {
        colors: schema.designTokens.colors.length,
        typography: schema.designTokens.typography.length,
      },
    });

    return schema;
  }

  // Simple in-memory cache: key → { data, expiresAt }
  private readonly cache = new Map<string, { data: any; expiresAt: number }>();

  private cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      logger.info('Figma cache hit', { key });
      return Promise.resolve(hit.data as T);
    }
    return fn().then(data => {
      this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
      return data;
    });
  }

  private async figmaGet(path: string, token: string, timeout = 30000): Promise<any> {
    const maxRetries = 2;
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data } = await this.figmaClient.get(path, {
          headers: { 'X-Figma-Token': token },
          timeout,
        });
        return data;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        if (status === 429 || status === 503) {
          // Cap wait at 15s regardless of Retry-After — long waits must fail fast
          const wait = Math.min(3000 * (attempt + 1), 15000);
          logger.warn(`Figma API ${status} on ${path} — waiting ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw error;
        }
      }
    }
    // Surface a clear message instead of raw axios error
    const status = lastError?.response?.status;
    if (status === 429) {
      throw new BadRequestException(
        'Figma API rate limit exceeded. Please wait a few minutes before running again, or use a different Figma token.',
      );
    }
    throw lastError;
  }

  async fetchFile(fileId: string, token: string) {
    return this.cached(`file:${fileId}`, 15 * 60 * 1000, () =>
      this.figmaGet(`/files/${fileId}`, token, 30000),
    );
  }

  async fetchImages(fileId: string, token: string) {
    return this.cached(`images:${fileId}`, 15 * 60 * 1000, () =>
      this.figmaGet(`/files/${fileId}/images`, token, 15000),
    );
  }

  async fetchComponents(fileId: string, token: string) {
    return this.cached(`components:${fileId}`, 15 * 60 * 1000, () =>
      this.figmaGet(`/files/${fileId}/components`, token, 15000),
    );
  }

  async fetchVariables(fileId: string, token: string) {
    try {
      const { data } = await this.figmaClient.get(`/files/${fileId}/variables/local`, {
        headers: { 'X-Figma-Token': token },
      });
      return data;
    } catch {
      // Variables API requires specific plan, gracefully degrade
      return null;
    }
  }

  // Webhook handler: called when Figma file changes
  async handleFileUpdate(fileId: string, eventType: string) {
    logger.info('Figma file updated', { fileId, eventType });
    // Notify API gateway to trigger a new run
    try {
      await axios.post(`${this.config.get('API_GATEWAY_URL')}/api/v1/webhooks/figma`, {
        figmaFileId: fileId,
        event: eventType,
      });
    } catch (error: any) {
      logger.error('Failed to notify API gateway of Figma update', { error: error.message });
    }
  }
}
