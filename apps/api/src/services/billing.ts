import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, usageRecords } from '../db/schema.js';
import { generateId, getCurrentBillingPeriodStart } from '../lib/utils.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

// Only initialize Stripe if key is configured
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    stripe = new Stripe(config.stripe.secretKey);
  }
  return stripe;
}

// ============================================
// USAGE REPORTING (Billing Meter API — per CORRECTIONS FIX 1)
// ============================================

/**
 * Report a usage event to Stripe Billing Meter and record locally.
 * Per CORRECTIONS: Use stripe.billing.meterEvents.create(), NOT legacy Usage Records.
 */
export async function reportUsage(
  userId: string,
  type: 'link_created' | 'view_recorded',
) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return;

  // Free tier has hard limits, not metered — skip Stripe reporting
  if (user.plan === 'free') return;
  if (!user.stripeCustomerId) return;

  // Record locally for our own analytics/dashboard
  await db.insert(usageRecords).values({
    id: generateId('usage'),
    userId,
    type,
    quantity: 1,
    periodStart: getCurrentBillingPeriodStart(),
  });

  // Report to Stripe Billing Meter (real-time, up to 1000/sec)
  if (!config.stripe.secretKey) return;

  const eventName = type === 'link_created' ? 'cloak_link_created' : 'cloak_view_recorded';

  try {
    await getStripe().billing.meterEvents.create({
      event_name: eventName,
      payload: {
        value: '1',
        stripe_customer_id: user.stripeCustomerId,
      },
    });
  } catch (error) {
    // Log but don't fail — usage reporting is best-effort
    // Local records remain for reconciliation
    logger.error({ error, userId, type }, 'Failed to report usage to Stripe');
  }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Create a Stripe Checkout session for subscription.
 */
export async function createCheckoutSession(
  userId: string,
  plan: 'starter' | 'growth' | 'scale',
  annual = false,
): Promise<string> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error('User not found');

  const s = getStripe();

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({ email: user.email, metadata: { userId } });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
  }

  // Map plan to price ID (monthly or annual)
  const monthlyPriceIds: Record<string, string | undefined> = {
    starter: config.stripe.starterPriceId,
    growth: config.stripe.growthPriceId,
    scale: config.stripe.scalePriceId,
  };
  const annualPriceIds: Record<string, string | undefined> = {
    starter: config.stripe.starterAnnualPriceId,
    growth: config.stripe.growthAnnualPriceId,
    scale: config.stripe.scaleAnnualPriceId,
  };

  const priceId = annual ? (annualPriceIds[plan] || monthlyPriceIds[plan]) : monthlyPriceIds[plan];
  if (!priceId) throw new Error(`No price ID configured for plan: ${plan}`);

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.dashboardUrl}/dashboard/settings?billing=success`,
    cancel_url: `${config.dashboardUrl}/dashboard/settings?billing=cancelled`,
    metadata: { userId, plan },
  });

  return session.url!;
}

/**
 * Create a Stripe Billing Portal session for managing subscription.
 */
export async function createPortalSession(userId: string): Promise<string> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user?.stripeCustomerId) throw new Error('No Stripe customer');

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.dashboardUrl}/dashboard/settings`,
  });

  return session.url;
}

// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================

/**
 * Handle Stripe webhook events.
 */
export async function handleStripeWebhook(body: string, signature: string) {
  if (!config.stripe.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  const event = getStripe().webhooks.constructEvent(body, signature, config.stripe.webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        await db.update(users).set({
          plan,
          stripeSubscriptionId: session.subscription as string,
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, userId));
        logger.info({ userId, plan }, 'Subscription activated');
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const user = await db.select().from(users)
        .where(eq(users.stripeSubscriptionId, sub.id)).get();
      if (user) {
        const status = sub.status;
        if (status === 'canceled' || status === 'unpaid') {
          await db.update(users).set({ plan: 'free', updatedAt: new Date().toISOString() })
            .where(eq(users.id, user.id));
          logger.info({ userId: user.id }, 'Subscription cancelled, reverted to free');
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const user = await db.select().from(users)
        .where(eq(users.stripeSubscriptionId, sub.id)).get();
      if (user) {
        await db.update(users).set({
          plan: 'free',
          stripeSubscriptionId: null,
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, user.id));
        logger.info({ userId: user.id }, 'Subscription deleted');
      }
      break;
    }
  }
}
