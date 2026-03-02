import { Hono } from 'hono';
import { eq, and, isNull, gt, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { organizations, orgMembers, orgInvites, users } from '../db/schema.js';
import { sessionAuth } from '../middleware/session.js';
import { orgResolver } from '../middleware/orgResolver.js';
import { requirePermission, canManageMember, canAssignRole, isLastOwner } from '../middleware/permissions.js';
import { generateId, generateToken, sha256 } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { logAudit, auditorFromContext } from '../services/audit.js';
import { sendTeamInviteEmail } from '../services/email.js';
import { ORG_ROLES, SEAT_LIMITS } from '@cloak/shared';
import type { Variables } from '../lib/types.js';

const teamsRouter = new Hono<{ Variables: Variables }>();

// All team routes require session auth (dashboard only)
// API key auth is not used for team management

// ============================================
// GET /v1/org/members — List members + pending invites
// ============================================

teamsRouter.get('/v1/org/members', sessionAuth, orgResolver, requirePermission('link.read'), async (c) => {
  const orgId = c.get('orgId');

  const [members, invites] = await Promise.all([
    db.select({
      id: orgMembers.id,
      userId: orgMembers.userId,
      role: orgMembers.role,
      createdAt: orgMembers.createdAt,
      email: users.email,
      name: users.name,
    })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(eq(orgMembers.orgId, orgId))
      .all(),
    db.select()
      .from(orgInvites)
      .where(and(
        eq(orgInvites.orgId, orgId),
        isNull(orgInvites.acceptedAt),
        isNull(orgInvites.revokedAt),
        gt(orgInvites.expiresAt, new Date().toISOString()),
      ))
      .all(),
  ]);

  return successResponse(c, {
    members: members.map((m) => ({
      id: m.id,
      user_id: m.userId,
      email: m.email,
      name: m.name,
      role: m.role,
      joined_at: m.createdAt,
    })),
    pending_invites: invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invited_at: inv.createdAt,
      expires_at: inv.expiresAt,
    })),
  });
});

// ============================================
// POST /v1/org/members/invite — Send invite
// ============================================

teamsRouter.post('/v1/org/members/invite', sessionAuth, orgResolver, requirePermission('member.invite'), async (c) => {
  const orgId = c.get('orgId');
  const user = c.get('user');
  const orgRole = c.get('orgRole');
  const org = c.get('org') as { plan: string } | undefined;
  const { email, role } = await c.req.json();

  if (!email) {
    return errorResponse(c, Errors.validation('email is required'));
  }

  // Plan gate: Free users cannot invite team members
  const orgPlan = (org?.plan || user.plan || 'free') as keyof typeof SEAT_LIMITS;
  const seatLimit = SEAT_LIMITS[orgPlan];
  if (!seatLimit || !seatLimit.additional) {
    return errorResponse(c, Errors.forbidden('Team members require a Starter plan or above. Upgrade at https://cloakshare.dev/pricing'));
  }

  // Seat limit: check current member count against plan limit
  const memberCount = await db.select({ count: count() }).from(orgMembers).where(eq(orgMembers.orgId, orgId)).get();
  const pendingCount = await db.select({ count: count() }).from(orgInvites).where(and(eq(orgInvites.orgId, orgId), isNull(orgInvites.acceptedAt))).get();
  const totalSeats = (memberCount?.count ?? 0) + (pendingCount?.count ?? 0);
  if (totalSeats >= seatLimit.included) {
    return errorResponse(c, Errors.limitReached(`Your ${orgPlan} plan includes ${seatLimit.included} seats. Contact support for additional seats.`));
  }

  const inviteRole = role || 'member';
  if (!(ORG_ROLES as readonly string[]).includes(inviteRole)) {
    return errorResponse(c, Errors.validation(`Invalid role. Must be one of: ${ORG_ROLES.join(', ')}`));
  }

  // Can't assign a role >= your own
  if (!canAssignRole(orgRole, inviteRole)) {
    return errorResponse(c, Errors.forbidden('Cannot invite with a role equal to or higher than your own'));
  }

  // Check if already a member
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    const existingMember = await db.select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, existingUser.id)))
      .get();
    if (existingMember) {
      return errorResponse(c, Errors.validation('User is already a member of this organization'));
    }
  }

  // Check for existing pending invite
  const existingInvite = await db.select({ id: orgInvites.id })
    .from(orgInvites)
    .where(and(
      eq(orgInvites.orgId, orgId),
      eq(orgInvites.email, email),
      isNull(orgInvites.acceptedAt),
      isNull(orgInvites.revokedAt),
    ))
    .get();

  if (existingInvite) {
    return errorResponse(c, Errors.validation('An invite is already pending for this email'));
  }

  // Generate invite token (hashed for storage)
  const token = generateToken(32);
  const tokenHash = sha256(token);
  const tokenPrefix = token.substring(0, 8);

  const inviteId = generateId('inv');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await db.insert(orgInvites).values({
    id: inviteId,
    orgId,
    email,
    role: inviteRole,
    tokenHash,
    tokenPrefix,
    invitedBy: user.id,
    expiresAt,
  });

  logger.info({ orgId, email, role: inviteRole, invitedBy: user.id }, 'Team invite sent');

  // Send invite email (best-effort)
  const orgData = c.get('org') as { name: string };
  sendTeamInviteEmail({
    inviteeEmail: email,
    orgName: orgData.name,
    inviterName: user.name || user.email,
    role: inviteRole,
    inviteToken: token,
  }).catch((err) => logger.warn({ err, email }, 'Failed to send invite email'));

  // Audit log
  const auditInvite = auditorFromContext(c);
  logAudit({ ...auditInvite, action: 'member.invited', resourceType: 'member', resourceId: inviteId, resourceLabel: email });

  return successResponse(c, {
    id: inviteId,
    email,
    role: inviteRole,
    invite_token: token, // Return raw token — this is the only time it's available
    expires_at: expiresAt,
  }, 201);
});

// ============================================
// POST /v1/org/invites/accept — Accept invite via token
// ============================================

teamsRouter.post('/v1/org/invites/accept', sessionAuth, async (c) => {
  const user = c.get('user');
  const { token } = await c.req.json();

  if (!token) {
    return errorResponse(c, Errors.validation('token is required'));
  }

  const tokenHash = sha256(token);

  const invite = await db.select()
    .from(orgInvites)
    .where(and(
      eq(orgInvites.tokenHash, tokenHash),
      isNull(orgInvites.acceptedAt),
      isNull(orgInvites.revokedAt),
    ))
    .get();

  if (!invite) {
    return errorResponse(c, Errors.notFound('Invite'));
  }

  // Check expiry
  if (new Date(invite.expiresAt) < new Date()) {
    return errorResponse(c, Errors.validation('This invite has expired'));
  }

  // Check email matches
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return errorResponse(c, Errors.forbidden('This invite was sent to a different email address'));
  }

  // Check not already a member
  const existingMember = await db.select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, invite.orgId), eq(orgMembers.userId, user.id)))
    .get();

  if (existingMember) {
    return errorResponse(c, Errors.validation('You are already a member of this organization'));
  }

  // Accept: create membership and mark invite as accepted
  const memberId = generateId('mem');
  await db.insert(orgMembers).values({
    id: memberId,
    orgId: invite.orgId,
    userId: user.id,
    role: invite.role,
  });

  await db.update(orgInvites)
    .set({ acceptedAt: new Date().toISOString() })
    .where(eq(orgInvites.id, invite.id));

  const org = await db.select().from(organizations).where(eq(organizations.id, invite.orgId)).get();

  logger.info({ orgId: invite.orgId, userId: user.id, role: invite.role }, 'Invite accepted');

  // Audit log
  logAudit({ orgId: invite.orgId, actorId: user.id, actorType: 'user', actorLabel: user.email, action: 'member.joined', resourceType: 'member', resourceId: memberId, resourceLabel: user.email });

  return successResponse(c, {
    org_id: invite.orgId,
    org_name: org?.name,
    role: invite.role,
  });
});

// ============================================
// DELETE /v1/org/invites/:id — Revoke pending invite
// ============================================

teamsRouter.delete('/v1/org/invites/:id', sessionAuth, orgResolver, requirePermission('member.invite'), async (c) => {
  const orgId = c.get('orgId');
  const inviteId = c.req.param('id');

  const invite = await db.select()
    .from(orgInvites)
    .where(and(
      eq(orgInvites.id, inviteId),
      eq(orgInvites.orgId, orgId),
      isNull(orgInvites.acceptedAt),
      isNull(orgInvites.revokedAt),
    ))
    .get();

  if (!invite) {
    return errorResponse(c, Errors.notFound('Invite'));
  }

  await db.update(orgInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(orgInvites.id, inviteId));

  return successResponse(c, { id: inviteId, status: 'revoked' });
});

// ============================================
// PATCH /v1/org/members/:id/role — Change member role
// ============================================

teamsRouter.patch('/v1/org/members/:id/role', sessionAuth, orgResolver, requirePermission('member.manage'), async (c) => {
  const orgId = c.get('orgId');
  const orgRole = c.get('orgRole');
  const memberId = c.req.param('id');
  const { role: newRole } = await c.req.json();

  if (!newRole || !(ORG_ROLES as readonly string[]).includes(newRole)) {
    return errorResponse(c, Errors.validation(`Invalid role. Must be one of: ${ORG_ROLES.join(', ')}`));
  }

  const member = await db.select()
    .from(orgMembers)
    .where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)))
    .get();

  if (!member) {
    return errorResponse(c, Errors.notFound('Member'));
  }

  // Can't manage someone with equal or higher role
  if (!canManageMember(orgRole, member.role)) {
    return errorResponse(c, Errors.forbidden('Cannot modify a member with equal or higher role'));
  }

  // Can't assign a role >= your own
  if (!canAssignRole(orgRole, newRole)) {
    return errorResponse(c, Errors.forbidden('Cannot assign a role equal to or higher than your own'));
  }

  // Prevent removing the last owner
  if (member.role === 'owner' && newRole !== 'owner') {
    const lastOwner = await isLastOwner(orgId, member.userId);
    if (lastOwner) {
      return errorResponse(c, Errors.validation('Cannot demote the last owner. Transfer ownership first.'));
    }
  }

  await db.update(orgMembers)
    .set({ role: newRole })
    .where(eq(orgMembers.id, memberId));

  // Audit log
  const auditRole = auditorFromContext(c);
  logAudit({ ...auditRole, action: 'member.role_changed', resourceType: 'member', resourceId: memberId, metadata: { before: member.role, after: newRole } });

  return successResponse(c, { id: memberId, role: newRole });
});

// ============================================
// DELETE /v1/org/members/:id — Remove member
// ============================================

teamsRouter.delete('/v1/org/members/:id', sessionAuth, orgResolver, requirePermission('member.manage'), async (c) => {
  const orgId = c.get('orgId');
  const orgRole = c.get('orgRole');
  const user = c.get('user');
  const memberId = c.req.param('id');

  const member = await db.select()
    .from(orgMembers)
    .where(and(eq(orgMembers.id, memberId), eq(orgMembers.orgId, orgId)))
    .get();

  if (!member) {
    return errorResponse(c, Errors.notFound('Member'));
  }

  // Can't remove yourself through this endpoint (use leave)
  if (member.userId === user.id) {
    return errorResponse(c, Errors.validation('Cannot remove yourself. Use the leave endpoint instead.'));
  }

  // Can't remove someone with equal or higher role
  if (!canManageMember(orgRole, member.role)) {
    return errorResponse(c, Errors.forbidden('Cannot remove a member with equal or higher role'));
  }

  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));

  logger.info({ orgId, removedUserId: member.userId, removedBy: user.id }, 'Member removed');

  // Audit log
  const auditRemove = auditorFromContext(c);
  logAudit({ ...auditRemove, action: 'member.removed', resourceType: 'member', resourceId: memberId, metadata: { removed_user_id: member.userId } });

  return successResponse(c, { id: memberId, status: 'removed' });
});

// ============================================
// GET /v1/org/settings — Org details
// ============================================

teamsRouter.get('/v1/org/settings', sessionAuth, orgResolver, requirePermission('link.read'), async (c) => {
  const org = c.get('org');

  return successResponse(c, {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    created_at: org.createdAt,
  });
});

// ============================================
// PATCH /v1/org/settings — Update org name/slug
// ============================================

teamsRouter.patch('/v1/org/settings', sessionAuth, orgResolver, requirePermission('org.settings'), async (c) => {
  const org = c.get('org');
  const { name, slug } = await c.req.json();

  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };

  if (name !== undefined) {
    if (!name || name.length > 100) {
      return errorResponse(c, Errors.validation('Name must be between 1 and 100 characters'));
    }
    updates.name = name;
  }

  if (slug !== undefined) {
    if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 50) {
      return errorResponse(c, Errors.validation('Slug must be lowercase alphanumeric with hyphens, max 50 chars'));
    }
    // Check uniqueness
    const existing = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .get();
    if (existing && existing.id !== org.id) {
      return errorResponse(c, Errors.validation('This slug is already taken'));
    }
    updates.slug = slug;
  }

  await db.update(organizations).set(updates).where(eq(organizations.id, org.id));

  // Audit log
  const auditSettings = auditorFromContext(c);
  logAudit({ ...auditSettings, action: 'org.settings_updated', resourceType: 'org', resourceId: org.id, metadata: { name: updates.name, slug: updates.slug } });

  return successResponse(c, {
    id: org.id,
    name: updates.name ?? org.name,
    slug: updates.slug ?? org.slug,
  });
});

// ============================================
// POST /v1/org/transfer — Transfer ownership
// ============================================

teamsRouter.post('/v1/org/transfer', sessionAuth, orgResolver, requirePermission('org.transfer'), async (c) => {
  const orgId = c.get('orgId');
  const user = c.get('user');
  const { new_owner_id } = await c.req.json();

  if (!new_owner_id) {
    return errorResponse(c, Errors.validation('new_owner_id is required'));
  }

  // Verify the new owner is a member
  const newOwnerMembership = await db.select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, new_owner_id)))
    .get();

  if (!newOwnerMembership) {
    return errorResponse(c, Errors.notFound('New owner must be an existing member'));
  }

  // Promote new owner and demote current owner to admin
  const currentMembership = await db.select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .get();

  if (!currentMembership) {
    return errorResponse(c, Errors.internal());
  }

  await db.update(orgMembers)
    .set({ role: 'owner' })
    .where(eq(orgMembers.id, newOwnerMembership.id));

  await db.update(orgMembers)
    .set({ role: 'admin' })
    .where(eq(orgMembers.id, currentMembership.id));

  logger.info({ orgId, previousOwner: user.id, newOwner: new_owner_id }, 'Ownership transferred');

  // Audit log
  const auditTransfer = auditorFromContext(c);
  logAudit({ ...auditTransfer, action: 'org.ownership_transferred', resourceType: 'org', resourceId: orgId, metadata: { previous_owner: user.id, new_owner: new_owner_id } });

  return successResponse(c, {
    previous_owner: user.id,
    new_owner: new_owner_id,
    your_new_role: 'admin',
  });
});

export default teamsRouter;
