import { describe, it, expect } from 'vitest';
import { registerUser, apiRequest, createTestLink } from './helpers.js';

describe('Plan enforcement (Free tier gates)', () => {
  let freeUser: { apiKey: string; email: string; userId: string };

  // Register a fresh Free user before all tests
  it('setup: register free user', async () => {
    freeUser = await registerUser();
    expect(freeUser.apiKey).toBeTruthy();
  });

  // TEST 1: Free user cannot upload .docx
  it('rejects .docx upload on Free plan', async () => {
    // Create a minimal fake docx (just needs the filename, gate checks extension)
    const fakeDocx = Buffer.from('PK\x03\x04fake docx content');
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fakeDocx], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      'report.docx',
    );

    const res = await apiRequest('/v1/links', freeUser.apiKey, {
      method: 'POST',
      body: formData,
    });

    const body = await res.json();
    console.log('TEST 1 - .docx upload:', res.status, JSON.stringify(body));
    expect(res.status).toBe(403);
    expect(body.error?.message).toContain('Office document');
  });

  // TEST 2: Free user cannot set 30-day expiry (max 7 days)
  it('rejects 30-day expiry on Free plan', async () => {
    const { res, body } = await createTestLink(freeUser.apiKey, {
      filename: 'test.png',
      expiresIn: '30d',
    });

    console.log('TEST 2 - 30d expiry:', res.status, JSON.stringify(body));
    expect(res.status).toBe(403);
    expect(body.error?.message).toContain('expiry');
  });

  // TEST 3: Free user cannot disable watermarks
  it('rejects watermark:false on Free plan', async () => {
    const { res, body } = await createTestLink(freeUser.apiKey, {
      filename: 'test.png',
      watermark: false,
    });

    console.log('TEST 3 - watermark false:', res.status, JSON.stringify(body));
    expect(res.status).toBe(403);
    expect(body.error?.message).toContain('Watermark');
  });

  // TEST 4: Free user cannot create webhooks
  it('rejects webhook creation on Free plan', async () => {
    const res = await apiRequest('/v1/webhooks', freeUser.apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/hook',
        events: ['link.viewed'],
      }),
    });

    const body = await res.json();
    console.log('TEST 4 - webhook creation:', res.status, JSON.stringify(body));
    expect(res.status).toBe(403);
    expect(body.error?.message).toContain('Webhook');
  });
});
