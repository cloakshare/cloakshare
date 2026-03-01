import app from '../index.js';

const uid = Date.now();
let userCounter = 0;

/**
 * Generate a unique email address for test isolation.
 */
export function uniqueEmail(prefix = 'test') {
  return `${prefix}-${uid}-${++userCounter}@example.com`;
}

/**
 * Register a new user, returning the API key and email.
 */
export async function registerUser(email?: string, password = 'TestPass1234!') {
  const e = email || uniqueEmail();
  const res = await app.request('/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: e, password }),
  });
  const body = await res.json();
  return {
    email: e,
    password,
    apiKey: body.data.api_key as string,
    userId: body.data.user.id as string,
  };
}

/**
 * Login and return the session cookie string.
 */
export async function loginUser(email: string, password: string) {
  const res = await app.request('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  // Extract just the cookie value: "cloak_session=xxx; Path=/; ..."
  const match = setCookie.match(/cloak_session=([^;]+)/);
  return {
    sessionCookie: match ? `cloak_session=${match[1]}` : '',
    response: await res.json(),
  };
}

/**
 * Make an API-key-authenticated request.
 */
export function apiRequest(path: string, apiKey: string, options: RequestInit = {}) {
  return app.request(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

/**
 * Make a session-authenticated request.
 */
export function sessionRequest(path: string, sessionCookie: string, options: RequestInit = {}) {
  return app.request(path, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: sessionCookie,
    },
  });
}

/**
 * Create a minimal PDF buffer for upload testing.
 * This is the smallest valid PDF that poppler can handle.
 */
export function minimalPdf(): Buffer {
  const content = `%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj

xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n

trailer
<< /Root 1 0 R /Size 4 >>
startxref
206
%%EOF`;
  return Buffer.from(content);
}

/**
 * Create a minimal PNG buffer (1x1 red pixel).
 */
export function minimalPng(): Buffer {
  // Minimal 1x1 red PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64',
  );
}

/**
 * Upload a file via multipart and create a link. Returns the link data.
 */
export async function createTestLink(
  apiKey: string,
  options: {
    filename?: string;
    buffer?: Buffer;
    contentType?: string;
    requireEmail?: boolean;
    password?: string;
    maxViews?: number;
    expiresIn?: string;
    watermark?: boolean;
  } = {},
) {
  const {
    filename = 'test.png',
    buffer = minimalPng(),
    contentType = 'image/png',
    requireEmail = false,
    password,
    maxViews,
    expiresIn,
    watermark,
  } = options;

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: contentType }), filename);
  if (requireEmail) formData.append('require_email', 'true');
  if (password) formData.append('password', password);
  if (maxViews) formData.append('max_views', String(maxViews));
  if (expiresIn) formData.append('expires_in', expiresIn);
  if (watermark !== undefined) formData.append('watermark', String(watermark));

  const res = await app.request('/v1/links', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const body = await res.json();
  return { res, body, linkId: body.data?.id as string };
}

export { app };
