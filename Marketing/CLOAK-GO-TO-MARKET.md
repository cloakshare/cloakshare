# CLOAK — Go-to-Market & Marketing Strategy

---

## THE HONEST REALITY

GitHub stars don't make revenue. Customers make revenue. Stars are a **credibility signal** — they tell a developer "this is safe to use, real people trust it." The goal isn't to hit 10K stars. The goal is to get developers integrating Cloak into their products and paying $29-299/mo for the cloud version. Stars are a means to that end.

Papermark's playbook is your direct blueprint — they did exactly what you're doing (open-source DocSend alternative) and reached $900K ARR. Here's what actually worked, adapted for Cloak.

---

## PRE-LAUNCH (Weeks 7-9 of Build)

### Build in Public

Start posting about Cloak **while you're building it**, not after. This does three things: validates the idea, builds an audience, and creates launch-day allies who feel invested.

**Week 7-8: Twitter/X thread strategy**

Post 3-4 times per week. Mix of:

1. **"I'm building" posts** — Show real screenshots, real code, real progress. Not polished marketing — raw developer energy.
   - "Building an open-source API for secure document sharing. Here's the rendering pipeline — Poppler converts PDF pages to images, Sharp processes them, Canvas renders with a per-viewer watermark. All MIT licensed."
   - [Screenshot of the viewer with watermark]

2. **Pain point posts** — Talk about the problem, not your solution. These get engagement from people who relate.
   - "DocSend charges $45/user/month to share a pitch deck with a link. And you can't even self-host it. In 2026 this feels insane."
   - "Every time I send a PDF by email I have zero idea if anyone opened it. Built something to fix that."

3. **Technical deep-dive posts** — Developers love learning. Teach something while showing your product.
   - "TIL: MuPDF is 78% faster than Poppler for PDF rendering, but it's AGPL licensed. If you use it in a SaaS, you must open-source your entire app or buy a commercial license. Poppler (GPL) via subprocess is the safe choice."
   - "Stripe deprecated Usage Records in their March 2025 API. If you're building metered billing, you need the new Billing Meter API. Here's how it works:"

4. **Engagement bait (authentic)** — Ask questions that your target audience cares about.
   - "What's the biggest problem with document sharing APIs?"
   - "If you could add one feature to DocSend, what would it be?"

**Where to post:**
- Twitter/X (primary — developer community lives here)
- LinkedIn (secondary — B2B decision-makers, sales teams)
- Dev.to (long-form technical posts, cross-post your blog)
- Reddit: r/selfhosted, r/SaaS, r/webdev, r/programming (be genuine, not promotional)

### Pre-Launch Email List

Add an email capture to cloakshare.dev as early as Week 7. Simple: "Cloak is launching soon. Get early access." Use Resend (already in the stack) or Loops.so. Goal: 200-500 emails before launch day.

### Pre-Launch README

Even before the public repo exists, draft the README. It's your most important marketing asset. It needs to be done BEFORE launch day, not rushed the night before.

---

## LAUNCH DAY SEQUENCE

This is a coordinated, one-day push across multiple channels. You get one shot at a "launch" — after that it's just marketing.

### The Channels (in priority order)

**1. Hacker News — Show HN**

This is the single highest-leverage channel for developer tools. Papermark's HN posts drove massive traffic. One good Show HN can generate 500-2000 stars in 24 hours.

**Format:**
```
Show HN: Cloak – Open-source API for secure document sharing (tokenized links, watermarks, tracking)
```

Link directly to the GitHub repo (not the marketing site). HN prefers GitHub links for Show HN posts.

**First comment** (post immediately after submitting):
Write a 3-4 paragraph comment explaining what you built, why, and what makes it different. Be authentic. Mention it's open source and self-hostable. Include a link to the live demo. Respond to every single comment.

**Timing:** Post between 8-9 AM Eastern on a Tuesday or Wednesday. These are the highest-traffic windows.

**2. Product Hunt**

Launch the same day as HN or the day after. Prepare in advance:
- Product page with screenshots, demo video (60-90 sec screen recording)
- Tagline: "Open-source secure document sharing API" or "The open-source DocSend alternative for developers"
- Maker comment ready to post
- 10-15 people lined up to upvote and leave genuine comments in the first hour (friends, early email list subscribers, fellow developers)

**3. Twitter/X Launch Thread**

One anchor thread that tells the full story. Structure:

```
Tweet 1: 🚀 Launching Cloak — an open-source API for secure document sharing.

Tokenized links. Dynamic watermarks. Page-by-page analytics.
Self-hostable. MIT licensed.

One API call to secure any document.

[link to GitHub]

🧵 Here's what I built and why 👇

Tweet 2: The problem:
You share a pitch deck. You have no idea who opens it, how long they read, or if they forwarded it to someone they shouldn't have.

DocSend charges $45/user/month for this.
You can't self-host it.
There's no API.

Tweet 3: Cloak is different:
- API-first (POST a file → get a secure link)
- Open source (MIT license, self-host with Docker)
- Dynamic watermarks (each viewer sees their email on every page)
- Real-time tracking (who viewed, what pages, how long)
- Webhooks, SDKs, embedded viewer

Tweet 4: Try it now — no signup needed.

[link to live demo on cloakshare.dev]

Upload any PDF. Get a secure link. See the analytics.

Tweet 5: The tech stack:
TypeScript, Hono, Drizzle ORM, Turso, Cloudflare R2, Poppler, Sharp.

Deployed on Fly.io + Cloudflare Pages.

Full architecture blog post: [link]

Tweet 6: Cloud version for when you don't want to self-host:
- Free tier (10 links/mo)
- Starter: $29/mo
- Growth: $99/mo
- Scale: $299/mo

Video support, custom domains, embedded viewer, team management.

Tweet 7: Star us on GitHub ⭐
[link]

Feedback welcome. Built solo, launching today. Let me know what you think.
```

**4. Reddit**

Post to relevant subreddits, one per subreddit, spaced out over the day:
- r/selfhosted — "I built an open-source DocSend alternative you can self-host with Docker"
- r/SaaS — "Launched Cloak — secure document sharing API, feedback welcome"
- r/webdev — "Show off: Built a secure document viewer with Canvas watermarks and HLS video"
- r/opensource — "Cloak: open-source API for tokenized document links with per-viewer watermarks"

**Rules:** Be genuine. Don't use marketing language. Show the tech, ask for feedback. Reddit will destroy you if you sound like an ad.

**5. Dev.to Launch Post**

Publish a detailed "how I built this" post on launch day. Cross-post your blog. Include architecture diagrams, code snippets, screenshots. This is long-form content that drives ongoing traffic via search.

Title: "I built an open-source API for secure document sharing — here's the architecture"

**6. Email List**

Send the launch email to your pre-launch list. Short, direct:
- "Cloak just launched. Here's the GitHub repo [link]. Try the demo [link]. Would love your feedback."

**7. LinkedIn**

One post, more professional/business-focused than Twitter:
- "Launched Cloak today — an open-source alternative to DocSend, built API-first for developers. Secure document sharing with tokenized links, watermarks, and page-by-page analytics. Free to self-host, cloud version starting at $29/mo."

---

## POST-LAUNCH: Ongoing Marketing (Month 1-3)

### Content Engine

This is how you sustain growth after launch-day buzz fades. Publish 2-3 pieces per week:

**Blog post types (rotate these):**

1. **Comparison posts** (SEO gold)
   - "Cloak vs DocSend: Feature comparison for developers"
   - "Cloak vs Papermark: Which open-source document sharing tool is right for you?"
   - "Top 5 DocSend alternatives in 2026"
   - "How to self-host a secure document sharing platform"
   These rank for buyer-intent keywords. People searching "DocSend alternative" are ready to switch.

2. **Technical tutorials** (builds trust + SEO)
   - "How to add secure document sharing to your Next.js app in 5 minutes"
   - "Building a pitch deck sharing tool with Cloak API and React"
   - "Self-hosting Cloak on a $5 VPS with Docker"
   - "How to track investor engagement on your pitch deck with webhooks"

3. **Use case posts** (reaches non-developer buyers)
   - "How startups use Cloak to share pitch decks with investors"
   - "Secure video sharing for sales teams"
   - "How to protect sensitive documents with tokenized links"
   - "HIPAA-compliant document sharing with self-hosted Cloak"

4. **Engineering deep-dives** (HN/dev community bait)
   - "Why we chose Poppler over MuPDF (and how AGPL almost killed our business model)"
   - "Rendering 100-page PDFs in 14 seconds with Poppler + Sharp"
   - "Dynamic watermarks: client-side Canvas vs server-side FFmpeg"
   - "How we built metered billing with Stripe's new Billing Meter API"

### SEO Strategy

Target these keyword clusters:

| Cluster | Keywords | Content Type |
|---------|----------|-------------|
| Alternatives | docsend alternative, papermark alternative, digify alternative | Comparison pages |
| Use cases | secure document sharing, share pitch deck securely, track document views | Use case pages + blog |
| Self-hosting | self-host document sharing, open source docsend, docker document viewer | Tutorial blog posts |
| API/developer | document sharing API, PDF watermark API, secure link API | Technical docs + blog |
| Video | secure video sharing, video watermark, track video views | Blog posts after video ships |

### Community Building

**Discord server** — Open on launch day. Channels:
- #general
- #help (support questions)
- #feature-requests
- #self-hosting
- #show-and-tell (developers share what they built with Cloak)
- #bugs

Keep it active. Respond to every message within a few hours. Early community members become your best advocates.

**GitHub Discussions** — Enable on the repo. Good for longer technical conversations and feature proposals.

**Contributing guide** — Make it easy for people to contribute. Create "good first issue" labels on GitHub. Each contributor becomes an advocate.

### Micro-Tools (Papermark's Genius Move)

Papermark built free tools that attract their target audience:
- Searchable investor database
- VC list by country/stage
- AI document assistant

Cloak equivalent — build tiny free tools that your audience wants:
- **PDF watermark tool** — Upload a PDF, add a watermark, download. Free, no signup. Link to Cloak for dynamic per-viewer watermarks.
- **Document link tracker** — Paste any URL, get a tracked link. Free tier. Upsell to Cloak for security features.
- **File format converter** — PPTX/DOCX to PDF online. Free. Mention Cloak for secure sharing.

These tools rank for high-traffic keywords and funnel developers to Cloak.

---

## PAID MARKETING (Month 3+, after product-market fit)

Don't spend money on ads until you have at least 50 paying customers organically. Then:

**1. Google Ads** — Target buyer-intent keywords: "docsend alternative", "secure document sharing API", "document tracking software". Small budget ($500-1000/mo) to start.

**2. Sponsorships** — Developer newsletters with relevant audiences:
- TLDR newsletter ($1-3K per placement, 1M+ subscribers)
- Bytes.dev (JavaScript focused)
- Console.dev (curates developer tools)
- Relevant YouTube channels doing developer tool reviews

**3. AppSumo or similar** — Lifetime deals drive volume but not recurring revenue. Use only if you want a burst of users for social proof. Not recommended for long-term revenue strategy.

---

## METRICS TO TRACK

**Vanity (useful for credibility, not revenue):**
- GitHub stars
- Twitter followers
- Discord members
- Product Hunt rank

**Growth (track weekly):**
- GitHub repo traffic (unique visitors, clones, referrers)
- Website unique visitors
- Demo completions (how many people actually try the demo)
- Sign-ups
- API keys created
- First link created (activation)

**Revenue (track weekly from day 1):**
- MRR (monthly recurring revenue)
- Paid conversion rate (free → paid)
- Churn rate
- ARPU (average revenue per user)
- LTV (lifetime value)

**Content (track monthly):**
- Blog traffic by post
- Keyword rankings for target clusters
- Backlinks acquired

---

## TIMELINE

```
Week 7-8:  Build in public (Twitter threads, dev.to posts)
           Email capture on cloakshare.dev
           Draft README, prep PH page
           
Week 9:    LAUNCH DAY
           HN Show HN post (morning)
           Product Hunt launch (same day or next)
           Twitter launch thread
           Reddit posts (4 subreddits)
           Dev.to launch post
           Email blast to pre-launch list
           LinkedIn post
           Discord server opens
           
Week 10:   Respond to all feedback, fix launch bugs fast
           First comparison blog post (Cloak vs DocSend)
           First technical tutorial
           
Week 11:   Second comparison post (Cloak vs Papermark)
           Use case post (pitch deck sharing)
           
Week 12+:  2-3 blog posts per week, ongoing
           Build micro-tool (PDF watermark tool)
           Community engagement daily
           Track metrics weekly
           
Month 3+:  Evaluate paid channels if organic is working
           Start Google Ads on buyer-intent keywords
           Explore newsletter sponsorships
```

---

## WHAT PAPERMARK DID RIGHT (copy this)

1. **Started with a tweet** to validate interest before building anything
2. **Built in public** — documented the entire build on Dev.to and Twitter
3. **Launched on Product Hunt AND Hacker News** with coordinated timing
4. **Wrote comparison content** aggressively (ranks for "DocSend alternative")
5. **Built micro-tools** (investor database, VC GPT) that attract their audience for free
6. **Launched on PH twice** — relaunched with major feature updates
7. **Engaged HN comments** personally and authentically
8. **Open-source credibility** — 40% of PH upvotes came from OSS community
9. **Consistent content cadence** — never stopped publishing

## WHAT TO DO DIFFERENTLY THAN PAPERMARK

1. **API-first positioning** — Papermark is a product. Cloak is an API. Your audience is developers building products, not end-users sharing decks directly. Lean into this.
2. **Video support** — Papermark doesn't do video. This is a real differentiator for sales teams.
3. **Developer experience** — SDKs in 3 languages, OpenAPI spec, live demo with no signup. Papermark has an API but it's not their lead feature.
4. **Self-hosting quality** — Make `docker compose up` genuinely work flawlessly. Many open-source projects claim self-hosting but it's a rough experience. Make it bulletproof.
5. **Design** — Papermark's site is functional but not beautiful. Your dark terminal luxury aesthetic is a deliberate differentiator. Looking professional builds trust faster.

---

## THE README (Your Most Important Marketing Asset)

The README is the first thing anyone sees. It must be exceptional.

```markdown
<p align="center">
  <img src="logo.svg" width="120" alt="Cloak" />
</p>

<h3 align="center">Secure any document. One API call.</h3>

<p align="center">
  Open-source API for tokenized document links with watermarks, tracking, and expiry.
</p>

<p align="center">
  <a href="https://cloakshare.dev">Website</a> ·
  <a href="https://github.com/cloakshare/cloakshare">Docs</a> ·
  <a href="https://cloakshare.dev/demo">Live Demo</a> ·
  <a href="https://discord.gg/xxx">Discord</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/cloakshare/cloakshare?style=flat" />
  <img src="https://img.shields.io/github/license/cloakshare/cloakshare" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" />
</p>

<p align="center">
  <img src="hero-screenshot.png" width="700" alt="Cloak dashboard" />
</p>

---

## What is Cloak?

Cloak is an open-source API for secure document and video sharing. Upload a file, get a tokenized link with dynamic watermarks, email gates, expiry, and page-by-page analytics.

- **API-first** — One POST request to secure any document
- **Dynamic watermarks** — Each viewer sees their email on every page  
- **Real-time analytics** — Who viewed, what pages, how long
- **Self-hostable** — Run it on your own infrastructure with Docker
- **Video support** — Secure video with HLS delivery and engagement heatmaps

## Quick Start

### Cloud (fastest)

```bash
curl -X POST https://api.cloakshare.dev/v1/links \
  -H "Authorization: Bearer ck_live_xxx" \
  -F file=@pitch-deck.pdf \
  -F require_email=true \
  -F watermark=true
```

### Self-hosted

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloak
docker compose up
```

Open http://localhost:3000 — that's it.

## Features

| Feature | Free | Starter ($29) | Growth ($99) | Scale ($299) |
|---------|------|--------------|-------------|-------------|
| Secure links | 10/mo | 100/mo | 500/mo | 2,000/mo |
| Email gate | ✓ | ✓ | ✓ | ✓ |
| Dynamic watermarks | ✓ | ✓ | ✓ | ✓ |
| Password protection | ✗ | ✓ | ✓ | ✓ |
| Video links | ✗ | ✓ | ✓ | ✓ |
| Custom domains | ✗ | ✗ | ✓ | ✓ |
| Team management | ✗ | ✗ | ✓ | ✓ |
| Self-hosted | ✓ | ✓ | ✓ | ✓ |

## SDKs

```bash
npm install @cloak/sdk        # Node.js
pip install cloak-python       # Python
go get github.com/cloakshare/cloakshare-go  # Go
```

## Documentation

Full docs at [GitHub Docs](https://github.com/cloakshare/cloakshare)

## Contributing

We love contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — use it however you want.
```

This README format follows what works: logo, one-liner, badges, screenshot, quick start in < 30 seconds, feature table, SDKs, docs link. No walls of text.
