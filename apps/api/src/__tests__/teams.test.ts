import { describe, it, expect, beforeAll } from 'vitest';
import {
  registerUser,
  loginUser,
  sessionRequest,
  upgradeUserPlan,
} from './helpers.js';

describe('Teams & Organization API', () => {
  let ownerCookie: string;
  let ownerId: string;

  beforeAll(async () => {
    const user = await registerUser();
    ownerId = user.userId;
    // Scale plan needed: provides 15 seats for multiple invite/member tests
    await upgradeUserPlan(ownerId, 'scale');
    const login = await loginUser(user.email, user.password);
    ownerCookie = login.sessionCookie;
  });

  // -------------------------------------------------------
  // Org Settings
  // -------------------------------------------------------
  describe('GET /v1/org/settings', () => {
    it('returns org info for the authenticated user', async () => {
      const res = await sessionRequest('/v1/org/settings', ownerCookie);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.plan).toBeDefined();
    });

    it('returns 401 without session', async () => {
      const res = await sessionRequest('/v1/org/settings', 'cloak_session=invalid');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /v1/org/settings', () => {
    it('updates org name', async () => {
      const newName = `Test Org ${Date.now()}`;
      const res = await sessionRequest('/v1/org/settings', ownerCookie, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.name).toBe(newName);
    });

    it('updates org slug', async () => {
      const slug = `test-slug-${Date.now()}`;
      const res = await sessionRequest('/v1/org/settings', ownerCookie, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.slug).toBe(slug);
    });

    it('rejects invalid slug format', async () => {
      const res = await sessionRequest('/v1/org/settings', ownerCookie, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'INVALID SLUG!!!' }),
      });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // Members
  // -------------------------------------------------------
  describe('GET /v1/org/members', () => {
    it('returns members list including the owner', async () => {
      const res = await sessionRequest('/v1/org/members', ownerCookie);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.members).toBeDefined();
      expect(data.members.length).toBeGreaterThanOrEqual(1);
      expect(data.pending_invites).toBeDefined();

      // Owner should be in members
      const owner = data.members.find((m: { role: string }) => m.role === 'owner');
      expect(owner).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // Invites
  // -------------------------------------------------------
  describe('POST /v1/org/members/invite', () => {
    it('creates an invite and returns 201', async () => {
      const inviteEmail = `invite-${Date.now()}@example.com`;
      const res = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: 'member' }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.email).toBe(inviteEmail);
      expect(data.role).toBe('member');
      expect(data.invite_token).toBeDefined();
      expect(data.expires_at).toBeDefined();
    });

    it('defaults role to member when not specified', async () => {
      const res = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `default-role-${Date.now()}@example.com` }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.role).toBe('member');
    });
  });

  // -------------------------------------------------------
  // Accept Invite
  // -------------------------------------------------------
  describe('POST /v1/org/invites/accept', () => {
    it('accepts a valid invite', async () => {
      const inviteeEmail = `invitee-${Date.now()}@example.com`;

      // Create invite
      const inviteRes = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteeEmail }),
      });
      const { data: invite } = await inviteRes.json();

      // Register the invitee
      const invitee = await registerUser(inviteeEmail);
      const { sessionCookie: inviteeCookie } = await loginUser(invitee.email, invitee.password);

      // Accept invite
      const res = await sessionRequest('/v1/org/invites/accept', inviteeCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.invite_token }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.org_id).toBeDefined();
      expect(data.role).toBe('member');
    });

    it('rejects invalid invite token', async () => {
      const user = await registerUser();
      const { sessionCookie } = await loginUser(user.email, user.password);

      const res = await sessionRequest('/v1/org/invites/accept', sessionCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'fake-token-123' }),
      });

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Revoke Invite
  // -------------------------------------------------------
  describe('DELETE /v1/org/invites/:id', () => {
    it('revokes a pending invite', async () => {
      const inviteRes = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `revoke-${Date.now()}@example.com` }),
      });
      const { data: invite } = await inviteRes.json();

      const res = await sessionRequest(`/v1/org/invites/${invite.id}`, ownerCookie, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.status).toBe('revoked');
    });
  });

  // -------------------------------------------------------
  // Change Member Role
  // -------------------------------------------------------
  describe('PATCH /v1/org/members/:id/role', () => {
    it('promotes a member to admin', async () => {
      // Create and accept invite
      const inviteeEmail = `promote-${Date.now()}@example.com`;
      const inviteRes = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteeEmail }),
      });
      const { data: invite } = await inviteRes.json();

      const invitee = await registerUser(inviteeEmail);
      const { sessionCookie: inviteeCookie } = await loginUser(invitee.email, invitee.password);
      await sessionRequest('/v1/org/invites/accept', inviteeCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.invite_token }),
      });

      // Get member ID from members list
      const membersRes = await sessionRequest('/v1/org/members', ownerCookie);
      const { data: membersData } = await membersRes.json();
      const member = membersData.members.find(
        (m: { email: string }) => m.email === inviteeEmail,
      );

      // Promote to admin
      const res = await sessionRequest(`/v1/org/members/${member.id}/role`, ownerCookie, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.role).toBe('admin');
    });
  });

  // -------------------------------------------------------
  // Remove Member
  // -------------------------------------------------------
  describe('DELETE /v1/org/members/:id', () => {
    it('removes a member from the org', async () => {
      // Create and accept invite
      const inviteeEmail = `remove-${Date.now()}@example.com`;
      const inviteRes = await sessionRequest('/v1/org/members/invite', ownerCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteeEmail }),
      });
      const { data: invite } = await inviteRes.json();

      const invitee = await registerUser(inviteeEmail);
      const { sessionCookie: inviteeCookie } = await loginUser(invitee.email, invitee.password);
      await sessionRequest('/v1/org/invites/accept', inviteeCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.invite_token }),
      });

      // Get member ID
      const membersRes = await sessionRequest('/v1/org/members', ownerCookie);
      const { data: membersData } = await membersRes.json();
      const member = membersData.members.find(
        (m: { email: string }) => m.email === inviteeEmail,
      );

      // Remove
      const res = await sessionRequest(`/v1/org/members/${member.id}`, ownerCookie, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.status).toBe('removed');
    });
  });
});
