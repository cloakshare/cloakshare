import { useState, useEffect, Fragment } from 'react';
import { auditApi } from '../lib/api';
import { useAuth } from '../lib/auth';

interface AuditEntry {
  id: string;
  actor: { id: string; type: string; label: string };
  action: string;
  resource: { type: string; id: string; label: string } | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLog() {
  const { activeOrg } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, [actionFilter]);

  async function loadEntries(loadCursor?: string) {
    try {
      setLoading(true);
      const data = await auditApi.list({
        cursor: loadCursor,
        limit: 50,
        action: actionFilter || undefined,
      });
      if (loadCursor) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setCursor(data.pagination.next_cursor);
      setHasMore(data.pagination.has_more);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action: string): string {
    return action.replaceAll('.', ' ').replaceAll('_', ' ');
  }

  const plan = activeOrg?.plan || 'free';
  if (plan === 'free' || plan === 'starter') {
    return (
      <div>
        <h1 className="font-mono font-semibold text-xl text-foreground mb-8">Audit Log</h1>
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <p className="text-muted mb-2">Audit log requires a Growth or Scale plan.</p>
          <a href="/dashboard/billing" className="text-accent text-sm font-mono hover:underline">
            Upgrade your plan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-mono font-semibold text-xl text-foreground mb-2">Audit Log</h1>
      <p className="text-sm text-muted mb-6">Activity history for your organization</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCursor(null); }}
          className="bg-background border border-border rounded px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:border-accent"
        >
          <option value="">All actions</option>
          <option value="link.created">Link created</option>
          <option value="link.revoked">Link revoked</option>
          <option value="api_key.created">API key created</option>
          <option value="api_key.revoked">API key revoked</option>
          <option value="member.invited">Member invited</option>
          <option value="member.joined">Member joined</option>
          <option value="member.role_changed">Role changed</option>
          <option value="member.removed">Member removed</option>
          <option value="org.ownership_transferred">Ownership transferred</option>
        </select>
      </div>

      {/* Entries */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {entries.length === 0 && !loading ? (
          <div className="p-8 text-center text-muted text-sm">No audit log entries found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="border-t border-border cursor-pointer hover:bg-elevated/50"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-5 py-3 text-xs text-muted font-mono whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-mono">
                      {entry.actor.label}
                      {entry.actor.type === 'api_key' && (
                        <span className="text-xs text-muted ml-1">(key)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-mono">
                      {formatAction(entry.action)}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted font-mono">
                      {entry.resource ? (
                        <span>{entry.resource.label || entry.resource.id}</span>
                      ) : '-'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted font-mono">
                      {entry.ip_address || '-'}
                    </td>
                  </tr>
                  {expandedId === entry.id && entry.metadata && (
                    <tr key={`${entry.id}-meta`} className="border-t border-border/50">
                      <td colSpan={5} className="px-5 py-3 bg-background">
                        <pre className="text-xs text-muted font-mono overflow-x-auto">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        {loading && (
          <div className="p-4 text-center text-muted text-sm">Loading...</div>
        )}

        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-border">
            <button
              onClick={() => cursor && loadEntries(cursor)}
              className="text-accent text-sm font-mono hover:underline"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
