import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FigmaModule } from './figma/figma.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FigmaModule,
    WebhookModule,
  ],
})
export class AppModule {}
