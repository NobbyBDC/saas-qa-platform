import { Module } from '@nestjs/common';
import { AiCopilotService } from './ai-copilot.service';
import { AiCopilotController } from './ai-copilot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [AiCopilotController],
  providers: [AiCopilotService],
  exports: [AiCopilotService],
})
export class AiCopilotModule {}
