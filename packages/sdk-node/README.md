# @cloakshare/sdk — Node.js SDK for CloakShare

Official Node.js SDK for the [CloakShare](https://cloakshare.dev) secure document and video sharing API. Create watermarked, tracked, expiring links with one function call. TypeScript types included. Zero external dependencies.

```typescript
import CloakShare from '@cloakshare/sdk';

const cloakshare = new CloakShare('ck_live_your_api_key');

const link = await cloakshare.links.create({
  file: './pitch-deck.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
});

console.log(link.secure_url);
// → https://view.cloakshare.dev/s/xK9mP2
```

---

## Install

```bash
npm install @cloakshare/sdk
```

Requires Node.js 18+. Zero external dependencies.

---

## Quick Start

```typescript
import CloakShare from '@cloakshare/sdk';

const cloakshare = new CloakShare('ck_live_your_api_key');

// Create a secure link from a file
const link = await cloakshare.links.create({
  file: './pitch-deck.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
  maxViews: 50,
});

console.log(link.secure_url);
// → https://view.cloakshare.dev/s/xK9mP2

// Check who viewed it
const analytics = await cloakshare.links.analytics(link.id);
console.log(analytics.viewers);
// → [{ email: "investor@acme.com", duration: 142, completion_rate: 0.83 }]
```

Get your API key at [cloakshare.dev](https://cloakshare.dev). Keys start with `ck_live_` (production) or `ck_test_` (testing).

---

## Links

### Create a Link

```typescript
// From a file path
const link = await cloakshare.links.create({
  file: './proposal.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
  maxViews: 50,
  password: 'secret123',
  allowedDomains: ['@acme.com'],
});

// From a Buffer
const link = await cloakshare.links.create({
  file: pdfBuffer,
  filename: 'proposal.pdf',
  requireEmail: true,
  watermark: true,
});
```

**CreateLinkParams:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `string \| Buffer \| Uint8Array` | File path, Buffer, or Uint8Array |
| `uploadKey` | `string` | Pre-uploaded file key (from `getUploadUrl`) |
| `filename` | `string` | Explicit filename (required when `file` is a Buffer) |
| `name` | `string` | Display name for the link |
| `requireEmail` | `boolean` | Require email gate |
| `watermark` | `boolean` | Enable dynamic watermark |
| `watermarkTemplate` | `string` | Custom watermark template (e.g., `"{{email}} · {{date}}"`) |
| `password` | `string` | Password protection |
| `expiresIn` | `string` | Expiration duration (e.g., `"7d"`, `"24h"`, `"1y"`) |
| `maxViews` | `number` | Maximum view count |
| `allowedDomains` | `string[]` | Restrict viewing to specific email domains |
| `blockDownload` | `boolean` | Prevent downloads |
| `notifyUrl` | `string` | Webhook URL for view notifications |
| `notifyEmail` | `string` | Email address for view notifications |

### Get a Link

```typescript
const link = await cloakshare.links.get('lnk_abc123');
console.log(link.status);      // "active"
console.log(link.view_count);  // 12
console.log(link.secure_url);  // "https://view.cloakshare.dev/s/..."
```

### List Links

```typescript
// Paginated
const { links, pagination } = await cloakshare.links.list({
  status: 'active',
  page: 1,
  limit: 20,
});

// Iterate all links (auto-paginates)
for await (const link of cloakshare.links.listAll()) {
  console.log(link.id, link.status);
}
```

### Get Analytics

```typescript
const analytics = await cloakshare.links.analytics('lnk_abc123');

console.log(analytics.total_views);     // 47
console.log(analytics.unique_viewers);  // 12
console.log(analytics.avg_duration);    // 94.5 (seconds)

for (const viewer of analytics.viewers) {
  console.log(viewer.email, viewer.duration, viewer.completion_rate);
}
```

### Revoke a Link

```typescript
await cloakshare.links.revoke('lnk_abc123');
// Link is now inaccessible. Viewers see a "revoked" message.
```

### Large File Upload (Presigned URL)

```typescript
// Step 1: Get a presigned upload URL
const { upload_url, upload_key } = await cloakshare.links.getUploadUrl({
  filename: 'product-demo.mp4',
  content_type: 'video/mp4',
  file_size: 500_000_000,
});

// Step 2: Upload the file directly to storage
await fetch(upload_url, {
  method: 'PUT',
  body: fileBuffer,
  headers: { 'Content-Type': 'video/mp4' },
});

// Step 3: Create the link using the upload key
const link = await cloakshare.links.create({
  uploadKey: upload_key,
  requireEmail: true,
  watermark: true,
});
```

---

## Webhooks

```typescript
// Create a webhook endpoint
const webhook = await cloakshare.webhooks.create(
  'https://your-app.com/webhook',
  ['link.viewed', 'link.expired'],
);
console.log(webhook.secret); // Save this — only shown once

// List all webhooks
const { webhooks } = await cloakshare.webhooks.list();

// Get webhook details with recent deliveries
const details = await cloakshare.webhooks.get('whk_abc123');
console.log(details.deliveries); // Last 20 delivery attempts

// Delete a webhook
await cloakshare.webhooks.delete('whk_abc123');
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `link.created` | New link created |
| `link.ready` | Rendering/transcoding complete |
| `link.viewed` | Someone viewed the link |
| `link.expired` | Link reached expiry date |
| `link.revoked` | Link was revoked |
| `link.render_failed` | Rendering failed |
| `link.max_views_reached` | View limit reached |
| `link.password_failed` | Incorrect password attempt |

### Verify Webhook Signatures

```typescript
import { CloakShare } from '@cloakshare/sdk';

// Verify HMAC-SHA256 signature (works without client instantiation)
const isValid = CloakShare.webhooks.verify(
  rawBody,        // string or Buffer — the raw request body
  signature,      // from the x-cloakshare-signature header
  webhookSecret,  // from webhook creation response
);

if (!isValid) {
  return res.status(401).send('Invalid signature');
}
```

---

## Viewers (GDPR)

```typescript
// Delete all viewing data for an email address
const result = await cloakshare.viewers.delete('john@example.com');
console.log(result.deleted_views);     // 23
console.log(result.deleted_sessions);  // 5
```

---

## Organization

```typescript
// List org members
const { members } = await cloakshare.org.listMembers();

// Invite a team member
await cloakshare.org.invite('colleague@acme.com', 'member');

// Change member role
await cloakshare.org.changeRole('mem_abc123', 'admin');

// Remove a member
await cloakshare.org.removeMember('mem_abc123');

// Get audit log (Growth plan and above)
const { entries } = await cloakshare.org.auditLog({ limit: 50 });
```

---

## Error Handling

```typescript
import CloakShare, {
  CloakShareError,
  RateLimitError,
  AuthenticationError,
} from '@cloakshare/sdk';

try {
  await cloakshare.links.create({ file: './doc.pdf' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof CloakShareError) {
    console.log(`${error.code}: ${error.message}`);
    console.log(`Docs: ${error.docUrl}`);
  }
}
```

The SDK automatically retries on transient errors (5xx, network timeouts) with exponential backoff. Default: 2 retries, max 30s between attempts.

---

## Configuration

```typescript
const cloakshare = new CloakShare('ck_live_your_api_key', {
  baseUrl: 'https://api.cloakshare.dev',  // Override for self-hosted
  timeout: 30000,                          // Request timeout in ms (default: 30s)
  maxRetries: 2,                           // Retry attempts (default: 2)
});
```

### Self-Hosted

```typescript
const cloakshare = new CloakShare('ck_live_your_api_key', {
  baseUrl: 'https://your-cloak-instance.com',
});
```

---

## TypeScript

Full TypeScript types are included. Every method parameter and return type is fully typed.

```typescript
import CloakShare from '@cloakshare/sdk';
import type {
  CreateLinkParams,
  Link,
  LinkAnalytics,
  CloakShareError,
  RateLimitError,
  AuthenticationError,
} from '@cloakshare/sdk';
```

---

## Links

- [CloakShare Website](https://cloakshare.dev)
- [API Documentation](https://docs.cloakshare.dev)
- [API Reference](https://docs.cloakshare.dev/api)
- [GitHub](https://github.com/cloakshare/cloakshare)
- [npm: @cloakshare/viewer](https://www.npmjs.com/package/@cloakshare/viewer) — Embeddable viewer
- [npm: @cloakshare/react](https://www.npmjs.com/package/@cloakshare/react) — React wrapper

---

## License

MIT
