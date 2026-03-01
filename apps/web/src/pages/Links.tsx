import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { linksApi } from '../lib/api';

interface LinkItem {
  id: string;
  secure_url: string;
  name: string | null;
  file_type: string;
  page_count: number;
  status: string;
  view_count: number;
  created_at: string;
}

const statusConfig: Record<string, { dot: string; text: string }> = {
  active: { dot: 'bg-accent', text: 'text-accent' },
  processing: { dot: 'bg-warning', text: 'text-warning' },
  expired: { dot: 'bg-text-tertiary', text: 'text-text-tertiary' },
  revoked: { dot: 'bg-destructive', text: 'text-destructive' },
  failed: { dot: 'bg-destructive', text: 'text-destructive' },
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Links() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    linksApi.list({ page, limit: 20 })
      .then((data) => {
        setLinks(data.links);
        setTotalPages(data.pagination.pages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load links');
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-sans font-semibold text-xl text-foreground">Links</h1>
        <span className="text-xs text-text-tertiary font-sans">
          {links.length > 0 ? `${links.length} links` : ''}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-16 rounded ml-auto" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-surface border border-destructive/30 rounded-lg">
          <p className="text-destructive font-sans text-sm">{error}</p>
          <button
            onClick={() => setPage(page)}
            className="mt-3 text-xs text-text-tertiary font-sans hover:text-text-secondary transition-colors"
          >
            Try again
          </button>
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-lg">
          <svg className="w-10 h-10 text-text-tertiary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-text-secondary font-sans text-sm">No links yet</p>
          <p className="text-text-tertiary font-sans text-xs mt-1">Create your first link via the API</p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Views</th>
                  <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const status = statusConfig[link.status] || { dot: 'bg-text-tertiary', text: 'text-text-tertiary' };
                  return (
                    <tr key={link.id} className="border-b border-border-subtle last:border-0 hover:bg-hover transition-colors duration-150">
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/links/${link.id}`}
                          className="text-sm text-foreground font-sans font-medium hover:text-accent transition-colors duration-150"
                        >
                          {link.name || <span className="font-mono text-text-secondary">{link.id}</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          <span className={`text-xs font-sans ${status.text}`}>{link.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-text-secondary tabular-nums">{link.view_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono uppercase ${link.file_type === 'video' ? 'text-accent' : 'text-text-tertiary'}`}>{link.file_type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-sans text-text-tertiary">{timeAgo(link.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-sans font-medium text-text-secondary hover:text-foreground hover:bg-hover disabled:opacity-30 transition-colors duration-150"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-text-tertiary tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-sans font-medium text-text-secondary hover:text-foreground hover:bg-hover disabled:opacity-30 transition-colors duration-150"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
