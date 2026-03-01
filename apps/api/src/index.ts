import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serve } from '@hono/node-server';
import { randomBytes } from 'crypto';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { AppError, errorResponse } from './lib/errors.js';
import type { Variables } from './lib/types.js';

// Middleware
import { apiVersionHeader, unknownVersionHandler } from './middleware/versioning.js';
import { orgResolver } from './middleware/orgResolver.js';
import { rateLimitByIp } from './middleware/rateLimit.js';

// Routes
import health from './routes/health.js';
import auth from './routes/auth.js';
import linksRouter from './routes/links.js';
import viewsRouter from './routes/views.js';
import webhooksRouter from './routes/webhooks.js';
import billingRouter from './routes/billing.js';
import domainsRouter from './routes/domains.js';
import gdprRouter from './routes/gdpr.js';
import embedRouter from './routes/embed.js';
import teamsRouter from './routes/teams.js';
import auditRouter from './routes/audit.js';
import notificationsRouter from './routes/notifications.js';

// Workers
import { startRenderWorker, stopRenderWorker } from './workers/renderer.js';
import { startWebhookWorker, stopWebhookWorker } from './workers/webhooks.js';
import { startAuditRetentionWorker, stopAuditRetentionWorker } from './workers/auditRetention.js';

const app = new Hono<{ Variables: Variables }>();

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// Compression
app.use('*', compress());

// CORS
app.use('*', cors({
  origin: config.isDev
    ? '*'
    : [config.viewerUrl, config.apiUrl, ...config.corsOrigins],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Org-Id', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Global security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-DNS-Prefetch-Control', 'off');
  c.header('X-Download-Options', 'noopen');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.isProd) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Request correlation ID + logging
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || randomBytes(8).toString('hex');
  c.header('X-Request-Id', requestId);

  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms,
  }, `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// Security headers for viewer routes
app.use('/s/*', async (c, next) => {
  await next();
  c.header('Permissions-Policy', 'display-capture=()');
  c.header('X-Frame-Options', 'DENY');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'");
});

app.use('/embed/*', async (c, next) => {
  await next();
  c.header('Permissions-Policy', 'display-capture=()');
});

// API version header on all responses
app.use('*', apiVersionHeader);

// Org resolution for authenticated API routes
app.use('/v1/*', orgResolver);

// ============================================
// RATE LIMITING — AUTH ENDPOINTS
// ============================================

// Strict IP-based rate limiting for auth to prevent brute-force
app.use('/v1/auth/login', rateLimitByIp({ max: 10, window: 60 }));
app.use('/v1/auth/register', rateLimitByIp({ max: 5, window: 60 }));

// ============================================
// ROUTES
// ============================================

// Health check
app.route('/', health);

// Auth (registration, login, API keys)
app.route('/v1/auth', auth);

// Links (CRUD + analytics)
app.route('/', linksRouter);

// Viewer endpoints (metadata, verify, track)
app.route('/', viewsRouter);

// Webhooks
app.route('/', webhooksRouter);

// Billing (Stripe)
app.route('/', billingRouter);

// Custom domains
app.route('/', domainsRouter);

// GDPR data deletion
app.route('/', gdprRouter);

// Embedded viewer
app.route('/', embedRouter);

// Teams & org management
app.route('/', teamsRouter);

// Audit log
app.route('/', auditRouter);

// Notifications
app.route('/', notificationsRouter);

// Internal file serving for local storage mode
if (config.storage.provider === 'local') {
  app.get('/internal/files/*', async (c) => {
    const key = c.req.path.replace('/internal/files/', '');
    try {
      const { createStorage } = await import('./services/storage.js');
      const storage = createStorage();
      const data = await storage.download(key);
      const ext = key.split('.').pop()?.toLowerCase();
      const contentType = ext === 'webp' ? 'image/webp'
        : ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'm3u8' ? 'application/vnd.apple.mpegurl'
        : ext === 'ts' ? 'video/mp2t'
        : 'application/octet-stream';
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=300',
        },
      });
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
    }
  });
}

// Unknown API versions — catch /v{N}/* where N != 1
app.all('/v:version{[0-9]+}/*', (c) => {
  const version = c.req.param('version');
  if (version !== '1') {
    return unknownVersionHandler(c);
  }
  // Fall through to 404 for valid version prefix but unknown endpoint
  return c.json(
    { data: null, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404,
  );
});

// ============================================
// ERROR HANDLING
// ============================================

app.onError((err, c) => {
  if (err instanceof AppError) {
    return errorResponse(c, err);
  }

  logger.error({ err }, 'Unhandled error');
  return c.json(
    { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    { data: null, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404,
  );
});

// ============================================
// START SERVER
// ============================================

if (!process.env.VITEST) {
  const port = config.port;

  logger.info({
    port,
    mode: config.mode,
    storage: config.storage.provider,
    database: config.database.provider,
  }, `Cloak API starting on port ${port}`);

  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info(`Cloak API listening on http://localhost:${info.port}`);

    // Start background workers
    startRenderWorker();
    startWebhookWorker();
    startAuditRetentionWorker();
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    stopRenderWorker();
    stopWebhookWorker();
    stopAuditRetentionWorker();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
