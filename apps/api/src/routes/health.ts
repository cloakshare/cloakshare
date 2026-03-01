import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { config } from '../lib/config.js';
import { createStorage } from '../services/storage.js';

const health = new Hono();

const startTime = Date.now();

health.get('/health', async (c) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};
  let healthy = true;

  // Database check
  try {
    const dbStart = Date.now();
    await db.run(sql`SELECT 1`);
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err) {
    healthy = false;
    checks.database = {
      status: 'error',
      error: err instanceof Error ? err.message : 'Database unavailable',
    };
  }

  // Storage check — verify client can be created and attempt a lightweight probe
  try {
    const storageStart = Date.now();
    const storage = createStorage();
    // Try downloading a non-existent key; a "not found" error means storage is reachable
    await storage.download('_health_probe').catch((err: Error) => {
      if (err.message?.includes('not found') || err.message?.includes('NoSuchKey') || err.message?.includes('ENOENT')) {
        return; // Storage is reachable, key just doesn't exist
      }
      throw err; // Actual connectivity issue
    });
    checks.storage = { status: 'ok', latency_ms: Date.now() - storageStart };
  } catch (err) {
    checks.storage = {
      status: 'degraded',
      error: err instanceof Error ? err.message : 'Storage probe failed',
    };
  }

  const status = healthy ? 'ok' : 'degraded';
  const statusCode = healthy ? 200 : 503;

  return c.json({
    status,
    version: config.apiVersion,
    mode: config.mode,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    timestamp: new Date().toISOString(),
  }, statusCode);
});

export default health;
