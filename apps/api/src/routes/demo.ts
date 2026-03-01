import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links, renderingJobs, users, apiKeys } from '../db/schema.js';
import { rateLimitByIp } from '../middleware/rateLimit.js';
import { generateId } from '../lib/utils.js';
import { Errors, errorResponse, successResponse } from '../lib/errors.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { createStorage } from '../services/storage.js';
import { MAX_FILE_SIZE } from '@cloak/shared';
import { nanoid } from 'nanoid';
import type { Variables } from '../lib/types.js';

const demoRouter = new Hono<{ Variables: Variables }>();

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

    // Demo limits: PDF only, 10MB max
    const ext = file.name?.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      return errorResponse(c, Errors.validation('Demo only supports PDF files'));
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse(c, Errors.fileTooLarge(10));
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes
    if (fileBuffer.length < 5 || fileBuffer.subarray(0, 5).toString() !== '%PDF-') {
      return errorResponse(c, Errors.validation('File does not appear to be a valid PDF'));
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
      originalFilename: file.name || 'demo.pdf',
      fileType: 'pdf',
      fileSize: file.size,
      r2Prefix: `renders/${linkId}/`,
      expiresAt,
      requireEmail: false,
      watermarkEnabled: true,
      blockDownload: true,
      status: 'processing',
      name: `Demo: ${file.name || 'document.pdf'}`,
    });

    await db.insert(renderingJobs).values({
      id: generateId('rjob'),
      linkId,
      sourceKey: r2Key,
      status: 'pending',
    });

    logger.info({ linkId }, 'Demo link created');

    const secureUrl = `${config.viewerUrl}/s/${linkId}`;

    return successResponse(c, {
      id: linkId,
      secure_url: secureUrl,
      progress_url: `${config.apiUrl}/v1/links/${linkId}/progress`,
      status: 'processing',
      expires_at: expiresAt,
    }, 202);
  }
);

export default demoRouter;
