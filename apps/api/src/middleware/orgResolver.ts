import type { Context, Next } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { organizations, orgMembers } from '../db/schema.js';
import { Errors, errorResponse } from '../lib/errors.js';

type AnyContext = Context<any>;

/**
 * Resolves the active organization for the current request.
 *
 * For API key auth: reads orgId from the API key record.
 * For session auth: reads from X-Org-Id header or user's defaultOrgId.
 *
 * Sets: c.set('org'), c.set('orgId'), c.set('orgRole'), c.set('orgMembership')
 */
export async function orgResolver(c: AnyContext, next: Next) {
  const user = c.get('user');
  const apiKey = c.get('apiKey');

  if (!user) {
    // No authenticated user — skip org resolution (public routes)
    await next();
    return;
  }

  // Determine orgId from API key or header or default
  let orgId: string | null = null;

  if (apiKey?.orgId) {
    orgId = apiKey.orgId;
  } else {
    // Dashboard session — check X-Org-Id header first, then defaultOrgId
    const headerOrgId = c.req.header('X-Org-Id');
    orgId = headerOrgId || user.defaultOrgId || null;
  }

  if (!orgId) {
    // User has no org yet (shouldn't happen after migration, but handle gracefully)
    await next();
    return;
  }

  // Look up org and membership
  const [org, membership] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, orgId)).get(),
    db.select().from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
      .get(),
  ]);

  if (!org) {
    return errorResponse(c, Errors.notFound('Organization'));
  }

  if (!membership) {
    return errorResponse(c, Errors.forbidden('You are not a member of this organization'));
  }

  c.set('org', org);
  c.set('orgId', orgId);
  c.set('orgRole', membership.role);
  c.set('orgMembership', membership);

  await next();
}
