import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links, renderingJobs, users } from '../db/schema.js';
import { rateLimitByIp } from '../middleware/rateLimit.js';
import { generateId } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { createStorage } from '../services/storage.js';
import { ALL_SUPPORTED_EXTENSIONS, OFFICE_FILE_EXTENSIONS, VIDEO_FILE_EXTENSIONS } from '@cloak/shared';
import { nanoid } from 'nanoid';
import type { Variables } from '../lib/types.js';

const demoRouter = new Hono<{ Variables: Variables }>();

const DEMO_MAX_SIZE = 20 * 1024 * 1024; // 20MB for demo

// Demo link creation — no auth, tight rate limit, short expiry
// Only available in cloud mode
demoRouter.post(
  '/v1/demo/link',
  rateLimitByIp({ max: 5, window: 300 }), // 5 per 5 minutes per IP
  async (c) => {
    if (config.mode !== 'cloud') {
      return errorResponse(c, Errors.forbidden('Demo is only available on the cloud service'));
    }

    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse(c, Errors.validation('multipart/form-data required'));
    }

    const body = await c.req.parseBody();
    const file = body['file'] as File | undefined;

    if (!file) {
      return errorResponse(c, Errors.validation('file is required'));
    }

    const ext = file.name?.split('.').pop()?.toLowerCase();
    if (!ext || !(ALL_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
      return errorResponse(c, Errors.validation(`Unsupported file type. Supported: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`));
    }

    if (file.size > DEMO_MAX_SIZE) {
      return errorResponse(c, Errors.fileTooLarge(20));
    }

    // Determine file type
    let fileType = 'pdf';
    if (ext === 'pdf') fileType = 'pdf';
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) fileType = ext === 'jpeg' ? 'jpg' : ext;
    else if ((OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext)) fileType = 'pdf'; // converted to PDF
    else if ((VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      if (!config.features.video) {
        return errorResponse(c, Errors.validation('Video support is not enabled'));
      }
      fileType = 'video';
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes for .pdf files
    if (ext === 'pdf') {
      if (fileBuffer.length < 5 || fileBuffer.subarray(0, 5).toString() !== '%PDF-') {
        return errorResponse(c, Errors.validation('File does not appear to be a valid PDF'));
      }
    }

    // Get or create a demo system user
    let demoUser = await db.select().from(users).where(eq(users.email, 'demo@cloakshare.dev')).get();
    if (!demoUser) {
      const demoUserId = generateId('usr');
      await db.insert(users).values({
        id: demoUserId,
        email: 'demo@cloakshare.dev',
        passwordHash: 'demo-no-login',
        plan: 'free',
      });
      demoUser = await db.select().from(users).where(eq(users.id, demoUserId)).get();
    }

    // Upload to storage
    const storage = createStorage();
    const r2Key = `temp/${nanoid()}/${file.name}`;
    await storage.upload(r2Key, fileBuffer, file.type);

    // Create link with 1-hour expiry, watermark, email gate off
    const linkId = generateId('lnk');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    await db.insert(links).values({
      id: linkId,
      userId: demoUser!.id,
      originalFilename: file.name || 'document',
      fileType,
      fileSize: file.size,
      r2Prefix: `renders/${linkId}/`,
      expiresAt,
      requireEmail: false,
      watermarkEnabled: true,
      blockDownload: true,
      status: 'processing',
      name: `Demo: ${file.name || 'document'}`,
    });

    await db.insert(renderingJobs).values({
      id: generateId('rjob'),
      linkId,
      sourceKey: r2Key,
      status: 'pending',
    });

    logger.info({ linkId, fileType, ext }, 'Demo link created');

    const secureUrl = `${config.viewerUrl}/s/${linkId}`;

    return successResponse(c, {
      id: linkId,
      secure_url: secureUrl,
      progress_url: `${config.apiUrl}/v1/links/${linkId}/progress`,
      file_type: fileType,
      status: 'processing',
      expires_at: expiresAt,
    }, 202);
  }
);

export default demoRouter;
