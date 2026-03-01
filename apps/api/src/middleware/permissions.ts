import type { Context, Next } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orgMembers } from '../db/schema.js';
import { Errors, errorResponse } from '../lib/errors.js';

type AnyContext = Context<any>;

// Role hierarchy: owner(4) > admin(3) > member(2) > viewer(1)
const ROLE_LEVELS: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

type Permission =
  | 'link.create'
  | 'link.read'
  | 'link.delete'
  | 'link.update'
  | 'analytics.read'
  | 'webhook.manage'
  | 'domain.manage'
  | 'member.invite'
  | 'member.manage'
  | 'org.settings'
  | 'org.billing'
  | 'org.transfer'
  | 'audit.read';

// Minimum role required for each permission
const PERMISSION_LEVELS: Record<Permission, number> = {
  'link.read': 1,      // viewer+
  'analytics.read': 1, // viewer+
  'audit.read': 1,     // viewer+
  'link.create': 2,    // member+
  'link.update': 2,    // member+
  'link.delete': 2,    // member+
  'webhook.manage': 3, // admin+
  'domain.manage': 3,  // admin+
  'member.invite': 3,  // admin+
  'member.manage': 3,  // admin+
  'org.settings': 3,   // admin+
  'org.billing': 4,    // owner only
  'org.transfer': 4,   // owner only
};

/**
 * Middleware that checks if the current user has the required permission
 * for the active organization.
 */
export function requirePermission(permission: Permission) {
  return async (c: AnyContext, next: Next) => {
    const orgRole = c.get('orgRole') as string | undefined;

    if (!orgRole) {
      return errorResponse(c, Errors.forbidden('No organization context'));
    }

    const userLevel = ROLE_LEVELS[orgRole] || 0;
    const requiredLevel = PERMISSION_LEVELS[permission];

    if (userLevel < requiredLevel) {
      return errorResponse(c, Errors.forbidden(
        `This action requires ${getMinRoleName(requiredLevel)} role or higher`,
      ));
    }

    await next();
  };
}

function getMinRoleName(level: number): string {
  for (const [role, l] of Object.entries(ROLE_LEVELS)) {
    if (l === level) return role;
  }
  return 'owner';
}

/**
 * Check if a user can manage another member (change role or remove).
 * Users can only manage members with a lower role than their own.
 */
export function canManageMember(actorRole: string, targetRole: string): boolean {
  return (ROLE_LEVELS[actorRole] || 0) > (ROLE_LEVELS[targetRole] || 0);
}

/**
 * Check if a user can assign a given role.
 * Users can only assign roles lower than their own.
 */
export function canAssignRole(actorRole: string, newRole: string): boolean {
  return (ROLE_LEVELS[actorRole] || 0) > (ROLE_LEVELS[newRole] || 0);
}

/**
 * Check if a user is the last owner of an organization.
 */
export async function isLastOwner(orgId: string, userId: string): Promise<boolean> {
  const owners = await db
    .select({ id: orgMembers.id, userId: orgMembers.userId })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'owner')))
    .all();

  return owners.length === 1 && owners[0].userId === userId;
}

export { ROLE_LEVELS };
