import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// USERS & AUTH
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // nanoid
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull().default('free'), // free | starter | growth | scale
  defaultOrgId: text('default_org_id'), // Active org for dashboard sessions
  spendingCap: integer('spending_cap'), // Monthly spending cap in cents, null = unlimited
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  emailVerifiedAt: text('email_verified_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(), // nanoid
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'), // Organization this key belongs to
  name: text('name').notNull(), // "Production", "Test", etc.
  keyHash: text('key_hash').notNull(), // SHA-256 hash of the key
  keyPrefix: text('key_prefix').notNull(), // First 12 chars for display: "ck_live_a1b2..."
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text('revoked_at'), // Soft delete
}, (table) => [
  index('idx_api_keys_key_hash').on(table.keyHash),
  index('idx_api_keys_user_id').on(table.userId),
]);

// ============================================
// SESSIONS (Dashboard auth)
// ============================================

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_sessions_token').on(table.token),
  index('idx_sessions_expires').on(table.expiresAt),
]);

// ============================================
// LINKS
// ============================================

export const links = sqliteTable('links', {
  id: text('id').primaryKey(), // nanoid (used in secure URL token)
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'), // Organization that owns this link

  // Source file info
  originalFilename: text('original_filename'),
  fileType: text('file_type').notNull(), // pdf | png | jpg | webp
  originalMimeType: text('original_mime_type'), // Original MIME type for office docs (e.g. application/vnd.openxmlformats-officedocument.wordprocessingml.document)
  fileSize: integer('file_size'), // bytes
  pageCount: integer('page_count'),

  // Video-specific fields
  videoDuration: integer('video_duration'), // seconds
  videoWidth: integer('video_width'),
  videoHeight: integer('video_height'),
  videoQualities: text('video_qualities'), // JSON array: ["720p", "1080p"]

  // Rendered content location
  r2Prefix: text('r2_prefix').notNull(), // "renders/{linkId}/"

  // Security rules
  expiresAt: text('expires_at'), // ISO timestamp, null = never
  maxViews: integer('max_views'), // null = unlimited
  requireEmail: integer('require_email', { mode: 'boolean' }).default(true),
  allowedDomains: text('allowed_domains'), // JSON array: ["@acme.com"]
  passwordHash: text('password_hash'), // bcrypt hash of password
  blockDownload: integer('block_download', { mode: 'boolean' }).default(true),

  // Watermark config
  watermarkEnabled: integer('watermark_enabled', { mode: 'boolean' }).default(true),
  watermarkTemplate: text('watermark_template').default('{{email}} · {{date}} · {{session_id}}'),

  // Notification
  notifyUrl: text('notify_url'), // Webhook URL for view events
  notifyEmail: text('notify_email'), // Email to notify on view

  // Branding (Growth+ tiers)
  customDomainId: text('custom_domain_id'),
  brandLogo: text('brand_logo'), // storage path to logo image
  brandColor: text('brand_color'), // Hex color
  brandName: text('brand_name'), // Displayed in viewer

  // Status
  // processing — file uploaded, rendering in progress
  // active     — rendered and viewable
  // expired    — past expires_at or max_views reached
  // revoked    — manually revoked by owner
  // failed     — rendering failed after all retries
  status: text('status').notNull().default('processing'),
  viewCount: integer('view_count').notNull().default(0),

  // Metadata
  name: text('name'), // Optional friendly name
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_links_user_id').on(table.userId),
  index('idx_links_status').on(table.status),
  index('idx_links_created_at').on(table.createdAt),
  index('idx_links_user_status_created').on(table.userId, table.status, table.createdAt),
]);

// ============================================
// VIEWS (Analytics Events)
// ============================================

export const views = sqliteTable('views', {
  id: text('id').primaryKey(), // nanoid
  linkId: text('link_id').notNull().references(() => links.id),

  // Viewer identity
  viewerEmail: text('viewer_email'),
  viewerIp: text('viewer_ip'),
  viewerUserAgent: text('viewer_user_agent'),
  viewerCountry: text('viewer_country'),
  viewerCity: text('viewer_city'),
  viewerDevice: text('viewer_device'), // desktop | mobile | tablet
  viewerBrowser: text('viewer_browser'),
  viewerOs: text('viewer_os'),

  // Engagement
  duration: integer('duration'), // Total seconds spent viewing
  pagesViewed: integer('pages_viewed'),
  pageDetails: text('page_details'), // JSON: [{"page":1,"seconds":12},...]
  completionRate: real('completion_rate'), // 0.0 - 1.0

  // Video engagement
  videoWatchTime: integer('video_watch_time'), // total seconds watched
  videoMaxReached: real('video_max_reached'), // furthest point reached (seconds)

  // Session
  sessionToken: text('session_token'), // Unique per view session
  returnVisit: integer('return_visit', { mode: 'boolean' }).default(false),

  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  endedAt: text('ended_at'),
}, (table) => [
  index('idx_views_link_id').on(table.linkId),
  index('idx_views_created_at').on(table.createdAt),
  index('idx_views_viewer_email').on(table.viewerEmail),
  index('idx_views_session').on(table.sessionToken),
]);

// ============================================
// VIEWER SESSIONS (Email gate auth)
// ============================================

export const viewerSessions = sqliteTable('viewer_sessions', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id),
  viewerEmail: text('viewer_email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_viewer_sessions_token').on(table.token),
  index('idx_viewer_sessions_link').on(table.linkId),
]);

// ============================================
// WEBHOOKS
// ============================================

export const webhookEndpoints = sqliteTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'), // Organization this endpoint belongs to
  url: text('url').notNull(),
  secret: text('secret').notNull(), // For HMAC signing
  events: text('events').notNull(), // JSON array: ["link.viewed", "link.expired"]
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull().references(() => webhookEndpoints.id),
  event: text('event').notNull(),
  payload: text('payload').notNull(), // JSON
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRetryAt: text('next_retry_at'),
  deliveredAt: text('delivered_at'),
  failedAt: text('failed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_webhook_deliveries_next_retry').on(table.nextRetryAt),
]);

// ============================================
// CUSTOM DOMAINS
// ============================================

export const customDomains = sqliteTable('custom_domains', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'), // Organization this domain belongs to
  domain: text('domain').notNull().unique(), // "docs.their-saas.com"
  verified: integer('verified', { mode: 'boolean' }).default(false),
  verifiedAt: text('verified_at'),
  cnameTarget: text('cname_target').notNull(), // "view.cloakshare.dev"
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// USAGE TRACKING (for billing)
// ============================================

export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'), // Organization for billing
  type: text('type').notNull(), // link_created | view_recorded
  quantity: integer('quantity').notNull().default(1),
  stripeReported: integer('stripe_reported', { mode: 'boolean' }).default(false),
  periodStart: text('period_start').notNull(), // Billing period
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_usage_records_user_period').on(table.userId, table.periodStart),
]);

// ============================================
// ORGANIZATIONS
// ============================================

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(), // nanoid with org_ prefix
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL-safe identifier
  plan: text('plan').notNull().default('free'), // free | starter | growth | scale
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(), // nanoid with mem_ prefix
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'), // owner | admin | member | viewer
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('idx_org_members_org_user').on(table.orgId, table.userId),
  index('idx_org_members_user_id').on(table.userId),
]);

export const orgInvites = sqliteTable('org_invites', {
  id: text('id').primaryKey(), // nanoid with inv_ prefix
  orgId: text('org_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'), // Role to assign on accept
  tokenHash: text('token_hash').notNull(), // SHA-256 hash of invite token
  tokenPrefix: text('token_prefix').notNull(), // First 8 chars for display
  invitedBy: text('invited_by').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_org_invites_token_hash').on(table.tokenHash),
  index('idx_org_invites_org_id').on(table.orgId),
  index('idx_org_invites_email').on(table.email),
]);

// ============================================
// AUDIT LOG
// ============================================

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(), // nanoid with aud_ prefix
  orgId: text('org_id').notNull(),
  actorId: text('actor_id').notNull(), // user ID or "system"
  actorType: text('actor_type').notNull().default('user'), // user | api_key | system
  actorLabel: text('actor_label').notNull(), // Denormalized: email or key prefix
  action: text('action').notNull(), // e.g. "link.created", "member.invited"
  resourceType: text('resource_type'), // link | api_key | webhook | member | org | domain
  resourceId: text('resource_id'),
  resourceLabel: text('resource_label'), // Denormalized: link name, email, etc.
  metadata: text('metadata'), // JSON: { before: {...}, after: {...} } for SOC 2
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_audit_log_org_id').on(table.orgId),
  index('idx_audit_log_org_created').on(table.orgId, table.createdAt),
  index('idx_audit_log_action').on(table.action),
  index('idx_audit_log_actor_id').on(table.actorId),
  index('idx_audit_log_resource').on(table.resourceType, table.resourceId),
]);

// ============================================
// RENDERING JOBS (Background queue)
// ============================================

export const renderingJobs = sqliteTable('rendering_jobs', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id),
  sourceKey: text('source_key').notNull(), // temp/{uploadId}/{filename} — location of uploaded file
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  progress: text('progress'), // JSON: { currentPage: 3, totalPages: 12, message: "..." }
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_rendering_jobs_status').on(table.status),
]);

// ============================================
// NOTIFICATIONS (Real-time view alerts)
// ============================================

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'),
  type: text('type').notNull(), // link.viewed | link.expired | link.ready | link.failed
  linkId: text('link_id').references(() => links.id),
  linkName: text('link_name'),
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON: { viewer_email, device, country, ... }
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_notifications_user_id').on(table.userId),
  index('idx_notifications_user_read').on(table.userId, table.read),
  index('idx_notifications_created_at').on(table.createdAt),
]);
