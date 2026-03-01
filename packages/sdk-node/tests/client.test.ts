import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CloakShare from '../src/index.js';
import { CloakShareError, RateLimitError, AuthenticationError } from '../src/errors.js';
import { verifyWebhookSignature } from '../src/webhookVerify.js';
import { createHmac } from 'crypto';

// ============================================
// CONSTRUCTOR
// ============================================

describe('CloakShare constructor', () => {
  it('throws if API key is empty', () => {
    expect(() => new CloakShare('')).toThrow('API key is required');
  });

  it('throws if API key has wrong prefix', () => {
    expect(() => new CloakShare('sk_wrong_prefix')).toThrow('Invalid API key format');
  });

  it('accepts ck_live_ prefix', () => {
    const sdk = new CloakShare('ck_live_abc123');
    expect(sdk).toBeDefined();
    expect(sdk.links).toBeDefined();
    expect(sdk.webhooks).toBeDefined();
    expect(sdk.viewers).toBeDefined();
    expect(sdk.org).toBeDefined();
  });

  it('accepts ck_test_ prefix', () => {
    const sdk = new CloakShare('ck_test_abc123');
    expect(sdk).toBeDefined();
  });

  it('accepts custom baseUrl and trims trailing slash', () => {
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000/' });
    expect(sdk).toBeDefined();
  });

  it('has static version', () => {
    expect(CloakShare.version).toBe('0.1.0');
  });
});

// ============================================
// ERROR CLASSES
// ============================================

describe('Error classes', () => {
  it('CloakShareError has correct properties', () => {
    const err = new CloakShareError('bad request', 400, 'VALIDATION', 'req_123', 'https://docs.cloakshare.dev');
    expect(err.message).toBe('bad request');
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.requestId).toBe('req_123');
    expect(err.docUrl).toBe('https://docs.cloakshare.dev');
    expect(err.name).toBe('CloakShareError');
    expect(err).toBeInstanceOf(Error);
  });

  it('RateLimitError extends CloakShareError', () => {
    const err = new RateLimitError('slow down', 30, 'req_456');
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfter).toBe(30);
    expect(err.name).toBe('RateLimitError');
    expect(err).toBeInstanceOf(CloakShareError);
  });

  it('AuthenticationError extends CloakShareError', () => {
    const err = new AuthenticationError('invalid key', 401, 'req_789');
    expect(err.status).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_FAILED');
    expect(err.name).toBe('AuthenticationError');
    expect(err).toBeInstanceOf(CloakShareError);
  });
});

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test_secret_123';

  it('returns true for valid signature', () => {
    const payload = '{"event":"link.viewed","data":{}}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const payload = '{"event":"link.viewed"}';
    expect(verifyWebhookSignature(payload, 'invalid_sig', secret)).toBe(false);
  });

  it('returns false for tampered payload', () => {
    const payload = '{"event":"link.viewed"}';
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature('{"event":"tampered"}', signature, secret)).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(verifyWebhookSignature('', 'sig', secret)).toBe(false);
    expect(verifyWebhookSignature('payload', '', secret)).toBe(false);
    expect(verifyWebhookSignature('payload', 'sig', '')).toBe(false);
  });

  it('works with Buffer payload', () => {
    const payload = Buffer.from('{"event":"link.viewed"}');
    const signature = createHmac('sha256', secret).update(payload.toString('utf8')).digest('hex');
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('is accessible via CloakShare.webhooks.verify', () => {
    expect(CloakShare.webhooks.verify).toBe(verifyWebhookSignature);
  });
});

// ============================================
// HTTP CLIENT (with fetch mock)
// ============================================

describe('HTTP client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: new Map(Object.entries(headers || {})),
    }) as unknown as typeof fetch;
  }

  it('sends Authorization header', async () => {
    mockFetch(200, { data: { links: [] } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    await sdk.links.list();

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['Authorization']).toBe('Bearer ck_live_abc123');
  });

  it('unwraps response.data', async () => {
    mockFetch(200, { data: { id: 'lnk_abc', secure_url: 'https://view.cloakshare.dev/s/lnk_abc' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    const link = await sdk.links.get('lnk_abc');
    expect(link.id).toBe('lnk_abc');
  });

  it('throws AuthenticationError on 401', async () => {
    mockFetch(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    await expect(sdk.links.list()).rejects.toThrow(AuthenticationError);
  });

  it('throws CloakShareError on 400', async () => {
    mockFetch(400, { error: { code: 'VALIDATION', message: 'Bad request' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    await expect(sdk.links.list()).rejects.toThrow(CloakShareError);
  });

  it('creates link with uploadKey (JSON body)', async () => {
    mockFetch(202, { data: { id: 'lnk_new', secure_url: 'https://view.cloakshare.dev/s/lnk_new', status: 'processing' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    const link = await sdk.links.create({ uploadKey: 'temp/abc/file.pdf', filename: 'file.pdf' });
    expect(link.id).toBe('lnk_new');
    expect(link.status).toBe('processing');
  });

  it('creates link from Buffer (FormData)', async () => {
    mockFetch(202, { data: { id: 'lnk_buf', status: 'processing' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    const buf = Buffer.from('%PDF-1.4 test content');
    const link = await sdk.links.create({ file: buf, filename: 'test.pdf' });
    expect(link.id).toBe('lnk_buf');
  });

  it('throws when create is called without file or uploadKey', async () => {
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    await expect(sdk.links.create({})).rejects.toThrow('Must provide file');
  });

  it('revoke calls DELETE', async () => {
    mockFetch(200, { data: { id: 'lnk_del', status: 'revoked' } });
    const sdk = new CloakShare('ck_live_abc123', { baseUrl: 'http://localhost:3000', maxRetries: 0 });
    await sdk.links.revoke('lnk_del');

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe('DELETE');
    expect(call[0]).toContain('/v1/links/lnk_del');
  });
});
