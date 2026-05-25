import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createLogger } from '@qa-platform/shared-utils/logger';

const logger = createLogger('figma-screenshotter');

@Injectable()
export class FigmaScreenshotter {
  constructor(private readonly config: ConfigService) {}

  /**
   * Capture PNG screenshots of Figma frames via the Figma Images API.
   * Returns a map of frameId → Buffer.
   */
  async captureFrames(
    fileId: string,
    token: string,
    frameIds: string[],
  ): Promise<Record<string, Buffer>> {
    if (!frameIds.length) return {};

    logger.info('Capturing Figma frame screenshots', { fileId, count: frameIds.length });

    // Figma Images API supports up to 50 IDs per request
    const results: Record<string, Buffer> = {};
    const chunks = this.chunkArray(frameIds, 50);

    for (const chunk of chunks) {
      try {
        // Request high-res PNG exports from Figma API
        const { data } = await axios.get(
          `https://api.figma.com/v1/images/${fileId}`,
          {
            headers: { 'X-Figma-Token': token },
            params: {
              ids: chunk.join(','),
              format: 'png',
              scale: 2,  // 2x for retina
            },
          },
        );

        const imageUrls: Record<string, string> = data.images ?? {};

        // Download each image
        await Promise.all(
          Object.entries(imageUrls).map(async ([id, url]) => {
            if (!url) return;
            try {
              const response = await axios.get(url, { responseType: 'arraybuffer' });
              results[id] = Buffer.from(response.data);
            } catch (error: any) {
              logger.warn('Failed to download frame image', { id, error: error.message });
            }
          }),
        );
      } catch (error: any) {
        logger.error('Failed to fetch frame images from Figma', { error: error.message });
      }
    }

    logger.info('Screenshot capture complete', {
      requested: frameIds.length,
      captured: Object.keys(results).length,
    });

    return results;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
