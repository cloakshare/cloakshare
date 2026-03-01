import { describe, it, expect, beforeAll } from 'vitest';
import { app, registerUser, createTestLink } from './helpers.js';

describe('Viewer API', () => {
  let apiKey: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
  });

  // -------------------------------------------------------
  // GET /v1/viewer/:token — Metadata
  // -------------------------------------------------------
  describe('GET /v1/viewer/:token', () => {
    it('returns 202 with processing status for newly created link', async () => {
      const { body: linkBody } = await createTestLink(apiKey, { requireEmail: true });
      // The link ID is the token
      const linkId = linkBody.data.id;

      const res = await app.request(`/v1/viewer/${linkId}`);
      // Link is always processing in tests (no background worker)
      expect(res.status).toBe(202);

      const { data } = await res.json();
      expect(data.status).toBe('processing');
      expect(data.progress_url).toBeDefined();
    });

    it('returns 404 for non-existent token', async () => {
      const res = await app.request('/v1/viewer/nonexistent-link-id');
      expect(res.status).toBe(404);
    });

    it('returns 410 for revoked link', async () => {
      const { linkId } = await createTestLink(apiKey);

      // Revoke the link
      await app.request(`/v1/links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const res = await app.request(`/v1/viewer/${linkId}`);
      expect(res.status).toBe(410);
    });
  });

  // -------------------------------------------------------
  // POST /v1/viewer/:token/verify — Create session
  // -------------------------------------------------------
  describe('POST /v1/viewer/:token/verify', () => {
    it('returns 404 for a processing (non-active) link', async () => {
      const { body: linkBody } = await createTestLink(apiKey, { requireEmail: false });
      const linkId = linkBody.data.id;

      const res = await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Verify requires link.status === 'active'; processing links return 404
      expect(res.status).toBe(404);
    });

    it('returns 404 for invalid token', async () => {
      const res = await app.request('/v1/viewer/fake-token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(404);
    });

    it('returns 404 for revoked link (verify treats all non-active as not found)', async () => {
      const { linkId } = await createTestLink(apiKey);

      // Revoke
      await app.request(`/v1/links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const res = await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Verify checks link.status !== 'active' → returns 404 for any non-active status
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // POST /v1/viewer/:token/track — View tracking
  // -------------------------------------------------------
  describe('POST /v1/viewer/:token/track', () => {
    it('accepts tracking data and returns 204', async () => {
      const { body: linkBody } = await createTestLink(apiKey, { requireEmail: false });
      const linkId = linkBody.data.id;

      const res = await app.request(`/v1/viewer/${linkId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_page: 1,
          total_duration: 5,
          is_final: false,
        }),
      });

      // Track always returns 204 (fire and forget)
      expect(res.status).toBe(204);
    });

    it('returns 204 even for invalid token (fire and forget)', async () => {
      const res = await app.request('/v1/viewer/fake-token/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_duration: 1 }),
      });

      // Track endpoint is fire-and-forget
      expect(res.status).toBe(204);
    });
  });
});
