import { CloakShareClient } from '../client.js';
import type { Member, AuditEntry } from '../types.js';

export class OrgResource {
  constructor(private client: CloakShareClient) {}

  /** List all organization members */
  async listMembers(): Promise<{ members: Member[]; pending_invites: unknown[] }> {
    return this.client.get('/v1/org/members');
  }

  /** Invite a member by email */
  async invite(email: string, role: string = 'member'): Promise<{ invite_id: string }> {
    return this.client.post('/v1/org/members/invite', { email, role });
  }

  /** Change a member's role */
  async changeRole(memberId: string, role: string): Promise<void> {
    return this.client.patch(`/v1/org/members/${memberId}`, { role });
  }

  /** Remove a member from the organization */
  async removeMember(memberId: string): Promise<void> {
    return this.client.delete(`/v1/org/members/${memberId}`);
  }

  /** Revoke a pending invite */
  async revokeInvite(inviteId: string): Promise<void> {
    return this.client.delete(`/v1/org/members/invites/${inviteId}`);
  }

  /** Get the audit log */
  async auditLog(params?: {
    page?: number;
    limit?: number;
    action?: string;
  }): Promise<{ entries: AuditEntry[]; pagination: { total: number; page: number; limit: number; pages: number } }> {
    return this.client.get('/v1/org/audit-log', params as Record<string, string | number | boolean | undefined>);
  }
}
