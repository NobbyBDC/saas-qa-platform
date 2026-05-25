import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_PRICE_IDS: Record<string, string> = {
  PRO: process.env.STRIPE_PRICE_PRO ?? '',
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
};

const PLAN_LIMITS: Record<string, { projectsLimit: number; runsPerMonth: number; storageGb: number; apiAccessEnabled: boolean; ssoEnabled: boolean }> = {
  FREE: { projectsLimit: 3, runsPerMonth: 50, storageGb: 1, apiAccessEnabled: false, ssoEnabled: false },
  PRO: { projectsLimit: 25, runsPerMonth: 1000, storageGb: 50, apiAccessEnabled: true, ssoEnabled: false },
  ENTERPRISE: { projectsLimit: -1, runsPerMonth: -1, storageGb: 500, apiAccessEnabled: true, ssoEnabled: true },
};

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY', 'sk_test_placeholder'), {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }

  async getOrCreateCustomer(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    if (org.stripeCustomerId) return org.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: org.billingEmail ?? undefined,
      name: org.name,
      metadata: { organizationId },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(organizationId: string, plan: 'PRO' | 'ENTERPRISE', successUrl: string, cancelUrl: string) {
    const customerId = await this.getOrCreateCustomer(organizationId);
    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) throw new BadRequestException(`No price configured for plan: ${plan}`);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: plan === 'PRO' ? 14 : undefined,
        metadata: { organizationId, plan },
      },
      metadata: { organizationId, plan },
    });

    this.logger.log(`Checkout session created for org ${organizationId} → plan ${plan}`);
    return { url: session.url, sessionId: session.id };
  }

  async createBillingPortalSession(organizationId: string, returnUrl: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    if (!org.stripeCustomerId) throw new BadRequestException('No billing account found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async getSubscriptionStatus(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const usage = await this.getCurrentPeriodUsage(organizationId);
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    return {
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      limits: PLAN_LIMITS[org.plan],
      usage,
      invoices: invoices.map(inv => ({
        id: inv.id,
        amount: inv.amount / 100,
        currency: inv.currency,
        status: inv.status,
        pdfUrl: inv.pdfUrl,
        hostedUrl: inv.hostedUrl,
        period: { start: inv.periodStart, end: inv.periodEnd },
        paidAt: inv.paidAt,
      })),
    };
  }

  async getCurrentPeriodUsage(organizationId: string) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [runs, apiCalls, storageRecords] = await Promise.all([
      this.prisma.usageRecord.aggregate({
        where: { organizationId, metricType: 'runs', billingPeriod: period },
        _sum: { quantity: true },
      }),
      this.prisma.usageRecord.aggregate({
        where: { organizationId, metricType: 'api_calls', billingPeriod: period },
        _sum: { quantity: true },
      }),
      this.prisma.usageRecord.aggregate({
        where: { organizationId, metricType: 'storage_bytes', billingPeriod: period },
        _sum: { quantity: true },
      }),
    ]);

    return {
      runs: runs._sum.quantity ?? 0,
      apiCalls: apiCalls._sum.quantity ?? 0,
      storageMb: Math.round((storageRecords._sum.quantity ?? 0) / 1024 / 1024),
      period,
    };
  }

  async recordUsage(organizationId: string, metricType: string, quantity: number, projectId?: string) {
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await this.prisma.usageRecord.create({
      data: { organizationId, projectId, metricType, quantity, billingPeriod },
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    this.logger.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { organizationId, plan } = session.metadata ?? {};
    if (!organizationId || !plan) return;

    const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);
    await this.applyPlanToOrg(organizationId, plan, subscription.id, subscription.status);

    this.logger.log(`Org ${organizationId} upgraded to ${plan}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const { organizationId, plan } = subscription.metadata;
    if (!organizationId) return;
    await this.applyPlanToOrg(organizationId, plan, subscription.id, subscription.status);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { organizationId } = subscription.metadata;
    if (!organizationId) return;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'FREE',
        planStatus: 'canceled',
        stripeSubscriptionId: null,
        ...PLAN_LIMITS.FREE,
      },
    });

    this.logger.log(`Org ${organizationId} downgraded to FREE (subscription canceled)`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    if (!invoice.customer) return;
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });
    if (!org) return;

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        organizationId: org.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'PAID',
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        pdfUrl: invoice.invoice_pdf ?? undefined,
        hostedUrl: invoice.hosted_invoice_url ?? undefined,
        paidAt: new Date(),
      },
      update: {
        status: 'PAID',
        paidAt: new Date(),
        pdfUrl: invoice.invoice_pdf ?? undefined,
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    if (!invoice.customer) return;
    const org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });
    if (!org) return;

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { planStatus: 'past_due' },
    });

    this.logger.warn(`Payment failed for org ${org.id}`);
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription) {
    this.logger.log(`Trial ending soon for subscription ${subscription.id}`);
  }

  private async applyPlanToOrg(
    organizationId: string,
    plan: string,
    subscriptionId: string,
    subscriptionStatus: string,
  ) {
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
    const planStatus = subscriptionStatus === 'trialing' ? 'trialing' : 'active';

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: plan as any,
        planStatus,
        stripeSubscriptionId: subscriptionId,
        ...limits,
      },
    });
  }
}
