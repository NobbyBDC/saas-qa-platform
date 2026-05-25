import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

  async uploadJson(key: string, data: unknown): Promise<string> {
    const body = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      ACL: 'public-read',
    }));
    return `${this.publicUrl}/${key}`;
  }
}
