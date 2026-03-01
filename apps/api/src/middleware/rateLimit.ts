import type { Context, Next } from 'hono';
import { getClientIp } from '../lib/utils.js';
import { Errors, errorResponse } from '../lib/errors.js';
import { RATE_LIMITS } from '@cloak/shared';

const isTest = !!process.env.VITEST;

type AnyContext = Context<any>;

// ============================================
// SLIDING WINDOW RATE LIMITER
// ============================================

// Two-window weighted average: estimated = previous × (1 - elapsed/window) + current
// More accurate than fixed-window, no burst at boundary edges.
interface WindowEntry {
  previous: number;
  current: number;
  windowStart: number; // ms timestamp of current window start
}

const rateLimitStore = new Map<string, WindowEntry>();

// Clean up stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    // If two full windows have passed, the entry is irrelevant
    if (now - entry.windowStart > 120_000) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

const WINDOW_SIZE = 60_000; // 1-minute window

function getEstimatedCount(key: string): { estimated: number; entry: WindowEntry } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = { previous: 0, current: 0, windowStart: now };
    rateLimitStore.set(key, entry);
    return { estimated: 0, entry };
  }

  const elapsed = now - entry.windowStart;

  // Rolled into next window
  if (elapsed >= WINDOW_SIZE) {
    entry.previous = entry.current;
    entry.current = 0;
    entry.windowStart = now;
  }

  const elapsedFraction = (now - entry.windowStart) / WINDOW_SIZE;
  const estimated = entry.previous * (1 - elapsedFraction) + entry.current;

  return { estimated, entry };
}

// ============================================
// IP-BASED RATE LIMITER (for viewer/public routes)
// ============================================

interface RateLimitOptions {
  max: number;
  window: number; // seconds
  keyFn?: (c: AnyContext) => string;
}

export function rateLimitByIp(options: RateLimitOptions) {
  return async (c: AnyContext, next: Next) => {
    if (isTest) { await next(); return; }
    const key = options.keyFn
      ? options.keyFn(c)
      : `rl:ip:${getClientIp(c.req.raw.headers)}`;

    const { estimated, entry } = getEstimatedCount(key);

    c.header('X-RateLimit-Limit', String(options.max));

    if (estimated >= options.max) {
      const retryAfter = Math.ceil((entry.windowStart + WINDOW_SIZE - Date.now()) / 1000);
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + WINDOW_SIZE) / 1000)));
      c.header('Retry-After', String(retryAfter));
      return errorResponse(c, Errors.rateLimited());
    }

    entry.current++;
    c.header('X-RateLimit-Remaining', String(Math.max(0, Math.floor(options.max - estimated - 1))));
    c.header('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + WINDOW_SIZE) / 1000)));
    await next();
  };
}

// ============================================
// ORG-BASED RATE LIMITER (for API routes)
// ============================================

type RateLimitCategory = 'default' | 'upload' | 'analytics';

/**
 * Rate limiter factory that reads org plan from context.
 * Uses sliding window counter per org+category.
 */
export function rateLimiter(category: RateLimitCategory) {
  return async (c: AnyContext, next: Next) => {
    if (isTest) { await next(); return; }
    const org = c.get('org') as { id: string; plan: string } | undefined;
    const user = c.get('user') as { id: string; plan?: string } | undefined;

    // Determine plan and key
    const plan = (org?.plan || user?.plan || 'free') as keyof typeof RATE_LIMITS;
    const keyId = org?.id || user?.id || getClientIp(c.req.raw.headers);
    const key = `rl:org:${keyId}:${category}`;

    const limits = RATE_LIMITS[plan] || RATE_LIMITS.free;
    const max = limits[category];

    const { estimated, entry } = getEstimatedCount(key);

    c.header('X-RateLimit-Limit', String(max));

    if (estimated >= max) {
      const retryAfter = Math.ceil((entry.windowStart + WINDOW_SIZE - Date.now()) / 1000);
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + WINDOW_SIZE) / 1000)));
      c.header('Retry-After', String(retryAfter));
      return errorResponse(c, Errors.rateLimited(
        `Rate limit exceeded. Your ${plan} plan allows ${max} ${category} requests per minute. ` +
        'Upgrade your plan for higher limits.',
        retryAfter,
      ));
    }

    entry.current++;
    c.header('X-RateLimit-Remaining', String(Math.max(0, Math.floor(max - estimated - 1))));
    c.header('X-RateLimit-Reset', String(Math.ceil((entry.windowStart + WINDOW_SIZE) / 1000)));
    await next();
  };
}
