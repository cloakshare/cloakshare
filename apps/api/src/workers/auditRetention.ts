import { lt, eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, organizations } from '../db/schema.js';
import { AUDIT_RETENTION_DAYS } from '@cloak/shared';
import { logger } from '../lib/logger.js';

const RETENTION_INTERVAL = 24 * 60 * 60 * 1000; // Run daily

/**
 * Delete audit log entries past their retention period.
 * Retention varies by plan: Growth = 90 days, Scale = 365 days.
 */
async function cleanupAuditLog() {
  try {
    const orgs = await db.select({ id: organizations.id, plan: organizations.plan }).from(organizations).all();

    let totalDeleted = 0;

    for (const org of orgs) {
      const days = AUDIT_RETENTION_DAYS[org.plan as keyof typeof AUDIT_RETENTION_DAYS] || 0;
      if (days === 0) {
        // Free/Starter — no audit retention, delete all
        const result = await db.delete(auditLog)
          .where(eq(auditLog.orgId, org.id))
          .returning({ id: auditLog.id });
        totalDeleted += result.length;
        continue;
      }

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const result = await db.delete(auditLog)
        .where(and(
          eq(auditLog.orgId, org.id),
          lt(auditLog.createdAt, cutoff),
        ))
        .returning({ id: auditLog.id });

      totalDeleted += result.length;
    }

    if (totalDeleted > 0) {
      logger.info({ totalDeleted }, 'Audit log retention cleanup complete');
    }
  } catch (err) {
    logger.error({ err }, 'Audit log retention cleanup failed');
  }
}

let retentionTimer: ReturnType<typeof setInterval> | null = null;

export function startAuditRetentionWorker() {
  logger.info('Audit retention worker started');
  // Run once at startup (delayed by 1 min to not compete with boot)
  setTimeout(cleanupAuditLog, 60_000);
  retentionTimer = setInterval(cleanupAuditLog, RETENTION_INTERVAL);
}

export function stopAuditRetentionWorker() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
  logger.info('Audit retention worker stopped');
}
