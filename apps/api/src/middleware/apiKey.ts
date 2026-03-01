import type { Next } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { apiKeys, users } from '../db/schema.js';
import { sha256 } from '../lib/utils.js';
import { Errors, errorResponse } from '../lib/errors.js';

export async function apiKeyAuth(c: Context<{ Variables: Record<string, any> }>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ck_')) {
    return errorResponse(c, Errors.unauthorized());
  }

  const key = header.replace('Bearer ', '');
  const keyHash = sha256(key);

  const apiKey = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .get();

  if (!apiKey || apiKey.revokedAt) {
    return errorResponse(c, Errors.unauthorized());
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, apiKey.userId))
    .get();

  if (!user) {
    return errorResponse(c, Errors.unauthorized());
  }

  // Update last used (fire and forget)
  try {
    db.update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, apiKey.id))
      .run();
  } catch {
    // Non-critical — don't block auth on lastUsedAt tracking failures
  }

  // Attach user and API key to context
  c.set('user', user);
  c.set('apiKey', apiKey);

  await next();
}
