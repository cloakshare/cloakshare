import { useAuth } from '../lib/auth';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="font-sans font-semibold text-xl text-foreground mb-8">Settings</h1>

      {/* Account info */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <h2 className="font-sans font-medium text-sm text-foreground mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Email</span>
            <span className="text-text-secondary font-mono">{user?.email}</span>
          </div>
          <div className="border-t border-border-subtle" />
          <div className="flex justify-between">
            <span className="text-text-tertiary font-sans">Plan</span>
            <span className="text-accent font-sans font-medium uppercase text-xs tracking-wider">{user?.plan}</span>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="font-sans font-medium text-sm text-foreground mb-4">Plan & Billing</h2>
        <p className="text-sm text-text-secondary font-sans mb-4">
          You're on the <span className="text-foreground font-medium">{user?.plan}</span> plan.
        </p>
        {user?.plan === 'free' && (
          <div className="bg-background border border-border-subtle rounded-md p-4">
            <p className="text-xs text-text-tertiary font-sans font-medium mb-2">Free tier limits</p>
            <ul className="text-xs text-text-secondary font-sans space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                50 links/month
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                500 views/month
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                7-day max expiry
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                10 API requests/min
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
