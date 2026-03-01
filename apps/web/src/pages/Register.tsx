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
          <div className="bg-surface border border-border rounded-lg p-8">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="font-sans font-semibold text-lg text-foreground">Account created</h2>
            </div>
            <p className="text-sm text-text-secondary font-sans mb-4">Save your API key — it won't be shown again.</p>

            <div className="bg-input border border-border rounded-md p-3 mb-6">
              <code className="text-sm text-accent font-mono break-all select-all">{apiKey}</code>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-accent text-background font-sans font-medium text-sm py-2.5 rounded-md hover:bg-accent-hover transition-colors"
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
          <h1 className="font-mono font-bold text-xl text-foreground tracking-tight">CloakShare</h1>
          <p className="text-sm text-text-secondary mt-2 font-sans">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-8 card-glow">
          <div className="mb-5">
            <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
              <p className="text-sm text-destructive font-sans">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-background font-sans font-medium text-sm py-2.5 rounded-md hover:bg-accent-hover hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-text-tertiary mt-5 font-sans">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
