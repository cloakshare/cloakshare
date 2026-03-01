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
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!link) return null;

  const statusColors: Record<string, string> = {
    active: 'bg-accent/15 text-accent',
    processing: 'bg-warning/15 text-warning',
    expired: 'bg-muted text-text-tertiary',
    revoked: 'bg-destructive/15 text-destructive',
    failed: 'bg-destructive/15 text-destructive',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => navigate('/dashboard/links')} className="text-xs text-text-tertiary font-mono hover:text-text-secondary transition-colors mb-2 block">
            &larr; Back to links
          </button>
          <h1 className="font-mono font-semibold text-xl text-foreground">{link.name || link.id}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${statusColors[link.status] || ''}`}>
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
              <span className="text-xs font-mono text-text-tertiary">{link.page_count} pages</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyUrl}
            className="px-3 py-1.5 bg-elevated border border-border rounded-md text-xs font-mono text-text-secondary hover:text-text-primary hover:border-text-tertiary transition-all"
          >
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
          {link.status === 'active' && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="px-3 py-1.5 border border-destructive/30 rounded-md text-xs font-mono text-destructive hover:bg-destructive/10 transition-all disabled:opacity-40"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Stats cards */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">Total Views</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{link.view_count}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">Unique Viewers</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{analytics?.unique_viewers ?? 0}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">{link.file_type === 'video' ? 'Avg Watch Time' : 'Avg Duration'}</p>
          <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">{analytics?.avg_duration ?? 0}s</p>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <h2 className="font-mono font-medium text-sm text-foreground mb-4">Rules</h2>
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Expires</span>
            <span className="text-text-secondary">{link.rules.expires_at ? new Date(link.rules.expires_at).toLocaleDateString() : 'Never'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Max views</span>
            <span className="text-text-secondary">{link.rules.max_views ?? 'Unlimited'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Email required</span>
            <span className="text-text-secondary">{link.rules.require_email ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Password</span>
            <span className="text-text-secondary">{link.rules.has_password ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Watermark</span>
            <span className="text-text-secondary">{link.rules.watermark ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Download blocked</span>
            <span className="text-text-secondary">{link.rules.block_download ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Recent views */}
      {link.recent_views.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h2 className="font-mono font-medium text-sm text-foreground">Recent Views</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-2.5">Viewer</th>
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-2.5">{link.file_type === 'video' ? 'Watch Time' : 'Duration'}</th>
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-2.5">{link.file_type === 'video' ? 'Progress' : 'Pages'}</th>
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-2.5">Device</th>
                <th className="text-right text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {link.recent_views.map((view, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-0">
                  <td className="px-5 py-2.5 text-sm font-mono text-text-secondary">{view.viewer_email || 'anonymous'}</td>
                  <td className="px-5 py-2.5 text-sm font-mono text-text-secondary tabular-nums">{link.file_type === 'video' ? `${view.video_watch_time ?? view.duration}s` : `${view.duration}s`}</td>
                  <td className="px-5 py-2.5 text-sm font-mono text-text-secondary tabular-nums">{link.file_type === 'video' ? `${Math.round((view.completion_rate ?? 0) * 100)}%` : view.pages_viewed}</td>
                  <td className="px-5 py-2.5 text-xs font-mono text-text-tertiary">{view.device}</td>
                  <td className="px-5 py-2.5 text-xs font-mono text-text-tertiary text-right">{new Date(view.viewed_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
