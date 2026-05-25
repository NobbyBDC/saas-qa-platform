import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { RunsModule } from './runs/runs.module';
import { ReportsModule } from './reports/reports.module';
import { WebsocketModule } from './websocket/websocket.module';
import { PrismaModule } from './prisma/prisma.module';

// New modules
import { BillingModule } from './billing/billing.module';
import { GitHubModule } from './github/github.module';
import { AiCopilotModule } from './ai-copilot/ai-copilot.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { AuditModule } from './audit/audit.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';

import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long', ttl: 60000, limit: 300 },
    ]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: 'ioredis',
        host: config.get('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
        password: config.get('REDIS_PASSWORD'),
        ttl: 300,
      }),
    }),

    // Core
    PrismaModule,
    AuthModule,
    ProjectsModule,
    RunsModule,
    ReportsModule,
    WebsocketModule,

    // SaaS Extensions
    BillingModule,
    GitHubModule,
    AiCopilotModule,
    NotificationsModule,
    ObservabilityModule,
    AuditModule,
    ApiKeysModule,
    HealthModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
