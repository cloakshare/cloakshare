import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { webhookEndpoints, webhookDeliveries } from '../db/schema.js';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { generateId, generateToken, isPrivateUrl } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { WEBHOOK_EVENTS } from '@cloak/shared';
import type { Variables } from '../lib/types.js';

const webhooksRouter = new Hono<{ Variables: Variables }>();

// ============================================
// POST /v1/webhooks — Create a webhook endpoint
// ============================================

webhooksRouter.post('/v1/webhooks', apiKeyAuth, rateLimiter('default'), async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const { url, events } = await c.req.json();

  if (!url || !events || !Array.isArray(events)) {
    return errorResponse(c, Errors.validation('url and events[] are required'));
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return errorResponse(c, Errors.validation('Invalid webhook URL'));
  }

  // SSRF check — block private/internal URLs
  if (isPrivateUrl(url)) {
    return errorResponse(c, Errors.validation('Webhook URL must not point to a private or internal address'));
  }

  // Validate events
  const validEvents = [...WEBHOOK_EVENTS, '*'] as string[];
  const invalid = events.filter((e: string) => !validEvents.includes(e));
  if (invalid.length > 0) {
    return errorResponse(c, Errors.validation(`Invalid events: ${invalid.join(', ')}`));
  }

  const secret = generateToken(32);
  const endpointId = generateId('wh');

  await db.insert(webhookEndpoints).values({
    id: endpointId,
    userId: user.id,
    orgId: orgId || null,
    url,
    secret,
    events: JSON.stringify(events),
  });

  return successResponse(c, {
    id: endpointId,
    url,
    events,
    secret, // Only shown once at creation
    active: true,
    created_at: new Date().toISOString(),
  }, 201);
});

// ============================================
// GET /v1/webhooks — List webhook endpoints
// ============================================

webhooksRouter.get('/v1/webhooks', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;

  const ownerCondition = orgId ? eq(webhookEndpoints.orgId, orgId) : eq(webhookEndpoints.userId, user.id);
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(ownerCondition)
    .all();

  return successResponse(c, {
    webhooks: endpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      events: JSON.parse(ep.events),
      active: ep.active,
      created_at: ep.createdAt,
    })),
  });
});

// ============================================
// GET /v1/webhooks/:id — Get webhook details with recent deliveries
// ============================================

webhooksRouter.get('/v1/webhooks/:id', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const endpointId = c.req.param('id');

  const ownerCondition = orgId ? eq(webhookEndpoints.orgId, orgId) : eq(webhookEndpoints.userId, user.id);
  const endpoint = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), ownerCondition))
    .get();

  if (!endpoint) {
    return errorResponse(c, Errors.notFound('Webhook endpoint'));
  }

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.endpointId, endpointId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20)
    .all();

  return successResponse(c, {
    id: endpoint.id,
    url: endpoint.url,
    events: JSON.parse(endpoint.events),
    active: endpoint.active,
    created_at: endpoint.createdAt,
    recent_deliveries: deliveries.map((d) => ({
      id: d.id,
      event: d.event,
      status_code: d.statusCode,
      attempts: d.attempts,
      delivered_at: d.deliveredAt,
      failed_at: d.failedAt,
      created_at: d.createdAt,
    })),
  });
});

// ============================================
// DELETE /v1/webhooks/:id — Delete a webhook endpoint
// ============================================

webhooksRouter.delete('/v1/webhooks/:id', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const endpointId = c.req.param('id');

  const ownerCondition = orgId ? eq(webhookEndpoints.orgId, orgId) : eq(webhookEndpoints.userId, user.id);
  const endpoint = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), ownerCondition))
    .get();

  if (!endpoint) {
    return errorResponse(c, Errors.notFound('Webhook endpoint'));
  }

  // Deactivate instead of hard delete (preserves delivery history)
  await db.update(webhookEndpoints)
    .set({ active: false })
    .where(eq(webhookEndpoints.id, endpointId));

  return successResponse(c, { id: endpointId, deleted: true });
});

export default webhooksRouter;
