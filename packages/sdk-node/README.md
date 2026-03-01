# @cloakshare/sdk

Official Node.js SDK for the [CloakShare](https://cloakshare.dev) API — secure document and video sharing with tokenized links, dynamic watermarks, and real-time analytics.

## Installation

```bash
npm install @cloakshare/sdk
```

## Quick Start

```typescript
import CloakShare from '@cloakshare/sdk';

const cloakshare = new CloakShare('ck_live_xxx');

// Create a secure link from a file
const link = await cloakshare.links.create({
  file: './pitch-deck.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
});

console.log(link.secure_url);
// → https://view.cloakshare.dev/s/xK9mP2
```

## Resources

### Links

```typescript
// Create from file path
const link = await cloakshare.links.create({
  file: './document.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
  maxViews: 50,
  password: 'secret',
  allowedDomains: ['@acme.com'],
});

// Create from Buffer
const link = await cloakshare.links.create({
  file: pdfBuffer,
  filename: 'document.pdf',
});

// Get a link
const link = await cloakshare.links.get('lnk_abc123');

// List links
const { links, pagination } = await cloakshare.links.list({ status: 'active' });

// Iterate all links
for await (const link of cloakshare.links.listAll()) {
  console.log(link.id, link.status);
}

// Get analytics
const analytics = await cloakshare.links.analytics('lnk_abc123');

// Revoke a link
await cloakshare.links.revoke('lnk_abc123');

// Large file upload (presigned URL)
const { upload_url, upload_key } = await cloakshare.links.getUploadUrl({
  filename: 'large-video.mp4',
  content_type: 'video/mp4',
  file_size: 500_000_000,
});
// Upload to upload_url, then create link with uploadKey
```

### Webhooks

```typescript
// Create a webhook
const webhook = await cloakshare.webhooks.create(
  'https://your-app.com/webhook',
  ['link.viewed', 'link.expired'],
);

// List webhooks
const { webhooks } = await cloakshare.webhooks.list();

// Delete a webhook
await cloakshare.webhooks.delete('whk_abc123');
```

### Webhook Verification

```typescript
// Verify webhook signatures (works without instantiation)
import { CloakShare } from '@cloakshare/sdk';

const isValid = CloakShare.webhooks.verify(
  rawBody,       // string or Buffer
  signature,     // from x-cloakshare-signature header
  webhookSecret, // from webhook creation
);
```

### Viewers (GDPR)

```typescript
// Delete all data for a viewer email
await cloakshare.viewers.delete('john@example.com');
```

### Organization

```typescript
// List members
const { members } = await cloakshare.org.listMembers();

// Invite a member
await cloakshare.org.invite('new@acme.com', 'member');

// Get audit log
const { entries } = await cloakshare.org.auditLog({ limit: 50 });
```

## Error Handling

```typescript
import { CloakShareError, RateLimitError, AuthenticationError } from '@cloakshare/sdk';

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

## Self-Hosted

```typescript
const cloakshare = new CloakShare('ck_live_xxx', {
  baseUrl: 'https://your-cloak-instance.com',
});
```

## TypeScript

Full TypeScript types are included. Every method parameter and return type is fully typed.

## Requirements

- Node.js >= 18.0.0
- Zero external dependencies

## License

MIT
