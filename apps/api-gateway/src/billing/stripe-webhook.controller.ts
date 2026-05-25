import { Controller, Post, Req, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { Request } from 'express';

@ApiTags('billing')
@Controller('billing/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly billing: BillingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    // req.rawBody is attached via middleware in main.ts
    const rawBody = (req as any).rawBody as Buffer;
    if (!rawBody) {
      this.logger.error('Raw body not available on webhook request');
      return { received: false };
    }
    return this.billing.handleWebhook(rawBody, signature);
  }
}
