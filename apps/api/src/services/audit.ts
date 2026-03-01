import type { Context } from 'hono';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { generateId, getClientIp } from '../lib/utils.js';
import { logger } from '../lib/logger.js';

interface AuditEntry {
  orgId: string;
  actorId: string;
  actorType?: 'user' | 'api_key' | 'system';
  actorLabel: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event. Fire-and-forget — errors are logged but don't propagate.
 */
export function logAudit(entry: AuditEntry): void {
  try {
    db.insert(auditLog)
      .values({
        id: generateId('aud'),
        orgId: entry.orgId,
        actorId: entry.actorId,
        actorType: entry.actorType || 'user',
        actorLabel: entry.actorLabel,
        action: entry.action,
        resourceType: entry.resourceType || null,
        resourceId: entry.resourceId || null,
        resourceLabel: entry.resourceLabel || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      })
      .run();
  } catch (err) {
    logger.error({ err, action: entry.action }, 'Failed to write audit log');
  }
}

/**
 * Extract actor info from a Hono context for audit logging.
 */
export function auditorFromContext(c: Context<any>): {
  actorId: string;
  actorType: 'user' | 'api_key';
  actorLabel: string;
  orgId: string;
  ipAddress: string;
  userAgent: string;
} {
  const user = c.get('user') as { id: string; email: string } | undefined;
  const apiKey = c.get('apiKey') as { id: string; keyPrefix: string } | undefined;
  const orgId = (c.get('orgId') as string) || '';

  let actorId = 'unknown';
  let actorType: 'user' | 'api_key' = 'user';
  let actorLabel = 'unknown';

  if (apiKey) {
    actorId = apiKey.id;
    actorType = 'api_key';
    actorLabel = apiKey.keyPrefix;
  } else if (user) {
    actorId = user.id;
    actorType = 'user';
    actorLabel = user.email;
  }

  return {
    actorId,
    actorType,
    actorLabel,
    orgId,
    ipAddress: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('user-agent') || '',
  };
}
