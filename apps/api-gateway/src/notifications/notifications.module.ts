import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { SlackService } from './slack.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService, SlackService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
