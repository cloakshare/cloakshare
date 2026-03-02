import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';
import { links, views, viewerSessions, users } from '../db/schema.js';
import { generateId, generateToken, sha256, getClientIp, parseUserAgent, formatDateForWatermark, renderWatermarkTemplate } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { rateLimitByIp } from '../middleware/rateLimit.js';
import { createStorage } from '../services/storage.js';
import { generateWatermarkedPages, getWatermarkedPageOnDemand } from '../services/watermarkRenderer.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { LINK_STATUS, PLAN_LIMITS } from '@cloak/shared';
import type { Plan } from '@cloak/shared';
import { dispatchWebhook } from '../services/webhooks.js';
import { reportUsage } from '../services/billing.js';
import { sendViewNotification } from '../services/email.js';
import { createNotification } from './notifications.js';
import type { Variables } from '../lib/types.js';

const viewsRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/viewer/:token — Get link metadata for viewer
// ============================================

viewsRouter.get('/v1/viewer/:token', async (c) => {
  const linkId = c.req.param('token');

  const link = await db
    .select()
    .from(links)
    .where(eq(links.id, linkId))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  // Check link status
  if (link.status === LINK_STATUS.PROCESSING) {
    return successResponse(c, {
      status: 'processing',
      message: 'This document is being prepared. Please try again in a moment.',
      progress_url: `${config.apiUrl}/v1/links/${linkId}/progress`,
    }, 202);
  }

  if (link.status === LINK_STATUS.FAILED) {
    return errorResponse(c, Errors.linkFailed());
  }

  if (link.status === LINK_STATUS.REVOKED) {
    return errorResponse(c, Errors.linkRevoked());
  }

  if (link.status === LINK_STATUS.EXPIRED) {
    return errorResponse(c, Errors.linkExpired());
  }

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
    return errorResponse(c, Errors.linkExpired());
  }

  // Check max views
  if (link.maxViews && link.viewCount >= link.maxViews) {
    await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
    return errorResponse(c, Errors.linkExpired());
  }

  // Determine badge visibility based on link owner's plan
  const linkOwner = await db.select({ plan: users.plan }).from(users).where(eq(users.id, link.userId)).get();
  const showBadge = !linkOwner || linkOwner.plan === 'free';

  return successResponse(c, {
    status: link.status,
    file_type: link.fileType,
    require_email: link.requireEmail,
    has_password: !!link.passwordHash,
    allowed_domains: link.allowedDomains ? JSON.parse(link.allowedDomains) : null,
    page_count: link.pageCount,
    video_metadata: link.fileType === 'video' ? {
      duration: link.videoDuration,
      width: link.videoWidth,
      height: link.videoHeight,
      qualities: link.videoQualities ? JSON.parse(link.videoQualities) : [],
    } : undefined,
    brand_name: link.brandName,
    brand_color: link.brandColor,
    brand_logo_url: link.brandLogo,
    watermark_enabled: link.watermarkEnabled,
    show_badge: showBadge,
    name: link.name,
  });
});

// ============================================
// POST /v1/viewer/:token/verify — Verify email & password
// ============================================

viewsRouter.post(
  '/v1/viewer/:token/verify',
  rateLimitByIp({
    max: 5,
    window: 15 * 60, // 15 minutes
    keyFn: (c) => `verify:${c.req.param('token')}:${getClientIp(c.req.raw.headers)}`,
  }),
  async (c) => {
    const linkId = c.req.param('token');
    const { email, password } = await c.req.json();

    const link = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .get();

    if (!link || link.status !== LINK_STATUS.ACTIVE) {
      return errorResponse(c, Errors.notFound('Link'));
    }

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
      return errorResponse(c, Errors.linkExpired());
    }

    // Check max views (per-link limit)
    if (link.maxViews && link.viewCount >= link.maxViews) {
      await db.update(links).set({ status: 'expired' }).where(eq(links.id, linkId));
      return errorResponse(c, Errors.linkExpired());
    }

    // Check monthly view limit for link owner's plan
    const linkOwner = await db.select({ plan: users.plan }).from(users).where(eq(users.id, link.userId)).get();
    if (linkOwner) {
      const ownerPlan = linkOwner.plan as Plan;
      const planLimits = PLAN_LIMITS[ownerPlan];
      if (planLimits) {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthlyViews = await db.select({ count: sql<number>`count(*)` }).from(views)
          .where(and(
            eq(views.linkId, linkId),
            sql`${views.viewedAt} like ${currentMonth + '%'}`,
          )).get();
        if ((monthlyViews?.count ?? 0) >= planLimits.viewsPerMonth) {
          return errorResponse(c, Errors.limitReached('This document has reached its monthly view limit.'));
        }
      }
    }

    // Verify email requirement
    if (link.requireEmail && !email) {
      return errorResponse(c, Errors.validation('Email is required'));
    }

    // Verify allowed domains
    if (link.allowedDomains && email) {
      const domains = JSON.parse(link.allowedDomains) as string[];
      const emailDomain = '@' + email.split('@')[1];
      if (!domains.includes(emailDomain)) {
        return errorResponse(c, Errors.domainNotAllowed(domains));
      }
    }

    // Verify password
    if (link.passwordHash) {
      if (!password) {
        return errorResponse(c, Errors.validation('Password is required'));
      }
      const valid = await bcrypt.compare(password, link.passwordHash);
      if (!valid) {
        return errorResponse(c, Errors.invalidPassword());
      }
    }

    // Create viewer session
    const sessionToken = generateToken(16);
    const sessionShortId = sessionToken.slice(0, 6);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // Hash viewer session token before storage
    const sessionTokenHash = sha256(sessionToken);

    await db.insert(viewerSessions).values({
      id: generateId('vs'),
      linkId,
      viewerEmail: email || 'anonymous',
      token: sessionTokenHash,
      expiresAt,
      ipAddress: getClientIp(c.req.raw.headers),
    });

    // Create view record
    const ua = c.req.header('user-agent') || null;
    const { device, browser, os } = parseUserAgent(ua);

    const viewId = generateId('view');
    await db.insert(views).values({
      id: viewId,
      linkId,
      viewerEmail: email || null,
      viewerIp: getClientIp(c.req.raw.headers),
      viewerUserAgent: ua,
      viewerCountry: c.req.header('cf-ipcountry') || null,
      viewerCity: c.req.header('cf-ipcity') || null,
      viewerDevice: device,
      viewerBrowser: browser,
      viewerOs: os,
      sessionToken: sessionTokenHash,
    });

    // Atomic view count increment
    await db.update(links)
      .set({ viewCount: sql`${links.viewCount} + 1` })
      .where(eq(links.id, linkId));

    // Build watermark text
    const watermarkText = link.watermarkEnabled
      ? renderWatermarkTemplate(
          link.watermarkTemplate || '{{email}} · {{date}} · {{session_id}}',
          {
            email: email || 'anonymous',
            date: formatDateForWatermark(),
            session_id: sessionShortId,
          },
        )
      : '';

    logger.info({
      linkId,
      viewerEmail: email,
      viewId,
      device,
    }, 'View session started');

    // Fire webhook: link.viewed (async, non-blocking)
    dispatchWebhook(linkId, 'link.viewed', {
      viewer_email: email || 'anonymous',
      view_id: viewId,
      device,
      country: c.req.header('cf-ipcountry') || null,
    }).catch((err) => logger.warn({ err, linkId }, 'Webhook dispatch failed'));

    // Create in-app notification for link owner (async, non-blocking)
    createNotification({
      userId: link.userId,
      orgId: link.orgId || undefined,
      type: 'link.viewed',
      linkId,
      linkName: link.name || link.originalFilename || link.id,
      message: `${email || 'Anonymous'} viewed "${link.name || link.originalFilename || 'your link'}"`,
      metadata: {
        viewer_email: email || 'anonymous',
        view_id: viewId,
        device,
        country: c.req.header('cf-ipcountry') || null,
      },
    }).catch((err) => logger.warn({ err, linkId }, 'Notification creation failed'));

    // Report usage for billing (async, non-blocking)
    reportUsage(link.userId, 'view_recorded').catch((err) => logger.warn({ err }, 'Usage reporting failed'));

    // Send email notification to link owner if configured (async, non-blocking)
    if (link.notifyEmail || config.features.emailNotifications) {
      const owner = await db.select({ email: users.email }).from(users)
        .where(eq(users.id, link.userId)).get();
      if (owner && (link.notifyEmail || owner.email)) {
        sendViewNotification({
          ownerEmail: link.notifyEmail || owner.email,
          linkName: link.name || link.originalFilename || link.id,
          linkId,
          viewerEmail: email || 'anonymous',
          viewerDevice: device,
          viewerCountry: c.req.header('cf-ipcountry') || null,
        }).catch((err) => logger.warn({ err }, 'View notification email failed'));
      }
    }

    const storage = createStorage();

    // Video links: return HLS playlist URLs instead of page URLs
    if (link.fileType === 'video') {
      const { generateSessionManifest } = await import('../services/transcoder.js');

      // Generate per-session manifest with pre-signed URLs baked in (for Safari/iOS)
      const qualities = link.videoQualities ? JSON.parse(link.videoQualities) : [];
      const sessionManifestContent = await generateSessionManifest(linkId, qualities);

      // Also provide the static master playlist URL for HLS.js (which re-signs per segment)
      const masterKey = `renders/${linkId}/video/master.m3u8`;
      const masterPlaylistUrl = await storage.getSignedUrl(masterKey, 300);

      return successResponse(c, {
        session_token: sessionToken,
        viewer_email: email || 'anonymous',
        file_type: 'video',
        master_playlist_url: masterPlaylistUrl,
        session_manifest: sessionManifestContent,
        segment_sign_url: `${config.apiUrl}/v1/viewer/${linkId}/sign-segment`,
        watermark_text: watermarkText,
        video_metadata: {
          duration: link.videoDuration,
          width: link.videoWidth,
          height: link.videoHeight,
          qualities,
        },
      });
    }

    // Document links: generate page URLs
    const pageCount = link.pageCount || 0;
    const pages: { page: number; url: string }[] = [];

    if (link.watermarkEnabled && pageCount > 0) {
      // Server-side watermarks: generate watermarked images for this session
      try {
        const sessionVsId = (await db
          .select({ id: viewerSessions.id })
          .from(viewerSessions)
          .where(eq(viewerSessions.token, sessionTokenHash))
          .get())!.id;

        const watermarkedUrls = await generateWatermarkedPages(
          linkId,
          sessionVsId,
          watermarkText,
          pageCount,
        );

        for (let i = 0; i < watermarkedUrls.length; i++) {
          pages.push({ page: i + 1, url: watermarkedUrls[i] });
        }
      } catch (err) {
        // Watermark rendering failed (e.g., clean images not yet available).
        // Fall back to clean signed URLs.
        logger.warn({ err, linkId }, 'Watermark rendering failed, falling back to clean pages');
        for (let i = 1; i <= pageCount; i++) {
          const r2Key = `renders/${linkId}/page-${i}.webp`;
          const url = await storage.getSignedUrl(r2Key, 300);
          pages.push({ page: i, url });
        }
      }
    } else {
      // No watermark — serve clean images via signed URLs
      for (let i = 1; i <= pageCount; i++) {
        const r2Key = `renders/${linkId}/page-${i}.webp`;
        const url = await storage.getSignedUrl(r2Key, 300);
        pages.push({ page: i, url });
      }
    }

    return successResponse(c, {
      session_token: sessionToken,
      viewer_email: email || 'anonymous',
      pages,
      page_count: pageCount,
      watermark_text: watermarkText,
    });
  },
);

// ============================================
// POST /v1/viewer/:token/sign-segment — Sign an HLS segment URL
// ============================================

viewsRouter.post('/v1/viewer/:token/sign-segment', async (c) => {
  const linkId = c.req.param('token');
  const sessionToken = c.req.header('x-session-token');

  if (!sessionToken) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, 401);
  }

  // Validate session — hash token before lookup
  const session = await db
    .select()
    .from(viewerSessions)
    .where(eq(viewerSessions.token, sha256(sessionToken)))
    .get();

  if (!session || new Date(session.expiresAt) < new Date()) {
    return errorResponse(c, Errors.unauthorized('Session expired'));
  }

  if (session.linkId !== linkId) {
    return errorResponse(c, Errors.forbidden('Session mismatch'));
  }

  const { segment_key } = await c.req.json();
  if (!segment_key || !segment_key.startsWith(`renders/${linkId}/video/`)) {
    return errorResponse(c, Errors.validation('Invalid segment key'));
  }

  const storage = createStorage();
  const url = await storage.getSignedUrl(segment_key, 60); // 60 sec expiry

  return c.json({ data: { url } });
});

// ============================================
// GET /v1/viewer/:token/page/:pageNumber — On-demand watermarked page
// ============================================

viewsRouter.get('/v1/viewer/:token/page/:pageNumber', async (c) => {
  const linkId = c.req.param('token');
  const pageNumberStr = c.req.param('pageNumber');
  const sessionToken = c.req.header('x-session-token');

  if (!sessionToken) {
    return errorResponse(c, Errors.unauthorized('Session token required'));
  }

  // Validate session — hash token before lookup
  const session = await db
    .select()
    .from(viewerSessions)
    .where(eq(viewerSessions.token, sha256(sessionToken)))
    .get();

  if (!session || new Date(session.expiresAt) < new Date()) {
    return errorResponse(c, Errors.unauthorized('Session expired. Please re-verify.'));
  }

  if (session.linkId !== linkId) {
    return errorResponse(c, Errors.forbidden('Session mismatch'));
  }

  const link = await db.select().from(links).where(eq(links.id, linkId)).get();
  if (!link) return errorResponse(c, Errors.notFound('Link'));

  const page = parseInt(pageNumberStr, 10);
  if (isNaN(page) || page < 1 || page > (link.pageCount || 0)) {
    return errorResponse(c, Errors.validation(`Page must be between 1 and ${link.pageCount}`));
  }

  // Build watermark text for this session
  const watermarkText = link.watermarkEnabled
    ? renderWatermarkTemplate(
        link.watermarkTemplate || '{{email}} · {{date}} · {{session_id}}',
        {
          email: session.viewerEmail,
          date: formatDateForWatermark(),
          session_id: sessionToken.slice(0, 6),
        },
      )
    : '';

  if (!link.watermarkEnabled || !watermarkText) {
    // No watermark — return clean page URL
    const storage = createStorage();
    const cleanKey = `renders/${linkId}/page-${page}.webp`;
    const url = await storage.getSignedUrl(cleanKey, 300);
    return successResponse(c, { url, page });
  }

  const signedUrl = await getWatermarkedPageOnDemand(
    linkId,
    session.id,
    watermarkText,
    page,
  );

  return successResponse(c, { url: signedUrl, page });
});

// ============================================
// POST /v1/viewer/:token/track — Track view events
// ============================================

viewsRouter.post('/v1/viewer/:token/track', async (c) => {
  const sessionToken = c.req.header('x-session-token');
  if (!sessionToken) {
    return c.body(null, 204);
  }

  const body = await c.req.json();
  const {
    current_page, seconds_on_page, total_duration, page_times, is_final,
    // Video tracking fields
    video_watch_time, video_current_time, video_total_duration,
  } = body;

  // Find the view record by session token (stored hashed)
  const view = await db
    .select()
    .from(views)
    .where(eq(views.sessionToken, sha256(sessionToken)))
    .get();

  if (!view) {
    return c.body(null, 204);
  }

  // Video tracking
  if (video_watch_time != null || video_current_time != null) {
    const videoCompletionRate = video_total_duration > 0
      ? parseFloat(Math.min(video_current_time / video_total_duration, 1.0).toFixed(2))
      : 0;

    await db.update(views)
      .set({
        duration: total_duration || video_watch_time || 0,
        videoWatchTime: video_watch_time || 0,
        videoMaxReached: video_current_time || 0,
        completionRate: videoCompletionRate,
        endedAt: is_final ? new Date().toISOString() : null,
      })
      .where(eq(views.id, view.id));

    return c.body(null, 204);
  }

  // Document tracking
  const pagesViewed = page_times
    ? Object.keys(page_times).length
    : (current_page || 1);

  const link = await db
    .select({ pageCount: links.pageCount })
    .from(links)
    .where(eq(links.id, view.linkId))
    .get();

  const pageCount = link?.pageCount || 1;
  const completionRate = parseFloat((pagesViewed / pageCount).toFixed(2));

  await db.update(views)
    .set({
      duration: total_duration || 0,
      pagesViewed,
      pageDetails: page_times ? JSON.stringify(
        Object.entries(page_times).map(([page, seconds]) => ({
          page: parseInt(page),
          seconds: Math.round(seconds as number),
        })),
      ) : null,
      completionRate,
      endedAt: is_final ? new Date().toISOString() : null,
    })
    .where(eq(views.id, view.id));

  return c.body(null, 204);
});

export default viewsRouter;
