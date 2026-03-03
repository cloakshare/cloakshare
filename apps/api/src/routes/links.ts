import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links, views, renderingJobs } from '../db/schema.js';
import { apiKeyAuth } from '../middleware/apiKey.js';
import { enforceUsageLimits } from '../middleware/usage.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { generateId } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { createStorage } from '../services/storage.js';
import { MAX_FILE_SIZE, ALL_SUPPORTED_EXTENSIONS, OFFICE_FILE_EXTENSIONS, OFFICE_MIME_TYPES, VIDEO_FILE_EXTENSIONS, VIDEO_MAX_FILE_SIZE, PLAN_LIMITS } from '@cloak/shared';
import type { Plan } from '@cloak/shared';
import { dispatchWebhook } from '../services/webhooks.js';
import { reportUsage } from '../services/billing.js';
import { logAudit, auditorFromContext } from '../services/audit.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import type { Variables } from '../lib/types.js';

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const linksRouter = new Hono<{ Variables: Variables }>();

// ============================================
// POST /v1/links/upload-url — Get presigned upload URL
// ============================================

linksRouter.post('/v1/links/upload-url', apiKeyAuth, rateLimiter('upload'), async (c) => {
  const { filename, content_type, file_size } = await c.req.json();

  if (!filename || !content_type) {
    return errorResponse(c, Errors.validation('filename and content_type are required'));
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  const isVideoUpload = ext && (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext);

  if (isVideoUpload && !config.features.video) {
    return errorResponse(c, Errors.forbidden('Video uploads require video support to be enabled'));
  }

  const maxSize = isVideoUpload ? VIDEO_MAX_FILE_SIZE : MAX_FILE_SIZE;
  if (file_size && file_size > maxSize) {
    return errorResponse(c, Errors.fileTooLarge(maxSize / 1_000_000));
  }

  const uploadId = nanoid();
  const r2Key = `temp/${uploadId}/${filename}`;
  const storage = createStorage();

  const presignedUrl = await storage.getPresignedUploadUrl(r2Key, content_type, 900);

  return successResponse(c, {
    upload_id: uploadId,
    upload_url: presignedUrl,
    r2_key: r2Key,
    expires_in: 900,
  });
});

// ============================================
// POST /v1/links — Create a secure link
// ============================================

linksRouter.post('/v1/links', apiKeyAuth, rateLimiter('upload'), enforceUsageLimits, async (c) => {
  const user = c.get('user') as { id: string; plan: string };
  const orgId = c.get('orgId') as string | undefined;
  const contentType = c.req.header('content-type') || '';
  const isAsync = c.req.query('async') === 'true';

  let fileBuffer: Buffer | null = null;
  let originalFilename = 'document.pdf';
  let fileType = 'pdf';
  let fileSize = 0;
  let r2Key: string | null = null;

  const storage = createStorage();

  if (contentType.includes('multipart/form-data')) {
    // Direct upload flow
    const body = await c.req.parseBody();
    const file = body['file'] as File | undefined;

    if (!file) {
      return errorResponse(c, Errors.validation('file is required'));
    }

    const multipartExt = file.name?.split('.').pop()?.toLowerCase();
    const isVideoFile = multipartExt && (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(multipartExt);

    if (isVideoFile && !config.features.video) {
      return errorResponse(c, Errors.forbidden('Video uploads require video support to be enabled'));
    }

    const multipartMaxSize = isVideoFile ? VIDEO_MAX_FILE_SIZE : MAX_FILE_SIZE;
    if (file.size > multipartMaxSize) {
      return errorResponse(c, Errors.fileTooLarge(multipartMaxSize / 1_000_000));
    }

    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    originalFilename = file.name || 'document.pdf';
    fileSize = file.size;

    // Determine file type
    const ext = originalFilename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') fileType = 'pdf';
    else if (ext === 'png') fileType = 'png';
    else if (ext === 'jpg' || ext === 'jpeg') fileType = 'jpg';
    else if (ext === 'webp') fileType = 'webp';
    else if (ext && (OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext)) fileType = 'pdf'; // Will be converted to PDF
    else if (ext && (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext)) fileType = 'video';
    else {
      return errorResponse(c, Errors.invalidFileType([...ALL_SUPPORTED_EXTENSIONS]));
    }

    // Validate PDF magic bytes (only for actual .pdf uploads, not office docs pending conversion)
    if (ext === 'pdf') {
      if (fileBuffer.length < 5 || fileBuffer.subarray(0, 5).toString() !== '%PDF-') {
        return errorResponse(c, Errors.validation('File does not appear to be a valid PDF'));
      }

      // Sanitization: reject PDFs with embedded JavaScript (CORRECTIONS SEC 4)
      const pdfStr = fileBuffer.toString('latin1');
      if (/\/JS\s/.test(pdfStr) || /\/JavaScript\s/.test(pdfStr)) {
        return errorResponse(c, Errors.validation('PDF contains embedded JavaScript which is not allowed'));
      }
    }

    // Upload original to temp storage
    r2Key = `temp/${nanoid()}/${originalFilename}`;
    await storage.upload(r2Key, fileBuffer, file.type);
  } else {
    // Presigned upload flow — file is already in storage
    const body = await c.req.json();
    r2Key = body.upload_r2_key;
    originalFilename = body.filename || 'document.pdf';

    if (!r2Key) {
      return errorResponse(c, Errors.validation('upload_r2_key is required when not using multipart upload'));
    }

    const ext = originalFilename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') fileType = 'pdf';
    else if (ext === 'png') fileType = 'png';
    else if (ext === 'jpg' || ext === 'jpeg') fileType = 'jpg';
    else if (ext === 'webp') fileType = 'webp';
    else if (ext && (OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext)) fileType = 'pdf';
    else if (ext && (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      if (!config.features.video) {
        return errorResponse(c, Errors.forbidden('Video uploads require video support to be enabled'));
      }
      fileType = 'video';
    }
    else fileType = 'pdf';
  }

  // Parse link options from body
  const body = contentType.includes('multipart/form-data')
    ? await c.req.parseBody()
    : await c.req.json().catch(() => ({}));

  const name = (body.name as string) || null;
  const expiresIn = body.expires_in as string | undefined;
  const expiresAtRaw = body.expires_at as string | undefined;
  const maxViews = body.max_views ? parseInt(body.max_views as string, 10) : null;
  const requireEmail = body.require_email !== 'false' && body.require_email !== false;
  const allowedDomains = body.allowed_domains
    ? (typeof body.allowed_domains === 'string' ? safeJsonParse(body.allowed_domains, null) : body.allowed_domains)
    : null;
  const password = body.password as string | undefined;
  const blockDownload = body.block_download !== 'false' && body.block_download !== false;
  const watermark = body.watermark !== 'false' && body.watermark !== false;
  const watermarkTemplate = (body.watermark_template as string) || undefined;
  const notifyUrl = (body.notify_url as string) || null;
  const notifyEmail = (body.notify_email as string) || null;

  // ============================================
  // PLAN ENFORCEMENT — feature gates per tier
  // ============================================
  const plan = (c.get('org') as { plan: string } | undefined)?.plan || user.plan;
  const planLimits = PLAN_LIMITS[plan as Plan];

  // File type gate: Free = PDF + images only, Starter = + Office, Growth+ = + Video
  const ext = originalFilename.split('.').pop()?.toLowerCase();
  if (ext && (OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext) && plan === 'free') {
    return errorResponse(c, Errors.forbidden('Office document support requires a Starter plan or above. Upgrade at https://cloakshare.dev/pricing'));
  }
  if (fileType === 'video' && (plan === 'free' || plan === 'starter')) {
    return errorResponse(c, Errors.forbidden('Video sharing requires a Growth plan or above. Upgrade at https://cloakshare.dev/pricing'));
  }

  // Password gate: Starter+ only
  if (password && !planLimits?.passwordProtection) {
    return errorResponse(c, Errors.forbidden('Password protection requires a Starter plan or above. Upgrade at https://cloakshare.dev/pricing'));
  }

  // Watermark gate: Free tier must have watermarks enabled
  if (!watermark && plan === 'free') {
    return errorResponse(c, Errors.forbidden('Watermarks cannot be disabled on the Free plan. Upgrade at https://cloakshare.dev/pricing'));
  }

  // Calculate expiry
  let expiresAt: string | null = null;
  if (expiresAtRaw) {
    expiresAt = new Date(expiresAtRaw).toISOString();
  } else if (expiresIn) {
    const match = (expiresIn as string).match(/^(\d+)(h|d|y)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const ms = unit === 'h' ? value * 3600000
        : unit === 'd' ? value * 86400000
        : value * 365 * 86400000;
      expiresAt = new Date(Date.now() + ms).toISOString();
    }
  }

  // Expiry gate: enforce max expiry per plan
  if (expiresAt && planLimits && planLimits.maxExpiryDays > 0) {
    const maxMs = planLimits.maxExpiryDays * 86400000;
    const expiryMs = new Date(expiresAt).getTime() - Date.now();
    if (expiryMs > maxMs) {
      return errorResponse(c, Errors.forbidden(`Your plan allows a maximum expiry of ${planLimits.maxExpiryDays} days. Upgrade at https://cloakshare.dev/pricing`));
    }
  }

  // Create link record
  const linkId = generateId('lnk');
  const r2Prefix = `renders/${linkId}/`;
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  // Detect original MIME type for office docs
  const originalMimeType = contentType.includes('multipart/form-data')
    ? Object.entries(OFFICE_MIME_TYPES).find(([, v]) => v === originalFilename.split('.').pop()?.toLowerCase())?.[0] || null
    : null;

  await db.insert(links).values({
    id: linkId,
    userId: user.id,
    orgId: orgId || null,
    originalFilename,
    fileType,
    originalMimeType,
    fileSize,
    r2Prefix,
    expiresAt,
    maxViews,
    requireEmail,
    allowedDomains: allowedDomains ? JSON.stringify(allowedDomains) : null,
    passwordHash,
    blockDownload,
    watermarkEnabled: watermark,
    watermarkTemplate,
    notifyUrl,
    notifyEmail,
    status: 'processing',
    name,
  });

  // Create rendering job with source file location
  await db.insert(renderingJobs).values({
    id: generateId('rjob'),
    linkId,
    sourceKey: r2Key!,
    status: 'pending',
  });

  logger.info({ linkId, userId: user.id, fileType, fileSize }, 'Link created, rendering queued');

  // Audit log
  if (orgId) {
    const audit = auditorFromContext(c);
    logAudit({ ...audit, action: 'link.created', resourceType: 'link', resourceId: linkId, resourceLabel: name || originalFilename });
  }

  // Fire webhook: link.created
  dispatchWebhook(linkId, 'link.created', {
    file_type: fileType,
    rules: { expires_at: expiresAt, max_views: maxViews, require_email: requireEmail },
  }).catch((err) => logger.warn({ err, linkId }, 'Webhook dispatch failed'));

  // Report usage for billing (async, non-blocking)
  reportUsage(user.id, 'link_created').catch((err) => logger.warn({ err }, 'Usage reporting failed'));

  const secureUrl = `${config.viewerUrl}/s/${linkId}`;
  const progressUrl = `${config.apiUrl}/v1/links/${linkId}/progress`;

  // Always return 202 — rendering happens in background
  return successResponse(c, {
    id: linkId,
    secure_url: secureUrl,
    analytics_url: `${config.apiUrl}/v1/links/${linkId}/analytics`,
    progress_url: progressUrl,
    name,
    file_type: fileType,
    status: 'processing',
    rules: {
      expires_at: expiresAt,
      max_views: maxViews,
      require_email: requireEmail,
      allowed_domains: allowedDomains,
      has_password: !!password,
      block_download: blockDownload,
      watermark,
    },
    view_count: 0,
    created_at: new Date().toISOString(),
  }, 202);
});

// ============================================
// POST /v1/links/bulk — Create multiple links at once
// ============================================

linksRouter.post('/v1/links/bulk', apiKeyAuth, rateLimiter('upload'), enforceUsageLimits, async (c) => {
  const user = c.get('user') as { id: string; plan: string };
  const orgId = c.get('orgId') as string | undefined;
  const body = await c.req.json();

  if (!body.files || !Array.isArray(body.files)) {
    return errorResponse(c, Errors.validation('files array is required'));
  }

  if (body.files.length === 0) {
    return errorResponse(c, Errors.validation('files array must not be empty'));
  }

  if (body.files.length > 20) {
    return errorResponse(c, Errors.validation('Maximum 20 files per bulk upload'));
  }

  const storage = createStorage();
  const results: Array<{ id: string; secure_url: string; status: string; filename: string }> = [];
  const errors: Array<{ filename: string; error: string }> = [];

  // Shared options from top-level body
  const sharedOptions = {
    require_email: body.require_email !== false,
    watermark: body.watermark !== false,
    block_download: body.block_download !== false,
    expires_in: body.expires_in as string | undefined,
    max_views: body.max_views ? parseInt(body.max_views, 10) : null,
    password: body.password as string | undefined,
    allowed_domains: body.allowed_domains || null,
    notify_url: body.notify_url || null,
  };

  const passwordHash = sharedOptions.password
    ? await bcrypt.hash(sharedOptions.password, 12)
    : null;

  // Calculate shared expiry
  let sharedExpiresAt: string | null = null;
  if (sharedOptions.expires_in) {
    const match = sharedOptions.expires_in.match(/^(\d+)(h|d|y)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const ms = unit === 'h' ? value * 3600000
        : unit === 'd' ? value * 86400000
        : value * 365 * 86400000;
      sharedExpiresAt = new Date(Date.now() + ms).toISOString();
    }
  }

  for (const file of body.files) {
    const { upload_r2_key, filename, name } = file;

    if (!upload_r2_key || !filename) {
      errors.push({ filename: filename || 'unknown', error: 'upload_r2_key and filename are required' });
      continue;
    }

    // Determine file type from extension
    const ext = filename.split('.').pop()?.toLowerCase();
    let fileType = 'pdf';
    if (ext === 'pdf') fileType = 'pdf';
    else if (ext === 'png') fileType = 'png';
    else if (ext === 'jpg' || ext === 'jpeg') fileType = 'jpg';
    else if (ext === 'webp') fileType = 'webp';
    else if (ext && (OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext)) fileType = 'pdf';
    else if (ext && (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      if (!config.features.video) {
        errors.push({ filename, error: 'Video uploads require video support to be enabled' });
        continue;
      }
      fileType = 'video';
    } else {
      errors.push({ filename, error: `Unsupported file type: .${ext}` });
      continue;
    }

    // Create link record
    const linkId = generateId('lnk');
    const r2Prefix = `renders/${linkId}/`;

    await db.insert(links).values({
      id: linkId,
      userId: user.id,
      orgId: orgId || null,
      originalFilename: filename,
      fileType,
      r2Prefix,
      expiresAt: sharedExpiresAt,
      maxViews: sharedOptions.max_views,
      requireEmail: sharedOptions.require_email,
      allowedDomains: sharedOptions.allowed_domains ? JSON.stringify(sharedOptions.allowed_domains) : null,
      passwordHash,
      blockDownload: sharedOptions.block_download,
      watermarkEnabled: sharedOptions.watermark,
      notifyUrl: sharedOptions.notify_url,
      status: 'processing',
      name: name || null,
    });

    // Create rendering job
    await db.insert(renderingJobs).values({
      id: generateId('rjob'),
      linkId,
      sourceKey: upload_r2_key,
      status: 'pending',
    });

    const secureUrl = `${config.viewerUrl}/s/${linkId}`;
    results.push({ id: linkId, secure_url: secureUrl, status: 'processing', filename });

    // Report usage
    reportUsage(user.id, 'link_created').catch((err) => logger.warn({ err }, 'Usage reporting failed'));
  }

  logger.info({ userId: user.id, count: results.length, errors: errors.length }, 'Bulk link creation');

  return successResponse(c, {
    links: results,
    errors: errors.length > 0 ? errors : undefined,
    total: results.length,
  }, 202);
});

// ============================================
// GET /v1/links — List links
// ============================================

linksRouter.get('/v1/links', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const status = c.req.query('status');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10), 100);
  const offset = (page - 1) * limit;

  // Scope to org if available, else fall back to user
  const conditions = orgId
    ? [eq(links.orgId, orgId)]
    : [eq(links.userId, user.id)];
  if (status) {
    conditions.push(eq(links.status, status));
  }

  const [result, totalResult] = await Promise.all([
    db
      .select()
      .from(links)
      .where(and(...conditions))
      .orderBy(desc(links.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: count() })
      .from(links)
      .where(and(...conditions))
      .get(),
  ]);

  const total = totalResult?.count ?? 0;

  return successResponse(c, {
    links: result.map((link) => ({
      id: link.id,
      secure_url: `${config.viewerUrl}/s/${link.id}`,
      name: link.name,
      file_type: link.fileType,
      page_count: link.pageCount,
      status: link.status,
      view_count: link.viewCount,
      created_at: link.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

// ============================================
// GET /v1/links/:id — Get link details
// ============================================

linksRouter.get('/v1/links/:id', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const linkId = c.req.param('id');

  const ownerCondition = orgId ? eq(links.orgId, orgId) : eq(links.userId, user.id);
  const link = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), ownerCondition))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  // Get recent views
  const recentViews = await db
    .select()
    .from(views)
    .where(eq(views.linkId, linkId))
    .orderBy(desc(views.createdAt))
    .limit(10)
    .all();

  return successResponse(c, {
    id: link.id,
    secure_url: `${config.viewerUrl}/s/${link.id}`,
    analytics_url: `${config.apiUrl}/v1/links/${link.id}/analytics`,
    name: link.name,
    file_type: link.fileType,
    page_count: link.pageCount,
    video_metadata: link.fileType === 'video' ? {
      duration: link.videoDuration,
      width: link.videoWidth,
      height: link.videoHeight,
      qualities: safeJsonParse(link.videoQualities, []),
    } : undefined,
    status: link.status,
    rules: {
      expires_at: link.expiresAt,
      max_views: link.maxViews,
      require_email: link.requireEmail,
      allowed_domains: safeJsonParse(link.allowedDomains, null),
      has_password: !!link.passwordHash,
      block_download: link.blockDownload,
      watermark: link.watermarkEnabled,
    },
    view_count: link.viewCount,
    recent_views: recentViews.map((v) => ({
      viewer_email: v.viewerEmail,
      viewed_at: v.createdAt,
      duration: v.duration,
      pages_viewed: v.pagesViewed,
      video_watch_time: v.videoWatchTime,
      completion_rate: v.completionRate,
      country: v.viewerCountry,
      city: v.viewerCity,
      device: v.viewerDevice,
    })),
    created_at: link.createdAt,
  });
});

// ============================================
// DELETE /v1/links/:id — Revoke a link
// ============================================

linksRouter.delete('/v1/links/:id', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const linkId = c.req.param('id');

  const ownerCondition = orgId ? eq(links.orgId, orgId) : eq(links.userId, user.id);
  const link = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), ownerCondition))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  const now = new Date().toISOString();
  await db
    .update(links)
    .set({ status: 'revoked', updatedAt: now })
    .where(eq(links.id, linkId));

  logger.info({ linkId, userId: user.id }, 'Link revoked');

  // Audit log
  if (orgId) {
    const audit = auditorFromContext(c);
    logAudit({ ...audit, action: 'link.revoked', resourceType: 'link', resourceId: linkId, resourceLabel: link.name || link.originalFilename || linkId });
  }

  // Fire webhook: link.revoked
  dispatchWebhook(linkId, 'link.revoked').catch((err) => logger.warn({ err, linkId }, 'Webhook dispatch failed'));

  return successResponse(c, {
    id: linkId,
    status: 'revoked',
    revoked_at: now,
  });
});

// ============================================
// GET /v1/links/:id/analytics — Detailed analytics
// ============================================

linksRouter.get('/v1/links/:id/analytics', apiKeyAuth, rateLimiter('analytics'), async (c) => {
  const user = c.get('user') as { id: string };
  const orgId = c.get('orgId') as string | undefined;
  const linkId = c.req.param('id');

  const ownerCondition = orgId ? eq(links.orgId, orgId) : eq(links.userId, user.id);
  const link = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), ownerCondition))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  const allViews = await db
    .select()
    .from(views)
    .where(eq(views.linkId, linkId))
    .all();

  const totalViews = allViews.length;
  const uniqueEmails = new Set(allViews.map((v) => v.viewerEmail).filter(Boolean));
  const avgDuration = totalViews > 0
    ? Math.round(allViews.reduce((sum, v) => sum + (v.duration || 0), 0) / totalViews)
    : 0;
  const avgCompletion = totalViews > 0
    ? parseFloat((allViews.reduce((sum, v) => sum + (v.completionRate || 0), 0) / totalViews).toFixed(2))
    : 0;

  return successResponse(c, {
    link_id: linkId,
    total_views: totalViews,
    unique_viewers: uniqueEmails.size,
    avg_duration: avgDuration,
    avg_completion_rate: avgCompletion,
    viewers: [...uniqueEmails].map((email) => {
      const emailViews = allViews.filter((v) => v.viewerEmail === email);
      return {
        email,
        total_views: emailViews.length,
        first_viewed: emailViews[0]?.createdAt,
        last_viewed: emailViews[emailViews.length - 1]?.createdAt,
        total_duration: emailViews.reduce((sum, v) => sum + (v.duration || 0), 0),
        avg_completion_rate: parseFloat(
          (emailViews.reduce((sum, v) => sum + (v.completionRate || 0), 0) / emailViews.length).toFixed(2),
        ),
      };
    }),
  });
});

// ============================================
// PATCH /v1/links/:id/branding — Update link branding
// ============================================

linksRouter.patch('/v1/links/:id/branding', apiKeyAuth, async (c) => {
  const user = c.get('user') as { id: string; plan: string };
  const org = c.get('org') as { plan: string } | undefined;
  const orgId = c.get('orgId') as string | undefined;
  const linkId = c.req.param('id');

  // Branding requires Growth+ plan (check org plan first, fall back to user plan)
  const plan = org?.plan || user.plan;
  if (plan === 'free' || plan === 'starter') {
    return errorResponse(c, Errors.forbidden('Branding customization requires a Growth or Scale plan'));
  }

  const ownerCondition = orgId ? eq(links.orgId, orgId) : eq(links.userId, user.id);
  const link = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), ownerCondition))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  const { brand_name, brand_color, brand_logo_url, custom_domain_id } = await c.req.json();

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (brand_name !== undefined) updates.brandName = brand_name;
  if (brand_color !== undefined) updates.brandColor = brand_color;
  if (brand_logo_url !== undefined) updates.brandLogo = brand_logo_url;
  if (custom_domain_id !== undefined) updates.customDomainId = custom_domain_id;

  await db.update(links).set(updates).where(eq(links.id, linkId));

  // Audit log
  if (orgId) {
    const audit = auditorFromContext(c);
    logAudit({ ...audit, action: 'link.branding_updated', resourceType: 'link', resourceId: linkId, resourceLabel: link.name || link.originalFilename || linkId });
  }

  return successResponse(c, {
    id: linkId,
    brand_name: brand_name ?? link.brandName,
    brand_color: brand_color ?? link.brandColor,
    brand_logo_url: brand_logo_url ?? link.brandLogo,
    custom_domain_id: custom_domain_id ?? link.customDomainId,
  });
});

// ============================================
// GET /v1/links/:id/progress — SSE rendering progress
// ============================================

linksRouter.get('/v1/links/:id/progress', async (c) => {
  const linkId = c.req.param('id');

  // Verify link exists
  const link = await db
    .select({ id: links.id, status: links.status })
    .from(links)
    .where(eq(links.id, linkId))
    .get();

  if (!link) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Link not found' } }, 404);
  }

  // If already done, return immediately
  if (link.status === 'active') {
    return c.json({ data: { status: 'completed', progress: 100 } });
  }
  if (link.status === 'failed') {
    return c.json({ data: { status: 'failed' } });
  }

  // Stream SSE with 2-minute timeout and polling
  return streamSSE(c, async (stream) => {
    const SSE_TIMEOUT = 2 * 60 * 1000; // 2 minutes max
    const POLL_MS = 500;
    const startTime = Date.now();
    let lastProgress = '';

    while (Date.now() - startTime < SSE_TIMEOUT) {
      const job = await db
        .select({
          status: renderingJobs.status,
          progress: renderingJobs.progress,
          error: renderingJobs.error,
        })
        .from(renderingJobs)
        .where(eq(renderingJobs.linkId, linkId))
        .get();

      if (!job) break;

      const progressJson = job.progress || '{}';

      // Only send if progress changed
      if (progressJson !== lastProgress) {
        lastProgress = progressJson;
        const progress = safeJsonParse(progressJson, {}) as {
          currentPage?: number;
          totalPages?: number;
          percent?: number;
          message?: string;
        };

        if (job.status === 'completed') {
          await stream.writeSSE({
            event: 'complete',
            data: JSON.stringify({
              status: 'completed',
              progress: 100,
            }),
          });
          return;
        }

        if (job.status === 'failed') {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              status: 'failed',
              error: job.error || 'Rendering failed',
            }),
          });
          return;
        }

        // Handle both document progress (currentPage/totalPages) and video progress (percent)
        const pct = progress.percent != null
          ? progress.percent
          : progress.totalPages
            ? Math.round((progress.currentPage || 0) / progress.totalPages * 100)
            : 0;

        await stream.writeSSE({
          event: 'progress',
          data: JSON.stringify({
            status: 'processing',
            progress: pct,
            message: progress.message || 'Processing...',
            ...(progress.currentPage != null && {
              current_page: progress.currentPage,
              total_pages: progress.totalPages || 0,
            }),
          }),
        });
      }

      await stream.sleep(POLL_MS);
    }

    // Timeout
    await stream.writeSSE({
      event: 'timeout',
      data: JSON.stringify({ status: 'timeout', message: 'Progress stream timed out' }),
    });
  });
});

export default linksRouter;
