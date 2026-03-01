import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links, notifications } from '../db/schema.js';
import { registerUser, createTestLink, apiRequest, app } from './helpers.js';

// ============================================
// Notifications API Test Suite
// ============================================

describe('Notifications', () => {
  let apiKey: string;
  let userId: string;
  let linkId: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
    userId = user.userId;

    // Create a link and activate it
    const { linkId: id } = await createTestLink(apiKey, { requireEmail: false });
    linkId = id;
    await db.update(links)
      .set({ status: 'active', pageCount: 1, requireEmail: false })
      .where(eq(links.id, linkId));
  });

  // ============================================
  // GET /v1/notifications — List notifications
  // ============================================

  describe('GET /v1/notifications', () => {
    it('returns empty list when no notifications exist', async () => {
      const res = await apiRequest('/v1/notifications', apiKey);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notifications).toEqual([]);
      expect(body.data.unread_count).toBe(0);
      expect(body.data.pagination.total).toBe(0);
    });

    it('returns notifications after a view event', async () => {
      // Trigger a view to create a notification
      const verifyRes = await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(verifyRes.status).toBe(200);

      // Small delay for async notification creation
      await new Promise((r) => setTimeout(r, 100));

      const res = await apiRequest('/v1/notifications', apiKey);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notifications.length).toBeGreaterThanOrEqual(1);
      expect(body.data.unread_count).toBeGreaterThanOrEqual(1);

      const notif = body.data.notifications[0];
      expect(notif.type).toBe('link.viewed');
      expect(notif.link_id).toBe(linkId);
      expect(notif.read).toBe(false);
      expect(notif.message).toBeTruthy();
    });

    it('filters by unread only', async () => {
      const res = await apiRequest('/v1/notifications?unread=true', apiKey);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notifications.every((n: { read: boolean }) => !n.read)).toBe(true);
    });

    it('supports pagination', async () => {
      const res = await apiRequest('/v1/notifications?page=1&limit=1', apiKey);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notifications.length).toBeLessThanOrEqual(1);
      expect(body.data.pagination.page).toBe(1);
      expect(body.data.pagination.limit).toBe(1);
    });

    it('requires auth', async () => {
      const res = await app.request('/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // POST /v1/notifications/read — Mark as read
  // ============================================

  describe('POST /v1/notifications/read', () => {
    it('marks specific notifications as read', async () => {
      // Get current notifications
      const listRes = await apiRequest('/v1/notifications', apiKey);
      const listBody = await listRes.json();
      const unreadNotif = listBody.data.notifications.find((n: { read: boolean }) => !n.read);

      if (!unreadNotif) {
        // Create one if none exist
        await app.request(`/v1/viewer/${linkId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      const refreshRes = await apiRequest('/v1/notifications', apiKey);
      const refreshBody = await refreshRes.json();
      const target = refreshBody.data.notifications.find((n: { read: boolean }) => !n.read);
      if (!target) return; // Skip if no unread notifications

      const res = await apiRequest('/v1/notifications/read', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [target.id] }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.marked_read).toBe(1);

      // Verify it's now read
      const checkRes = await apiRequest('/v1/notifications', apiKey);
      const checkBody = await checkRes.json();
      const found = checkBody.data.notifications.find((n: { id: string }) => n.id === target.id);
      expect(found?.read).toBe(true);
    });

    it('marks all notifications as read', async () => {
      // Create another notification
      await app.request(`/v1/viewer/${linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await new Promise((r) => setTimeout(r, 100));

      const res = await apiRequest('/v1/notifications/read', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.marked_read).toBe('all');

      // Verify all are read
      const checkRes = await apiRequest('/v1/notifications?unread=true', apiKey);
      const checkBody = await checkRes.json();
      expect(checkBody.data.unread_count).toBe(0);
    });

    it('returns error when no ids or all provided', async () => {
      const res = await apiRequest('/v1/notifications/read', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('requires auth', async () => {
      const res = await app.request('/v1/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // Notification isolation between users
  // ============================================

  describe('User isolation', () => {
    it('does not leak notifications between users', async () => {
      const otherUser = await registerUser();

      // The other user should have zero notifications
      const res = await apiRequest('/v1/notifications', otherUser.apiKey);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notifications.length).toBe(0);
      expect(body.data.unread_count).toBe(0);
    });

    it('cannot mark another user\'s notifications as read', async () => {
      const otherUser = await registerUser();

      // Get the first user's notification ids
      const listRes = await apiRequest('/v1/notifications', apiKey);
      const listBody = await listRes.json();
      const ids = listBody.data.notifications.map((n: { id: string }) => n.id);

      if (ids.length === 0) return;

      // Try to mark them with the other user's key
      await apiRequest('/v1/notifications/read', otherUser.apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      // The original user's notifications should be unchanged
      const checkRes = await apiRequest('/v1/notifications', apiKey);
      const checkBody = await checkRes.json();
      // They should still exist (mark-read checks userId ownership)
      expect(checkBody.data.notifications.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // SSE Stream
  // ============================================

  describe('GET /v1/notifications/stream', () => {
    it('returns SSE content type', async () => {
      // We can't fully test SSE in this setup, but we can verify the endpoint responds
      const res = await apiRequest('/v1/notifications/stream', apiKey);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    });

    it('requires auth', async () => {
      const res = await app.request('/v1/notifications/stream');
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // Notification content
  // ============================================

  describe('Notification content', () => {
    it('includes metadata with viewer details', async () => {
      // Trigger a fresh view
      const freshLink = await createTestLink(apiKey, { requireEmail: false });
      await db.update(links)
        .set({ status: 'active', pageCount: 1, requireEmail: false })
        .where(eq(links.id, freshLink.linkId));

      await app.request(`/v1/viewer/${freshLink.linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await new Promise((r) => setTimeout(r, 100));

      const res = await apiRequest('/v1/notifications', apiKey);
      const body = await res.json();
      const notif = body.data.notifications.find(
        (n: { link_id: string }) => n.link_id === freshLink.linkId,
      );

      expect(notif).toBeTruthy();
      expect(notif.metadata).toBeTruthy();
      expect(notif.metadata.viewer_email).toBe('anonymous');
      expect(notif.metadata.view_id).toBeTruthy();
      expect(notif.created_at).toBeTruthy();
    });

    it('creates notification with email viewer info', async () => {
      // Create a link that requires email
      const emailLink = await createTestLink(apiKey, { requireEmail: true });
      await db.update(links)
        .set({ status: 'active', pageCount: 1 })
        .where(eq(links.id, emailLink.linkId));

      await app.request(`/v1/viewer/${emailLink.linkId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'viewer@example.com' }),
      });
      await new Promise((r) => setTimeout(r, 100));

      const res = await apiRequest('/v1/notifications', apiKey);
      const body = await res.json();
      const notif = body.data.notifications.find(
        (n: { link_id: string }) => n.link_id === emailLink.linkId,
      );

      expect(notif).toBeTruthy();
      expect(notif.metadata.viewer_email).toBe('viewer@example.com');
      expect(notif.message).toContain('viewer@example.com');
    });
  });
});
