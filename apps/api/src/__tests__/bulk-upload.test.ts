import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser, apiRequest, app } from './helpers.js';

// ============================================
// Bulk Upload API Test Suite
// ============================================

describe('Bulk Upload: POST /v1/links/bulk', () => {
  let apiKey: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
  });

  // ============================================
  // Validation
  // ============================================

  describe('Validation', () => {
    it('requires files array', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('files array');
    });

    it('rejects empty files array', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('empty');
    });

    it('rejects more than 20 files', async () => {
      const files = Array.from({ length: 21 }, (_, i) => ({
        upload_r2_key: `temp/test/${i}.pdf`,
        filename: `doc-${i}.pdf`,
      }));

      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('20');
    });

    it('requires auth', async () => {
      const res = await app.request('/v1/links/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ upload_r2_key: 'a', filename: 'b.pdf' }] }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // Successful bulk creation
  // ============================================

  describe('Successful creation', () => {
    it('creates multiple links and returns 202', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/test1/doc1.pdf', filename: 'doc1.pdf' },
            { upload_r2_key: 'temp/test2/doc2.pdf', filename: 'doc2.pdf' },
            { upload_r2_key: 'temp/test3/img1.png', filename: 'img1.png' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(3);
      expect(body.data.links).toHaveLength(3);
      expect(body.data.links[0].id).toMatch(/^lnk_/);
      expect(body.data.links[0].status).toBe('processing');
      expect(body.data.links[0].secure_url).toContain('/s/');
      expect(body.data.links[0].filename).toBe('doc1.pdf');
    });

    it('applies shared options to all links', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          require_email: false,
          watermark: false,
          expires_in: '7d',
          files: [
            { upload_r2_key: 'temp/t/a.pdf', filename: 'a.pdf' },
            { upload_r2_key: 'temp/t/b.pdf', filename: 'b.pdf' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(2);
    });

    it('allows custom name per file', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/t/a.pdf', filename: 'a.pdf', name: 'Proposal Q1' },
            { upload_r2_key: 'temp/t/b.pdf', filename: 'b.pdf', name: 'Proposal Q2' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(2);
    });
  });

  // ============================================
  // Partial success with errors
  // ============================================

  describe('Partial success', () => {
    it('creates valid files and reports errors for invalid ones', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/t/valid.pdf', filename: 'valid.pdf' },
            { upload_r2_key: 'temp/t/bad.exe', filename: 'bad.exe' },
            { upload_r2_key: 'temp/t/also-valid.png', filename: 'also-valid.png' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(2);
      expect(body.data.links).toHaveLength(2);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].filename).toBe('bad.exe');
      expect(body.data.errors[0].error).toContain('Unsupported');
    });

    it('reports error for missing upload_r2_key', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { filename: 'no-key.pdf' },
            { upload_r2_key: 'temp/t/ok.pdf', filename: 'ok.pdf' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(1);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].error).toContain('required');
    });
  });

  // ============================================
  // File type support
  // ============================================

  describe('File types', () => {
    it('accepts PDF, PNG, JPG, WebP files', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/t/a.pdf', filename: 'a.pdf' },
            { upload_r2_key: 'temp/t/b.png', filename: 'b.png' },
            { upload_r2_key: 'temp/t/c.jpg', filename: 'c.jpg' },
            { upload_r2_key: 'temp/t/d.webp', filename: 'd.webp' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(4);
      expect(body.data.errors).toBeUndefined();
    });

    it('accepts office document types', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/t/a.docx', filename: 'a.docx' },
            { upload_r2_key: 'temp/t/b.pptx', filename: 'b.pptx' },
            { upload_r2_key: 'temp/t/c.xlsx', filename: 'c.xlsx' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(3);
    });

    it('accepts video types when enabled', async () => {
      const res = await apiRequest('/v1/links/bulk', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { upload_r2_key: 'temp/t/a.mp4', filename: 'a.mp4' },
            { upload_r2_key: 'temp/t/b.mov', filename: 'b.mov' },
          ],
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.data.total).toBe(2);
    });
  });
});
