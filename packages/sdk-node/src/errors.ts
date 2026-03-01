export class CloakShareError extends Error {
  status: number;
  code: string;
  requestId?: string;
  docUrl?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
    docUrl?: string,
  ) {
    super(message);
    this.name = 'CloakShareError';
    this.status = status;
    this.code = code || 'UNKNOWN';
    this.requestId = requestId;
    this.docUrl = docUrl;
  }
}

export class RateLimitError extends CloakShareError {
  retryAfter: number;

  constructor(message: string, retryAfter: number, requestId?: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', requestId, 'https://docs.cloakshare.dev/errors/rate-limits');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends CloakShareError {
  constructor(message: string, status: number, requestId?: string) {
    super(message, status, 'AUTHENTICATION_FAILED', requestId, 'https://docs.cloakshare.dev/errors/authentication');
    this.name = 'AuthenticationError';
  }
}
