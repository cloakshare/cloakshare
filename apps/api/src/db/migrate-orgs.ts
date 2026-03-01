/**
 * Data migration script: creates personal org per user, moves resources to orgId.
 * Run once after deploying the org schema changes.
 *
 * Usage: npx tsx src/db/migrate-orgs.ts
 */
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import {
  users,
  organizations,
  orgMembers,
  apiKeys,
  links,
  webhookEndpoints,
  customDomains,
  usageRecords,
} from './schema.js';
import { generateId } from '../lib/utils.js';
import { logger } from '../lib/logger.js';

async function migrateOrgs() {
  logger.info('Starting org migration...');

  const allUsers = await db.select().from(users).all();
  logger.info({ count: allUsers.length }, 'Found users to migrate');

  let migrated = 0;
  let skipped = 0;

  for (const user of allUsers) {
    // Skip if user already has a defaultOrgId (already migrated)
    if (user.defaultOrgId) {
      skipped++;
      continue;
    }

    const orgId = generateId('org');
    const emailLocal = user.email.split('@')[0].replace(/[^a-z0-9-]/g, '-').slice(0, 40);
    let slug = emailLocal;

    // Handle slug collision
    const existingSlug = await db.select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .get();

    if (existingSlug) {
      slug = `${emailLocal}-${user.id.slice(-4)}`;
    }

    // Create personal org
    await db.insert(organizations).values({
      id: orgId,
      name: user.name || user.email.split('@')[0],
      slug,
      plan: user.plan,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });

    // Create owner membership
    await db.insert(orgMembers).values({
      id: generateId('mem'),
      orgId,
      userId: user.id,
      role: 'owner',
    });

    // Set defaultOrgId
    await db.update(users)
      .set({ defaultOrgId: orgId })
      .where(eq(users.id, user.id));

    // Migrate API keys
    await db.update(apiKeys)
      .set({ orgId })
      .where(eq(apiKeys.userId, user.id));

    // Migrate links
    await db.update(links)
      .set({ orgId })
      .where(eq(links.userId, user.id));

    // Migrate webhook endpoints
    await db.update(webhookEndpoints)
      .set({ orgId })
      .where(eq(webhookEndpoints.userId, user.id));

    // Migrate custom domains
    await db.update(customDomains)
      .set({ orgId })
      .where(eq(customDomains.userId, user.id));

    // Migrate usage records
    await db.update(usageRecords)
      .set({ orgId })
      .where(eq(usageRecords.userId, user.id));

    migrated++;
    logger.info({ userId: user.id, orgId, slug }, 'User migrated to personal org');
  }

  logger.info({ migrated, skipped, total: allUsers.length }, 'Org migration complete');
}

migrateOrgs().catch((err) => {
  logger.error({ err }, 'Org migration failed');
  process.exit(1);
});
