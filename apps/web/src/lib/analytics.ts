// GA4 + PostHog analytics helpers
// All functions are safe to call even if gtag/posthog are not loaded.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    posthog?: import('posthog-js').PostHog;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

function posthog() {
  return typeof window !== 'undefined' ? window.posthog : undefined;
}

// ---- Tracking helpers ----

export function trackSignup(email: string, plan: string) {
  gtag('event', 'sign_up', {
    method: 'email',
    plan,
  });
  posthog()?.capture('sign_up', { email, plan });
}

export function trackLogin(email: string) {
  gtag('event', 'login', {
    method: 'email',
  });
  posthog()?.capture('login', { email });
}

export function trackLinkCreated(linkName: string) {
  gtag('event', 'link_created', {
    link_name: linkName,
  });
  posthog()?.capture('link_created', { link_name: linkName });
}

export function trackLinkViewed(linkName: string) {
  gtag('event', 'link_viewed', {
    link_name: linkName,
  });
  posthog()?.capture('link_viewed', { link_name: linkName });
}

export function trackPlanUpgraded(fromPlan: string, toPlan: string) {
  gtag('event', 'plan_upgraded', {
    from_plan: fromPlan,
    to_plan: toPlan,
  });
  posthog()?.capture('plan_upgraded', { from_plan: fromPlan, to_plan: toPlan });
}

export function identifyUser(userId: string, email: string, plan: string) {
  // GA4 user properties
  gtag('set', 'user_properties', {
    user_id: userId,
    email,
    plan,
  });
  gtag('set', { user_id: userId });

  // PostHog identify
  posthog()?.identify(userId, { email, plan });
}

export function resetAnalytics() {
  posthog()?.reset();
}
