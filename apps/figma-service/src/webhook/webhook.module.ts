import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { FigmaModule } from '../figma/figma.module';

@Module({
  imports: [FigmaModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
