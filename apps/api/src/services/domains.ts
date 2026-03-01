import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customDomains, users } from '../db/schema.js';
import { generateId } from '../lib/utils.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import dns from 'dns/promises';

const CNAME_TARGET = config.viewerUrl ? new URL(config.viewerUrl).hostname : 'view.cloakshare.dev';

/**
 * Add a custom domain for a user.
 */
export async function addDomain(userId: string, domain: string, orgId?: string) {
  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new Error('Invalid domain format');
  }

  // Check if domain is already registered
  const existing = await db.select().from(customDomains)
    .where(eq(customDomains.domain, domain.toLowerCase()))
    .get();

  if (existing) {
    throw new Error('Domain is already registered');
  }

  const id = generateId('dom');
  await db.insert(customDomains).values({
    id,
    userId,
    orgId: orgId || null,
    domain: domain.toLowerCase(),
    cnameTarget: CNAME_TARGET,
  });

  logger.info({ userId, domain }, 'Custom domain added');

  return {
    id,
    domain: domain.toLowerCase(),
    cname_target: CNAME_TARGET,
    verified: false,
  };
}

/**
 * Verify a custom domain's DNS configuration.
 */
export async function verifyDomain(userId: string, domainId: string, orgId?: string) {
  const ownerCondition = orgId ? eq(customDomains.orgId, orgId) : eq(customDomains.userId, userId);
  const domain = await db.select().from(customDomains)
    .where(and(eq(customDomains.id, domainId), ownerCondition))
    .get();

  if (!domain) {
    throw new Error('Domain not found');
  }

  if (domain.verified) {
    return { verified: true, domain: domain.domain };
  }

  try {
    const records = await dns.resolveCname(domain.domain);
    const hasCorrectCname = records.some(
      (record) => record.toLowerCase() === domain.cnameTarget.toLowerCase(),
    );

    if (hasCorrectCname) {
      await db.update(customDomains).set({
        verified: true,
        verifiedAt: new Date().toISOString(),
      }).where(eq(customDomains.id, domainId));

      logger.info({ userId, domain: domain.domain }, 'Custom domain verified');
      return { verified: true, domain: domain.domain };
    }

    return {
      verified: false,
      domain: domain.domain,
      expected_cname: domain.cnameTarget,
      message: `CNAME record not found. Add a CNAME record pointing ${domain.domain} to ${domain.cnameTarget}`,
    };
  } catch (error: any) {
    return {
      verified: false,
      domain: domain.domain,
      expected_cname: domain.cnameTarget,
      message: `DNS lookup failed: ${error.code || error.message}. Add a CNAME record pointing ${domain.domain} to ${domain.cnameTarget}`,
    };
  }
}

/**
 * List all custom domains for a user.
 */
export async function listDomains(userId: string, orgId?: string) {
  const ownerCondition = orgId ? eq(customDomains.orgId, orgId) : eq(customDomains.userId, userId);
  return db.select().from(customDomains)
    .where(ownerCondition)
    .all();
}

/**
 * Delete a custom domain.
 */
export async function deleteDomain(userId: string, domainId: string, orgId?: string) {
  const ownerCondition = orgId ? eq(customDomains.orgId, orgId) : eq(customDomains.userId, userId);
  const domain = await db.select().from(customDomains)
    .where(and(eq(customDomains.id, domainId), ownerCondition))
    .get();

  if (!domain) {
    throw new Error('Domain not found');
  }

  await db.delete(customDomains).where(eq(customDomains.id, domainId));
  logger.info({ userId, domain: domain.domain }, 'Custom domain deleted');
}
