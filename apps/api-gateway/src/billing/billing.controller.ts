import {
  Controller, Get, Post, Body, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current plan, usage, and invoices' })
  getStatus(@Req() req: any) {
    return this.billing.getSubscriptionStatus(req.user.orgId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe checkout session for plan upgrade' })
  createCheckout(
    @Req() req: any,
    @Body() body: { plan: 'PRO' | 'ENTERPRISE'; successUrl: string; cancelUrl: string },
  ) {
    return this.billing.createCheckoutSession(
      req.user.orgId,
      body.plan,
      body.successUrl,
      body.cancelUrl,
    );
  }

  @Post('portal')
  @ApiOperation({ summary: 'Create Stripe billing portal session' })
  createPortal(@Req() req: any, @Body() body: { returnUrl: string }) {
    return this.billing.createBillingPortalSession(req.user.orgId, body.returnUrl);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current billing period usage' })
  getUsage(@Req() req: any) {
    return this.billing.getCurrentPeriodUsage(req.user.orgId);
  }
}
