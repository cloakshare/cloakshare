import { useState, useEffect } from 'react';
import { teamsApi } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  invited_at: string;
  expires_at: string;
}

const roleBadge: Record<string, string> = {
  owner: 'bg-accent/15 text-accent',
  admin: 'bg-warning/15 text-warning',
  member: 'bg-elevated text-text-secondary',
  viewer: 'bg-elevated text-text-tertiary',
};

export default function Team() {
  const { user, activeOrg } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const myRole = activeOrg?.role || 'viewer';
  const canInvite = ['admin', 'owner'].includes(myRole);
  const canManage = ['admin', 'owner'].includes(myRole);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      const data = await teamsApi.listMembers();
      setMembers(data.members);
      setInvites(data.pending_invites);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setError('');
    try {
      await teamsApi.invite(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('member');
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    try {
      await teamsApi.revokeInvite(id);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  async function handleChangeRole(memberId: string, newRole: string) {
    try {
      await teamsApi.changeRole(memberId, newRole);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the organization?')) return;
    try {
      await teamsApi.removeMember(memberId);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-sans font-semibold text-xl text-foreground mb-8">Team</h1>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-16 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-sans font-semibold text-xl text-foreground mb-2">Team</h1>
      {activeOrg && (
        <p className="text-sm text-text-secondary font-sans mb-8">{activeOrg.name} &middot; <span className="text-accent font-medium">{activeOrg.plan}</span> plan</p>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-sans">
          {error}
        </div>
      )}

      {/* Invite form */}
      {canInvite && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-8">
          <h2 className="font-sans font-medium text-sm text-foreground mb-4">Invite member</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                {myRole === 'owner' && <option value="admin">Admin</option>}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="bg-accent text-background font-sans text-sm font-medium px-4 py-2.5 rounded-md hover:bg-accent-hover hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {inviting ? 'Sending...' : 'Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="font-sans font-medium text-sm text-foreground">Members ({members.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">User</th>
              <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Role</th>
              <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Joined</th>
              {canManage && <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const initials = (m.name || m.email).slice(0, 2).toUpperCase();
              return (
                <tr key={m.id} className="border-b border-border-subtle last:border-0 hover:bg-hover transition-colors duration-150">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-[10px] font-sans font-medium text-text-secondary flex-shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm text-foreground font-sans">{m.email}</div>
                        {m.name && <div className="text-xs text-text-tertiary font-sans">{m.name}</div>}
                      </div>
                      {m.user_id === user?.id && <span className="text-[10px] font-sans font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">you</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {canManage && m.user_id !== user?.id ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.id, e.target.value)}
                        className="bg-input border border-border rounded-md px-2 py-1 text-xs text-foreground font-sans focus:outline-none focus:border-accent/50 transition-colors"
                      >
                        <option value="viewer">viewer</option>
                        <option value="member">member</option>
                        {myRole === 'owner' && <option value="admin">admin</option>}
                      </select>
                    ) : (
                      <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded ${roleBadge[m.role] || roleBadge.viewer}`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-text-tertiary font-sans">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '-'}
                  </td>
                  {canManage && (
                    <td className="px-5 py-3 text-right">
                      {m.user_id !== user?.id && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-xs font-sans font-medium text-destructive/70 hover:text-destructive transition-colors duration-150"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="font-sans font-medium text-sm text-foreground">Pending Invites ({invites.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Email</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Role</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Expires</th>
                {canInvite && <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-border-subtle last:border-0 hover:bg-hover transition-colors duration-150">
                  <td className="px-5 py-3 text-sm text-foreground font-sans">{inv.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded ${roleBadge[inv.role] || roleBadge.viewer}`}>
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-text-tertiary font-sans">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                  {canInvite && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs font-sans font-medium text-destructive/70 hover:text-destructive transition-colors duration-150"
                      >
                        Revoke
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
