import { useAuth } from '../lib/auth';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="font-mono font-semibold text-xl text-foreground mb-8">Settings</h1>

      {/* Account info */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <h2 className="font-mono font-medium text-sm text-foreground mb-4">Account</h2>
        <div className="space-y-3 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Email</span>
            <span className="text-text-secondary">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Plan</span>
            <span className="text-accent uppercase text-xs tracking-wider">{user?.plan}</span>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="font-mono font-medium text-sm text-foreground mb-4">Plan & Billing</h2>
        <p className="text-sm text-text-secondary font-mono mb-4">
          You're on the <span className="text-foreground">{user?.plan}</span> plan.
        </p>
        {user?.plan === 'free' && (
          <div className="bg-background border border-border-subtle rounded-md p-4">
            <p className="text-xs text-text-tertiary font-mono mb-2">Free tier limits:</p>
            <ul className="text-xs text-text-secondary font-mono space-y-1">
              <li>50 links/month</li>
              <li>500 views/month</li>
              <li>7-day max expiry</li>
              <li>10 API requests/min</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
