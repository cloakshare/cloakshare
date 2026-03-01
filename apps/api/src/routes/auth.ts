import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';
import { users, apiKeys, sessions, organizations, orgMembers } from '../db/schema.js';
import { generateId, generateToken, sha256 } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { sessionAuth } from '../middleware/session.js';
import { logger } from '../lib/logger.js';
import { logAudit, auditorFromContext } from '../services/audit.js';
import { API_KEY_LIVE_PREFIX, API_KEY_TEST_PREFIX } from '@cloak/shared';
import { randomBytes } from 'crypto';
import type { Variables } from '../lib/types.js';

const auth = new Hono<{ Variables: Variables }>();

// ============================================
// REGISTRATION
// ============================================

auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();

  if (!email || !password) {
    return errorResponse(c, Errors.validation('Email and password are required'));
  }

  if (password.length < 8) {
    return errorResponse(c, Errors.validation('Password must be at least 8 characters'));
  }

  // Check if email is taken
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (existing) {
    return errorResponse(c, Errors.validation('An account with this email already exists'));
  }

  const userId = generateId('usr');
  const passwordHash = await bcrypt.hash(password, 12);

  // Create personal org
  const orgId = generateId('org');
  const emailLocal = email.toLowerCase().split('@')[0].replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  let slug = emailLocal;
  // Handle slug collision
  const existingSlug = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).get();
  if (existingSlug) {
    slug = `${emailLocal}-${userId.slice(-4)}`;
  }

  // Create a default API key
  const keyRaw = `${API_KEY_LIVE_PREFIX}${randomBytes(16).toString('hex')}`;
  const keyHash = sha256(keyRaw);
  const keyPrefix = keyRaw.slice(0, 12) + '...';

  // Wrap all inserts in a transaction for atomicity
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      defaultOrgId: orgId,
    });

    await tx.insert(organizations).values({
      id: orgId,
      name: name || email.split('@')[0],
      slug,
      plan: 'free',
    });

    await tx.insert(orgMembers).values({
      id: generateId('mem'),
      orgId,
      userId,
      role: 'owner',
    });

    await tx.insert(apiKeys).values({
      id: generateId('key'),
      userId,
      orgId,
      name: 'Default',
      keyHash,
      keyPrefix,
    });
  });

  // Create session — store hash of token, send raw token as cookie
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.insert(sessions).values({
    id: generateId('ses'),
    userId,
    token: sha256(sessionToken),
    expiresAt,
  });

  setCookie(c, 'cloak_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  logger.info({ userId, email: email.toLowerCase() }, 'User registered');

  return successResponse(c, {
    user: {
      id: userId,
      email: email.toLowerCase(),
      name: name || null,
      plan: 'free',
      default_org_id: orgId,
    },
    api_key: keyRaw, // Only shown once
  }, 201);
});

// ============================================
// LOGIN
// ============================================

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return errorResponse(c, Errors.validation('Email and password are required'));
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();

  if (!user) {
    return errorResponse(c, Errors.unauthorized('Invalid email or password'));
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return errorResponse(c, Errors.unauthorized('Invalid email or password'));
  }

  // Session rotation: invalidate all existing sessions for this user
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  // Create new session — store hash of token, send raw token as cookie
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.insert(sessions).values({
    id: generateId('ses'),
    userId: user.id,
    token: sha256(sessionToken),
    expiresAt,
  });

  setCookie(c, 'cloak_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  logger.info({ userId: user.id }, 'User logged in');

  return successResponse(c, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    },
  });
});

// ============================================
// LOGOUT
// ============================================

auth.post('/logout', sessionAuth, async (c) => {
  const session = c.get('session') as { id: string };

  await db.delete(sessions).where(eq(sessions.id, session.id));
  deleteCookie(c, 'cloak_session');

  return successResponse(c, { message: 'Logged out' });
});

// ============================================
// GET CURRENT USER
// ============================================

auth.get('/me', sessionAuth, async (c) => {
  const user = c.get('user') as {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    defaultOrgId: string | null;
    createdAt: string | null;
  };

  // Fetch user's orgs with their role
  const memberships = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      orgPlan: organizations.plan,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id))
    .all();

  return successResponse(c, {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    default_org_id: user.defaultOrgId,
    orgs: memberships.map((m) => ({
      id: m.orgId,
      name: m.orgName,
      slug: m.orgSlug,
      plan: m.orgPlan,
      role: m.role,
    })),
    created_at: user.createdAt,
  });
});

// ============================================
// API KEY MANAGEMENT
// ============================================

auth.get('/api-keys', sessionAuth, async (c) => {
  const user = c.get('user') as { id: string };

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .all();

  return successResponse(c, { api_keys: keys });
});

auth.post('/api-keys', sessionAuth, async (c) => {
  const user = c.get('user') as { id: string; defaultOrgId: string | null };
  const { name, type = 'live' } = await c.req.json();

  if (!name) {
    return errorResponse(c, Errors.validation('Name is required'));
  }

  const prefix = type === 'test' ? API_KEY_TEST_PREFIX : API_KEY_LIVE_PREFIX;
  const keyRaw = `${prefix}${randomBytes(16).toString('hex')}`;
  const keyHash = sha256(keyRaw);
  const keyPrefix = keyRaw.slice(0, 12) + '...';

  const id = generateId('key');
  const orgId = c.get('orgId') as string | undefined || user.defaultOrgId;

  await db.insert(apiKeys).values({
    id,
    userId: user.id,
    orgId: orgId || null,
    name,
    keyHash,
    keyPrefix,
  });

  logger.info({ userId: user.id, keyId: id }, 'API key created');

  // Audit log
  if (orgId) {
    const audit = auditorFromContext(c);
    logAudit({ ...audit, action: 'api_key.created', resourceType: 'api_key', resourceId: id, resourceLabel: name });
  }

  return successResponse(c, {
    id,
    name,
    key: keyRaw, // Only shown once
    key_prefix: keyPrefix,
  }, 201);
});

auth.delete('/api-keys/:id', sessionAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const keyId = c.req.param('id');

  const key = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .get();

  if (!key || key.userId !== user.id) {
    return errorResponse(c, Errors.notFound('API key'));
  }

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, keyId));

  logger.info({ userId: user.id, keyId }, 'API key revoked');

  // Audit log
  const auditOrgId = c.get('orgId') as string | undefined;
  if (auditOrgId) {
    const audit = auditorFromContext(c);
    logAudit({ ...audit, action: 'api_key.revoked', resourceType: 'api_key', resourceId: keyId, resourceLabel: key?.keyPrefix || keyId });
  }

  return successResponse(c, { id: keyId, revoked: true });
});

export default auth;
