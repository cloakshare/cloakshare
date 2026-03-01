import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { app, registerUser, apiRequest, createTestLink, minimalPdf } from './helpers.js';
import { db } from '../db/client.js';
import { links, renderingJobs } from '../db/schema.js';

/**
 * Minimal DOCX buffer — a ZIP file with the PK magic header.
 * DOCX/PPTX/XLSX are all ZIP-based Office Open XML formats.
 */
function minimalDocx(): Buffer {
  // PK zip header (minimal)
  return Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
    0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

function minimalPptx(): Buffer {
  return minimalDocx(); // Same ZIP-based format, extension distinguishes
}

function minimalXlsx(): Buffer {
  return minimalDocx(); // Same ZIP-based format
}

describe('Office Document Conversion', () => {
  let apiKey: string;
  let userId: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
    userId = user.userId;
  });

  // -------------------------------------------------------
  // Office Upload — File Type Acceptance
  // -------------------------------------------------------
  describe('Upload — File Type Acceptance', () => {
    it('accepts DOCX upload and sets file_type to pdf (pending conversion)', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'report.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf'); // Office docs get converted to PDF
      expect(body.data.status).toBe('processing');
      expect(body.data.id).toBeDefined();
    });

    it('accepts PPTX upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'slides.pptx',
        buffer: minimalPptx(),
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts XLSX upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'data.xlsx',
        buffer: minimalXlsx(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts ODT upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'document.odt',
        buffer: minimalDocx(), // ODT is also ZIP-based
        contentType: 'application/vnd.oasis.opendocument.text',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts ODP (OpenDocument Presentation) upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'presentation.odp',
        buffer: minimalDocx(),
        contentType: 'application/vnd.oasis.opendocument.presentation',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts ODS (OpenDocument Spreadsheet) upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'spreadsheet.ods',
        buffer: minimalDocx(),
        contentType: 'application/vnd.oasis.opendocument.spreadsheet',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts RTF upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'memo.rtf',
        buffer: Buffer.from('{\\rtf1\\ansi\\deff0 Hello, World!}'),
        contentType: 'text/rtf',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });

    it('accepts legacy DOC format', async () => {
      // DOC uses OLE2 compound document format (magic: D0 CF 11 E0)
      const { res, body } = await createTestLink(apiKey, {
        filename: 'legacy.doc',
        buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        contentType: 'application/msword',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('pdf');
    });
  });

  // -------------------------------------------------------
  // Rendering Job Creation
  // -------------------------------------------------------
  describe('Rendering Job Creation', () => {
    it('creates a rendering job for office document upload', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'queued.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const job = await db.select()
        .from(renderingJobs)
        .where(eq(renderingJobs.linkId, linkId))
        .get();

      expect(job).toBeDefined();
      expect(job!.status).toBe('pending');
      expect(job!.sourceKey).toContain('queued.docx');
    });

    it('rendering job source key references the uploaded file', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'tracked-upload.pptx',
        buffer: minimalPptx(),
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      const job = await db.select()
        .from(renderingJobs)
        .where(eq(renderingJobs.linkId, linkId))
        .get();

      expect(job).toBeDefined();
      expect(job!.sourceKey).toMatch(/^temp\/.+\/tracked-upload\.pptx$/);
    });
  });

  // -------------------------------------------------------
  // Link Metadata for Office Documents
  // -------------------------------------------------------
  describe('Link Metadata', () => {
    it('office document link shows file_type=pdf in list endpoint', async () => {
      await createTestLink(apiKey, {
        filename: 'listed.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const res = await apiRequest('/v1/links', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      const officeLink = data.links.find((l: any) =>
        l.file_type === 'pdf' && l.status === 'processing'
      );
      expect(officeLink).toBeDefined();
    });

    it('office document link detail shows page_count after rendering', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'rendered.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Simulate rendering completion
      await db.update(links)
        .set({ status: 'active', pageCount: 5 })
        .where(eq(links.id, linkId));

      const res = await apiRequest(`/v1/links/${linkId}`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.file_type).toBe('pdf');
      expect(data.page_count).toBe(5);
      expect(data.video_metadata).toBeUndefined();
    });
  });

  // -------------------------------------------------------
  // Viewer — Processing State
  // -------------------------------------------------------
  describe('Viewer — Processing State', () => {
    it('viewer returns 202 for office document still being processed', async () => {
      const { body } = await createTestLink(apiKey, {
        filename: 'processing.xlsx',
        buffer: minimalXlsx(),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const res = await app.request(`/v1/viewer/${body.data.id}`);
      expect(res.status).toBe(202);

      const { data } = await res.json();
      expect(data.status).toBe('processing');
      expect(data.progress_url).toContain('/progress');
    });

    it('viewer returns correct metadata for active office document', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'active.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await db.update(links)
        .set({ status: 'active', pageCount: 3 })
        .where(eq(links.id, linkId));

      const res = await app.request(`/v1/viewer/${linkId}`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.file_type).toBe('pdf');
      expect(data.page_count).toBe(3);
    });
  });

  // -------------------------------------------------------
  // Office Document with Link Options
  // -------------------------------------------------------
  describe('Office Document with Link Options', () => {
    it('office document link respects password option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'protected.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        password: 'DocPass123',
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.has_password).toBe(true);
    });

    it('office document link respects watermark option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'watermarked.pptx',
        buffer: minimalPptx(),
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        watermark: true,
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.watermark).toBe(true);
    });
  });

  // -------------------------------------------------------
  // SSE Progress Endpoint
  // -------------------------------------------------------
  describe('SSE Progress', () => {
    it('progress endpoint returns completed status for active link', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'progress-test.docx',
        buffer: minimalDocx(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Simulate rendering completion
      await db.update(links)
        .set({ status: 'active' })
        .where(eq(links.id, linkId));

      const res = await app.request(`/v1/links/${linkId}/progress`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.status).toBe('completed');
      expect(data.progress).toBe(100);
    });

    it('progress endpoint returns 404 for non-existent link', async () => {
      const res = await app.request('/v1/links/nonexistent-id/progress');
      expect(res.status).toBe(404);
    });
  });
});
