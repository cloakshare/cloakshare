# Show HN Draft — CloakShare

> Personal reference only. Do NOT commit to GitHub.
>
> Two variants below: a SaaS-aligned launch (ready today, points at cloakshare.dev)
> and the original OSS-aligned launch (ship after the GitHub repo is live).
> Pick one.

---

## VARIANT A — SaaS-Aligned Launch (ready today)

### Post

**Title:** Show HN: CloakShare – PDFs that actually expire (410 Gone, per-page render, no DRM)

**URL:** https://www.cloakshare.dev

### Maker Comment (post as first comment)

Hi HN — I built CloakShare because every "expiring document" tool I tried was theater. You upload a PDF, get a "share link," and the recipient downloads the file in three seconds. Then the link "expires" and the dashboard tells you the document is gone. The recipient still has the PDF on their laptop. The "expiration" was a UI lie.

The real problem: PDFs do not expire. Once a recipient has the file, they have it forever. The only way to make a document genuinely expire is to never deliver the file in the first place.

**How CloakShare works:** when you create a link, the PDF stays on our server. The viewer renders one page at a time as a canvas image, on demand, in the recipient's browser. They can read it, scroll it, search it (we extract a text layer for accessibility) — but they never receive the underlying PDF. When the link expires, the viewer endpoint returns `410 Gone`. There is nothing on the recipient's machine to fall back to.

**On the 410 Gone choice:** most tools in this space return a 200 with a "this link has expired" page. That is technically wrong. RFC 9110 reserves 404 for "we don't know if this ever existed" and 410 Gone for "this existed but is intentionally no longer available." Audit logs, archive crawlers, and link checkers all behave differently for 410 — they stop revisiting, which is exactly what you want for a revoked document. It is a small thing but a correct thing.

**Technical choices worth discussing:**

- **Per-page canvas render over PDF.js streaming** — PDF.js can render in-browser, but the recipient still receives the underlying PDF byte stream. We render server-side per-page to a bitmap and stream that. Slightly slower first paint, but the underlying file never leaves our infrastructure.
- **Watermarks baked at render time, not as overlay** — recipient email + session ID composited into the page bitmap. Even a screenshot of the rendered page traces back to a specific viewing session. CSS overlay watermarks are trivially defeatable; render-time watermarks are not.
- **No PDF download endpoint, period** — every "expiring document" tool I evaluated had a download option that defeated the purpose. We just do not expose one. If you need to send a PDF the recipient can keep, attach it to an email — that is the right tool.
- **View tracking at the page level** — we record which pages were viewed for how long. For sales decks, this is the killer feature. You see your prospect spent 2 minutes on slide 7 (pricing) and 14 seconds on slide 4 (team).
- **Stateless link tokens** — link IDs are opaque + signed. No DB lookup needed to validate the link's signature; only the expiration check hits the DB. Lets us serve `410 Gone` from the edge with one Redis call.

**On the business model:** free tier covers 50 links/month with full per-page tracking, watermarking, and instant revoke. Paid plans start at $29/mo and remove the cap. The free tier exists because most senders use this for a single deck or contract — they should not need to subscribe to send one expiring document. Paid users are the ones with ongoing workflows: VCs sharing dozens of decks, RIAs sharing client docs, lawyers sending discovery materials.

**What this is not:** this is not enterprise DRM. Adobe LiveCycle and AEM Rights Management solve a different problem — they let you require Adobe Reader on the recipient's machine and enforce expiration through the viewer's local clock. That works, but the price tag is meaningful and the experience is brittle. CloakShare is for the 95% case: "send a sensitive document to a smart recipient who will not actively try to defeat the system, but might forward the link to their team or save the file from a regular PDF reader."

I would love feedback on: the 410 Gone choice (over-engineering or right thing?), per-page render performance for documents above 50 pages, and which integrations to ship next (Slack share, Notion embed, Salesforce attachment).

- Live: https://www.cloakshare.dev
- Free tier: https://app.cloakshare.dev/register
- "Send a PDF that expires" write-up: https://www.cloakshare.dev/blog/send-pdf-that-expires
- Compare pages: https://www.cloakshare.dev/compare

---

## X / Twitter Thread

🧵 PDFs do not expire. Every "self-destructing document" tool you've tried is theater.

The recipient downloaded the file the moment they clicked your link. When you "revoke" it, they still have it on their laptop.

I built CloakShare to actually solve this. Architecture below.

1/

→

The viewer renders one page at a time as a server-side bitmap. The recipient never receives the underlying PDF. They read it in their browser, but the file stays on our infrastructure.

When the link expires, the viewer returns 410 Gone. Nothing on their machine to fall back to.

2/

→

Why 410 Gone and not the typical "this link has expired" 200 page?

RFC 9110 reserves 410 for "this existed but is intentionally no longer available." Archive crawlers and link checkers handle 410 specially — they stop revisiting. Exactly what you want for a revoked document.

3/

→

Watermarks are baked into the page bitmap at render time — recipient email + session ID composited into the image. Screenshots are still traceable.

CSS overlay watermarks are trivially defeated with browser dev tools. Render-time watermarks are not.

4/

→

Page-level view tracking is the killer feature for sales decks. You see your prospect spent 2 minutes on slide 7 (pricing) and 14 seconds on slide 4 (team).

That's signal a sender-side tool can't give you.

5/

→

Free tier: 50 links/month, full tracking + watermarking + revoke.

Paid starts at $29/mo. No download endpoint, ever — that defeats the purpose of the product.

6/

→

If you send pitch decks, contracts, financials, or legal briefs and want them to actually expire when you say they expire:

https://www.cloakshare.dev

Free to try, no credit card.

End/

---

## Reddit Posts

### r/SaaS (or r/sideproject)

**Title:** I built a tool that makes PDFs actually expire — not the fake "self-destructing" kind

I got tired of "expiring document" tools where the recipient just downloads the PDF the moment they click the link, and the "revoke" button is theater.

CloakShare renders one page at a time as a server-side bitmap. The recipient reads it in their browser, but never receives the underlying PDF file. When the link expires, the viewer returns `410 Gone`. There's nothing on their laptop to fall back to.

Built this for VCs, lawyers, and consultants who send sensitive decks/contracts/briefs and want the document to actually expire when the deal closes (or the deadline hits).

Free tier covers 50 links/month with full per-page view tracking, watermarking, and instant revoke. Paid plans start at $29/mo.

Would love feedback on positioning vs DocSend / Papermark / Brieflink / DealRoom — the established tools all let recipients download the file by default.

→ https://www.cloakshare.dev

### r/startups

**Title:** "Self-destructing" document tools are mostly theater — here's why and what we built instead

Most tools that promise expiring documents just give you a link that "expires" while the recipient already downloaded the PDF. The expiration is a UX lie.

Real expiration requires never delivering the file in the first place. We built CloakShare around that constraint:

- Per-page canvas render — the PDF byte stream never leaves our server
- Watermarks composited into the page bitmap at render time (not CSS overlay)
- 410 Gone semantics on revocation (proper HTTP, archive crawlers stop revisiting)
- View tracking down to the page-and-second level

For pitch decks, contracts, financial models, legal briefs — anything where forwarding-the-link or saving-after-the-fact would compromise the deal — this is the right architecture.

Free tier: https://www.cloakshare.dev

---

## Indie Hackers Post

**Title:** Why "self-destructing" PDFs are mostly theater (and what we built instead)

I'm Ryan, the indie founder behind CloakShare. We make PDFs that actually expire — not the fake kind where the recipient downloaded the file in 3 seconds and the "revoke" button is a UI lie.

**The realization:** I tried four "expiring document" tools before building this. All four had the same flaw: the recipient downloaded the underlying PDF the moment they clicked the link. When I "revoked" it, the dashboard told me the document was gone. The recipient's laptop did not agree.

The only way to make a document actually expire is to never deliver the file. CloakShare renders one page at a time as a server-side bitmap, streamed to the recipient's browser. They read it, scroll it, even search it (we extract a text layer for accessibility) — but they never receive the underlying PDF.

When the link expires, the viewer endpoint returns `410 Gone`. There is nothing on their machine to fall back to.

**Pricing:** free tier covers 50 links/month with full per-page tracking, watermarking, and instant revoke. Paid starts at $29/mo.

**On the "no download endpoint" choice:** every tool I evaluated had a download option that defeated the purpose. I just do not expose one. If you need to send a PDF the recipient can keep, attach it to an email — that is the right tool. CloakShare is for the cases where they should not keep it.

**On indie sustainability:** free tier exists because most users send one deck or contract — they should not need to subscribe to send one document. Paid users are VCs sharing dozens of decks, RIAs with client docs, lawyers with discovery materials. The pricing reflects "you do this multiple times a week" not "you do this once a quarter."

→ Live: https://www.cloakshare.dev
→ Free signup: https://app.cloakshare.dev/register

Open to feedback — especially on positioning vs DocSend (the 800lb gorilla here at $45/user/mo).

---

## Notes on Timing

- **HN:** Tuesday or Wednesday, 8:00–10:00 AM Pacific. Avoid Mondays (overflow from weekend), avoid Fridays (less engaged audience).
- **Reddit r/SaaS:** any weekday morning. Avoid weekends.
- **Reddit r/startups:** any weekday morning, frame as "what we learned building" rather than direct ad.
- **Indie Hackers:** post during US business hours, lead with the realization, not the pitch.
- **X/Twitter thread:** Tuesday or Wednesday, 9:00 AM Eastern. Pin to profile for 24h.

## Predicted Questions to Pre-Draft Answers For

- "Can't I just screenshot every page?" → Yes, but the watermark in the bitmap traces back to the session. Screenshot ≠ original file.
- "What's the latency on per-page render?" → ~200ms first paint per page on documents under 50 pages. Above that we pre-render the next 3 pages as the user reads.
- "Why not just use Google Drive expiring links?" → Drive's "expiring link" lets the recipient download and keep the file before expiration. Same theater.
- "How is this different from DocSend?" → DocSend lets recipients download by default unless you specifically disable it. We never expose download. Also DocSend is $45/user/mo; we're $29/mo flat.
- "Open source?" → Roadmap. Want to pay rent first.

---

## VARIANT B — OSS-Aligned Launch (ship AFTER github repo is live)

### Post

**Title:** Show HN: CloakShare -- Open-source DocSend alternative with video streaming (MIT)

**URL:** https://github.com/cloakshare/cloakshare

### Maker Comment (post as first comment)

Hi HN -- I built CloakShare because I was tired of paying $45/user/month for DocSend just to share a pitch deck with basic analytics. CloakShare is an open-source, API-first secure document sharing platform that gives you tracked links with watermarks, email gating, expiration, and real-time analytics.

**Why I built it:** DocSend charges $45/user/mo for what is fundamentally "serve pages as images with analytics." Papermark exists but is AGPL, which kills embedding in commercial products. And there is no npm package out there for secure document viewing -- if you want to embed a secure doc viewer in your app, you are rolling your own. I wanted something MIT-licensed, self-hostable, and embeddable.

**How it works:** Upload a file via the REST API, get back a secure link. Recipients open the link and hit an email gate. The viewer renders document pages on canvas with per-session watermarks (email + date + session ID). You get webhooks and analytics for every view, page turn, and time spent. Revoke access anytime.

**Video support:** CloakShare also handles video files with HLS streaming, adaptive quality tiers, and watermark overlays -- something DocSend does not do at all.

**Embeddable viewer:** There is an npm package (`@cloakshare/viewer`) that works as a Web Component. Drop `<cloak-viewer>` into any framework. PDF and image viewing is free with no API key required.

**Technical choices worth discussing:**

- **Hono over Express** -- 3x lighter, runs on Node, Bun, Deno, and edge runtimes. No reason to use Express in 2026.
- **SQLite/Turso over Postgres** -- zero-config for self-hosting. Clone, run, done. Turso gives you the distributed option when you need it.
- **Poppler over MuPDF** -- MuPDF is AGPL, which would poison the MIT license. Poppler (GPL with poppler-utils exception for CLI usage) keeps us clean.
- **Canvas rendering over PDF.js iframes** -- PDF.js hands users the raw PDF in the browser. Canvas rendering means we control every pixel, can overlay watermarks that survive screenshots, and capture granular analytics.
- **Web Components over React-only** -- the viewer needs to work in Vue, Svelte, plain HTML, everywhere. Web Components are the only real answer.

I would love feedback on: API design, performance (especially the rendering pipeline), and what features you think are missing.

- GitHub: https://github.com/cloakshare/cloakshare
- Live demo: https://demo.cloakshare.com
- Docs: https://docs.cloakshare.com
