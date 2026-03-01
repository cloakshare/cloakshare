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
        <h1 className="font-sans font-semibold text-xl text-foreground mb-8">Audit Log</h1>
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <svg className="w-10 h-10 text-text-tertiary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-text-secondary font-sans text-sm mb-2">Audit log requires a Growth or Scale plan.</p>
          <a href="/dashboard/billing" className="text-accent text-sm font-sans font-medium hover:text-accent-hover transition-colors duration-150">
            Upgrade your plan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-sans font-semibold text-xl text-foreground mb-2">Audit Log</h1>
      <p className="text-sm text-text-secondary font-sans mb-6">Activity history for your organization</p>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-sans">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="mb-6">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCursor(null); }}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground font-sans focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
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
          <div className="p-8 text-center">
            <svg className="w-10 h-10 text-text-tertiary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-text-secondary font-sans text-sm">No audit log entries found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Time</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Actor</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Action</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Resource</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="border-b border-border-subtle last:border-0 cursor-pointer hover:bg-hover transition-colors duration-150"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-5 py-3 text-xs text-text-tertiary font-mono whitespace-nowrap tabular-nums">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-sans">
                      {entry.actor.label}
                      {entry.actor.type === 'api_key' && (
                        <span className="text-[10px] font-sans text-text-tertiary ml-1 bg-elevated px-1 py-0.5 rounded">key</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground font-sans capitalize">
                      {formatAction(entry.action)}
                    </td>
                    <td className="px-5 py-3 text-sm text-text-tertiary font-mono">
                      {entry.resource ? (
                        <span>{entry.resource.label || entry.resource.id}</span>
                      ) : <span className="text-text-tertiary">-</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-text-tertiary font-mono tabular-nums">
                      {entry.ip_address || '-'}
                    </td>
                  </tr>
                  {expandedId === entry.id && entry.metadata && (
                    <tr key={`${entry.id}-meta`}>
                      <td colSpan={5} className="px-5 py-3 bg-background border-b border-border-subtle">
                        <pre className="text-xs text-text-secondary font-mono overflow-x-auto">
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
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-3 w-28 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3 w-20 rounded" />
                <div className="skeleton h-3 w-32 rounded ml-auto" />
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-border-subtle">
            <button
              onClick={() => cursor && loadEntries(cursor)}
              className="text-accent text-sm font-sans font-medium hover:text-accent-hover transition-colors duration-150"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
