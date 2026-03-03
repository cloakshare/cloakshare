# CloakShare — Secure Document & Video Sharing API

Open-source API and embeddable viewer for sharing documents and videos with watermarks, email gates, expiry, and per-page analytics.

[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![GitHub Stars](https://img.shields.io/github/stars/cloakshare/cloakshare?style=flat&color=orange)](https://github.com/cloakshare/cloakshare/stargazers) [![Tests](https://img.shields.io/github/actions/workflow/status/cloakshare/cloakshare/ci.yml?label=tests)](https://github.com/cloakshare/cloakshare/actions) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## What CloakShare Does

**Secure document sharing** — Turn any PDF, DOCX, PPTX, or image into a tracked, watermarked link. Know who viewed it, which pages they read, and how long they spent.

**Secure video sharing** — Share MP4, MOV, and WebM videos with dynamic watermarks, email gates, and engagement analytics. HLS adaptive streaming for large files.

**Embeddable document viewer** — Drop a secure viewer into any web app with one line of code. Watermarks, email gates, and password protection built in. No iframe, no external redirect. Works in React, Vue, Svelte, Angular, and vanilla HTML.

**Document analytics API** — Per-page view tracking, time-on-page, scroll depth, viewer email, device, location. Webhooks for real-time notifications on 8 event types with HMAC-SHA256 signed payloads.

**Open-source alternative to DocSend** — Self-host with Docker (MIT license) or use the managed cloud API. No per-user pricing. Free tier available.

---

## Quick Start

### API

```bash
# Create a secure link
curl -X POST https://api.cloakshare.dev/v1/links \
  -H "Authorization: Bearer ck_live_your_api_key" \
  -F file=@pitch-deck.pdf \
  -F require_email=true \
  -F watermark=true \
  -F expires_in=7d

# Response:
# {
#   "data": {
#     "id": "lnk_xK9mP2",
#     "secure_url": "https://view.cloakshare.dev/s/xK9mP2",
#     "status": "processing",
#     "file_type": "pdf"
#   }
# }
```

Get your free API key at [cloakshare.dev](https://cloakshare.dev).

### Embeddable Viewer

```bash
npm install @cloakshare/viewer
```

```html
<script src="https://unpkg.com/@cloakshare/viewer"></script>

<!-- Free — PDF & images, no API key needed -->
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>

<!-- With API key — adds Office docs, video, server-side analytics -->
<cloak-viewer src="/proposal.docx" api-key="ck_live_..." watermark="{{email}}"></cloak-viewer>
```

### React

```bash
npm install @cloakshare/react
```

```jsx
import { CloakViewer } from '@cloakshare/react';

function App() {
  return (
    <CloakViewer
      src="/pitch-deck.pdf"
      watermark="Confidential · {{email}}"
      emailGate
      onView={(e) => console.log('Viewed page:', e.page)}
    />
  );
}
```

### Node.js SDK

```bash
npm install @cloakshare/sdk
```

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

### Python

```bash
pip install cloakshare
```

```python
import cloakshare

client = cloakshare.Client("ck_live_your_api_key")

link = client.links.create(
    file="./pitch-deck.pdf",
    require_email=True,
    watermark=True,
    expires_in="7d",
)

print(link.secure_url)
# → https://view.cloakshare.dev/s/xK9mP2
```

### Go

```bash
go get github.com/cloakshare/cloakshare-go
```

```go
client := cloakshare.NewClient("ck_live_your_api_key")

link, _ := client.Links.Create(&cloakshare.LinkParams{
    File:         "./pitch-deck.pdf",
    RequireEmail: true,
    Watermark:    true,
    ExpiresIn:    "7d",
})

fmt.Println(link.SecureURL)
// → https://view.cloakshare.dev/s/xK9mP2
```

---

## Features

- **Dynamic watermarks** — Text overlay on every page with template variables: `{{email}}`, `{{date}}`, `{{session_id}}`. Server-side compositing (not removable via DevTools).
- **Email gate** — Require viewer to enter their email before accessing the document. Verified server-side.
- **Password protection** — Lock documents behind a password. Server-side verification. Available on Starter plan and above.
- **Link expiry** — Set documents to expire after a duration (1 hour to 1 year) or on a specific date.
- **View limits** — Limit the number of times a link can be viewed. Webhook fired when limit reached.
- **Per-page analytics** — Track which pages were viewed, time on each page, scroll depth, and total engagement. Available on Starter plan and above.
- **Webhooks** — Real-time HTTP notifications with HMAC-SHA256 signatures. 8 events: `link.created`, `link.viewed`, `link.expired`, `link.revoked`, `link.ready`, `link.render_failed`, `link.max_views_reached`, `link.password_failed`.
- **Print and download blocking** — Canvas-based rendering prevents easy copy/paste, printing, and downloading.
- **Video support** — MP4, MOV, WebM with HLS adaptive streaming, watermark overlay, and engagement heatmaps. Available on Growth plan and above.
- **Office document support** — DOCX, PPTX, XLSX rendered securely via server-side conversion. Available on Starter plan and above.
- **Embeddable viewer** — Web Component (`<cloak-viewer>`) that works in React, Vue, Svelte, Angular, and vanilla HTML. Free for PDF and images, no API key required.
- **Self-hostable** — Run CloakShare on your own infrastructure with Docker. MIT license. SQLite database, any S3-compatible storage.
- **REST API** — Full API for creating links, uploading files, checking analytics, managing webhooks, teams, and custom domains.
- **Node.js SDK** — `@cloakshare/sdk` with TypeScript types, automatic retries, and pagination helpers. Zero external dependencies.

### Supported File Types

```
Documents:  PDF · DOCX · PPTX · XLSX · ODP · ODS · ODT · CSV
Video:      MP4 · MOV · WebM · MKV · AVI
Images:     PNG · JPG · WebP · GIF · BMP · SVG
```

One API, every format. CloakShare detects the file type and handles rendering and conversion automatically.

---

## Use Cases

### Fundraising and Investor Relations
Share pitch decks with investors and track which slides they read. Know if they forwarded your deck. Watermark each viewer's email on every page.

### Sales Proposals and Pricing
Send proposals that expire after 7 days. Get notified the moment a prospect opens your pricing page. See which sections they spent the most time on.

### Training and Education
Distribute course materials that cannot be easily downloaded or reshared. Watermark each student's email. Track completion and engagement per page.

### Legal and Compliance
Share contracts and NDAs with email-verified access. Audit trail of who viewed what, when, and from where. Password protection for sensitive documents.

### Real Estate
Share property documents, inspection reports, and appraisals with buyers. Each viewer sees their own watermarked copy. Links expire after the transaction closes.

### Healthcare
Share patient documents securely with access controls. Email-verified viewing, link expiry, and audit logs for compliance.

---

## CloakShare vs Alternatives

| Feature | CloakShare | DocSend | Papermark | PandaDoc |
|---------|-----------|---------|-----------|----------|
| Open source | MIT | No | AGPL | No |
| Self-hostable | Yes | No | Yes | No |
| API-first | Yes | Limited | Limited | Yes |
| Embeddable viewer | Yes | No | No | No |
| npm package | Yes | No | No | No |
| Dynamic watermarks | Yes | Yes | Yes | No |
| Video support | Yes | Yes | No | No |
| Per-page analytics | Yes | Yes | Yes | Yes |
| Webhooks with HMAC | Yes | Yes | Yes | Yes |
| SDKs | Node.js, Python, Go | None | None | None |
| Teams and RBAC | Yes | Yes | Yes | Yes |
| Free tier | Yes | No | Yes | No |
| Starting price | Free / $29/mo | $45/user/mo | $59/mo | $35/user/mo |

---

## Tech Stack

- **Runtime:** Node.js + [Hono](https://hono.dev) (lightweight web framework)
- **Database:** SQLite via [Turso](https://turso.tech) (cloud) or local SQLite (self-hosted)
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **Storage:** Cloudflare R2 / any S3-compatible (MinIO, AWS S3, Backblaze B2)
- **PDF rendering:** Poppler (`pdftoppm`) + Sharp
- **Office conversion:** LibreOffice headless
- **Video:** FFmpeg HLS transcoding (adaptive bitrate: 720p + 1080p)
- **Viewer:** Custom canvas-based renderer with Shadow DOM Web Component
- **Dashboard:** React + Tailwind CSS
- **Marketing site:** [Astro](https://astro.build)
- **Monorepo:** pnpm workspaces + [Turborepo](https://turbo.build)

---

## Self-Hosting

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
cp .env.example .env
# Edit .env: set SESSION_SECRET, JWT_SECRET, CLOAK_SIGNING_SECRET
docker compose up -d
```

Open `http://localhost:3000` — that's it. CloakShare runs on a single server with 1GB RAM.

The self-hosted version includes PDF rendering, office document conversion, video transcoding, email gates, watermarks, webhooks, analytics, teams, and the full secure viewer.

**Works with:** MinIO, AWS S3, Backblaze B2, Cloudflare R2, or any S3-compatible storage provider.

Full configuration guide: [Self-Hosting Guide](https://docs.cloakshare.dev/self-hosting)

---

## API Reference

```
POST   /v1/links                    Create a secure link (multipart file upload)
POST   /v1/links/upload-url         Get presigned upload URL (large files)
POST   /v1/links/bulk               Create multiple links at once
GET    /v1/links                    List your links (paginated)
GET    /v1/links/:id                Get link details
GET    /v1/links/:id/analytics      Get per-page view analytics
GET    /v1/links/:id/progress       SSE stream for rendering progress
DELETE /v1/links/:id                Revoke a link

POST   /v1/webhooks                 Create a webhook endpoint
GET    /v1/webhooks                 List webhooks
GET    /v1/webhooks/:id             Get webhook details + delivery history
DELETE /v1/webhooks/:id             Delete a webhook

GET    /v1/viewer/:token            Get viewer metadata (email gate, password)
POST   /v1/viewer/:token/verify     Verify email/password to access document
GET    /v1/viewer/:token/page/:num  Get rendered page image (with watermark)
POST   /v1/viewer/:token/track      Track viewing engagement

GET    /v1/notifications/stream     SSE real-time view notifications
DELETE /v1/viewers/:email           GDPR data deletion
```

Full API documentation: [docs.cloakshare.dev](https://docs.cloakshare.dev)

---

## Pricing

| Plan | Price | Links/mo | Views/mo |
|------|-------|----------|----------|
| Free | $0 | 50 | 500 |
| Starter | $29/mo | 500 | 10,000 |
| Growth | $99/mo | 2,500 | 25,000 |
| Scale | $299/mo | 10,000 | 100,000 |

The `@cloakshare/viewer` npm package is free forever for PDF and image viewing. No API key required.

Annual billing: 20% off. [See full pricing](https://cloakshare.dev/pricing)

---

## Project Structure

```
cloakshare/
├── apps/
│   ├── api/          # Hono API server
│   ├── site/         # Astro marketing site
│   ├── web/          # React dashboard
│   └── viewer/       # Secure document/video viewer
├── packages/
│   ├── shared/       # Shared types, constants, config
│   ├── sdk-node/     # @cloakshare/sdk (Node.js SDK)
│   ├── sdk-python/   # Python SDK
│   ├── sdk-go/       # Go SDK
│   ├── viewer-core/  # @cloakshare/viewer (Web Component)
│   └── react/        # @cloakshare/react (React wrapper)
├── docker-compose.yml
├── .env.example
└── turbo.json
```

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev
```

Good first issues are labeled [`good first issue`](https://github.com/cloakshare/cloakshare/labels/good%20first%20issue).

---

## Links

- [Website](https://cloakshare.dev)
- [Documentation](https://docs.cloakshare.dev)
- [API Reference](https://docs.cloakshare.dev/api)
- [npm: @cloakshare/viewer](https://www.npmjs.com/package/@cloakshare/viewer)
- [npm: @cloakshare/react](https://www.npmjs.com/package/@cloakshare/react)
- [npm: @cloakshare/sdk](https://www.npmjs.com/package/@cloakshare/sdk)
- [Discord](https://discord.gg/cloakshare)
- [Twitter](https://twitter.com/cloakshare)

---

## License

MIT — use CloakShare however you want. Free forever for self-hosting.
