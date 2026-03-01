import { lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { viewerSessions } from '../db/schema.js';
import { createStorage } from '../services/storage.js';
import { logger } from '../lib/logger.js';

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function cleanExpiredWatermarks() {
  try {
    const cutoff = new Date(Date.now() - SESSION_MAX_AGE).toISOString();
    const storage = createStorage();

    // Find expired viewer sessions
    const expired = await db
      .select({ id: viewerSessions.id, linkId: viewerSessions.linkId })
      .from(viewerSessions)
      .where(lt(viewerSessions.expiresAt, cutoff))
      .all();

    if (expired.length === 0) return;

    let cleaned = 0;
    for (const session of expired) {
      const prefix = `watermarked/${session.linkId}/${session.id}/`;
      await storage.deletePrefix(prefix).catch(() => {});
      cleaned++;
    }

    if (cleaned > 0) {
      logger.info({ cleaned, total: expired.length }, 'Cleaned expired watermark session images');
    }
  } catch (error) {
    logger.error({ error }, 'Watermark cleanup failed');
  }
}

export function startWatermarkCleaner() {
  // Run once on startup after a delay, then every hour
  setTimeout(cleanExpiredWatermarks, 30_000);
  cleanupTimer = setInterval(cleanExpiredWatermarks, CLEANUP_INTERVAL);
  logger.info('Watermark cleaner started');
}

export function stopWatermarkCleaner() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  logger.info('Watermark cleaner stopped');
}
