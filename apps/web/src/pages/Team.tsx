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
        <h1 className="font-mono font-semibold text-xl text-foreground mb-8">Team</h1>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-mono font-semibold text-xl text-foreground mb-2">Team</h1>
      {activeOrg && (
        <p className="text-sm text-muted mb-8">{activeOrg.name} &middot; {activeOrg.plan} plan</p>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Invite form */}
      {canInvite && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-8">
          <h2 className="font-mono font-medium text-foreground mb-4">Invite member</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-muted mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full bg-background border border-border rounded px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-background border border-border rounded px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:border-accent"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                {myRole === 'owner' && <option value="admin">Admin</option>}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="bg-accent text-background font-mono text-sm font-medium px-4 py-2 rounded hover:bg-accent/90 disabled:opacity-50"
            >
              {inviting ? 'Sending...' : 'Invite'}
            </button>
          </form>
        </div>
      )}

      {/* Members table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="font-mono font-medium text-foreground">Members ({members.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wider">
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Joined</th>
              {canManage && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-5 py-3">
                  <div className="text-sm text-foreground font-mono">{m.email}</div>
                  {m.name && <div className="text-xs text-muted">{m.name}</div>}
                  {m.user_id === user?.id && <span className="text-xs text-accent">(you)</span>}
                </td>
                <td className="px-5 py-3">
                  {canManage && m.user_id !== user?.id ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleChangeRole(m.id, e.target.value)}
                      className="bg-background border border-border rounded px-2 py-1 text-foreground text-xs font-mono"
                    >
                      <option value="viewer">viewer</option>
                      <option value="member">member</option>
                      {myRole === 'owner' && <option value="admin">admin</option>}
                    </select>
                  ) : (
                    <span className="text-sm text-foreground font-mono">{m.role}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-muted font-mono">
                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '-'}
                </td>
                {canManage && (
                  <td className="px-5 py-3 text-right">
                    {m.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-mono"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-mono font-medium text-foreground">Pending Invites ({invites.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Expires</th>
                {canInvite && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-5 py-3 text-sm text-foreground font-mono">{inv.email}</td>
                  <td className="px-5 py-3 text-sm text-foreground font-mono">{inv.role}</td>
                  <td className="px-5 py-3 text-sm text-muted font-mono">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                  {canInvite && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-mono"
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
