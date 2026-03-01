import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { views, viewerSessions, links } from '../db/schema.js';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { successResponse, errorResponse, Errors } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../lib/types.js';

const gdprRouter = new Hono<{ Variables: Variables }>();

// ============================================
// DELETE /v1/viewers/:email — GDPR data deletion
// ============================================

gdprRouter.delete('/v1/viewers/:email', apiKeyAuth, async (c) => {
  const email = decodeURIComponent(c.req.param('email'));
  const user = c.get('user') as { id: string };

  if (!email || !email.includes('@')) {
    return errorResponse(c, Errors.validation('Valid email address is required'));
  }

  // Only delete data for links owned by this user's org (or user directly)
  const orgId = c.get('orgId') as string | undefined;
  const ownerCondition = orgId ? eq(links.orgId, orgId) : eq(links.userId, user.id);
  const userLinks = await db.select({ id: links.id }).from(links)
    .where(ownerCondition).all();
  const userLinkIds = userLinks.map((l) => l.id);

  if (userLinkIds.length === 0) {
    return successResponse(c, { email, deleted: { views: 0, sessions: 0 }, message: 'No data found' });
  }

  // Delete view records for this email scoped to the user's links
  const deletedViews = await db.delete(views)
    .where(and(eq(views.viewerEmail, email), inArray(views.linkId, userLinkIds)))
    .returning({ id: views.id });

  // Delete viewer sessions for this email scoped to the user's links
  const deletedSessions = await db.delete(viewerSessions)
    .where(and(eq(viewerSessions.viewerEmail, email), inArray(viewerSessions.linkId, userLinkIds)))
    .returning({ id: viewerSessions.id });

  logger.info({
    email,
    deletedViews: deletedViews.length,
    deletedSessions: deletedSessions.length,
  }, 'GDPR data deletion completed');

  return successResponse(c, {
    email,
    deleted: {
      views: deletedViews.length,
      sessions: deletedSessions.length,
    },
    message: `All data for ${email} has been deleted`,
  });
});

export default gdprRouter;
