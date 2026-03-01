import { describe, it, expect, beforeAll } from 'vitest';
import app from '../index.js';

// Unique suffix to avoid email collisions across test runs.
const uid = Date.now();

describe('Smoke tests', () => {
  // Shared state: a registered user whose API key is reused for
  // authenticated endpoint tests.  Performing a single registration at the
  // suite level avoids hitting the per-IP rate limiter that applies to
  // /v1/auth/register.
  let registeredApiKey: string;
  const sharedEmail = `smoke-shared-${uid}@example.com`;
  const sharedPassword = 'Shared1234!';

  beforeAll(async () => {
    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sharedEmail, password: sharedPassword }),
    });
    const body = await res.json();
    registeredApiKey = body.data.api_key;
  });

  // -------------------------------------------------------
  // 1. Health check
  // -------------------------------------------------------
  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
    });
  });

  // -------------------------------------------------------
  // 2 & 3. Registration
  // -------------------------------------------------------
  describe('POST /v1/auth/register', () => {
    it('creates a user and returns 201 with user and api_key', async () => {
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `smoke-register-${uid}@example.com`,
          password: 'Test1234!',
        }),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(`smoke-register-${uid}@example.com`);
      expect(body.data.api_key).toBeDefined();
      expect(body.data.api_key).toMatch(/^ck_live_/);
      expect(body.error).toBeNull();
    });

    it('returns 400 when password is missing', async () => {
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `smoke-nopw-${uid}@example.com`,
        }),
      });

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------
  // 4 & 5. Login
  // -------------------------------------------------------
  describe('POST /v1/auth/login', () => {
    it('returns 200 with user data and sets session cookie on valid credentials', async () => {
      // Login with the user created in the suite-level beforeAll
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sharedEmail, password: sharedPassword }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(sharedEmail);
      expect(body.error).toBeNull();

      // The response should include a set-cookie header for the session
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('cloak_session');
    });

    it('returns 401 with wrong password', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sharedEmail, password: 'WrongPassword99!' }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------
  // 6. GET /v1/auth/me without session
  // -------------------------------------------------------
  describe('GET /v1/auth/me', () => {
    it('returns 401 without a session cookie', async () => {
      const res = await app.request('/v1/auth/me');
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------
  // 7. POST /v1/links without auth
  // -------------------------------------------------------
  describe('POST /v1/links', () => {
    it('returns 401 without an API key', async () => {
      const res = await app.request('/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // -------------------------------------------------------
  // 8. GET /v1/links with valid API key
  // -------------------------------------------------------
  describe('GET /v1/links', () => {
    it('returns 200 with a links array when authenticated', async () => {
      const res = await app.request('/v1/links', {
        headers: {
          Authorization: `Bearer ${registeredApiKey}`,
        },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.links).toBeDefined();
      expect(Array.isArray(body.data.links)).toBe(true);
      expect(body.data.pagination).toBeDefined();
      expect(body.error).toBeNull();
    });
  });

  // -------------------------------------------------------
  // 9. 404 for nonexistent endpoint
  // -------------------------------------------------------
  describe('GET /nonexistent', () => {
    it('returns 404', async () => {
      const res = await app.request('/nonexistent');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // -------------------------------------------------------
  // 10. Unknown API version
  // -------------------------------------------------------
  describe('GET /v2/links', () => {
    it('returns 404 for an unsupported API version', async () => {
      const res = await app.request('/v2/links');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBeDefined();
      // The API may return UNKNOWN_API_VERSION or NOT_FOUND depending on
      // route matching order.  Either way, the caller learns this version
      // is not available.
      expect(['UNKNOWN_API_VERSION', 'NOT_FOUND']).toContain(body.error.code);
    });
  });
});
