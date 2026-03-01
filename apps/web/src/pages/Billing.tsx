import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { billingApi } from '../lib/api';

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '50 links/month',
      '500 views/month',
      '7-day max expiry',
      '10 API req/min',
      'Community support',
    ],
  },
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '$29',
    period: '/month',
    features: [
      '500 links/month',
      '5,000 views/month',
      '90-day max expiry',
      '60 API req/min',
      'Webhooks',
      'Email support',
    ],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    price: '$99',
    period: '/month',
    features: [
      '2,500 links/month',
      '25,000 views/month',
      '1-year max expiry',
      '300 API req/min',
      'Custom domains',
      'Custom branding',
      'Priority support',
    ],
  },
  {
    id: 'scale' as const,
    name: 'Scale',
    price: '$299',
    period: '/month',
    features: [
      '10,000 links/month',
      '100,000 views/month',
      'No expiry limits',
      '1,000 API req/min',
      'Everything in Growth',
      'Embedded viewer',
      'SSO/SAML',
      'Dedicated support',
    ],
  },
];

export default function Billing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleUpgrade = async (planId: 'starter' | 'growth' | 'scale') => {
    setLoading(planId);
    setError('');
    try {
      const { checkout_url } = await billingApi.checkout(planId);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    }
    setLoading(null);
  };

  const handleManage = async () => {
    setLoading('manage');
    setError('');
    try {
      const { portal_url } = await billingApi.portal();
      window.location.href = portal_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
    setLoading(null);
  };

  const currentPlan = user?.plan || 'free';

  return (
    <div>
      <h1 className="font-sans font-semibold text-xl text-foreground mb-2">Plan & Billing</h1>
      <p className="text-sm text-text-secondary font-sans mb-8">
        You're on the <span className="text-accent font-medium">{currentPlan}</span> plan.
      </p>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-destructive font-sans">{error}</p>
        </div>
      )}

      {/* Manage subscription button for paid plans */}
      {currentPlan !== 'free' && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans font-medium text-sm text-foreground">Manage Subscription</h2>
              <p className="text-xs text-text-tertiary font-sans mt-1">
                Update payment method, change plan, or cancel
              </p>
            </div>
            <button
              onClick={handleManage}
              disabled={loading === 'manage'}
              className="px-4 py-2 bg-elevated border border-border rounded-md text-sm font-sans font-medium text-text-secondary hover:text-foreground hover:border-text-tertiary transition-all duration-150 disabled:opacity-40"
            >
              {loading === 'manage' ? 'Opening...' : 'Billing Portal'}
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = !isCurrent && plan.id !== 'free';

          return (
            <div
              key={plan.id}
              className={`bg-surface border rounded-lg p-5 card-glow ${
                isCurrent ? 'border-accent/40' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-sans font-medium text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-mono font-semibold text-foreground tabular-nums">{plan.price}</span>
                    <span className="text-xs text-text-tertiary font-sans">{plan.period}</span>
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-xs font-sans font-medium px-2 py-0.5 rounded bg-accent/15 text-accent">
                    Current
                  </span>
                )}
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs font-sans text-text-secondary">
                    <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {isUpgrade && (
                <button
                  onClick={() => handleUpgrade(plan.id as 'starter' | 'growth' | 'scale')}
                  disabled={loading === plan.id}
                  className="w-full px-4 py-2 bg-accent text-background font-sans font-medium text-sm rounded-md hover:bg-accent-hover hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading === plan.id ? 'Redirecting...' : 'Upgrade'}
                </button>
              )}
              {isCurrent && plan.id !== 'free' && (
                <button
                  onClick={handleManage}
                  disabled={loading === 'manage'}
                  className="w-full px-4 py-2 bg-elevated border border-border rounded-md text-sm font-sans font-medium text-text-secondary hover:text-foreground hover:bg-hover transition-all duration-150 disabled:opacity-40"
                >
                  Manage
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
