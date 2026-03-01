import { useEffect, useState } from 'react';
import { apiKeysApi } from '../lib/api';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    apiKeysApi.list()
      .then((data) => setKeys(data.api_keys))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load API keys');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const result = await apiKeysApi.create(newKeyName.trim());
      setNewKey(result.key);
      setNewKeyName('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await apiKeysApi.revoke(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const copyNewKey = () => {
    navigator.clipboard.writeText(newKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  return (
    <div>
      <h1 className="font-sans font-semibold text-xl text-foreground mb-8">API Keys</h1>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-sans">
          {error}
        </div>
      )}

      {/* Create new key */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <h2 className="font-sans font-medium text-sm text-foreground mb-3">Create API Key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production)"
            className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
          />
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="px-4 py-2 bg-accent text-background font-sans font-medium text-sm rounded-md hover:bg-accent-hover hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Show newly created key */}
      {newKey && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground font-sans">Your new API key — save it now, it won't be shown again.</p>
            <button
              onClick={copyNewKey}
              className="text-xs font-sans text-accent hover:text-accent-hover transition-colors duration-150"
            >
              {copiedKey ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-input border border-border rounded-md p-3">
            <code className="text-sm text-accent font-mono break-all select-all">{newKey}</code>
          </div>
          <button
            onClick={() => setNewKey('')}
            className="mt-3 text-xs text-text-tertiary font-sans hover:text-text-secondary transition-colors duration-150"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-3 w-32 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 bg-surface border border-border rounded-lg">
          <svg className="w-10 h-10 text-text-tertiary mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-text-secondary font-sans text-sm">No API keys</p>
          <p className="text-text-tertiary font-sans text-xs mt-1">Create one above to get started</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-3">Key</th>
                <th className="text-left text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-3">Last used</th>
                <th className="text-right text-xs text-text-tertiary font-sans font-medium uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border-subtle last:border-0 hover:bg-hover transition-colors duration-150">
                  <td className="px-5 py-3 text-sm font-sans text-foreground">{key.name}</td>
                  <td className="px-5 py-3 text-sm font-mono text-text-tertiary">{key.key_prefix}•••</td>
                  <td className="px-5 py-3 text-xs font-sans text-text-tertiary">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-xs font-sans font-medium text-destructive/70 hover:text-destructive transition-colors duration-150"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
