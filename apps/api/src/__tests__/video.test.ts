import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app, registerUser, apiRequest, createTestLink } from './helpers.js';
import { db } from '../db/client.js';
import { links, views, viewerSessions } from '../db/schema.js';
import { config } from '../lib/config.js';

/**
 * Minimal MP4 buffer — a valid ftyp box (ISO Base Media File Format header).
 * Not playable, but enough for file type detection in upload routes.
 */
function minimalMp4(): Buffer {
  // ftyp box: 20 bytes total
  // [4 bytes size][4 bytes 'ftyp'][4 bytes brand 'isom'][4 bytes version][4 bytes compat brand]
  const buf = Buffer.alloc(20);
  buf.writeUInt32BE(20, 0);                     // box size
  buf.write('ftyp', 4, 'ascii');                // box type
  buf.write('isom', 8, 'ascii');                // major brand
  buf.writeUInt32BE(0x200, 12);                 // minor version
  buf.write('isom', 16, 'ascii');               // compatible brand
  return buf;
}

function minimalWebm(): Buffer {
  // WebM magic bytes: 1A 45 DF A3 (EBML header)
  return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
}

function minimalMov(): Buffer {
  // MOV uses same ftyp structure as MP4 but with 'qt  ' brand
  const buf = Buffer.alloc(20);
  buf.writeUInt32BE(20, 0);
  buf.write('ftyp', 4, 'ascii');
  buf.write('qt  ', 8, 'ascii');
  buf.writeUInt32BE(0, 12);
  buf.write('qt  ', 16, 'ascii');
  return buf;
}

/**
 * Write stub HLS playlist files to local storage so that the verify endpoint's
 * generateSessionManifest() call can read them without FFmpeg actually running.
 */
function createStubHlsFiles(linkId: string, qualities: string[]) {
  const storagePath = config.storage.localPath;
  const videoDir = join(storagePath, 'renders', linkId, 'video');

  // Master playlist
  mkdirSync(videoDir, { recursive: true });
  let master = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const q of qualities) {
    master += `#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n${q}/playlist.m3u8\n`;
  }
  writeFileSync(join(videoDir, 'master.m3u8'), master);

  // Variant playlists (one per quality)
  for (const q of qualities) {
    const qDir = join(videoDir, q);
    mkdirSync(qDir, { recursive: true });
    const variant =
      '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n' +
      '#EXTINF:6.0,\nsegment-000.ts\n#EXT-X-ENDLIST\n';
    writeFileSync(join(qDir, 'playlist.m3u8'), variant);
    // Write a dummy segment so storage doesn't fail
    writeFileSync(join(qDir, 'segment-000.ts'), Buffer.alloc(16));
  }
}

describe('Video Pipeline', () => {
  let apiKey: string;
  let userId: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
    userId = user.userId;
  });

  // -------------------------------------------------------
  // Video Upload — File Type Acceptance
  // -------------------------------------------------------
  describe('Video Upload — File Type Acceptance', () => {
    it('accepts MP4 video upload and returns 202 with processing status', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'demo.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('video');
      expect(body.data.status).toBe('processing');
      expect(body.data.id).toBeDefined();
      expect(body.data.secure_url).toContain('/s/');
      expect(body.data.progress_url).toBeDefined();
    });

    it('accepts WebM video upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'clip.webm',
        buffer: minimalWebm(),
        contentType: 'video/webm',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('video');
    });

    it('accepts MOV video upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'recording.mov',
        buffer: minimalMov(),
        contentType: 'video/quicktime',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('video');
    });

    it('accepts MKV video upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'movie.mkv',
        buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
        contentType: 'video/x-matroska',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('video');
    });

    it('accepts AVI video upload', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'legacy.avi',
        buffer: Buffer.from('RIFF\x00\x00\x00\x00AVI '),
        contentType: 'video/x-msvideo',
      });

      expect(res.status).toBe(202);
      expect(body.data.file_type).toBe('video');
    });

    it('rejects unsupported file type (e.g., .exe)', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from('MZ')], { type: 'application/octet-stream' }), 'malware.exe');

      const res = await app.request('/v1/links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('INVALID_FILE_TYPE');
    });

    it('rejects unsupported file type (.flv)', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from('FLV\x01')], { type: 'video/x-flv' }), 'old.flv');

      const res = await app.request('/v1/links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // Video Upload — Extension Validation
  // -------------------------------------------------------
  describe('Video Upload — Extension Validation', () => {
    it('presigned URL endpoint detects video extension and applies video size limit', async () => {
      // A video file within the 500MB video limit but above the 100MB doc limit
      const res = await app.request('/v1/links/upload-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'big.mp4',
          content_type: 'video/mp4',
          file_size: 200_000_000, // 200 MB — above MAX_FILE_SIZE but within VIDEO_MAX_FILE_SIZE
        }),
      });

      // Should succeed because video extension gets the 500MB limit
      expect(res.status).toBe(200);
    });

    it('presigned URL endpoint rejects non-video file above doc size limit', async () => {
      const res = await app.request('/v1/links/upload-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'large.pdf',
          content_type: 'application/pdf',
          file_size: 200_000_000, // 200 MB — above 100MB doc limit
        }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('FILE_TOO_LARGE');
    });
  });

  // -------------------------------------------------------
  // Video Upload — Size Limits
  // -------------------------------------------------------
  describe('Video Upload — Size Limits', () => {
    it('rejects presigned upload URL when file_size exceeds VIDEO_MAX_FILE_SIZE (500MB)', async () => {
      const res = await app.request('/v1/links/upload-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'huge.mp4',
          content_type: 'video/mp4',
          file_size: 600_000_000, // 600 MB > 500 MB limit
        }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('FILE_TOO_LARGE');
    });

    it('accepts presigned upload URL for video within size limit', async () => {
      const res = await app.request('/v1/links/upload-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'normal.mp4',
          content_type: 'video/mp4',
          file_size: 50_000_000, // 50 MB
        }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.upload_url).toBeDefined();
      expect(data.upload_id).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // Video Link Details & Metadata
  // -------------------------------------------------------
  describe('Video Link Details & Metadata', () => {
    it('video link shows file_type=video in list endpoint', async () => {
      await createTestLink(apiKey, {
        filename: 'listed.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      const res = await apiRequest('/v1/links', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      const videoLink = data.links.find((l: any) => l.file_type === 'video');
      expect(videoLink).toBeDefined();
      expect(videoLink.file_type).toBe('video');
    });

    it('video link detail includes video_metadata when active', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'detail.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      // Manually set the link to active with video metadata (simulating completed transcode)
      await db.update(links)
        .set({
          status: 'active',
          videoDuration: 120,
          videoWidth: 1920,
          videoHeight: 1080,
          videoQualities: JSON.stringify(['720p', '1080p']),
        })
        .where(eq(links.id, linkId));

      const res = await apiRequest(`/v1/links/${linkId}`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.file_type).toBe('video');
      expect(data.video_metadata).toBeDefined();
      expect(data.video_metadata.duration).toBe(120);
      expect(data.video_metadata.width).toBe(1920);
      expect(data.video_metadata.height).toBe(1080);
      expect(data.video_metadata.qualities).toEqual(['720p', '1080p']);
    });

    it('non-video link detail does not include video_metadata', async () => {
      const { linkId } = await createTestLink(apiKey);

      // Set to active for detail retrieval
      await db.update(links)
        .set({ status: 'active', pageCount: 3 })
        .where(eq(links.id, linkId));

      const res = await apiRequest(`/v1/links/${linkId}`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.file_type).not.toBe('video');
      expect(data.video_metadata).toBeUndefined();
    });
  });

  // -------------------------------------------------------
  // Video Viewer Metadata
  // -------------------------------------------------------
  describe('Video Viewer Metadata', () => {
    it('GET /v1/viewer/:token returns video_metadata for active video link', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'viewer-test.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      // Activate with video metadata
      await db.update(links)
        .set({
          status: 'active',
          videoDuration: 300,
          videoWidth: 1280,
          videoHeight: 720,
          videoQualities: JSON.stringify(['720p']),
        })
        .where(eq(links.id, linkId));

      const res = await app.request(`/v1/viewer/${linkId}`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.file_type).toBe('video');
      expect(data.video_metadata).toBeDefined();
      expect(data.video_metadata.duration).toBe(300);
      expect(data.video_metadata.qualities).toEqual(['720p']);
    });

    it('GET /v1/viewer/:token returns 202 for processing video link', async () => {
      const { body } = await createTestLink(apiKey, {
        filename: 'processing-vid.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      const res = await app.request(`/v1/viewer/${body.data.id}`);
      expect(res.status).toBe(202);

      const { data } = await res.json();
      expect(data.status).toBe('processing');
    });
  });

  // -------------------------------------------------------
  // Video Tracking (watch time & completion)
  // -------------------------------------------------------
  describe('Video Tracking', () => {
    let videoLinkId: string;
    let sessionToken: string;

    beforeAll(async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'tracked.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        requireEmail: false,
      });
      videoLinkId = linkId;

      // Activate the link with video metadata and disable email requirement
      await db.update(links)
        .set({
          status: 'active',
          requireEmail: false,
          videoDuration: 60,
          videoWidth: 1280,
          videoHeight: 720,
          videoQualities: JSON.stringify(['720p']),
        })
        .where(eq(links.id, videoLinkId));

      // Create stub HLS files so generateSessionManifest can read them
      createStubHlsFiles(videoLinkId, ['720p']);

      // Create a viewer session + view record via verify
      const verifyRes = await app.request(`/v1/viewer/${videoLinkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(verifyRes.status).toBe(200);
      const verifyBody = await verifyRes.json();
      sessionToken = verifyBody.data.session_token;
    });

    it('verify endpoint returns video-specific fields for video link', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'verify-vid.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        requireEmail: false,
      });

      await db.update(links)
        .set({
          status: 'active',
          requireEmail: false,
          videoDuration: 90,
          videoWidth: 1920,
          videoHeight: 1080,
          videoQualities: JSON.stringify(['720p', '1080p']),
        })
        .where(eq(links.id, linkId));

      createStubHlsFiles(linkId, ['720p', '1080p']);

      const res = await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.file_type).toBe('video');
      expect(data.session_token).toBeDefined();
      expect(data.master_playlist_url).toBeDefined();
      expect(data.segment_sign_url).toBeDefined();
      expect(data.video_metadata).toBeDefined();
      expect(data.video_metadata.duration).toBe(90);
      expect(data.video_metadata.qualities).toEqual(['720p', '1080p']);
    });

    it('accepts video tracking data (watch time, current time)', async () => {
      const res = await app.request(`/v1/viewer/${videoLinkId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          video_watch_time: 30,
          video_current_time: 45,
          video_total_duration: 60,
          total_duration: 30,
          is_final: false,
        }),
      });

      expect(res.status).toBe(204);
    });

    it('updates view record with video watch time on final track', async () => {
      // Send final tracking event
      await app.request(`/v1/viewer/${videoLinkId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          video_watch_time: 55,
          video_current_time: 58,
          video_total_duration: 60,
          total_duration: 55,
          is_final: true,
        }),
      });

      // Check the view record was updated
      const view = await db.select()
        .from(views)
        .where(eq(views.sessionToken, sessionToken))
        .get();

      expect(view).toBeDefined();
      expect(view!.videoWatchTime).toBe(55);
      expect(view!.videoMaxReached).toBe(58);
      expect(view!.completionRate).toBeCloseTo(0.97, 1);
      expect(view!.endedAt).toBeDefined();
    });

    it('track returns 204 without session token (fire and forget)', async () => {
      const res = await app.request(`/v1/viewer/${videoLinkId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_watch_time: 10,
          video_current_time: 10,
          video_total_duration: 60,
        }),
      });

      expect(res.status).toBe(204);
    });
  });

  // -------------------------------------------------------
  // Video Segment Signing
  // -------------------------------------------------------
  describe('Video Segment Signing', () => {
    let videoLinkId: string;
    let sessionToken: string;

    beforeAll(async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'segment-test.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        requireEmail: false,
      });
      videoLinkId = linkId;

      await db.update(links)
        .set({
          status: 'active',
          requireEmail: false,
          videoDuration: 30,
          videoWidth: 1280,
          videoHeight: 720,
          videoQualities: JSON.stringify(['720p']),
        })
        .where(eq(links.id, videoLinkId));

      createStubHlsFiles(videoLinkId, ['720p']);

      const verifyRes = await app.request(`/v1/viewer/${videoLinkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const verifyBody = await verifyRes.json();
      sessionToken = verifyBody.data.session_token;
    });

    it('returns 401 without session token', async () => {
      const res = await app.request(`/v1/viewer/${videoLinkId}/sign-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_key: `renders/${videoLinkId}/video/720p/segment-000.ts` }),
      });

      expect(res.status).toBe(401);
    });

    it('rejects segment key outside the link render path', async () => {
      const res = await app.request(`/v1/viewer/${videoLinkId}/sign-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({ segment_key: 'renders/other-link-id/video/720p/segment-000.ts' }),
      });

      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('INVALID_KEY');
    });

    it('rejects request with mismatched session (wrong link)', async () => {
      // Create another video link
      const { linkId: otherLinkId } = await createTestLink(apiKey, {
        filename: 'other.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      // Try to sign a segment for the other link using first link's session token
      const res = await app.request(`/v1/viewer/${otherLinkId}/sign-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({ segment_key: `renders/${otherLinkId}/video/720p/segment-000.ts` }),
      });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------
  // Video Link Lifecycle (revoke, analytics)
  // -------------------------------------------------------
  describe('Video Link Lifecycle', () => {
    it('revoking a video link returns status=revoked', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'revocable.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      const res = await apiRequest(`/v1/links/${linkId}`, apiKey, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.status).toBe('revoked');
    });

    it('revoked video link returns 410 for viewer metadata', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'revoked-vid.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
      });

      // Activate first, then revoke
      await db.update(links).set({ status: 'active' }).where(eq(links.id, linkId));
      await apiRequest(`/v1/links/${linkId}`, apiKey, { method: 'DELETE' });

      const res = await app.request(`/v1/viewer/${linkId}`);
      expect(res.status).toBe(410);
    });

    it('analytics endpoint works for video links with views', async () => {
      const { linkId } = await createTestLink(apiKey, {
        filename: 'analytics-vid.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        requireEmail: false,
      });

      // Activate and verify to create a view
      await db.update(links)
        .set({
          status: 'active',
          requireEmail: false,
          videoDuration: 60,
          videoWidth: 1280,
          videoHeight: 720,
          videoQualities: JSON.stringify(['720p']),
        })
        .where(eq(links.id, linkId));

      createStubHlsFiles(linkId, ['720p']);

      const verifyRes = await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(verifyRes.status).toBe(200);

      const res = await apiRequest(`/v1/links/${linkId}/analytics`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.total_views).toBe(1);
      expect(data.link_id).toBe(linkId);
    });
  });

  // -------------------------------------------------------
  // Video Upload with Link Options
  // -------------------------------------------------------
  describe('Video Upload with Link Options', () => {
    it('video link respects require_email option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'gated.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        requireEmail: true,
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.require_email).toBe(true);
    });

    it('video link respects password option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'secret.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        password: 'SecurePass123',
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.has_password).toBe(true);
    });

    it('video link respects max_views option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'limited.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        maxViews: 5,
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.max_views).toBe(5);
    });

    it('video link respects watermark option', async () => {
      const { res, body } = await createTestLink(apiKey, {
        filename: 'watermarked.mp4',
        buffer: minimalMp4(),
        contentType: 'video/mp4',
        watermark: true,
      });

      expect(res.status).toBe(202);
      expect(body.data.rules.watermark).toBe(true);
    });
  });
});
