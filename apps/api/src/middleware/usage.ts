import type { Next } from 'hono';
import type { Context } from 'hono';
import { eq, and, like, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links } from '../db/schema.js';
import { PLAN_LIMITS } from '@cloak/shared';
import { getCurrentMonth } from '../lib/utils.js';
import { Errors, errorResponse } from '../lib/errors.js';
import type { Plan } from '@cloak/shared';

export async function enforceUsageLimits(c: Context<{ Variables: Record<string, any> }>, next: Next) {
  const user = c.get('user') as { id: string; plan: string };
  const org = c.get('org') as { id: string; plan: string } | undefined;

  // Use org plan if available, fall back to user plan
  const plan = (org?.plan || user.plan) as Plan;
  const limits = PLAN_LIMITS[plan];

  if (!limits) {
    await next();
    return;
  }

  const currentMonth = getCurrentMonth();

  // Count by orgId if available, else by userId
  const ownerCondition = org
    ? eq(links.orgId, org.id)
    : eq(links.userId, user.id);

  const result = await db
    .select({ count: count() })
    .from(links)
    .where(
      and(
        ownerCondition,
        like(links.createdAt, `${currentMonth}%`),
      ),
    )
    .get();

  const linkCount = result?.count ?? 0;

  if (linkCount >= limits.linksPerMonth) {
    return errorResponse(
      c,
      Errors.limitReached(
        `${plan === 'free' ? 'Free tier' : plan.charAt(0).toUpperCase() + plan.slice(1) + ' plan'} limit: ${limits.linksPerMonth} links per month. ${plan === 'free' ? 'Upgrade at https://cloakshare.dev/pricing' : 'Contact support for higher limits.'}`,
      ),
    );
  }

  // Spending cap enforcement: if a cap is set and user has exceeded plan limits,
  // check if overage cost would exceed the cap
  const spendingCap = (user as { spendingCap?: number | null }).spendingCap;
  if (spendingCap && linkCount >= limits.linksPerMonth) {
    // Overage rates in cents per link
    const overageRates: Record<string, number> = { starter: 8, growth: 6, scale: 4 };
    const rate = overageRates[plan] || 0;
    const overageLinks = linkCount - limits.linksPerMonth;
    const overageCostCents = overageLinks * rate;

    if (overageCostCents >= spendingCap) {
      return errorResponse(
        c,
        Errors.limitReached(
          `Spending cap reached ($${(spendingCap / 100).toFixed(2)}). Increase your cap in billing settings or upgrade your plan.`,
        ),
      );
    }
  }

  // Set usage headers so clients can track remaining quota
  c.header('X-Usage-Limit', String(limits.linksPerMonth));
  c.header('X-Usage-Used', String(linkCount));
  c.header('X-Usage-Remaining', String(Math.max(0, limits.linksPerMonth - linkCount)));

  await next();
}
