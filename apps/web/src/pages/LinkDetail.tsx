import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { linksApi } from '../lib/api';

export default function LinkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<Awaited<ReturnType<typeof linksApi.get>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof linksApi.analytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      linksApi.get(id),
      linksApi.analytics(id).catch(() => null),
    ])
      .then(([linkData, analyticsData]) => {
        setLink(linkData);
        setAnalytics(analyticsData);
      })
      .catch(() => navigate('/dashboard/links'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleRevoke = async () => {
    if (!id || !confirm('Revoke this link? Viewers will lose access immediately.')) return;
    setRevoking(true);
    setError('');
    try {
      await linksApi.revoke(id);
      setLink(prev => prev ? { ...prev, status: 'revoked' } : null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link');
    }
    setRevoking(false);
  };

  const copyUrl = () => {
    if (link) {
      navigator.clipboard.writeText(link.secure_url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-6 w-48 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5">
              <div className="skeleton h-3 w-20 rounded mb-3" />
              <div className="skeleton h-7 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="skeleton h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!link) return null;

  const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
    active: { dot: 'bg-accent', bg: 'bg-accent/10', text: 'text-accent' },
    processing: { dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },
    expired: { dot: 'bg-text-tertiary', bg: 'bg-muted', text: 'text-text-tertiary' },
    revoked: { dot: 'bg-destructive', bg: 'bg-destructive/10', text: 'text-destructive' },
    failed: { dot: 'bg-destructive', bg: 'bg-destructive/10', text: 'text-destructive' },
  };

  const status = statusConfig[link.status] || statusConfig.expired;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => navigate('/dashboard/links')} className="text-xs text-text-tertiary font-sans hover:text-text-secondary transition-colors duration-150 mb-2 block">
            &larr; Back to links
          </button>
          <h1 className="font-sans font-semibold text-xl text-foreground">{link.name || <span className="font-mono">{link.id}</span>}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-sans px-2 py-0.5 rounded ${status.bg} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {link.status}
            </span>
            <span className={`text-xs font-mono uppercase ${link.file_type === 'video' ? 'text-accent' : 'text-text-tertiary'}`}>{link.file_type}</span>
            {link.file_type === 'video' && link.video_metadata ? (
              <>
                <span className="text-xs font-mono text-text-tertiary">
                  {Math.floor(link.video_metadata.duration / 60)}:{String(link.video_metadata.duration % 60).padStart(2, '0')}
                </span>
                <span className="text-xs font-mono text-text-tertiary">
                  {link.video_metadata.qualities.join(', ')}
                </span>
              </>
            ) : link.page_count ? (
              <span className="text-xs font-sans text-text-tertiary">{link.page_count} pages</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyUrl}
            className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-sans font-medium text-text-secondary hover:text-foreground hover:border-text-tertiary transition-all duration-150"
          >
            {copied ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </span>
            ) : 'Copy URL'}
          </button>
          {link.status === 'active' && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="px-3 py-1.5 border border-destructive/30 rounded-md text-xs font-sans font-medium text-destructive hover:bg-destructive/10 transition-all duration-150 disabled:opacity-40"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-sans">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-lg p-5 card-glow">
          <p className="text-xs text-text-tertiary font-sans uppercase tracking-wider mb-1">Total Views</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{link.view_count}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5 card-glow">
          <p className="text-xs text-text-tertiary font-sans uppercase tracking-wider mb-1">Unique Viewers</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{analytics?.unique_viewers ?? 0}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5 card-glow">
          <p className="text-xs text-text-tertiary font-sans uppercase tracking-wider mb-1">{link.file_type === 'video' ? 'Avg Watch Time' : 'Avg Duration'}</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{analytics?.avg_duration ?? 0}s</p>
        </div>
      </div>

      {/* Secure URL */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans font-medium text-sm text-foreground">Secure Link</h2>
          <button
            onClick={copyUrl}
            className="text-xs font-sans text-accent hover:text-accent-hover transition-colors duration-150"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="bg-input border border-border rounded-md p-3">
          <code className="text-sm text-text-secondary font-mono break-all select-all">{link.secure_url}</code>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <h2 className="font-sans font-medium text-sm text-foreground mb-4">Rules</h2>
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Expires</span>
            <span className="text-text-secondary font-sans">{link.rules.expires_at ? new Date(link.rules.expires_at).toLocaleDateString() : 'Never'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Max views</span>
            <span className="text-text-secondary font-mono tabular-nums">{link.rules.max_views ?? 'Unlimited'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Email required</span>
            <span className="text-text-secondary font-sans">{link.rules.require_email ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Password</span>
            <span className="text-text-secondary font-sans">{link.rules.has_password ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Watermark</span>
            <span className="text-text-secondary font-sans">{link.rules.watermark ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Download blocked</span>
            <span className="text-text-secondary font-sans">{link.rules.block_download ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Recent views */}
      {link.recent_views.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="font-sans font-medium text-sm text-foreground">Recent Views</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Viewer</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">{link.file_type === 'video' ? 'Watch Time' : 'Duration'}</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">{link.file_type === 'video' ? 'Progress' : 'Pages'}</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">Device</th>
                <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {link.recent_views.map((view, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-hover transition-colors duration-150">
                  <td className="px-5 py-2.5 text-sm font-sans text-text-secondary">{view.viewer_email || <span className="text-text-tertiary italic">anonymous</span>}</td>
                  <td className="px-5 py-2.5 text-sm font-mono text-text-secondary tabular-nums">{link.file_type === 'video' ? `${view.video_watch_time ?? view.duration}s` : `${view.duration}s`}</td>
                  <td className="px-5 py-2.5">
                    {link.file_type === 'video' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((view.completion_rate ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-text-tertiary tabular-nums">{Math.round((view.completion_rate ?? 0) * 100)}%</span>
                      </div>
                    ) : (
                      <span className="text-sm font-mono text-text-secondary tabular-nums">{view.pages_viewed}</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-xs font-sans text-text-tertiary">{view.device}</td>
                  <td className="px-5 py-2.5 text-xs font-sans text-text-tertiary text-right">{new Date(view.viewed_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
