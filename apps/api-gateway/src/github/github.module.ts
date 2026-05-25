import { Module } from '@nestjs/common';
import { GitHubService } from './github.service';
import { GitHubController } from './github.controller';
import { GitHubWebhookController } from './github-webhook.controller';
import { GitHubOAuthService } from './github-oauth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [GitHubController, GitHubWebhookController],
  providers: [GitHubService, GitHubOAuthService],
  exports: [GitHubService],
})
export class GitHubModule {}
