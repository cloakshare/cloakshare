import { eq, and, sql, asc, lt } from 'drizzle-orm';
import { extname } from 'node:path';
import { db } from '../db/client.js';
import { renderingJobs, links, users } from '../db/schema.js';
import { createStorage } from '../services/storage.js';
import { renderPdf, renderImage, renderLimit } from '../services/renderer.js';
import { isOfficeDocument, convertToPdf } from '../services/converter.js';
import { transcodeVideo } from '../services/transcoder.js';
import { dispatchWebhook } from '../services/webhooks.js';
import { sendLinkReadyNotification } from '../services/email.js';
import { logger } from '../lib/logger.js';
import { VIDEO_FILE_EXTENSIONS } from '@cloak/shared';

const POLL_INTERVAL = 1000; // 1 second
const STALE_JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const RETRY_BACKOFF_MS = [0, 30_000, 120_000]; // immediate, 30s, 2min
let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Claim a pending job atomically.
 * Uses UPDATE ... WHERE status = 'pending' to prevent race conditions.
 */
async function claimJob() {
  const pendingJob = await db
    .select({ id: renderingJobs.id })
    .from(renderingJobs)
    .where(eq(renderingJobs.status, 'pending'))
    .orderBy(asc(renderingJobs.createdAt))
    .limit(1)
    .get();

  if (!pendingJob) return null;

  // Atomically claim — only succeeds if still 'pending'
  const result = await db
    .update(renderingJobs)
    .set({
      status: 'processing',
      startedAt: new Date().toISOString(),
      attempts: sql`${renderingJobs.attempts} + 1`,
    })
    .where(
      and(
        eq(renderingJobs.id, pendingJob.id),
        eq(renderingJobs.status, 'pending'),
      )
    )
    .returning({
      id: renderingJobs.id,
      linkId: renderingJobs.linkId,
      sourceKey: renderingJobs.sourceKey,
      attempts: renderingJobs.attempts,
    });

  return result[0] || null;
}

/**
 * Process a single rendering job.
 */
async function processJob(job: { id: string; linkId: string; sourceKey: string; attempts: number }) {
  const { id: jobId, linkId, sourceKey } = job;

  try {
    const link = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .get();

    if (!link) {
      logger.error({ jobId, linkId }, 'Link not found for rendering job');
      await db.update(renderingJobs)
        .set({ status: 'failed', error: 'Link not found' })
        .where(eq(renderingJobs.id, jobId));
      return;
    }

    // Download source file from temp storage
    const storage = createStorage();
    let fileBuffer = await storage.download(sourceKey);

    // Progress callback — writes to DB for SSE endpoint to read
    const onProgress = (progress: { currentPage: number; totalPages: number; message: string }) => {
      db.update(renderingJobs)
        .set({ progress: JSON.stringify(progress) })
        .where(eq(renderingJobs.id, jobId))
        .run();
    };

    // Convert office documents to PDF before rendering
    const ext = extname(link.originalFilename || sourceKey).replace('.', '').toLowerCase();
    let renderFileType = link.fileType;

    if (isOfficeDocument(`.${ext}`)) {
      onProgress({ currentPage: 0, totalPages: 0, message: 'Converting document to PDF...' });
      fileBuffer = Buffer.from(await convertToPdf(Buffer.from(fileBuffer), link.originalFilename || 'document'));
      renderFileType = 'pdf';
    }

    // Check if this is a video file
    const isVideo = (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext);

    if (isVideo) {
      // Video transcoding path
      const onVideoProgress = (progress: { percent: number; message: string }) => {
        db.update(renderingJobs)
          .set({ progress: JSON.stringify(progress) })
          .where(eq(renderingJobs.id, jobId))
          .run();
      };

      const videoResult = await transcodeVideo(
        fileBuffer,
        linkId,
        link.originalFilename || 'video',
        onVideoProgress,
      );

      // Mark job completed
      await db.update(renderingJobs)
        .set({
          status: 'completed',
          completedAt: new Date().toISOString(),
          progress: JSON.stringify({ percent: 100, message: 'Complete' }),
        })
        .where(eq(renderingJobs.id, jobId));

      // Update link with video metadata
      await db.update(links)
        .set({
          status: 'active',
          videoDuration: Math.round(videoResult.duration),
          videoWidth: videoResult.width,
          videoHeight: videoResult.height,
          videoQualities: JSON.stringify(videoResult.qualities),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(links.id, linkId));

      // Clean up temp file
      await storage.delete(sourceKey).catch(() => {});

      // Fire webhook with video metadata
      await dispatchWebhook(linkId, 'link.ready', {
        file_type: 'video',
        duration: videoResult.duration,
        qualities: videoResult.qualities,
        width: videoResult.width,
        height: videoResult.height,
      }).catch(() => {});

      // Send email notification
      const videoOwner = await db.select({ email: users.email }).from(users)
        .where(eq(users.id, link.userId)).get();
      if (videoOwner) {
        sendLinkReadyNotification({
          ownerEmail: videoOwner.email,
          linkName: link.name || link.originalFilename || linkId,
          linkId,
          pageCount: 0,
        }).catch(() => {});
      }

      logger.info({ jobId, linkId, duration: videoResult.duration, qualities: videoResult.qualities }, 'Video transcoding job completed');
      return;
    }

    // Document rendering path
    const result = renderFileType === 'pdf'
      ? await renderPdf(fileBuffer, linkId, onProgress)
      : await renderImage(fileBuffer, linkId, onProgress);

    // Mark job completed
    await db.update(renderingJobs)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        progress: JSON.stringify({
          currentPage: result.pageCount,
          totalPages: result.pageCount,
          message: 'Complete',
        }),
      })
      .where(eq(renderingJobs.id, jobId));

    // Update link to active with page count
    await db.update(links)
      .set({
        status: 'active',
        pageCount: result.pageCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(links.id, linkId));

    // Clean up temp file
    await storage.delete(sourceKey).catch(() => {});

    // Fire webhook: link.ready
    await dispatchWebhook(linkId, 'link.ready', { page_count: result.pageCount }).catch(() => {});

    // Send email notification to owner
    const owner = await db.select({ email: users.email }).from(users)
      .where(eq(users.id, link.userId)).get();
    if (owner) {
      sendLinkReadyNotification({
        ownerEmail: owner.email,
        linkName: link.name || link.originalFilename || linkId,
        linkId,
        pageCount: result.pageCount,
      }).catch(() => {});
    }

    logger.info({ jobId, linkId, pageCount: result.pageCount }, 'Rendering job completed');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, linkId, error: errorMsg }, 'Rendering job failed');
    await failJob(jobId, linkId, job.attempts, errorMsg);
  }
}

/**
 * Handle job failure — retry or mark as permanently failed (after 3 attempts).
 */
async function failJob(jobId: string, linkId: string, attempts: number, error: string) {
  const maxAttempts = 3;

  if (attempts >= maxAttempts) {
    await db.update(renderingJobs)
      .set({ status: 'failed', error })
      .where(eq(renderingJobs.id, jobId));

    await db.update(links)
      .set({ status: 'failed', updatedAt: new Date().toISOString() })
      .where(eq(links.id, linkId));

    // Clean up partial renders
    const storage = createStorage();
    await storage.deletePrefix(`renders/${linkId}/`).catch(() => {});

    // Fire webhook: link.render_failed
    await dispatchWebhook(linkId, 'link.render_failed', { error }).catch(() => {});

    logger.error({ jobId, linkId, attempts }, 'Rendering permanently failed');
  } else {
    // Return to pending with backoff delay
    const delay = RETRY_BACKOFF_MS[attempts] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
    const retryAfter = new Date(Date.now() + delay).toISOString();
    await db.update(renderingJobs)
      .set({ status: 'pending', error, startedAt: retryAfter })
      .where(eq(renderingJobs.id, jobId));

    logger.warn({ jobId, linkId, attempts, maxAttempts, retryAfterMs: delay }, 'Rendering failed, will retry');
  }
}

/**
 * Reclaim stale jobs stuck in 'processing' for longer than STALE_JOB_TIMEOUT_MS.
 * Resets them to 'pending' so they can be retried.
 */
async function reclaimStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
  const stale = await db
    .update(renderingJobs)
    .set({ status: 'pending', error: 'Reclaimed: job exceeded processing timeout' })
    .where(
      and(
        eq(renderingJobs.status, 'processing'),
        lt(renderingJobs.startedAt, cutoff),
      )
    )
    .returning({ id: renderingJobs.id });

  if (stale.length > 0) {
    logger.warn({ count: stale.length, jobIds: stale.map(j => j.id) }, 'Reclaimed stale processing jobs');
  }
}

/**
 * Poll for pending jobs and process them.
 */
let pollCount = 0;
async function poll() {
  if (!running) return;

  try {
    // Check for stale jobs every 60 polls (~1 minute)
    pollCount++;
    if (pollCount % 60 === 0) {
      await reclaimStaleJobs();
    }

    const job = await claimJob();
    if (job) {
      // Use concurrency limiter for document renders.
      // Video jobs are NOT wrapped here because transcodeVideo() already
      // applies transcodeLimit internally — wrapping again would deadlock.
      const ext = job.sourceKey.split('.').pop()?.toLowerCase() || '';
      const isVideo = (VIDEO_FILE_EXTENSIONS as readonly string[]).includes(ext);

      if (isVideo) {
        processJob(job).catch((err) =>
          logger.error({ err, jobId: job.id }, 'Unhandled error in video processJob'));
      } else {
        renderLimit(async () => {
          await processJob(job);
        }).catch((err) =>
          logger.error({ err, jobId: job.id }, 'Unhandled error in document processJob'));
      }
    }
  } catch (error) {
    logger.error({ error }, 'Render worker poll error');
  }
}

/**
 * Start the rendering worker.
 */
export function startRenderWorker() {
  if (running) return;
  running = true;
  logger.info('Render worker started');
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

/**
 * Stop the rendering worker.
 */
export function stopRenderWorker() {
  running = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  logger.info('Render worker stopped');
}
