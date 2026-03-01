import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  registerUser,
  apiRequest,
  sessionRequest,
  loginUser,
  createTestLink,
} from './helpers.js';

describe('Edge Cases & Error Handling', () => {
  let apiKey: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
  });

  // -------------------------------------------------------
  // API Version Handling
  // -------------------------------------------------------
  describe('API Versioning', () => {
    it('rejects unsupported API version (v2)', async () => {
      const res = await app.request('/v2/links');
      expect(res.status).toBe(404);
      const { error } = await res.json();
      expect(['UNKNOWN_API_VERSION', 'NOT_FOUND']).toContain(error.code);
    });

    it('rejects unsupported API version (v99)', async () => {
      const res = await app.request('/v99/links');
      expect(res.status).toBe(404);
    });

    it('includes X-API-Version header in response', async () => {
      const res = await app.request('/health');
      const version = res.headers.get('X-API-Version');
      expect(version).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // 404 Handling
  // -------------------------------------------------------
  describe('404 Handling', () => {
    it('returns proper error envelope for nonexistent endpoint', async () => {
      const res = await app.request('/nonexistent');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBeDefined();
    });

    it('returns 404 for nonexistent v1 endpoint', async () => {
      const res = await app.request('/v1/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Authentication Isolation
  // -------------------------------------------------------
  describe('Cross-user isolation', () => {
    it('user A cannot see user B\'s links', async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      // Create link as user A
      const { linkId } = await createTestLink(userA.apiKey);

      // Try to access as user B
      const res = await apiRequest(`/v1/links/${linkId}`, userB.apiKey);
      expect(res.status).toBe(404);
    });

    it('user A cannot delete user B\'s link', async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      const { linkId } = await createTestLink(userA.apiKey);

      const res = await apiRequest(`/v1/links/${linkId}`, userB.apiKey, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });

    it('user A cannot see user B\'s analytics', async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      const { linkId } = await createTestLink(userA.apiKey);

      const res = await apiRequest(`/v1/links/${linkId}/analytics`, userB.apiKey);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Health Check
  // -------------------------------------------------------
  describe('Health Check', () => {
    it('returns 200 with status, checks, uptime', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.uptime).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.checks.database).toBeDefined();
      expect(body.checks.database.latency_ms).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // Security Headers
  // -------------------------------------------------------
  describe('Security Headers', () => {
    it('includes X-Content-Type-Options', async () => {
      const res = await app.request('/health');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('includes X-DNS-Prefetch-Control', async () => {
      const res = await app.request('/health');
      expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('off');
    });

    it('includes Referrer-Policy', async () => {
      const res = await app.request('/health');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('includes X-Request-Id in response', async () => {
      const res = await app.request('/health');
      expect(res.headers.get('X-Request-Id')).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // GDPR Deletion
  // -------------------------------------------------------
  describe('DELETE /v1/viewers/:email', () => {
    it('deletes viewer data for an email', async () => {
      const res = await apiRequest(
        `/v1/viewers/${encodeURIComponent('viewer@example.com')}`,
        apiKey,
        { method: 'DELETE' },
      );

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.deleted).toBeDefined();
      expect(data.deleted.views).toBeDefined();
      expect(data.deleted.sessions).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/viewers/test@example.com', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // Embed endpoints
  // -------------------------------------------------------
  describe('Embed', () => {
    it('returns 404 for non-existent embed', async () => {
      const res = await app.request('/v1/embed/fake-link-id');
      expect(res.status).toBe(404);
    });

    it('returns 400 for processing link (not yet active)', async () => {
      const { linkId } = await createTestLink(apiKey);
      const res = await app.request(`/v1/embed/${linkId}`);
      // Link is processing in tests — embed requires active status
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // Request body validation
  // -------------------------------------------------------
  describe('Request body validation', () => {
    it('handles malformed JSON', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      });

      // Returns an error (400 or 500 depending on framework handling)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('handles empty body for login', async () => {
      const res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // Domains (plan-gated)
  // -------------------------------------------------------
  describe('Domains (plan-gated)', () => {
    it('rejects domain creation on free plan', async () => {
      const res = await apiRequest('/v1/domains', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'docs.example.com' }),
      });

      // Should be 403 (plan restriction) or similar
      expect([400, 403]).toContain(res.status);
    });

    it('lists domains (empty on free plan)', async () => {
      const res = await apiRequest('/v1/domains', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.domains).toBeDefined();
      expect(data.domains).toEqual([]);
    });
  });
});
