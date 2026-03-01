import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { sessionAuth } from '../middleware/session.js';
import { createCheckoutSession, createPortalSession, handleStripeWebhook } from '../services/billing.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../lib/types.js';

const billingRouter = new Hono<{ Variables: Variables }>();

// ============================================
// POST /v1/billing/checkout — Create Stripe Checkout session
// ============================================

billingRouter.post('/v1/billing/checkout', sessionAuth, async (c) => {
  if (!config.features.billing) {
    return errorResponse(c, Errors.validation('Billing is not enabled in self-hosted mode'));
  }

  const user = c.get('user') as { id: string; plan: string };
  const { plan, annual } = await c.req.json();

  if (!plan || !['starter', 'growth', 'scale'].includes(plan)) {
    return errorResponse(c, Errors.validation('Invalid plan. Must be starter, growth, or scale'));
  }

  if (user.plan === plan) {
    return errorResponse(c, Errors.validation('You are already on this plan'));
  }

  try {
    const url = await createCheckoutSession(user.id, plan, annual === true);
    return successResponse(c, { checkout_url: url });
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Failed to create checkout session');
    return errorResponse(c, Errors.internal('Failed to create checkout session'));
  }
});

// ============================================
// POST /v1/billing/portal — Create Stripe Billing Portal session
// ============================================

billingRouter.post('/v1/billing/portal', sessionAuth, async (c) => {
  if (!config.features.billing) {
    return errorResponse(c, Errors.validation('Billing is not enabled in self-hosted mode'));
  }

  const user = c.get('user') as { id: string };

  try {
    const url = await createPortalSession(user.id);
    return successResponse(c, { portal_url: url });
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Failed to create portal session');
    return errorResponse(c, Errors.validation('No active subscription to manage'));
  }
});

// ============================================
// PUT /v1/billing/spending-cap — Set spending cap
// ============================================

billingRouter.put('/v1/billing/spending-cap', sessionAuth, async (c) => {
  const user = c.get('user') as { id: string; plan: string };
  const { cap_cents } = await c.req.json();

  // null or 0 means remove cap
  const spendingCap = cap_cents && cap_cents > 0 ? Math.round(cap_cents) : null;

  await db.update(users).set({ spendingCap }).where(eq(users.id, user.id));

  return successResponse(c, {
    spending_cap_cents: spendingCap,
    spending_cap_display: spendingCap ? `$${(spendingCap / 100).toFixed(2)}` : null,
  });
});

// ============================================
// POST /v1/billing/webhook — Stripe webhook handler
// ============================================

billingRouter.post('/v1/billing/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return errorResponse(c, Errors.validation('Missing Stripe signature header'));
  }

  try {
    const body = await c.req.text();
    await handleStripeWebhook(body, signature);
    return successResponse(c, { received: true });
  } catch (error) {
    logger.error({ error }, 'Stripe webhook failed');
    return errorResponse(c, Errors.validation('Webhook processing failed'));
  }
});

export default billingRouter;
