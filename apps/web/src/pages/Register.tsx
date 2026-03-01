import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const key = await register(email, password);
      setApiKey(key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-mono font-semibold text-lg text-foreground mb-2">Account created</h2>
            <p className="text-sm text-text-secondary mb-4">Save your API key — it won't be shown again.</p>

            <div className="bg-background border border-border-subtle rounded-md p-3 mb-6">
              <code className="text-sm text-accent font-mono break-all select-all">{apiKey}</code>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-accent text-background font-mono font-medium text-sm py-2.5 rounded-md hover:bg-accent/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-mono font-bold text-2xl text-foreground tracking-tight">CloakShare</h1>
          <p className="text-sm text-text-secondary mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-6">
          <div className="mb-4">
            <label className="block text-xs text-text-tertiary mb-1.5 font-mono uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs text-text-tertiary mb-1.5 font-mono uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive mb-4 font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-background font-mono font-medium text-sm py-2.5 rounded-md hover:bg-accent/90 hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-tertiary mt-4 font-mono">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:opacity-80 transition-opacity">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
