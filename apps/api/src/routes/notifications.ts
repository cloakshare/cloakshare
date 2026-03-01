import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { sessionAuth } from '../middleware/session.js';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { generateId } from '../lib/utils.js';
import { successResponse, errorResponse, Errors } from '../lib/errors.js';
import type { Variables } from '../lib/types.js';

const notificationsRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/notifications — List notifications
// ============================================

notificationsRouter.get('/v1/notifications', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const unreadOnly = c.req.query('unread') === 'true';
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [eq(notifications.userId, user.id)];
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  const [result, totalResult, unreadResult] = await Promise.all([
    db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db.select({ count: count() })
      .from(notifications)
      .where(and(...conditions))
      .get(),
    db.select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))
      .get(),
  ]);

  const total = totalResult?.count ?? 0;

  return successResponse(c, {
    notifications: result.map((n) => ({
      id: n.id,
      type: n.type,
      link_id: n.linkId,
      link_name: n.linkName,
      message: n.message,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      read: n.read,
      created_at: n.createdAt,
    })),
    unread_count: unreadResult?.count ?? 0,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

// ============================================
// POST /v1/notifications/read — Mark notifications as read
// ============================================

notificationsRouter.post('/v1/notifications/read', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const { ids, all } = await c.req.json();

  if (all) {
    // Mark all unread notifications as read
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.userId, user.id),
        eq(notifications.read, false),
      ));

    return successResponse(c, { marked_read: 'all' });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(c, Errors.validation('ids array or all=true is required'));
  }

  // Mark specific notifications as read
  for (const id of ids) {
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, user.id),
      ));
  }

  return successResponse(c, { marked_read: ids.length });
});

// ============================================
// GET /v1/notifications/stream — SSE real-time notifications
// ============================================

notificationsRouter.get('/v1/notifications/stream', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };

  return streamSSE(c, async (stream) => {
    const SSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes max
    const POLL_MS = 2000; // Poll every 2 seconds
    const startTime = Date.now();
    let lastSeenId = '';

    // Send initial heartbeat
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ status: 'connected', user_id: user.id }),
    });

    while (Date.now() - startTime < SSE_TIMEOUT) {
      // Fetch new unread notifications
      const conditions = [
        eq(notifications.userId, user.id),
        eq(notifications.read, false),
      ];

      const newNotifications = await db.select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(10)
        .all();

      // Only send notifications we haven't sent yet
      for (const n of newNotifications) {
        if (n.id !== lastSeenId && (!lastSeenId || n.createdAt! > lastSeenId)) {
          await stream.writeSSE({
            event: 'notification',
            data: JSON.stringify({
              id: n.id,
              type: n.type,
              link_id: n.linkId,
              link_name: n.linkName,
              message: n.message,
              metadata: n.metadata ? JSON.parse(n.metadata) : null,
              created_at: n.createdAt,
            }),
          });
        }
      }

      if (newNotifications.length > 0) {
        lastSeenId = newNotifications[0].id;
      }

      await stream.sleep(POLL_MS);
    }

    await stream.writeSSE({
      event: 'timeout',
      data: JSON.stringify({ status: 'timeout', message: 'Stream timed out, please reconnect' }),
    });
  });
});

// ============================================
// Helper: Create a notification (used by other services)
// ============================================

export async function createNotification(params: {
  userId: string;
  orgId?: string;
  type: string;
  linkId?: string;
  linkName?: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(notifications).values({
    id: generateId('ntf'),
    userId: params.userId,
    orgId: params.orgId || null,
    type: params.type,
    linkId: params.linkId || null,
    linkName: params.linkName || null,
    message: params.message,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}

export default notificationsRouter;
