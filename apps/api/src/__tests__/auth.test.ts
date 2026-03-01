import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  uniqueEmail,
  registerUser,
  loginUser,
  sessionRequest,
} from './helpers.js';

describe('Authentication', () => {
  // -------------------------------------------------------
  // Registration
  // -------------------------------------------------------
  describe('POST /v1/auth/register', () => {
    it('creates a user and returns 201 with user data + API key', async () => {
      const email = uniqueEmail('reg');
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'StrongPass1!' }),
      });

      expect(res.status).toBe(201);
      const { data, error } = await res.json();
      expect(error).toBeNull();
      expect(data.user.email).toBe(email);
      expect(data.user.id).toBeDefined();
      expect(data.api_key).toMatch(/^ck_live_/);
    });

    it('rejects duplicate email', async () => {
      const email = uniqueEmail('dup');
      await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'StrongPass1!' }),
      });

      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'StrongPass1!' }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing email with 400', async () => {
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'StrongPass1!' }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects short password with 400', async () => {
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail(), password: 'short' }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing password with 400', async () => {
      const res = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail() }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -------------------------------------------------------
  // Login
  // -------------------------------------------------------
  describe('POST /v1/auth/login', () => {
    let testEmail: string;
    const testPassword = 'LoginPass1!';

    beforeAll(async () => {
      const user = await registerUser(undefined, testPassword);
      testEmail = user.email;
    });

    it('returns 200 with session cookie on valid credentials', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });

      expect(res.status).toBe(200);
      const { data, error } = await res.json();
      expect(error).toBeNull();
      expect(data.user.email).toBe(testEmail);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('cloak_session');
    });

    it('returns 401 with wrong password', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPass99!' }),
      });

      expect(res.status).toBe(401);
      const { error } = await res.json();
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with non-existent email', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com', password: testPassword }),
      });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // Session Rotation
  // -------------------------------------------------------
  describe('Session rotation', () => {
    it('invalidates previous session on new login', async () => {
      const user = await registerUser();
      const { sessionCookie: session1 } = await loginUser(user.email, user.password);

      // First session should work
      const me1 = await sessionRequest('/v1/auth/me', session1);
      expect(me1.status).toBe(200);

      // Login again to get a new session
      const { sessionCookie: session2 } = await loginUser(user.email, user.password);

      // New session should work
      const me2 = await sessionRequest('/v1/auth/me', session2);
      expect(me2.status).toBe(200);

      // Old session should be invalidated
      const me1Again = await sessionRequest('/v1/auth/me', session1);
      expect(me1Again.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // CSRF Protection (cookie attributes)
  // -------------------------------------------------------
  describe('CSRF protection', () => {
    it('sets HttpOnly flag on session cookie', async () => {
      const user = await registerUser();
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie.toLowerCase()).toContain('httponly');
    });

    it('sets SameSite=Lax on session cookie', async () => {
      const user = await registerUser();
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie.toLowerCase()).toContain('samesite=lax');
    });

    it('sets Path=/ on session cookie', async () => {
      const user = await registerUser();
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie.toLowerCase()).toContain('path=/');
    });
  });

  // -------------------------------------------------------
  // Session: GET /v1/auth/me
  // -------------------------------------------------------
  describe('GET /v1/auth/me', () => {
    let sessionCookie: string;
    let testEmail: string;

    beforeAll(async () => {
      const user = await registerUser();
      testEmail = user.email;
      const login = await loginUser(user.email, user.password);
      sessionCookie = login.sessionCookie;
    });

    it('returns user profile with valid session', async () => {
      const res = await sessionRequest('/v1/auth/me', sessionCookie);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.email).toBe(testEmail);
      expect(data.id).toBeDefined();
      expect(data.plan).toBeDefined();
      expect(data.orgs).toBeDefined();
      expect(Array.isArray(data.orgs)).toBe(true);
    });

    it('returns 401 without session cookie', async () => {
      const res = await app.request('/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid session token', async () => {
      const res = await sessionRequest('/v1/auth/me', 'cloak_session=invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // Logout
  // -------------------------------------------------------
  describe('POST /v1/auth/logout', () => {
    it('invalidates session and returns 200', async () => {
      const user = await registerUser();
      const { sessionCookie } = await loginUser(user.email, user.password);

      // Logout
      const logoutRes = await sessionRequest('/v1/auth/logout', sessionCookie, {
        method: 'POST',
      });
      expect(logoutRes.status).toBe(200);

      // Verify session is invalid
      const meRes = await sessionRequest('/v1/auth/me', sessionCookie);
      expect(meRes.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // API Keys
  // -------------------------------------------------------
  describe('API Key Management', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const user = await registerUser();
      const login = await loginUser(user.email, user.password);
      sessionCookie = login.sessionCookie;
    });

    it('GET /v1/auth/api-keys lists keys (includes the one from registration)', async () => {
      const res = await sessionRequest('/v1/auth/api-keys', sessionCookie);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.api_keys).toBeDefined();
      expect(data.api_keys.length).toBeGreaterThanOrEqual(1);
      // Keys should NOT contain the raw key, only prefix
      for (const key of data.api_keys) {
        expect(key.keyPrefix).toBeDefined();
        expect(key.key).toBeUndefined();
      }
    });

    it('POST /v1/auth/api-keys creates a new key and returns 201', async () => {
      const res = await sessionRequest('/v1/auth/api-keys', sessionCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Key' }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.key).toMatch(/^ck_live_/);
      expect(data.name).toBe('Test Key');
      expect(data.id).toBeDefined();
    });

    it('POST /v1/auth/api-keys supports test key type', async () => {
      const res = await sessionRequest('/v1/auth/api-keys', sessionCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Mode Key', type: 'test' }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.key).toMatch(/^ck_test_/);
    });

    it('DELETE /v1/auth/api-keys/:id revokes a key', async () => {
      // Create a key to revoke
      const createRes = await sessionRequest('/v1/auth/api-keys', sessionCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'To Revoke' }),
      });
      const { data: created } = await createRes.json();

      // Revoke it
      const revokeRes = await sessionRequest(
        `/v1/auth/api-keys/${created.id}`,
        sessionCookie,
        { method: 'DELETE' },
      );

      expect(revokeRes.status).toBe(200);
      const { data } = await revokeRes.json();
      expect(data.revoked).toBe(true);
    });

    it('revoked API key cannot authenticate', async () => {
      // Create and immediately revoke
      const createRes = await sessionRequest('/v1/auth/api-keys', sessionCookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Will Revoke' }),
      });
      const { data: created } = await createRes.json();

      await sessionRequest(`/v1/auth/api-keys/${created.id}`, sessionCookie, {
        method: 'DELETE',
      });

      // Try to use the revoked key
      const res = await app.request('/v1/links', {
        headers: { Authorization: `Bearer ${created.key}` },
      });
      expect(res.status).toBe(401);
    });
  });
});
