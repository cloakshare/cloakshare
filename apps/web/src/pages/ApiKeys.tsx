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

  return (
    <div>
      <h1 className="font-mono font-semibold text-xl text-foreground mb-8">API Keys</h1>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-6 text-destructive text-sm font-mono">
          {error}
        </div>
      )}

      {/* Create new key */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <h2 className="font-mono font-medium text-sm text-foreground mb-3">Create API Key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production)"
            className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
          />
          <button
            type="submit"
            disabled={creating || !newKeyName.trim()}
            className="px-4 py-2 bg-accent text-background font-mono font-medium text-sm rounded-md hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Show newly created key */}
      {newKey && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5 mb-6">
          <p className="text-sm text-foreground font-mono mb-2">Your new API key (save it now — it won't be shown again):</p>
          <div className="bg-background border border-border-subtle rounded-md p-3">
            <code className="text-sm text-accent font-mono break-all select-all">{newKey}</code>
          </div>
          <button
            onClick={() => setNewKey('')}
            className="mt-3 text-xs text-text-tertiary font-mono hover:text-text-secondary transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 bg-surface border border-border rounded-lg">
          <p className="text-text-secondary font-mono text-sm">No API keys</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-3">Key</th>
                <th className="text-left text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-3">Last used</th>
                <th className="text-right text-xs text-text-tertiary font-mono font-normal uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-5 py-3 text-sm font-mono text-foreground">{key.name}</td>
                  <td className="px-5 py-3 text-sm font-mono text-text-tertiary">{key.key_prefix}•••</td>
                  <td className="px-5 py-3 text-xs font-mono text-text-tertiary">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-xs font-mono text-destructive/70 hover:text-destructive transition-colors"
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
