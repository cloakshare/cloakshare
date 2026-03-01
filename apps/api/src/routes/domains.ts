import { Hono } from 'hono';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { addDomain, verifyDomain, listDomains, deleteDomain } from '../services/domains.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { config } from '../lib/config.js';
import type { Variables } from '../lib/types.js';

const domainsRouter = new Hono<{ Variables: Variables }>();

// ============================================
// POST /v1/domains — Add a custom domain
// ============================================

domainsRouter.post('/v1/domains', apiKeyAuth, rateLimiter('default'), async (c) => {
  if (!config.features.customDomains) {
    return errorResponse(c, Errors.validation('Custom domains require a Growth or Scale plan'));
  }

  const user = c.get('user') as { id: string; plan: string };
  const org = c.get('org') as { plan: string } | undefined;
  const orgId = c.get('orgId') as string | undefined;

  const plan = org?.plan || user.plan;
  if (plan === 'free' || plan === 'starter') {
    return errorResponse(c, Errors.forbidden('Custom domains require a Growth or Scale plan'));
  }

  const { domain } = await c.req.json();
  if (!domain) {
    return errorResponse(c, Errors.validation('domain is required'));
  }

  try {
    const result = await addDomain(user.id, domain, orgId);
    return successResponse(c, result, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Domain operation failed';
    return errorResponse(c, Errors.validation(msg));
  }
});

// ============================================
// GET /v1/domains — List custom domains
// ============================================

domainsRouter.get('/v1/domains', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const domains = await listDomains(user.id, orgId);

  return successResponse(c, {
    domains: domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      cname_target: d.cnameTarget,
      verified: d.verified,
      verified_at: d.verifiedAt,
      created_at: d.createdAt,
    })),
  });
});

// ============================================
// POST /v1/domains/:id/verify — Verify DNS
// ============================================

domainsRouter.post('/v1/domains/:id/verify', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const domainId = c.req.param('id');

  try {
    const result = await verifyDomain(user.id, domainId, orgId);
    return successResponse(c, result);
  } catch {
    return errorResponse(c, Errors.notFound('Domain'));
  }
});

// ============================================
// DELETE /v1/domains/:id — Remove a custom domain
// ============================================

domainsRouter.delete('/v1/domains/:id', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const domainId = c.req.param('id');

  try {
    await deleteDomain(user.id, domainId, orgId);
    return successResponse(c, { id: domainId, deleted: true });
  } catch {
    return errorResponse(c, Errors.notFound('Domain'));
  }
});

export default domainsRouter;
