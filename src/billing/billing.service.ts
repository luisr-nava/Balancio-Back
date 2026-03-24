import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import Stripe from 'stripe';
import { RawBodyRequest } from './types/raw-body-request';
import { Subscription as SubscriptionEntity } from './entities/subscription.entity';
import { envs } from '@/config';

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

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
    const stripe = new Stripe(envs.stripeSecretKey!);

    const signature = req.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        envs.stripeWebhookSecret!,
      );
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(`❌ Stripe webhook signature failed: ${err.message}`);
      }
      throw new BadRequestException('Invalid Stripe signature');
    }

    this.logger.log(`📨 Webhook recibido: ${event.type} [${event.id}]`);

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
        await this.handleInvoicePaymentPaid(event);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;

      default:
        this.logger.debug(`⚠️ Evento ignorado: ${event.type}`);
        break;
    }

    return { received: true };
  }

  async createCheckoutSession(ownerId: string, plan: 'BASIC' | 'PRO') {
    const existing = await this.getSubscriptionByOwner(ownerId);

    // Block if Stripe subscription already exists (even if plan is still FREE
    // in DB, e.g. during the webhook race between checkout.session.completed
    // and invoice.paid). Without this guard, a second checkout session would
    // create a duplicate active subscription in Stripe.
    if (existing?.stripeSubscriptionId) {
      throw new BadRequestException('Ya tenés una suscripción activa');
    }

    if (existing && existing.plan !== 'FREE') {
      throw new BadRequestException('Ya tenés una suscripción activa');
    }

    const stripe = new Stripe(envs.stripeSecretKey!);

    const priceId =
      plan === 'BASIC'
        ? envs.stripePriceBasic!
        : envs.stripePricePro!;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Metadata on the session is used by checkout.session.completed.
      metadata: { ownerId, plan },
      // Metadata on subscription_data propagates to the Stripe Subscription
      // object itself, enabling fallback lookups in invoice.paid when the
      // checkout.session.completed webhook hasn't been processed yet.
      subscription_data: {
        metadata: { ownerId, plan },
      },
      success_url: `${process.env.FRONTEND_URL}/billing/success`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
    });

    return { url: session.url };
  }

  private async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;

    this.logger.log(
      `🛒 checkout.session.completed | session=${session.id} | sub=${session.subscription} | customer=${session.customer} | ownerId=${session.metadata?.ownerId}`,
    );

    if (!session.subscription || !session.customer) {
      this.logger.warn('checkout.session.completed: falta subscription o customer, ignorando');
      return;
    }

    const ownerId = session.metadata?.ownerId;
    if (!ownerId) {
      this.logger.warn('checkout.session.completed: falta metadata.ownerId, ignorando');
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer.id;

    const existing = await this.subscriptionRepository.findOne({
      where: { ownerId },
    });

    if (existing) {
      await this.subscriptionRepository.update(
        { ownerId },
        { stripeCustomerId, stripeSubscriptionId },
      );
      this.logger.log(`✅ checkout.session.completed: updated subscription row for ownerId=${ownerId}`);
    } else {
      await this.subscriptionRepository.insert({
        ownerId,
        stripeCustomerId,
        stripeSubscriptionId,
        status: SubscriptionStatus.INCOMPLETE,
        plan: 'FREE',
      });
      this.logger.log(`✅ checkout.session.completed: inserted new subscription row for ownerId=${ownerId}`);
    }
  }

  private async handleSubscriptionCreated(event: Stripe.Event) {
    const sub = event.data.object as StripeSubscriptionWithPeriod;

    this.logger.log(
      `📋 customer.subscription.created | sub=${sub.id} | status=${sub.status}`,
    );

    const updateData: DeepPartial<SubscriptionEntity> = {
      status: sub.status as SubscriptionStatus,
    };

    if (sub.current_period_end) {
      updateData.currentPeriodEnd = new Date(sub.current_period_end * 1000);
    }

    const result = await this.subscriptionRepository.update(
      { stripeSubscriptionId: sub.id },
      updateData,
    );

    if (result.affected === 0) {
      this.logger.warn(
        `customer.subscription.created: no row found for stripeSubscriptionId=${sub.id} — checkout.session.completed may not have arrived yet`,
      );
    }
  }

  private async handleSubscriptionUpdated(event: Stripe.Event) {
    const sub = event.data.object as StripeSubscriptionWithPeriod;

    this.logger.log(
      `🔄 customer.subscription.updated | sub=${sub.id} | status=${sub.status}`,
    );

    const updateData: DeepPartial<SubscriptionEntity> = {
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

    if (priceId === envs.stripePriceBasic) return 'BASIC';
    if (priceId === envs.stripePricePro) return 'PRO';

    throw new Error(`Unknown Stripe price: ${priceId}`);
  }

  /**
   * Finds the local subscription entity using a multi-step fallback strategy,
   * then backfills any missing Stripe IDs.
   *
   * Fallback chain:
   *   1. stripeSubscriptionId  (fast path — normal case)
   *   2. stripeCustomerId      (if checkout.session.completed saved it but not sub id)
   *   3. ownerId from Stripe subscription metadata (if row was never created yet)
   */
  private async findSubscriptionForInvoice(
    stripeSubscriptionId: string,
    stripeCustomerId: string | null | undefined,
    stripe: Stripe,
  ): Promise<SubscriptionEntity | null> {
    // ── 1. Primary: match by stripeSubscriptionId ────────────────────────────
    let entity = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });

    if (entity) {
      this.logger.log(`🔍 [1] Encontrada por stripeSubscriptionId=${stripeSubscriptionId}`);
      return entity;
    }

    this.logger.warn(
      `🔍 [1] No encontrada por stripeSubscriptionId=${stripeSubscriptionId} — intentando fallbacks`,
    );

    // ── 2. Fallback: match by stripeCustomerId ───────────────────────────────
    if (stripeCustomerId) {
      entity = await this.subscriptionRepository.findOne({
        where: { stripeCustomerId },
      });

      if (entity) {
        this.logger.log(`🔍 [2] Encontrada por stripeCustomerId=${stripeCustomerId} — backfilling stripeSubscriptionId`);
        await this.subscriptionRepository.update(
          { id: entity.id },
          { stripeSubscriptionId },
        );
        entity.stripeSubscriptionId = stripeSubscriptionId;
        return entity;
      }

      this.logger.warn(`🔍 [2] No encontrada por stripeCustomerId=${stripeCustomerId}`);
    }

    // ── 3. Fallback: retrieve Stripe subscription and read ownerId from metadata ─
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const ownerId = stripeSub.metadata?.ownerId;

      this.logger.log(
        `🔍 [3] Stripe sub metadata: ownerId=${ownerId ?? 'null'} | customer=${stripeSub.customer}`,
      );

      if (ownerId) {
        entity = await this.subscriptionRepository.findOne({
          where: { ownerId },
        });

        if (entity) {
          this.logger.log(`🔍 [3] Encontrada por ownerId=${ownerId} — backfilling stripeSubscriptionId + stripeCustomerId`);
          const customerId =
            typeof stripeSub.customer === 'string'
              ? stripeSub.customer
              : stripeSub.customer.id;

          await this.subscriptionRepository.update(
            { id: entity.id },
            { stripeSubscriptionId, stripeCustomerId: customerId },
          );
          entity.stripeSubscriptionId = stripeSubscriptionId;
          entity.stripeCustomerId = customerId;
          return entity;
        }

        this.logger.warn(`🔍 [3] No encontrada por ownerId=${ownerId} — inserting new row`);

        // Row doesn't exist yet (invoice.paid arrived before checkout.session.completed)
        // Create the row now so the plan can be saved, and checkout.session.completed
        // will find it and only update stripeCustomerId/stripeSubscriptionId later.
        const customerId =
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : stripeSub.customer.id;

        const inserted = this.subscriptionRepository.create({
          ownerId,
          stripeSubscriptionId,
          stripeCustomerId: customerId,
          status: SubscriptionStatus.INCOMPLETE,
          plan: 'FREE',
        });

        const saved = await this.subscriptionRepository.save(inserted);
        this.logger.log(`🔍 [3] Row creado (ownerId=${ownerId})`);
        return saved;
      }
    } catch (err) {
      this.logger.error(
        `🔍 [3] Error al recuperar Stripe subscription ${stripeSubscriptionId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    this.logger.error(
      `❌ No se pudo encontrar la suscripción en DB para stripeSubscriptionId=${stripeSubscriptionId}`,
    );
    return null;
  }

  private async handleInvoicePaymentPaid(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | null;
      customer?: string | null;
      lines: { data: { period?: { end?: number } }[] };
    };

    this.logger.log(
      `💰 invoice.paid | invoice=${invoice.id} | sub=${invoice.subscription} | customer=${invoice.customer}`,
    );

    if (!invoice.subscription) {
      this.logger.warn('invoice.paid: sin subscription id (factura de pago único), ignorando');
      return;
    }

    const stripe = new Stripe(envs.stripeSecretKey!);

    const subscriptionEntity = await this.findSubscriptionForInvoice(
      invoice.subscription,
      invoice.customer,
      stripe,
    );

    if (!subscriptionEntity) return;

    // Retrieve Stripe subscription to get the priceId as the source of truth
    const stripeSubscription = await stripe.subscriptions.retrieve(
      invoice.subscription,
    );

    const priceId = stripeSubscription.items.data[0]?.price.id;
    const periodEnd = invoice.lines.data[0]?.period?.end;

    this.logger.log(
      `💰 invoice.paid | priceId=${priceId} | STRIPE_PRICE_BASIC=${envs.stripePriceBasic} | STRIPE_PRICE_PRO=${envs.stripePricePro}`,
    );

    const updateData: DeepPartial<SubscriptionEntity> = {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: periodEnd
        ? new Date(periodEnd * 1000)
        : subscriptionEntity.currentPeriodEnd,
      pendingPlan: undefined,
    };

    // The plan is always derived from the priceId Stripe actually charged —
    // never from internal pendingPlan — so DB stays in sync with Stripe billing.
    if (priceId === envs.stripePriceBasic) {
      updateData.plan = 'BASIC';
      this.logger.log('💰 invoice.paid: plan → BASIC');
    } else if (priceId === envs.stripePricePro) {
      updateData.plan = 'PRO';
      this.logger.log('💰 invoice.paid: plan → PRO');
    } else {
      this.logger.warn(
        `💰 invoice.paid: priceId "${priceId}" no coincide con BASIC ni PRO — plan no actualizado`,
      );
    }

    await this.subscriptionRepository.save({
      id: subscriptionEntity.id,
      ...updateData,
    });

    this.logger.log(
      `✅ invoice.paid: suscripción ${subscriptionEntity.id} actualizada | plan=${updateData.plan} | status=active`,
    );
  }

  private async handleSubscriptionDeleted(event: Stripe.Event) {
    const sub = event.data.object as Stripe.Subscription;

    this.logger.log(`🗑️ customer.subscription.deleted | sub=${sub.id}`);

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

    this.logger.warn(`❌ invoice.payment_failed | invoice=${invoice.id} | sub=${invoice.subscription}`);

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

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException(
        'No existe una suscripción activa en Stripe',
      );
    }

    const stripe = new Stripe(envs.stripeSecretKey!);

    // Retrieve the current Stripe subscription to get the subscription item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId,
    );

    const currentItemId = stripeSubscription.items.data[0]?.id;
    if (!currentItemId) {
      throw new BadRequestException('No se encontró el item de suscripción en Stripe');
    }

    const newPriceId =
      plan === 'BASIC'
        ? envs.stripePriceBasic!
        : envs.stripePricePro!;

    // Update the price in Stripe so the next billing cycle charges the correct
    // amount. proration_behavior: 'none' applies the change at period end
    // without generating an immediate invoice.
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: currentItemId, price: newPriceId }],
      proration_behavior: 'none',
    });

    // Track the pending plan in DB — confirmed when invoice.paid fires
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

    const stripe = new Stripe(envs.stripeSecretKey!);

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

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
