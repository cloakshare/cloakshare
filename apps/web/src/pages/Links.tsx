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

const statusColors: Record<string, string> = {
  active: 'text-accent',
  processing: 'text-warning',
  expired: 'text-text-tertiary',
  revoked: 'text-destructive',
  failed: 'text-destructive',
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
        <h1 className="font-mono font-semibold text-xl text-foreground">Links</h1>
        <span className="text-xs text-text-tertiary font-mono">
          {links.length > 0 ? `${links.length} links` : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-surface border border-destructive/30 rounded-lg">
          <p className="text-destructive font-mono text-sm">{error}</p>
          <button
            onClick={() => setPage(page)}
            className="mt-3 text-xs text-text-tertiary font-mono hover:text-text-secondary transition-colors"
          >
            Try again
          </button>
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-lg">
          <p className="text-text-secondary font-mono text-sm">No links yet</p>
          <p className="text-text-tertiary font-mono text-xs mt-1">Create your first link via the API</p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-4 py-3">Views</th>
                  <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-right text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-border-subtle last:border-0 hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/links/${link.id}`}
                        className="text-sm text-foreground font-mono hover:text-accent transition-colors"
                      >
                        {link.name || link.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${statusColors[link.status] || 'text-text-tertiary'}`}>
                        {link.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-text-secondary tabular-nums">{link.view_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono uppercase ${link.file_type === 'video' ? 'text-accent' : 'text-text-tertiary'}`}>{link.file_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-mono text-text-tertiary">{timeAgo(link.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-[#222225] disabled:opacity-30 transition-colors"
              >
                Prev
              </button>
              <span className="text-xs font-mono text-text-tertiary tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-[#222225] disabled:opacity-30 transition-colors"
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
