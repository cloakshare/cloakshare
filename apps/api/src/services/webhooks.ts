import { createHmac, timingSafeEqual } from 'crypto';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { webhookEndpoints, webhookDeliveries, links } from '../db/schema.js';
import { generateId, isPrivateUrl } from '../lib/utils.js';
import { logger } from '../lib/logger.js';
import type { WEBHOOK_EVENTS } from '@cloak/shared';

type WebhookEvent = typeof WEBHOOK_EVENTS[number];

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a webhook signature (for consumers to use).
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Dispatch a webhook event for a given link.
 * Finds all matching webhook endpoints for the link's owner and queues deliveries.
 */
export async function dispatchWebhook(
  linkId: string,
  event: WebhookEvent,
  extraPayload?: Record<string, unknown>,
) {
  // Get the link to find the owner
  const link = await db
    .select({ userId: links.userId, id: links.id, name: links.name, status: links.status })
    .from(links)
    .where(eq(links.id, linkId))
    .get();

  if (!link) return;

  // Find active webhook endpoints for this user that subscribe to this event
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.userId, link.userId),
        eq(webhookEndpoints.active, true),
      )
    )
    .all();

  // Filter to endpoints that subscribe to this event
  const matching = endpoints.filter((ep) => {
    try {
      const events = JSON.parse(ep.events) as string[];
      return events.includes(event) || events.includes('*');
    } catch {
      logger.warn({ endpointId: ep.id }, 'Invalid JSON in webhook events field');
      return false;
    }
  });

  if (matching.length === 0) return;

  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: {
      link_id: link.id,
      link_name: link.name,
      status: link.status,
      ...extraPayload,
    },
  });

  // Queue a delivery for each matching endpoint
  for (const endpoint of matching) {
    await db.insert(webhookDeliveries).values({
      id: generateId('whd'),
      endpointId: endpoint.id,
      event,
      payload,
      nextRetryAt: new Date().toISOString(),
    });
  }

  logger.info({ linkId, event, endpoints: matching.length }, 'Webhook dispatched');
}

/**
 * Process pending webhook deliveries.
 * Called by the webhook retry worker on an interval.
 */
export async function processWebhookDeliveries() {
  const now = new Date().toISOString();

  // Find deliveries ready to send
  const pending = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        isNull(webhookDeliveries.deliveredAt),
        isNull(webhookDeliveries.failedAt),
        lte(webhookDeliveries.nextRetryAt, now),
      )
    )
    .limit(10)
    .all();

  for (const delivery of pending) {
    await attemptDelivery(delivery);
  }
}

/**
 * Attempt to deliver a single webhook.
 */
async function attemptDelivery(delivery: typeof webhookDeliveries.$inferSelect) {
  const endpoint = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, delivery.endpointId))
    .get();

  if (!endpoint || !endpoint.active) {
    await db.update(webhookDeliveries)
      .set({ failedAt: new Date().toISOString() })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  // SSRF prevention: block private/internal URLs
  if (isPrivateUrl(endpoint.url)) {
    logger.warn({ endpointId: endpoint.id, url: endpoint.url }, 'Webhook blocked: private URL');
    await db.update(webhookDeliveries)
      .set({ failedAt: new Date().toISOString(), responseBody: 'Blocked: private/internal URL' })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  const signature = signPayload(delivery.payload, endpoint.secret);
  const attempts = delivery.attempts + 1;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cloak-Signature': signature,
        'X-Cloak-Event': delivery.event,
        'X-Cloak-Delivery-Id': delivery.id,
        'User-Agent': 'Cloak-Webhooks/1.0',
      },
      body: delivery.payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      // Success
      await db.update(webhookDeliveries)
        .set({
          attempts,
          statusCode: response.status,
          responseBody: responseBody.slice(0, 1000),
          deliveredAt: new Date().toISOString(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      logger.info({ deliveryId: delivery.id, endpoint: endpoint.url }, 'Webhook delivered');
    } else {
      // HTTP error — schedule retry
      await handleFailure(delivery, attempts, response.status, responseBody.slice(0, 500));
    }
  } catch (error) {
    // Network error — schedule retry
    const errorMsg = error instanceof Error ? error.message : String(error);
    await handleFailure(delivery, attempts, null, errorMsg);
  }
}

/**
 * Handle delivery failure — schedule retry with exponential backoff or mark as permanently failed.
 */
async function handleFailure(
  delivery: typeof webhookDeliveries.$inferSelect,
  attempts: number,
  statusCode: number | null,
  responseBody: string,
) {
  if (attempts >= delivery.maxAttempts) {
    // Permanently failed
    await db.update(webhookDeliveries)
      .set({
        attempts,
        statusCode,
        responseBody,
        failedAt: new Date().toISOString(),
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    logger.warn({ deliveryId: delivery.id, attempts }, 'Webhook permanently failed');
  } else {
    // Exponential backoff: 30s, 5min, 30min
    const delays = [30_000, 300_000, 1_800_000];
    const delay = delays[attempts - 1] || 1_800_000;
    const nextRetry = new Date(Date.now() + delay).toISOString();

    await db.update(webhookDeliveries)
      .set({
        attempts,
        statusCode,
        responseBody,
        nextRetryAt: nextRetry,
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    logger.info({ deliveryId: delivery.id, attempts, nextRetry }, 'Webhook retry scheduled');
  }
}
