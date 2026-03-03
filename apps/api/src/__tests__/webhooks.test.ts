import { describe, it, expect, beforeAll } from 'vitest';
import { registerUser, apiRequest, upgradeUserPlan } from './helpers.js';

describe('Webhooks API', () => {
  let apiKey: string;

  beforeAll(async () => {
    const user = await registerUser();
    apiKey = user.apiKey;
    // Webhooks require Starter plan or above
    await upgradeUserPlan(user.userId, 'starter');
  });

  // -------------------------------------------------------
  // Create Webhook
  // -------------------------------------------------------
  describe('POST /v1/webhooks', () => {
    it('creates a webhook and returns 201 with secret', async () => {
      const res = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['link.viewed'],
        }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.id).toBeDefined();
      expect(data.url).toBe('https://example.com/webhook');
      expect(data.secret).toBeDefined();
      expect(data.active).toBe(true);
    });

    it('supports wildcard events', async () => {
      const res = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/all-events',
          events: ['*'],
        }),
      });

      expect(res.status).toBe(201);
    });

    it('rejects invalid URL', async () => {
      const res = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'not-a-url',
          events: ['link.viewed'],
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects missing events', async () => {
      const res = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------
  // List Webhooks
  // -------------------------------------------------------
  describe('GET /v1/webhooks', () => {
    it('returns webhooks array (without secrets)', async () => {
      const res = await apiRequest('/v1/webhooks', apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.webhooks).toBeDefined();
      expect(Array.isArray(data.webhooks)).toBe(true);

      for (const wh of data.webhooks) {
        expect(wh.secret).toBeUndefined();
        expect(wh.url).toBeDefined();
      }
    });
  });

  // -------------------------------------------------------
  // Get Webhook Details
  // -------------------------------------------------------
  describe('GET /v1/webhooks/:id', () => {
    let webhookId: string;

    beforeAll(async () => {
      const res = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/detail-test',
          events: ['link.created'],
        }),
      });
      const { data } = await res.json();
      webhookId = data.id;
    });

    it('returns webhook details with recent deliveries', async () => {
      const res = await apiRequest(`/v1/webhooks/${webhookId}`, apiKey);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.id).toBe(webhookId);
      expect(data.url).toBe('https://example.com/detail-test');
      expect(data.recent_deliveries).toBeDefined();
      expect(Array.isArray(data.recent_deliveries)).toBe(true);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await apiRequest('/v1/webhooks/fake-id', apiKey);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Delete Webhook
  // -------------------------------------------------------
  describe('DELETE /v1/webhooks/:id', () => {
    it('soft-deletes (deactivates) a webhook', async () => {
      const createRes = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/to-delete',
          events: ['link.revoked'],
        }),
      });
      const { data: created } = await createRes.json();

      const res = await apiRequest(`/v1/webhooks/${created.id}`, apiKey, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.deleted).toBe(true);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await apiRequest('/v1/webhooks/fake-id', apiKey, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------
  // Cross-user isolation
  // -------------------------------------------------------
  describe('Cross-user isolation', () => {
    it('cannot access another user\'s webhook', async () => {
      // Create webhook as user A
      const createRes = await apiRequest('/v1/webhooks', apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/isolated',
          events: ['link.viewed'],
        }),
      });
      const { data: created } = await createRes.json();

      // Try to access as user B
      const otherUser = await registerUser();
      const res = await apiRequest(`/v1/webhooks/${created.id}`, otherUser.apiKey);
      expect(res.status).toBe(404);
    });
  });
});
