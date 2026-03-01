import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { logger } from './logger.js';

let initialized = false;

export function initSentry() {
  if (!config.sentryDsn) {
    logger.debug('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    release: `cloak-api@${process.env.npm_package_version || '0.0.0'}`,
    tracesSampleRate: config.isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
  });

  initialized = true;
  logger.info('Sentry error tracking initialized');
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(err);
  });
}

export function captureRequestError(
  err: unknown,
  requestInfo: { method: string; path: string; requestId?: string },
) {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    scope.setTag('request.method', requestInfo.method);
    scope.setTag('request.path', requestInfo.path);
    if (requestInfo.requestId) {
      scope.setTag('request.id', requestInfo.requestId);
    }
    Sentry.captureException(err);
  });
}
