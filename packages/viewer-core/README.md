# @cloakshare/viewer — Secure Document Viewer Web Component

Embeddable secure document viewer for any web app. Watermarks, email gates, password protection, and view tracking. Free for PDF and images — no API key needed. Works in React, Vue, Svelte, Angular, and vanilla HTML.

```html
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>
```

---

## Install

```bash
npm install @cloakshare/viewer
```

Or via CDN:

```html
<script src="https://unpkg.com/@cloakshare/viewer"></script>
```

---

## Quick Start

### HTML (ES Module)

```html
<script type="module">
  import '@cloakshare/viewer';
</script>

<cloak-viewer
  src="/deck.pdf"
  watermark="{{email}} · {{date}}"
  email-gate
></cloak-viewer>
```

### HTML (CDN)

```html
<script src="https://unpkg.com/@cloakshare/viewer"></script>

<cloak-viewer
  src="/pitch-deck.pdf"
  watermark="Confidential · {{email}}"
  email-gate
></cloak-viewer>
```

### React

Use the `@cloakshare/react` wrapper for React projects:

```bash
npm install @cloakshare/react
```

```jsx
import { CloakViewer } from '@cloakshare/react';

function App() {
  return (
    <CloakViewer
      src="/deck.pdf"
      watermark="{{email}} · {{date}}"
      emailGate
      onView={(e) => console.log('Page viewed:', e.page)}
    />
  );
}
```

### Vue / Svelte / Angular

Web Components work natively — no wrapper needed:

```vue
<script setup>
import '@cloakshare/viewer';
</script>

<template>
  <cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate />
</template>
```

---

## Free vs API-Connected Mode

| | Free (no API key) | With API Key |
|-|-------------------|-------------|
| **Formats** | PDF, PNG, JPG, WebP, GIF, BMP, SVG | + DOCX, PPTX, XLSX, MP4, MOV, WebM |
| **Processing** | Client-side canvas rendering | Server-side Poppler/Sharp/FFmpeg |
| **Watermarks** | Canvas overlay (client-side) | Server-burned into rendered images |
| **Email gate** | localStorage check | Server-verified |
| **Password** | Client-side check | Server-verified |
| **Analytics** | Client events only | Full server-side tracking |
| **Cost** | Free forever | Free tier: 50 links/mo, 500 views/mo |

```html
<!-- Free — runs entirely client-side, no API key -->
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>

<!-- API-connected — server-side security, Office docs, video, analytics -->
<cloak-viewer src="/proposal.docx" api-key="ck_live_..." watermark="{{email}}"></cloak-viewer>
```

---

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | `string` | required | URL or path to the document or image |
| `watermark` | `string` | `""` | Watermark text. Supports `{{email}}`, `{{date}}`, `{{session_id}}` template variables |
| `email-gate` | `boolean` | `false` | Require viewer to enter email before viewing |
| `password` | `string` | `""` | Require password to view |
| `email` | `string` | `""` | Pre-fill viewer email (skips email gate if set) |
| `theme` | `"dark"` | `"dark"` | Viewer theme |
| `allow-download` | `boolean` | `false` | Show download button |
| `expires` | `string` | `""` | ISO 8601 expiry timestamp (e.g., `2026-04-01T00:00:00Z`) |
| `api-key` | `string` | `""` | CloakShare API key. Enables Office docs, video, and server-side analytics |
| `api-url` | `string` | `"https://api.cloakshare.dev"` | API endpoint. Override for self-hosted instances |
| `renderer` | `"auto" \| "external"` | `"auto"` | Set to `"external"` to skip bundled PDF.js (use if your app already loads PDF.js) |
| `branding` | `boolean` | `true` | Show "Secured by CloakShare" badge |
| `width` | `string` | `"100%"` | Component width |
| `height` | `string` | `"600px"` | Component height |

---

## Events

```javascript
const viewer = document.querySelector('cloak-viewer');

viewer.addEventListener('cloak:view', (e) => {
  console.log(e.detail);
  // {
  //   page: 3,
  //   email: "viewer@company.com",
  //   timestamp: "2026-03-02T14:30:00Z",
  //   sessionId: "s_abc123",
  //   duration: 12.5,
  //   scrollDepth: 85,
  //   referrer: "https://app.company.com",
  //   device: "desktop"
  // }
});

viewer.addEventListener('cloak:ready', (e) => {
  console.log(e.detail);
  // { pageCount: 12, format: "pdf" }
});

viewer.addEventListener('cloak:error', (e) => {
  console.log(e.detail);
  // { code: "EXPIRED", message: "This document has expired", details: "..." }
});

viewer.addEventListener('cloak:email-submitted', (e) => {
  console.log(e.detail);
  // { email: "viewer@company.com" }
});
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `LOAD_FAILED` | Document failed to fetch (network error, 404, CORS) |
| `PARSE_FAILED` | Document is corrupted or unsupported format |
| `EXPIRED` | Document past expiry date |
| `PASSWORD_REQUIRED` | Password needed but not provided |
| `PASSWORD_INCORRECT` | Wrong password entered |
| `EMAIL_REQUIRED` | Email gate active, no email submitted |
| `API_ERROR` | CloakShare API returned an error |
| `API_UNAUTHORIZED` | Invalid or missing API key |
| `UNSUPPORTED_FORMAT` | File type not supported in current mode (e.g., .docx without API key) |
| `RENDER_ERROR` | Canvas rendering failed (WebGL context lost, memory exceeded) |

---

## Supported Formats

### Free (no API key)

- **PDF** — Lazy-loads PDF.js (~400KB gzipped) on first use only
- **Images** — PNG, JPG, WebP, GIF, BMP, SVG (native Canvas API, 0KB added)

### With API Key

- **Office** — DOCX, PPTX, XLSX (server-side rendering via LibreOffice + Poppler)
- **Video** — MP4, MOV, WebM (HLS adaptive streaming via FFmpeg)

---

## Bundle Size

| Component | Size (gzipped) | When loaded |
|-----------|---------------|-------------|
| Shell (Web Component + watermark + gates + toolbar) | ~7 KB | Always (page init) |
| PDF.js renderer | ~400 KB | Only when `src` is a `.pdf` file |
| Image renderer | 0 KB | Uses native Canvas API |
| API-connected mode | 0 KB | Fetches pre-rendered images from server |

If your app already includes PDF.js, use `renderer="external"` to skip the bundled copy:

```html
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs"></script>
<cloak-viewer src="/deck.pdf" renderer="external"></cloak-viewer>
```

---

## Security Model

### Client-Only Mode (no API key)

Client-only mode provides deterrent-level security — the same level as DocSend and Papermark:

- **Watermarks** — Canvas overlay, redrawn per frame. Visual deterrent, removable by determined attacker.
- **Email gate** — `localStorage` check. Bypassable via DevTools.
- **Password** — Client-side hash comparison. PDF bytes still in memory.
- **Print protection** — CSS `@media print { display: none }`.
- **Right-click** — `contextmenu` event prevention.
- **Expiry** — Server time fetch to prevent trivial clock-change bypass. Falls back to system clock if offline.

### API-Connected Mode (with API key)

API-connected mode provides real enforcement:

- **Watermarks** — Server-burned into rendered images. Cannot be removed without image editing.
- **Email gate** — Server-side verification. No page data served until verified.
- **Password** — Server-side verification.
- **Expiry** — Server-side token invalidation. API returns 410.
- **View limits** — Server-side counter.
- **Analytics** — Server-side tracking. Cannot be spoofed without the API key.

---

## CSP (Content Security Policy)

If your app has strict CSP headers, add these directives:

```
script-src: 'self' (if bundled) or https://unpkg.com/@cloakshare/viewer (if CDN)
connect-src: https://api.cloakshare.dev (if using API-connected mode)
img-src: blob: (for canvas-rendered pages)
style-src: 'unsafe-inline' (Shadow DOM styles)
worker-src: blob: (PDF.js uses web workers for parsing)
```

---

## Offline Support

| Scenario | Behavior |
|----------|----------|
| Client-only + local/cached PDF | Works fully offline |
| Client-only + remote PDF | `LOAD_FAILED` error (expected) |
| API-connected mode | `API_ERROR` error (expected) |
| Component bundle | Cached by your app's service worker |

Client-only mode with local documents works fully offline — something DocSend and Papermark cannot offer.

---

## Accessibility

- Keyboard navigation: Arrow keys for page nav, Tab for toolbar controls, Escape to close modals
- ARIA labels on all toolbar buttons and controls
- Screen reader announcements for page changes ("Page 3 of 12")
- Focus management: focus trapped in email gate and password modals
- `prefers-reduced-motion` support for animations
- WCAG 2.1 AA color contrast on all text

---

## Self-Hosted

Point the viewer at your own CloakShare instance:

```html
<cloak-viewer
  src="/deck.pdf"
  api-key="ck_live_..."
  api-url="https://your-cloak-instance.com"
></cloak-viewer>
```

---

## Links

- [CloakShare Website](https://cloakshare.dev)
- [Documentation](https://docs.cloakshare.dev)
- [GitHub](https://github.com/cloakshare/cloakshare)
- [npm: @cloakshare/react](https://www.npmjs.com/package/@cloakshare/react) — React wrapper
- [npm: @cloakshare/sdk](https://www.npmjs.com/package/@cloakshare/sdk) — Node.js SDK

---

## License

MIT
