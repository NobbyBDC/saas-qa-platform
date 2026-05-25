import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from '@qa-platform/shared-utils/logger';

const logger = createLogger('storage-service');

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get('S3_BUCKET', 'qa-platform');
    this.publicUrl = config.get('S3_PUBLIC_URL', 'http://localhost:9000/qa-platform');

    this.s3 = new S3Client({
      endpoint: config.get('S3_ENDPOINT', 'http://localhost:9000'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: config.get('S3_SECRET_KEY', 'minioadmin'),
      },
      region: 'us-east-1',
      forcePathStyle: true,
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
      }));
      const url = `${this.publicUrl}/${key}`;
      logger.info('Uploaded file', { key, url });
      return url;
    } catch (error: any) {
      logger.error('S3 upload failed', { key, error: error.message });
      throw error;
    }
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async uploadJson(key: string, data: unknown): Promise<string> {
    const body = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    return this.upload(key, body, 'application/json');
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }
}
