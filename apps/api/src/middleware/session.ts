import type { Next } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { Errors, errorResponse } from '../lib/errors.js';

export async function sessionAuth(c: Context<{ Variables: Record<string, any> }>, next: Next) {
  const token = getCookie(c, 'cloak_session');
  if (!token) {
    return errorResponse(c, Errors.unauthorized('Not logged in'));
  }

  const session = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, token),
        gt(sessions.expiresAt, new Date().toISOString()),
      ),
    )
    .get();

  if (!session) {
    return errorResponse(c, Errors.unauthorized('Session expired'));
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) {
    return errorResponse(c, Errors.unauthorized('User not found'));
  }

  c.set('user', user);
  c.set('session', session);

  await next();
}
