import { Controller, Post, Headers, Body, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { FigmaService } from '../figma/figma.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly figmaService: FigmaService,
    private readonly config: ConfigService,
  ) {}

  @Post('figma')
  async handleFigmaWebhook(
    @Body() body: any,
    @Headers('x-figma-signature') signature: string,
  ) {
    // Verify HMAC signature
    const secret = this.config.get('FIGMA_WEBHOOK_SECRET');
    if (secret) {
      const expected = createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
      if (signature !== `sha256=${expected}`) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const { event_type, file_key } = body;
    await this.figmaService.handleFileUpdate(file_key, event_type);

    return { received: true };
  }
}
