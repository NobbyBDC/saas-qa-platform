import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('runs') private readonly runsQueue: Queue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Service health check' })
  async check() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const db = checks[0];
    const redis = checks[1];

    const dbOk = db.status === 'fulfilled';
    const redisOk = redis.status === 'fulfilled';
    const allOk = dbOk && redisOk;

    const status = allOk ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor(process.uptime()),
      checks: {
        database: dbOk
          ? { status: 'ok', latencyMs: (db as PromiseFulfilledResult<number>).value }
          : { status: 'error', error: (db as PromiseRejectedResult).reason?.message },
        redis: redisOk
          ? { status: 'ok', latencyMs: (redis as PromiseFulfilledResult<number>).value }
          : { status: 'error', error: (redis as PromiseRejectedResult).reason?.message },
      },
    };
  }

  private async checkDatabase(): Promise<number> {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return Date.now() - start;
  }

  private async checkRedis(): Promise<number> {
    const start = Date.now();
    const client = await this.runsQueue.client;
    await (client as any).ping();
    return Date.now() - start;
  }
}
