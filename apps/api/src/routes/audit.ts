import { Hono } from 'hono';
import { eq, and, desc, lt, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { sessionAuth } from '../middleware/session.js';
import { orgResolver } from '../middleware/orgResolver.js';
import { requirePermission } from '../middleware/permissions.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { AUDIT_RETENTION_DAYS } from '@cloak/shared';
import type { Variables } from '../lib/types.js';

const auditRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/org/audit-log — Query audit log with cursor pagination
// ============================================

auditRouter.get('/v1/org/audit-log', sessionAuth, orgResolver, requirePermission('audit.read'), async (c) => {
  const orgId = c.get('orgId');
  const org = c.get('org') as { plan: string };

  // Check plan — audit log requires Growth+
  const retentionDays = AUDIT_RETENTION_DAYS[org.plan as keyof typeof AUDIT_RETENTION_DAYS] || 0;
  if (retentionDays === 0) {
    return errorResponse(c, Errors.forbidden('Audit log requires a Growth or Scale plan'));
  }

  const cursor = c.req.query('cursor'); // ISO timestamp for cursor-based pagination
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const action = c.req.query('action');
  const actorId = c.req.query('actor_id');
  const resourceType = c.req.query('resource_type');
  const after = c.req.query('after'); // ISO date filter
  const before = c.req.query('before'); // ISO date filter

  const conditions = [eq(auditLog.orgId, orgId)];

  if (cursor) {
    conditions.push(lt(auditLog.createdAt, cursor));
  }
  if (action) {
    conditions.push(eq(auditLog.action, action));
  }
  if (actorId) {
    conditions.push(eq(auditLog.actorId, actorId));
  }
  if (resourceType) {
    conditions.push(eq(auditLog.resourceType, resourceType));
  }
  if (after) {
    conditions.push(gte(auditLog.createdAt, after));
  }
  if (before) {
    conditions.push(lt(auditLog.createdAt, before));
  }

  const entries = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1)
    .all();

  const hasMore = entries.length > limit;
  const results = entries.slice(0, limit);
  const nextCursor = hasMore ? results[results.length - 1].createdAt : null;

  return successResponse(c, {
    entries: results.map((e) => ({
      id: e.id,
      actor: {
        id: e.actorId,
        type: e.actorType,
        label: e.actorLabel,
      },
      action: e.action,
      resource: e.resourceType ? {
        type: e.resourceType,
        id: e.resourceId,
        label: e.resourceLabel,
      } : null,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      ip_address: e.ipAddress,
      created_at: e.createdAt,
    })),
    pagination: {
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

export default auditRouter;
