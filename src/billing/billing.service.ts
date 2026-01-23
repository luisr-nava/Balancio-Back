import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import Stripe from 'stripe';
import { RawBodyRequest } from './types/raw-body-request';
import { Subscription as SubscriptionEntity } from './entities/subscription.entity';

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null;
};


// TODO: Change process.env.STRIPE_*** for envs
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

  async getSubscriptionByOwner(ownerId: string) {
    return this.subscriptionRepository.findOne({
      where: { ownerId },
    });
  }

  async hasActiveSubscription(ownerId: string): Promise<boolean> {
    const subscription = await this.getSubscriptionByOwner(ownerId);

    return (
      subscription?.status === SubscriptionStatus.ACTIVE &&
      (!subscription.currentPeriodEnd ||
        subscription.currentPeriodEnd > new Date())
    );
  }

  async handleWebhook(req: RawBodyRequest) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const signature = req.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body, // ✔️ ahora TS sabe que es Buffer
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error('❌ Stripe webhook signature failed:', err.message);
      }
      throw new BadRequestException('Invalid Stripe signature');
    }

    switch (event.type as string) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'invoice.payment.paid':
        await this.handleInvoicePaymentPaid(event);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;

      default:
        // console.log('⚠️ Evento ignorado:', event.type);
        break;
    }

    return { received: true };
  }

  async createCheckoutSession(ownerId: string, plan: 'BASIC' | 'PRO') {
    const existing = await this.getSubscriptionByOwner(ownerId);

    if (existing && existing.plan !== 'FREE') {
      throw new BadRequestException('Ya tenés una suscripción activa');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const priceId =
      plan === 'BASIC'
        ? process.env.STRIPE_PRICE_BASIC!
        : process.env.STRIPE_PRICE_PRO!;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/billing/success`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
      metadata: { ownerId, plan },
    });

    return { url: session.url };
  }

  private toDateFromUnix(timestamp?: number): Date | undefined {
    return timestamp ? new Date(timestamp * 1000) : undefined;
  }

  private async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!session.subscription || !session.customer) return;

    const ownerId = session.metadata?.ownerId;
    if (!ownerId) return;

    const existing = await this.subscriptionRepository.findOne({
      where: { ownerId },
    });

    if (existing) {
      await this.subscriptionRepository.update(
        { ownerId },
        {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        },
      );
    } else {
      await this.subscriptionRepository.insert({
        ownerId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        status: SubscriptionStatus.INCOMPLETE,
        plan: 'FREE',
      });
    }
  }

  private async handleSubscriptionCreated(event: Stripe.Event) {
    const sub = event.data.object as StripeSubscriptionWithPeriod;

    const updateData: Partial<SubscriptionEntity> = {
      status: sub.status as SubscriptionStatus,
    };

    if (sub.current_period_end) {
      updateData.currentPeriodEnd = new Date(sub.current_period_end * 1000);
    }

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: sub.id },
      updateData,
    );
  }

  private async handleSubscriptionUpdated(event: Stripe.Event) {
    const sub = event.data.object as StripeSubscriptionWithPeriod;

    const updateData: Partial<SubscriptionEntity> = {
      status: sub.status as SubscriptionStatus,
    };

    if (sub.current_period_end) {
      updateData.currentPeriodEnd = new Date(sub.current_period_end * 1000);
    }

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: sub.id },
      updateData,
    );
  }

  private resolvePlanFromSubscription(
    sub: Stripe.Subscription,
  ): 'BASIC' | 'PRO' {
    const priceId = sub.items.data[0].price.id;

    if (priceId === process.env.STRIPE_PRICE_BASIC) return 'BASIC';
    if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO';

    throw new Error(`Unknown Stripe price: ${priceId}`);
  }

  private async handleInvoicePaymentPaid(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | null;
      lines: { data: { period?: { end?: number } }[] };
    };

    if (!invoice.subscription) return;

    const subscriptionEntity = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: invoice.subscription },
    });

    if (!subscriptionEntity) {
      return;
    }
    if (!subscriptionEntity) return;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const stripeSubscription = await stripe.subscriptions.retrieve(
      invoice.subscription,
    );

    const priceId = stripeSubscription.items.data[0]?.price.id;

    const periodEnd = invoice.lines.data[0]?.period?.end;

    const updateData: Partial<SubscriptionEntity> = {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : subscriptionEntity.currentPeriodEnd,
    };

    if (subscriptionEntity.plan === 'FREE') {
      if (priceId === process.env.STRIPE_PRICE_BASIC) {
        updateData.plan = 'BASIC';
      }

      if (priceId === process.env.STRIPE_PRICE_PRO) {
        updateData.plan = 'PRO';
      }
    }

    if (
      subscriptionEntity.pendingPlan &&
      subscriptionEntity.pendingPlan !== subscriptionEntity.plan
    ) {
      updateData.plan = subscriptionEntity.pendingPlan;
      updateData.pendingPlan = undefined;
    }

    await this.subscriptionRepository.update(
      { id: subscriptionEntity.id },
      updateData,
    );
  }

  private async handleSubscriptionDeleted(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription;

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: sub.id },
      {
        status: SubscriptionStatus.CANCELED,
        plan: 'FREE',
        pendingPlan: undefined,
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        currentPeriodEnd: undefined,
      },
    );
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | null;
    };

    if (!invoice.subscription) return;

    await this.subscriptionRepository.update(
      { stripeSubscriptionId: invoice.subscription },
      {
        status: SubscriptionStatus.PAST_DUE,
      },
    );
  }

  async requestPlanChange(ownerId: string, plan: 'BASIC' | 'PRO' | 'FREE') {
    const subscription = await this.getSubscriptionByOwner(ownerId);

    if (!subscription) {
      throw new BadRequestException('Suscripción no encontrada');
    }

    if (subscription.plan === 'FREE') {
      throw new BadRequestException(
        'Los usuarios FREE deben pasar por checkout',
      );
    }

    if (subscription.plan === plan) {
      throw new BadRequestException('Ya tenés este plan activo');
    }

    if (plan === 'FREE') {
      throw new BadRequestException(
        'Para pasar a FREE debés cancelar la suscripción',
      );
    }

    await this.subscriptionRepository.update(
      { id: subscription.id },
      { pendingPlan: plan },
    );

    return {
      message: `El cambio a ${plan} se aplicará al finalizar el período`,
      effectiveAt: subscription.currentPeriodEnd,
    };
  }

  async cancelSubscription(ownerId: string) {
    const subscription = await this.getSubscriptionByOwner(ownerId);

    if (!subscription) {
      throw new BadRequestException('Suscripción no encontrada');
    }

    if (subscription.plan === 'FREE') {
      throw new BadRequestException('No tenés una suscripción activa');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        'No existe una suscripción activa en Stripe',
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // 🔥 Cancela en Stripe al final del período
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // 🧼 LIMPIEZA INMEDIATA DE INTENCIÓN
    await this.subscriptionRepository.update(
      { id: subscription.id },
      {
        pendingPlan: null as any,
      },
    );

    return {
      message: 'La suscripción se cancelará al finalizar el período',
      effectiveAt: subscription.currentPeriodEnd,
    };
  }
}
