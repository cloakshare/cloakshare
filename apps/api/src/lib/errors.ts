import type { Context } from 'hono';
import type { ApiError } from '@cloak/shared';

type AnyContext = Context<any>;

const ERROR_DOCS: Record<string, string> = {
  VALIDATION_ERROR: 'https://docs.cloakshare.dev/errors/validation',
  NOT_FOUND: 'https://docs.cloakshare.dev/errors/not-found',
  UNAUTHORIZED: 'https://docs.cloakshare.dev/errors/authentication',
  FORBIDDEN: 'https://docs.cloakshare.dev/errors/forbidden',
  RATE_LIMITED: 'https://docs.cloakshare.dev/errors/rate-limits',
  FILE_TOO_LARGE: 'https://docs.cloakshare.dev/errors/file-limits',
  INVALID_FILE_TYPE: 'https://docs.cloakshare.dev/errors/supported-types',
  LINK_EXPIRED: 'https://docs.cloakshare.dev/errors/link-expired',
  LINK_REVOKED: 'https://docs.cloakshare.dev/errors/link-revoked',
  RENDER_FAILED: 'https://docs.cloakshare.dev/errors/render-failed',
  LIMIT_REACHED: 'https://docs.cloakshare.dev/errors/plan-limits',
  DOMAIN_NOT_ALLOWED: 'https://docs.cloakshare.dev/errors/allowed-domains',
  INVALID_PASSWORD: 'https://docs.cloakshare.dev/errors/password-incorrect',
  SESSION_EXPIRED: 'https://docs.cloakshare.dev/errors/session-expired',
  INTERNAL_ERROR: 'https://docs.cloakshare.dev/errors',
};

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): ApiError & Record<string, unknown> {
    const json: ApiError & Record<string, unknown> = { code: this.code, message: this.message };
    if ((this as any).retryAfter != null) json.retry_after = (this as any).retryAfter;
    json.doc_url = ERROR_DOCS[this.code] || 'https://docs.cloakshare.dev/errors';
    return json;
  }
}

// Common errors
export const Errors = {
  unauthorized: (message = 'Invalid API key') =>
    new AppError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Access denied') =>
    new AppError('FORBIDDEN', message, 403),
  notFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  linkExpired: () =>
    new AppError('LINK_EXPIRED', 'This link has expired', 410),
  linkRevoked: () =>
    new AppError('LINK_REVOKED', 'This link has been revoked', 410),
  linkFailed: () =>
    new AppError('RENDER_FAILED', 'This document could not be processed. The sender has been notified.', 500),
  linkProcessing: () =>
    new AppError('LINK_PROCESSING', 'This document is being prepared. Please try again in a moment.', 202),
  limitReached: (message: string) =>
    new AppError('LIMIT_REACHED', message, 429),
  rateLimited: (message = 'Too many requests', retryAfter?: number) => {
    const err = new AppError('RATE_LIMITED', message, 429);
    (err as any).retryAfter = retryAfter;
    (err as any).docsUrl = 'https://github.com/cloakshare/cloakshare#api-reference';
    return err;
  },
  domainNotAllowed: (domains: string[]) =>
    new AppError('DOMAIN_NOT_ALLOWED', `Only ${domains.join(', ')} email addresses can view this`, 403),
  invalidPassword: () =>
    new AppError('INVALID_PASSWORD', 'Incorrect password', 403),
  fileTooLarge: (maxMb: number) =>
    new AppError('FILE_TOO_LARGE', `File must be under ${maxMb} MB`, 400),
  invalidFileType: (allowed: string[]) =>
    new AppError('INVALID_FILE_TYPE', `Allowed file types: ${allowed.join(', ')}`, 400),
  validation: (message: string) =>
    new AppError('VALIDATION_ERROR', message, 400),
  internal: (message = 'An unexpected error occurred') =>
    new AppError('INTERNAL_ERROR', message, 500),
};

export function errorResponse(c: AnyContext, error: AppError) {
  return c.json({ data: null, error: error.toJSON() }, error.statusCode as any);
}

export function successResponse<T>(c: AnyContext, data: T, status: number = 200) {
  return c.json({ data, error: null }, status as any);
}
