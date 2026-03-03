# @cloakshare/react — Secure Document Viewer for React

React wrapper for [`@cloakshare/viewer`](https://www.npmjs.com/package/@cloakshare/viewer) — drop a secure document viewer into your React app with watermarks, email gates, and view tracking. Free for PDF and images.

```jsx
import { CloakViewer } from '@cloakshare/react';

<CloakViewer src="/deck.pdf" watermark="Confidential" emailGate />
```

---

## Install

```bash
npm install @cloakshare/react
```

Requires React 18+ as a peer dependency. Automatically includes `@cloakshare/viewer`.

---

## Quick Start

```jsx
import { CloakViewer } from '@cloakshare/react';

function App() {
  return (
    <CloakViewer
      src="/pitch-deck.pdf"
      watermark="{{email}} · {{date}}"
      emailGate
      onView={(e) => console.log('Page viewed:', e.page)}
      onReady={(e) => console.log('Ready:', e.pageCount, 'pages')}
    />
  );
}
```

### Free Mode (PDF and images, no API key)

```jsx
<CloakViewer
  src="/quarterly-report.pdf"
  watermark="Confidential · {{email}}"
  emailGate
  password="secret123"
  expires="2026-04-01T00:00:00Z"
/>
```

### API-Connected Mode (Office docs, video, server-side analytics)

```jsx
<CloakViewer
  src="/proposal.docx"
  apiKey="ck_live_your_api_key"
  watermark="{{email}} · {{date}}"
  emailGate
  onView={(e) => console.log(e.email, 'viewed page', e.page)}
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | required | URL or path to document or image |
| `watermark` | `string` | `""` | Watermark text. Supports `{{email}}`, `{{date}}`, `{{session_id}}` |
| `emailGate` | `boolean` | `false` | Require email before viewing |
| `password` | `string` | `""` | Require password to view |
| `email` | `string` | `""` | Pre-fill viewer email (skips email gate if set) |
| `theme` | `"dark" \| "light"` | `"dark"` | Viewer theme |
| `allowDownload` | `boolean` | `false` | Show download button |
| `expires` | `string` | `""` | ISO 8601 expiry timestamp |
| `apiKey` | `string` | `""` | CloakShare API key (enables Office docs, video, analytics) |
| `apiUrl` | `string` | `"https://api.cloakshare.dev"` | API endpoint (override for self-hosted) |
| `renderer` | `"auto" \| "external"` | `"auto"` | Set to `"external"` if your app already loads PDF.js |
| `branding` | `boolean` | `true` | Show "Secured by CloakShare" badge |
| `width` | `string` | `"100%"` | Component width |
| `height` | `string` | `"600px"` | Component height |

### Event Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onView` | `(event: CloakViewEvent) => void` | Fired on each page view. Includes `page`, `email`, `duration`, `scrollDepth`, `device` |
| `onReady` | `(event: CloakReadyEvent) => void` | Fired when viewer is ready. Includes `pageCount`, `format` |
| `onError` | `(event: CloakErrorEvent) => void` | Fired on error. Includes `code`, `message`, `details` |
| `onEmailSubmitted` | `(event: { email: string }) => void` | Fired when viewer submits their email |

### Standard HTML Props

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | CSS class name |
| `style` | `CSSProperties` | Inline styles |
| `id` | `string` | Element ID |

---

## Ref Access

Access the underlying `<cloak-viewer>` DOM element via ref:

```jsx
import { useRef } from 'react';
import { CloakViewer } from '@cloakshare/react';
import type { CloakViewerRef } from '@cloakshare/react';

function App() {
  const viewerRef = useRef<CloakViewerRef>(null);

  const handleClick = () => {
    // Access the underlying <cloak-viewer> DOM element
    console.log(viewerRef.current?.element);
  };

  return (
    <>
      <CloakViewer ref={viewerRef} src="/deck.pdf" />
      <button onClick={handleClick}>Get element</button>
    </>
  );
}
```

---

## TypeScript

All props, events, and ref types are fully typed. Types are re-exported from `@cloakshare/viewer`:

```typescript
import type {
  CloakViewerProps,
  CloakViewerRef,
  CloakViewEvent,
  CloakReadyEvent,
  CloakErrorEvent,
  CloakErrorCode,
} from '@cloakshare/react';
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `LOAD_FAILED` | Document failed to fetch (network error, 404, CORS) |
| `PARSE_FAILED` | Document is corrupted or unsupported |
| `EXPIRED` | Document past expiry date |
| `PASSWORD_REQUIRED` | Password needed but not provided |
| `PASSWORD_INCORRECT` | Wrong password entered |
| `EMAIL_REQUIRED` | Email gate active, no email submitted |
| `API_ERROR` | CloakShare API returned an error |
| `API_UNAUTHORIZED` | Invalid or missing API key |
| `UNSUPPORTED_FORMAT` | File type not supported (e.g., .docx without API key) |
| `RENDER_ERROR` | Canvas rendering failed |

---

## How It Works

`@cloakshare/react` is a thin wrapper around the `<cloak-viewer>` Web Component. It:

1. Maps camelCase React props to kebab-case HTML attributes (`emailGate` → `email-gate`, `apiKey` → `api-key`)
2. Converts React event callbacks to Web Component event listeners (`onView` → `cloak:view`)
3. Forwards refs to the underlying DOM element
4. Handles boolean attributes correctly (present/absent, not `"true"`/`"false"`)

The actual rendering, watermarking, email gate UI, and security logic all live in `@cloakshare/viewer`.

---

## Self-Hosted

Point the viewer at your own CloakShare instance:

```jsx
<CloakViewer
  src="/deck.pdf"
  apiKey="ck_live_..."
  apiUrl="https://your-cloak-instance.com"
/>
```

---

## Links

- [CloakShare Website](https://cloakshare.dev)
- [Documentation](https://docs.cloakshare.dev)
- [npm: @cloakshare/viewer](https://www.npmjs.com/package/@cloakshare/viewer) — Web Component (vanilla HTML)
- [npm: @cloakshare/sdk](https://www.npmjs.com/package/@cloakshare/sdk) — Node.js SDK
- [GitHub](https://github.com/cloakshare/cloakshare)

---

## License

MIT
