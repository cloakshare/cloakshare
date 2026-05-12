# CloakShare Marketing Content

> Personal reference file. Do not commit to GitHub.

---

## 1. Dev.to / Hashnode Tutorial

### Title: Add Secure Document Sharing to Your App in 10 Minutes

### Tags: `typescript`, `api`, `opensource`, `webdev`

### Cover Image Alt: CloakShare — secure document sharing API

---

You're building an app that needs to share sensitive documents — investor decks, contracts, training materials, medical records. You reach for email attachments or Google Drive links. Then you realize: you have zero control after the file leaves your server.

No view tracking. No watermarks. No expiry. No way to revoke access.

I built CloakShare to fix this. It's an open-source API (MIT licensed) that turns any document into a tracked, watermarked, expiring secure link. Here's how to add it to your app in 10 minutes.

### What we're building

A simple integration that:
1. Uploads a PDF to CloakShare
2. Gets back a secure viewer link
3. Tracks who views it and which pages they read
4. Watermarks every page with the viewer's email

### Prerequisites

- Node.js 18+
- A CloakShare API key (free at [cloakshare.dev](https://cloakshare.dev)) — or self-host with Docker

### Step 1: Install the SDK

```bash
npm install @cloakshare/sdk
```

### Step 2: Upload a document and create a secure link

```typescript
import CloakShare from '@cloakshare/sdk';

const cloak = new CloakShare({ apiKey: 'ck_live_xxx' });

const link = await cloak.links.create({
  file: './proposal.pdf',
  name: 'Q1 Sales Proposal',
  watermark: true,
  watermark_text: '{{email}} - {{date}}',
  require_email: true,
  expires_in: '30d',
});

console.log(link.secure_url);
// https://view.cloakshare.dev/s/lnk_aBcDeF9
```

That's it. One API call. You now have a secure link that:
- Requires email verification before viewing
- Watermarks every page with the viewer's email and date
- Expires in 30 days
- Tracks every page view

### Step 3: Send the link

Send `link.secure_url` however you want — email, Slack, in-app notification. When someone opens it, they'll see the email gate, enter their email, and view the document in a secure canvas-based viewer.

### Step 4: Check analytics

```typescript
const analytics = await cloak.links.getAnalytics(link.id);

console.log(analytics);
// {
//   total_views: 12,
//   unique_viewers: 4,
//   avg_completion_rate: 0.82,
//   viewers: [
//     { email: "alice@acme.com", views: 3, completion_rate: 0.95 },
//     { email: "bob@acme.com", views: 1, completion_rate: 0.35 }
//   ]
// }
```

Alice read 95% of the document across 3 sessions. Bob skimmed 35% once. You now know exactly who's engaged and who isn't.

### Step 5: Listen for events with webhooks

```typescript
const webhook = await cloak.webhooks.create({
  url: 'https://your-app.com/api/webhooks/cloak',
  events: ['link.viewed', 'link.completed'],
  secret: 'whsec_your_secret',
});
```

CloakShare sends webhook events with HMAC-SHA256 signatures. You get notified the moment someone opens your document.

### Step 6: Verify webhook signatures

```typescript
import { verifyWebhookSignature } from '@cloakshare/sdk';

app.post('/api/webhooks/cloak', (req, res) => {
  const isValid = verifyWebhookSignature(
    req.body,
    req.headers['x-cloak-signature'],
    'whsec_your_secret'
  );

  if (!isValid) return res.status(401).send('Invalid signature');

  const event = req.body;
  if (event.type === 'link.viewed') {
    // Someone just opened your document
    console.log(`${event.data.viewer_email} viewed ${event.data.link_name}`);
  }
});
```

### The embeddable viewer (bonus)

If you want to embed the viewer directly in your app instead of using hosted links:

```bash
npm install @cloakshare/viewer
```

```html
<cloak-viewer
  src="/deck.pdf"
  watermark="Confidential - {{email}}"
  email-gate
  theme="dark"
></cloak-viewer>
```

This is a Web Component — works in React, Vue, Svelte, Angular, or plain HTML. Free for PDF and images, no API key needed. Office docs and video require the API.

### Self-hosting

Don't want to use the cloud? CloakShare is fully self-hostable:

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
docker compose up -d
```

SQLite database, local file storage, 1GB RAM. Runs on any VPS. Plug in S3-compatible storage when you're ready to scale.

### What you get

| Feature | How it works |
|---------|-------------|
| Watermarks | Dynamic text burned onto every page (viewer email, date, session ID) |
| Email gate | Viewer must verify email before accessing document |
| Password protection | Optional password on any link |
| Link expiry | Time-based or view-count-based expiry |
| Per-page analytics | Which pages were read, time spent on each, scroll depth |
| Webhooks | 8 event types with HMAC-SHA256 signatures |
| Video support | MP4/MOV/WEBM with HLS streaming and watermark overlays |
| Office docs | DOCX, PPTX, XLSX converted and rendered securely |

### Comparison

| | CloakShare | DocSend | Google Drive |
|-|-----------|---------|-------------|
| Per-page analytics | Yes | Yes | No |
| Watermarks | Yes | Yes | No |
| Self-hostable | Yes | No | No |
| API-first | Yes | No | Limited |
| Open source | MIT | No | No |
| Starting price | Free | $45/user/mo | Free (no features) |

### Links

- GitHub: [github.com/cloakshare/cloakshare](https://github.com/cloakshare/cloakshare)
- Docs: [cloakshare.dev/docs](https://cloakshare.dev/docs)
- npm: [@cloakshare/sdk](https://www.npmjs.com/package/@cloakshare/sdk)

Star the repo if this is useful. Issues and PRs welcome — we label beginner-friendly ones with `good first issue`.

---

## 2. Reddit / HN Posts

### 2a. r/selfhosted — Self-Hosting Walkthrough

**Title:** I built an open-source DocSend alternative you can self-host with Docker

**Body:**

I've been building CloakShare — an open-source (MIT licensed) secure document sharing API. Think DocSend but self-hostable, API-first, and free.

**What it does:**
- Upload a PDF, get a secure viewer link
- Watermarks every page with the viewer's email
- Tracks which pages were viewed and for how long
- Email gate, password protection, link expiry
- Video support with HLS streaming
- Office doc conversion (DOCX, PPTX, XLSX)

**Self-hosting setup (under 5 minutes):**

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
cp .env.example .env
docker compose up -d
```

That's it. Runs on `localhost:3000`.

**What's inside the Docker stack:**
- Node.js API server (Hono framework)
- SQLite database (zero config)
- Poppler for PDF rendering
- FFmpeg for video transcoding
- Sharp for image optimization
- Local file storage by default

**Resource requirements:**
- 1GB RAM minimum
- ~2GB disk for the Docker image
- Any VPS works (Hetzner, DigitalOcean, etc.)

**Storage options:**
Local disk is the default. When you're ready, plug in any S3-compatible storage:
- AWS S3
- Cloudflare R2
- Backblaze B2
- MinIO (self-hosted)

Just set the environment variables and restart.

**Why I built this:**

DocSend charges $45/user/month. Papermark is open source but AGPL (viral license — if you modify it, you must open-source your changes). I wanted something MIT-licensed that developers could embed into their own products without legal friction.

**Tech stack:** TypeScript, Hono, Drizzle ORM, SQLite/Turso, Poppler, Sharp, FFmpeg

**Links:**
- GitHub: https://github.com/cloakshare/cloakshare
- Live demo: https://demo.cloakshare.dev
- Docs: https://cloakshare.dev/docs

Happy to answer questions about the architecture or help with setup.

---

### 2b. r/opensource

**Title:** CloakShare — MIT-licensed DocSend alternative with per-page analytics, watermarks, and self-hosting

**Body:**

I open-sourced CloakShare, a secure document sharing API. Upload a file, get a tracked, watermarked, expiring viewer link.

**Why MIT instead of AGPL:**

The closest open-source alternative (Papermark) uses AGPL. That means if you modify their code and deploy it — even internally — you're legally required to open-source your changes. For a startup embedding document sharing into their product, that's a non-starter. Legal teams see AGPL and kill the integration.

MIT has no such restriction. Fork CloakShare, modify it, embed it in your proprietary product, deploy it on your servers. No strings attached.

**What makes it different:**
- **API-first** — not a dashboard you click through. One API call to create a secure link.
- **Self-hostable** — `docker compose up` and you're running
- **Embeddable viewer** — npm package (`@cloakshare/viewer`) you can drop into any web app
- **Per-page analytics** — not just "someone opened the link" but which pages they read and for how long
- **Video support** — HLS streaming with watermark overlays

**Business model:** Open core. Self-hosted is free forever with all features. Cloud version adds managed infrastructure, CDN, analytics dashboard, and a free tier to get started.

**Contributing:**

7 open issues labeled `good first issue` if you want to contribute:
- Add light theme to viewer
- Add CONTRIBUTING.md
- Add OpenGraph meta tags
- Add page count to link list API
- Add rate limit headers
- Add CSV export for analytics
- Add keyboard shortcut hints to viewer

GitHub: https://github.com/cloakshare/cloakshare

Feedback welcome. What features would you want from something like this?

---

### 2c. Show HN (Second Launch)

**Title:** Show HN: CloakShare — Embeddable secure document viewer (Web Component, free for PDF)

**Body:**

Last month I launched CloakShare, an open-source DocSend alternative (MIT licensed). Today I'm shipping the embeddable viewer as an npm package.

**One line of code:**
```html
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate />
```

**What it does:**
- Renders PDFs and images in a secure canvas-based viewer
- Watermarks every page (dynamic text — viewer email, date, custom)
- Email gate — require email before viewing
- Password protection
- Print/download protection
- Per-page view tracking via events

**Why it exists:**

No npm package combines document viewing + watermarking + email gates + view tracking. You have react-pdf and PDF.js for rendering, but they don't do security. You have DocSend and Papermark for security, but they're SaaS dashboards — you can't embed them.

**How it works:**
- Web Component (Shadow DOM) — works in React, Vue, Svelte, Angular, vanilla HTML
- ~15KB gzipped shell component
- PDF.js lazy-loaded only when rendering a PDF (~400KB, loaded on demand)
- Images use native Canvas API (0KB extra)

**Free vs paid:**
- PDF + images: free forever, no API key, runs client-side
- Office docs + video: requires CloakShare API (server-side processing)

**Technical details:**
- Canvas-based rendering (no downloadable file URLs)
- Watermark composited per frame (can't remove via DevTools)
- Shadow DOM encapsulation (host page CSS/JS can't interfere)
- Keyboard accessible (arrow keys, tab, escape)
- ARIA labels and screen reader support

GitHub: https://github.com/cloakshare/cloakshare
npm: https://www.npmjs.com/package/@cloakshare/viewer
Live demo: https://cloakshare.dev/embed

---

## 3. Newsletter Pitch Emails

### 3a. Console.dev

**Subject:** CloakShare — open-source secure document sharing API (MIT)

Hi Console team,

I'd love to submit CloakShare for consideration in Console.

**CloakShare** is an open-source (MIT licensed) API for secure document and video sharing. Upload a file, get a tracked, watermarked, expiring viewer link. Think DocSend but API-first, self-hostable, and free.

**Why it's interesting for your audience:**

- **API-first** — one `curl` or SDK call to create a secure link. No dashboard required.
- **MIT licensed** — not AGPL like Papermark (the main open-source alternative). Developers can fork, modify, and embed without licensing friction.
- **Self-hostable** — `docker compose up` on any VPS. SQLite + local storage. 1GB RAM.
- **Embeddable viewer** — ships as an npm Web Component (`@cloakshare/viewer`). Drop `<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate />` into any app. Free for PDF and images.
- **Per-page analytics** — tracks which pages were viewed, time spent on each, scroll depth, completion rate. Not just "link was opened."

**Tech stack:** TypeScript, Hono, Drizzle ORM, SQLite/Turso, Poppler, Sharp, FFmpeg

**Links:**
- GitHub: https://github.com/cloakshare/cloakshare
- Website: https://cloakshare.dev
- npm: https://www.npmjs.com/package/@cloakshare/viewer

Thanks for your time. Happy to provide any additional info.

Best,
[Your name]

---

### 3b. TLDR Newsletter

**Subject:** Open-source DocSend alternative — CloakShare (MIT, self-hostable, API-first)

Hi TLDR team,

Quick pitch for TLDR Open Source or TLDR Web Dev:

**CloakShare** is an MIT-licensed secure document sharing API. One API call turns any PDF, Office doc, or video into a tracked, watermarked, expiring viewer link.

**The hook:** DocSend charges $45/user/month. Papermark (the open-source alternative) is AGPL. CloakShare is MIT — free to fork, modify, and embed. Self-host with Docker or use the free cloud tier.

**Key features:**
- Per-page analytics (which slides held attention, not just "link opened")
- Dynamic watermarks (viewer email burned into every page)
- Email gates, password protection, link expiry
- Video support with HLS streaming
- Embeddable viewer Web Component (free npm package for PDF/images)
- SDKs for Node.js, Python, Go

**Traction:** [Insert current GitHub stars], [Insert npm downloads if available]

**Links:**
- GitHub: https://github.com/cloakshare/cloakshare
- Website: https://cloakshare.dev

Would this be a fit for an upcoming issue?

Best,
[Your name]

---

### 3c. Changelog

**Subject:** CloakShare — open-source DocSend alternative for developers

Hi Changelog team,

I built CloakShare, an open-source (MIT licensed) secure document sharing API. I think it'd be a good fit for Changelog News or the podcast.

**The story:**

Every developer tool that handles sensitive content (LMS platforms, deal rooms, investor portals, HR tools) needs document sharing with access controls. The options are: pay DocSend $45/user/month, use Papermark (AGPL — viral license), or build it yourself.

I built CloakShare as the missing infrastructure layer. Upload a file via API, get a secure viewer link back. Per-page analytics, dynamic watermarks, email gates, expiry, webhooks. MIT licensed, self-hostable with Docker, and ships an embeddable viewer as an npm package.

**What makes it different from Papermark:**
1. MIT vs AGPL — developers can embed without licensing anxiety
2. API-first vs dashboard-first — built for integration, not manual workflow
3. Embeddable viewer — npm package, not just hosted links
4. Video support — HLS streaming with watermark overlays

**Tech details that your audience would find interesting:**
- Canvas-based viewer (watermarks composited per frame, not CSS overlays)
- Poppler for PDF rendering (MIT — chose over MuPDF which is AGPL)
- Background rendering queue with atomic job claiming
- SQLite for zero-config self-hosting, Turso for cloud scale
- ~15KB Web Component shell, PDF.js lazy-loaded only when needed

**Links:**
- GitHub: https://github.com/cloakshare/cloakshare
- Website: https://cloakshare.dev
- Blog (technical deep dives): https://cloakshare.dev/blog

Would love to chat about the architecture decisions or the open-core business model. Happy to come on the podcast or just submit for Changelog News.

Best,
[Your name]

---

## 4. Tweet Threads

### 4a. Build-in-Public Launch Thread

**Tweet 1:**
I just shipped an embeddable secure document viewer as an npm package.

One line of code:

```html
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate />
```

Watermarks, email gates, view tracking. Free for PDF & images. No API key.

Here's what I built and why:

**Tweet 2:**
The problem: no npm package exists that combines document viewing + watermarking + email gates + view tracking.

You have react-pdf for rendering. DocSend for security. But nothing that does both AND embeds in your app.

Until now.

**Tweet 3:**
How it works:

- Web Component (works in React, Vue, Svelte, Angular, vanilla HTML)
- ~15KB shell component
- PDF.js lazy-loaded only when needed
- Canvas-based rendering (no downloadable file URLs)
- Shadow DOM encapsulation

**Tweet 4:**
Free tier (no API key, runs client-side):
- PDF viewing
- Image viewing
- Client-side watermarks
- Email gate
- Password protection

With API key (server-side processing):
- Office docs (DOCX, PPTX, XLSX)
- Video (HLS streaming)
- Server-burned watermarks
- Analytics dashboard

**Tweet 5:**
I'm building CloakShare in public. It's the full-stack secure document sharing API behind this viewer.

Open source. MIT licensed. Self-hostable with Docker.

Think DocSend but for developers.

GitHub: github.com/cloakshare/cloakshare
Try it: cloakshare.dev/embed

**Tweet 6:**
Numbers so far:
- [X] GitHub stars
- [X] npm downloads
- 10 blog posts
- 7 good-first-issue labels for contributors
- 0 funding, bootstrapped

If you're building something that shares sensitive documents, try it and tell me what's missing.

---

### 4b. Comparison Thread — CloakShare vs DocSend

**Tweet 1:**
DocSend charges $45/user/month.

For a 5-person sales team sharing proposals, that's $2,700/year.

Here's what you get for free with CloakShare (open source, MIT licensed):

**Tweet 2:**
Per-page analytics:
- DocSend: Yes ($45/user/mo)
- CloakShare: Yes (free, self-hosted)

Which slides held attention? Did they skip pricing? Did they come back?

Same data. $0/year instead of $2,700.

**Tweet 3:**
Watermarks:
- DocSend: Static text
- CloakShare: Dynamic templates — viewer email, date, session ID

Every page stamped with WHO is reading it and WHEN. Deters forwarding because the leak is traceable.

**Tweet 4:**
API access:
- DocSend: No real API
- CloakShare: API-first. One curl command to create a secure link.

```
curl -X POST https://api.cloakshare.dev/v1/links \
  -F file=@proposal.pdf \
  -F watermark=true \
  -F require_email=true
```

**Tweet 5:**
Self-hosting:
- DocSend: No
- CloakShare: `docker compose up`

Your documents on your infrastructure. SQLite, local storage, 1GB RAM. Useful for healthcare, legal, government — anyone with data sovereignty requirements.

**Tweet 6:**
Open source:
- DocSend: Proprietary
- CloakShare: MIT licensed

Read every line of code that touches your data. Fork it. Modify it. Embed it in your product. No licensing anxiety.

github.com/cloakshare/cloakshare

---

### 4c. Comparison Thread — CloakShare vs Papermark

**Tweet 1:**
Papermark is great. $900K ARR, 6.9K GitHub stars, 2-person team. Respect.

But if you're a developer choosing between Papermark and CloakShare, here's an honest comparison:

**Tweet 2:**
License:
- Papermark: AGPL
- CloakShare: MIT

AGPL means if you modify the code and deploy it (even internally), you must open-source your changes. MIT has no such restriction. Fork it, embed it, ship it. Your legal team will thank you.

**Tweet 3:**
Architecture:
- Papermark: Dashboard-first (Next.js app with API bolted on)
- CloakShare: API-first (Hono API with viewer as separate component)

If you're integrating document sharing into YOUR product, you need an API, not a dashboard.

**Tweet 4:**
Embeddable viewer:
- Papermark: No npm package. Links only.
- CloakShare: Web Component npm package. Drop into any app.

```html
<cloak-viewer src="/deck.pdf" watermark="{{email}}" email-gate />
```

Free for PDF & images. No API key needed.

**Tweet 5:**
Video support:
- Papermark: No
- CloakShare: Yes — MP4, MOV, WEBM with HLS streaming and watermark overlays

If you share training videos, product demos, or investor updates alongside docs — CloakShare handles both.

**Tweet 6:**
Both are open source. Both solve real problems. Choose based on your use case:

- Need a ready-made dashboard? Papermark.
- Need an API to embed in your product? CloakShare.
- Care about license freedom? CloakShare (MIT).

github.com/cloakshare/cloakshare

---

### 4d. Technical Thread — How We Built Per-Page Analytics

**Tweet 1:**
We track which pages someone reads in a shared PDF, how long they spend on each page, and their scroll depth.

Here's the technical architecture behind per-page analytics in CloakShare:

**Tweet 2:**
Step 1: Server-side rendering

When you upload a PDF, Poppler converts each page to an image. Not PDF.js — Poppler is MIT licensed (MuPDF is AGPL).

150 DPI, compressed to WebP with Sharp. ~80KB per page instead of ~400KB JPEG.

**Tweet 3:**
Step 2: Canvas-based viewer

We don't serve PDFs. We serve page images drawn to Canvas.

Why Canvas instead of PDF.js?
- No downloadable file URLs
- Watermark composited per frame (can't remove via DevTools)
- Full control over the interaction loop = trivial analytics

**Tweet 4:**
Step 3: IntersectionObserver tracking

When a page enters the viewport, a timer starts. On page change, tab blur, or navigation away, we POST:

- Page number
- Duration (seconds)
- Scroll depth (0-100%)
- Device type

**Tweet 5:**
Step 4: Aggregation

Server stores per-page engagement per viewer. The analytics API returns:

- Total views
- Unique viewers
- Per-viewer breakdown (which pages, how long, completion rate)
- 3-second threshold for "engagement" (below = skim, above = read)

**Tweet 6:**
The whole thing is open source (MIT).

Rendering pipeline, viewer code, analytics queries — all on GitHub.

Or try the hosted version: upload a PDF, share the link, watch the per-page analytics roll in.

github.com/cloakshare/cloakshare

---

### 4e. Technical Thread — Canvas Watermarks

**Tweet 1:**
Most document viewers add watermarks with CSS overlays. You can remove them in 5 seconds with DevTools.

Here's how CloakShare does watermarks that actually work:

**Tweet 2:**
Client-side mode:

The watermark is composited directly onto the Canvas rendering context. Every frame. Not a DOM element — a pixel-level overlay drawn with ctx.fillText().

Delete the DOM node? The watermark is still in the pixels.

**Tweet 3:**
Template variables:

```
watermark="{{email}} - {{date}} - {{session_id}}"
```

Each viewer sees their own email burned into every page. If the document leaks, you know exactly who shared it.

**Tweet 4:**
API-connected mode (stronger):

Watermarks are burned into the rendered page images SERVER-SIDE before they reach the browser.

The viewer never receives a clean image. You'd need Photoshop to remove it — and it's on every single page.

**Tweet 5:**
Is this DRM? No. Nothing browser-based is DRM.

It's a deterrent. Same level as DocSend and Papermark. It stops casual forwarding because the leak is traceable.

We're transparent about this in our docs. "Deters casual sharing, not determined attackers."

**Tweet 6:**
The watermark engine, viewer, and rendering pipeline are all open source.

MIT licensed. Self-hostable. Free for PDF & images.

github.com/cloakshare/cloakshare

---

### 4f. Use-Case Thread — Fundraising

**Tweet 1:**
You've spent months on your pitch deck. Now you're sending it to 30 VCs.

Here's what you don't know:
- Which ones opened it
- Who forwarded it to their partners
- Whether your financials are in a competitor's inbox

**Tweet 2:**
With CloakShare, you upload the deck once and get a secure link.

When an investor opens it, you see:
- 3:15 PM — investor@sequoia.com opened the deck
- 3:17 PM — Jumped to slide 4 (market opportunity)
- 3:22 PM — 5 minutes on slide 6 (traction)
- 3:27 PM — Finished. 12 min total. 95% completion.

**Tweet 3:**
Reading the signals:

- 5 min on traction, skipped financials? They like the market. Lead with unit economics next call.
- 30 seconds, 2 pages? Not interested. Don't follow up.
- Opened twice, weeks apart? Reconsidering. Warm follow-up time.
- New email from different domain? Forwarded internally. Partner review.

**Tweet 4:**
Every page is watermarked with the viewer's email. If someone forwards your deck, you know who did it and who received it.

Not to punish — to understand your fundraise pipeline.

**Tweet 5:**
Free tier covers a seed round.

50 links, 500 views per month. Send 40 decks, get 3-4 opens each = ~120-160 views. Comfortably free.

Or self-host for unlimited everything: `docker compose up`

**Tweet 6:**
Stop emailing PDFs into the void.

Upload a deck. Get a secure link. Send it. Watch the analytics.

cloakshare.dev — free to start
github.com/cloakshare/cloakshare — open source (MIT)
