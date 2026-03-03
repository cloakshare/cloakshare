import { describe, it, expect, beforeAll } from 'vitest';
import {
  app,
  registerUser,
  apiRequest,
  createTestLink,
  minimalPng,
  minimalPdf,
  upgradeUserPlan,
} from './helpers.js';

describe('Links API', () => {
  let apiKey: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
    // Starter plan needed for password protection tests
    await upgradeUserPlan(user.userId, 'starter');
  });

  // -------------------------------------------------------
  // Create Link (multipart upload)
  // -------------------------------------------------------
  describe('POST /v1/links', () => {
    it('creates a link from PNG upload and returns 202', async () => {
      const { res, body } = await createTestLink(apiKey);
      expect(res.status).toBe(202);
      expect(body.error).toBeNull();
      expect(body.data.id).toBeDefined();
      expect(body.data.secure_url).toBeDefined();
      expect(body.data.status).toBe('processing');
      expect(body.data.file_type).toBe('png');
    });

    it('creates a link from PDF upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'doc.pdf',
        buffer: minimalPdf(),
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('applies custom rules (password, max_views, expires_in)', async () => {
      const { body } = await createTestLink(apiKey, {
        password: 'secret123',
        maxViews: 5,
        expiresIn: '7d',
      });

      expect(body.data.rules).toBeDefined();
      expect(body.data.rules.has_password).toBe(true);
      expect(body.data.rules.max_views).toBe(5);
      expect(body.data.rules.expires_at).toBeDefined();
    });

    it('rejects unsupported file extensions with 400', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([Buffer.from('not a real file')], { type: 'application/octet-stream' }),
        'malware.exe',
      );

      const res = await app.request('/v1/links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('INVALID_FILE_TYPE');
    });

    it('rejects request without auth with 401', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([minimalPng()], { type: 'image/png' }), 'test.png');

      const res = await app.request('/v1/links', {
        method: 'POST',
        body: formData,
      });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // List Links
  // -------------------------------------------------------
  describe('GET /v1/links', () => {
    beforeAll(async () => {
      // Create a couple links to list
      await createTestLink(apiKey);
      await createTestLink(apiKey);
    });

    it('returns paginated links', async () => {
      const res = await apiRequest('/v1/links', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.links).toBeDefined();
      expect(Array.isArray(data.links)).toBe(true);
      expect(data.links.length).toBeGreaterThanOrEqual(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeGreaterThanOrEqual(2);
      expect(data.pagination.page).toBe(1);
    });

    it('supports pagination params', async () => {
      const res = await apiRequest('/v1/links?page=1&limit=1', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.links.length).toBe(1);
      expect(data.pagination.limit).toBe(1);
      expect(data.pagination.pages).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array for user with no links', async () => {
      const newUser = await registerUser();
      const res = await apiRequest('/v1/links', newUser.apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.links).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });
  });

  // -------------------------------------------------------
  // Get Link Details
  // -------------------------------------------------------
  describe('GET /v1/links/:id', () => {
    let linkId: string;

    beforeAll(async () => {
      const result = await createTestLink(apiKey);
      linkId = result.linkId;
    });

    it('returns link details', async () => {
      const res = await apiRequest(`/v1/links/${linkId}`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.id).toBe(linkId);
      expect(data.secure_url).toBeDefined();
      expect(data.analytics_url).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.file_type).toBeDefined();
      expect(data.rules).toBeDefined();
      expect(data.view_count).toBe(0);
    });

    it('returns 404 for non-existent link', async () => {
      const res = await apiRequest('/v1/links/nonexistent-id', apiKey);
      expect(res.status).toBe(404);
    });

    it('returns 404 for another user\'s link', async () => {
      const otherUser = await registerUser();
      const res = await apiRequest(`/v1/links/${linkId}`, otherUser.apiKey);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Delete/Revoke Link
  // -------------------------------------------------------
  describe('DELETE /v1/links/:id', () => {
    it('revokes a link (soft delete)', async () => {
      const { linkId } = await createTestLink(apiKey);

      const res = await apiRequest(`/v1/links/${linkId}`, apiKey, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.status).toBe('revoked');
      expect(data.revoked_at).toBeDefined();
    });

    it('revoked link shows as revoked in details', async () => {
      const { linkId } = await createTestLink(apiKey);

      await apiRequest(`/v1/links/${linkId}`, apiKey, { method: 'DELETE' });

      const detailRes = await apiRequest(`/v1/links/${linkId}`, apiKey);
      expect(detailRes.status).toBe(200);
      const { data } = await detailRes.json();
      expect(data.status).toBe('revoked');
    });

    it('returns 404 for non-existent link', async () => {
      const res = await apiRequest('/v1/links/fake-id', apiKey, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Analytics
  // -------------------------------------------------------
  describe('GET /v1/links/:id/analytics', () => {
    it('returns analytics data for a link with no views', async () => {
      const { linkId } = await createTestLink(apiKey);

      const res = await apiRequest(`/v1/links/${linkId}/analytics`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.link_id).toBe(linkId);
      expect(data.total_views).toBe(0);
      expect(data.unique_viewers).toBe(0);
      expect(data.viewers).toEqual([]);
    });

    it('returns 404 for non-existent link', async () => {
      const res = await apiRequest('/v1/links/fake-id/analytics', apiKey);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Upload URL (presigned)
  // -------------------------------------------------------
  describe('POST /v1/links/upload-url', () => {
    it('returns upload URL for supported file type', async () => {
      const res = await apiRequest('/v1/links/upload-url', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'document.pdf', content_type: 'application/pdf' }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.upload_url).toBeDefined();
      expect(data.upload_id).toBeDefined();
      expect(data.expires_in).toBe(900);
    });

    it('rejects missing filename', async () => {
      const res = await apiRequest('/v1/links/upload-url', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: 'application/pdf' }),
      });

      expect(res.status).toBe(400);
    });
  });
});
