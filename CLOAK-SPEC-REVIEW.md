# CLOAK SPEC REVIEW — Deep Analysis & Improvements
## Based on competitive research, technical validation, and market analysis

---

## EXECUTIVE SUMMARY

The Cloak spec is **strong and well-architected** for an MVP. The vision is clear, the tech choices are mostly sound, and the market positioning (API-first secure document sharing) targets a genuinely empty quadrant that no competitor occupies. However, deep research surfaced **3 critical bugs, 7 architectural issues, and 15+ improvements** that will save significant rework later.

**The biggest finding:** You're building in an unoccupied market position. DocSend is GUI-only. Digify has an API but is enterprise-priced ($130-$480/mo). Papermark is open-source but has weak security and no real API. **No one has built the "Stripe of secure document sharing" yet.** This is a validated $15B+ market with a clear gap.

---

## PART 1: CRITICAL ISSUES (Must Fix Before Building)

### 1.1 CRITICAL: Stripe Usage Records API is DEPRECATED

**Impact:** The entire billing implementation in the spec will not work.

The spec references `stripe.subscriptionItems.createUsageRecord()` — this is the **legacy Usage Records API**, which was removed in Stripe API version `2025-03-31`. Since you're starting a new project in 2026, you **must** use the new **Billing Meter API**.

**What changed:**
| Legacy (in spec) | New (required) |
|---|---|
| `subscriptionItems.createUsageRecord()` | `billing.meterEvents.create()` |
| Requires `SubscriptionItem` ID | Uses `stripe_customer_id` directly |
| No event cancellation | Cancel within 24 hours |
| No grace period | 1-hour grace after invoice |
| Lower rate limits | 1,000 events/sec (10K via v2 streams) |

**Fix:** Replace Section 13 billing code with the Meter API. Key concepts:
- **Meters**: Define aggregation (sum/max) over a billing period
- **Meter Events**: Individual usage actions (`link_created`, `view_recorded`)
- **Prices**: Attached to meters, define billing rates

The `usageRecords` DB table and hourly cron approach are still valid — just change the Stripe API calls.

---

### 1.2 CRITICAL: 512MB RAM Insufficient for PDF Rendering

**Impact:** Large PDFs will OOM and crash the server.

The spec sets `memory_mb = 512` in `fly.toml`. Research confirms:
- Node.js heap defaults to ~512MB, leaving **zero headroom** for OS + rendering binary + Sharp/libvips
- A 200-page PDF at 150 DPI can require 2+ GB during rendering
- Multiple concurrent renders multiply the problem
- Sharp (libvips) has a known memory fragmentation issue on Linux/glibc that causes unbounded RSS growth

**Fix:**
```toml
# fly.toml
[[vm]]
  cpu_kind = "shared"
  cpus = 2              # Bump to 2 for concurrent rendering
  memory_mb = 1024      # Minimum 1GB, 2GB recommended
  swap_size_mb = 512    # Add swap as safety valve
```

```dockerfile
# Dockerfile — add jemalloc (CRITICAL for Sharp)
RUN apt-get install -y libjemalloc2
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV NODE_OPTIONS="--max-old-space-size=768"
```

**Why jemalloc matters:** One team reported reducing memory from 400GB to 125GB (68% reduction) across replicas by simply adding jemalloc. Without it, Sharp's memory "leaks" are actually glibc allocator fragmentation.

---

### 1.3 CRITICAL: Thumbnail Generation Code Has a Bug

**Impact:** The thumbnail code in Section 6 will crash at runtime.

```typescript
// BUG: This passes an R2 key string to Sharp, not a buffer
const thumbBuffer = await sharp(pages[0].r2Key) // ← This is a string like "renders/abc/page-1.webp"
  .resize(400)
  .webp({ quality: 75 })
  .toBuffer();
```

Sharp expects a file path or Buffer, not an R2 object key. The page buffer should be cached during rendering or re-fetched from R2.

**Fix:** Cache the first page buffer during the render loop:
```typescript
let firstPageBuffer: Buffer;

for (let i = 1; i <= pdfInfo.pageCount; i++) {
  const result = await converter(i, { responseType: 'buffer' });
  const webpBuffer = await sharp(result.buffer).webp({ quality: 85 }).toBuffer();

  if (i === 1) firstPageBuffer = webpBuffer; // Cache for thumbnail
  // ... rest of upload logic
}

// Generate thumbnail from cached buffer
const thumbBuffer = await sharp(firstPageBuffer)
  .resize(400)
  .webp({ quality: 75 })
  .toBuffer();
```

---

## PART 2: ARCHITECTURAL ISSUES (Should Fix)

### 2.1 Hono Multipart Uploads Load Entire Files Into Memory

**Problem:** Hono's `req.parseBody()` loads entire uploaded files into memory. For a 100MB PDF upload limit, multiple concurrent uploads could consume gigabytes of RAM.

**Better approach: Presigned URL uploads to R2**

Instead of routing files through your API server:
1. Client calls `POST /v1/links/upload-url` → API generates a presigned R2 PUT URL
2. Client uploads directly to R2 using the presigned URL
3. Client calls `POST /v1/links` with the R2 object key to finalize
4. API validates, renders, and creates the link

This eliminates file memory pressure on the API server entirely and is the standard pattern for Cloudflare R2. The spec's `file_url` parameter already supports URL-based intake — extend this pattern.

**Alternative:** Use the `hono-upload` package which uses busboy for streaming uploads if you must receive files server-side.

---

### 2.2 PDF Rendering Should Use Poppler, Not pdf2pic

**Problem:** The spec recommends `pdf2pic` (GraphicsMagick/ImageMagick) with Poppler as fallback. Replace with Poppler (`pdftoppm`) as primary — it's faster, more reliable, and has no heavy dependencies.

| Engine | Speed | Quality | License | Docker Size |
|---|---|---|---|---|
| Poppler (`pdftoppm`) | Fast | Excellent | **GPL 2.0** (safe as subprocess) | Small (~15MB) |
| Ghostscript | Slowest | Good | AGPL 3.0 | Large |
| pdf2pic (GM+GS) | Slow | Good | Mixed | Largest |
| ~~MuPDF (`mutool draw`)~~ | ~~Fastest~~ | ~~Excellent~~ | **AGPL 3.0 — INCOMPATIBLE** | Small |

**IMPORTANT: Do NOT use MuPDF.** MuPDF is licensed under GNU AGPL 3.0. Using it as part of a SaaS requires releasing the **entire application** source under AGPL — this destroys the open-core business model. A commercial license from Artifex exists but pricing is undisclosed and requires sales contact. Poppler via subprocess is the correct choice.

**Fix:** Use Poppler `pdftoppm` as the rendering engine:
```dockerfile
RUN apt-get install -y poppler-utils
# Remove: graphicsmagick (not needed)
# Do NOT use: mupdf-tools (AGPL license)
```

```typescript
// Render with Poppler via child_process
import { execFile } from 'child_process/promises';

async function renderPage(pdfPath: string, page: number, outputDir: string) {
  await execFile('pdftoppm', [
    '-png', '-r', '150',
    '-f', String(page), '-l', String(page),
    '-scale-to-x', '1600', '-scale-to-y', '-1',
    pdfPath, join(outputDir, 'page')
  ]);
}
```

---

### 2.3 Rendering Must Be Async (Background Job Queue)

**Problem:** The spec's rendering pipeline is synchronous — the `POST /v1/links` handler renders all pages before responding. A 50-page PDF at 150 DPI could take 30-60 seconds, which will timeout HTTP connections and block the event loop.

**Fix:** Add a background job system:
1. `POST /v1/links` → validates file, stores in R2, creates link with `status: "processing"`, returns immediately
2. Background worker picks up the job, renders pages, updates `status: "active"`
3. Webhook fires `link.ready` event when rendering completes
4. Viewer shows "Document is being prepared..." if accessed during processing

For MVP, use **BullMQ with Redis** (Fly.io has managed Redis) or even a simple database-backed polling queue. Add a `rendering_jobs` table:

```typescript
export const renderingJobs = sqliteTable('rendering_jobs', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

---

### 2.4 R2 Signed URLs Exposed to Client Are Bearer Tokens

**Problem:** The spec returns signed R2 URLs directly to the viewer frontend. Anyone who intercepts or extracts these URLs from network traffic / DevTools has full access to the page images for 5 minutes.

**Better approach: Worker-based R2 proxy**

Instead of exposing R2 URLs, route image requests through your API or a Cloudflare Worker:

```
Viewer requests page image →
  GET /v1/viewer/:token/pages/:page (with session cookie) →
  API validates session + token →
  API fetches from R2 internally →
  API streams image to client →
  Client renders on canvas
```

The R2 URL **never reaches the browser**. This eliminates the bearer-token problem entirely. The Worker validates the session cookie, so sharing the URL without the cookie yields a 403.

**Trade-off:** Adds latency (~20-50ms) and routes traffic through your API. For MVP, the signed URL approach is acceptable — add this as Phase 2.

---

### 2.5 Missing Concurrency Limits for PDF Rendering

**Problem:** If 10 users upload PDFs simultaneously, 10 concurrent rendering jobs will overwhelm a 1GB machine.

**Fix:** Add bounded concurrency:
```typescript
import pLimit from 'p-limit';

// Max 2 concurrent renders per machine
const renderLimit = pLimit(2);

// Max 3 concurrent Sharp operations per render
const sharpLimit = pLimit(3);

async function renderPdf(fileBuffer: Buffer, linkId: string) {
  return renderLimit(async () => {
    // ... rendering logic with sharpLimit for each page
  });
}
```

---

### 2.6 Missing Session Table in Database Schema

**Problem:** The spec mentions "Session stored in DB (simple sessions table, or use Turso TTL)" for dashboard auth but doesn't include the sessions table in the schema.

**Fix:** Add to schema:
```typescript
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Also add viewer sessions for the email gate
export const viewerSessions = sqliteTable('viewer_sessions', {
  id: text('id').primaryKey(),
  linkId: text('link_id').notNull().references(() => links.id),
  viewerEmail: text('viewer_email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

Add indexes:
```sql
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_viewer_sessions_token ON viewer_sessions(token);
```

---

### 2.7 Viewer Verify Endpoint Needs Rate Limiting

**Problem:** `POST /v1/viewer/:token/verify` accepts email + password with no rate limiting. This is a brute-force vector for:
- Guessing which email domains are allowed
- Brute-forcing link passwords
- Email enumeration

**Fix:** Add per-IP rate limiting specifically on this endpoint:
```typescript
// 5 attempts per IP per link per 15 minutes
app.post('/v1/viewer/:token/verify', rateLimitByIp({ max: 5, window: '15m' }), handler);
```

---

## PART 3: COMPETITIVE INTELLIGENCE (Informing Improvements)

### Market Position Map

```
                    SECURITY STRENGTH
                         HIGH
                          |
           Locklizard     |    Digify ($130-480/mo)
           ShareFile      |
                          |
    GUI-FIRST --------+------------ API-FIRST
                          |
           DocSend ($65)  |    [CLOAK] ($29-299/mo)
           Papermark($39) |
           Ellty ($29)    |
                          |
                         LOW
```

**Cloak targets the empty HIGH SECURITY + API-FIRST quadrant.**

### Key Competitor Weaknesses Cloak Should Exploit

| Competitor | #1 Weakness | Cloak Advantage |
|---|---|---|
| **DocSend** | $65/user/mo per-seat pricing (most complained about) | Per-account pricing, 3x cheaper for teams |
| **DocSend** | No real API for programmatic link creation | API-first from day one |
| **Digify** | $130-480/mo enterprise pricing | $29/mo entry with same security features |
| **Papermark** | Client-side PDF rendering (PDFs delivered to browser) | Server-side image rendering (no raw files in browser) |
| **Papermark** | No watermarking, no DRM | Dynamic watermarking on all tiers |
| **All competitors** | GUI-first, API bolted on | API-first, dashboard for management |

### DocSend's Top Complaints (Direct Opportunities)

1. **Too expensive** (18+ G2 mentions) → Cloak: $29 vs $65/user
2. **No free plan** → Cloak: 50 links/mo free
3. **No real API** → Cloak: API-first
4. **Poor data export** → Cloak: webhooks + full API access to analytics
5. **Clunky interface** → Cloak: Clean dashboard, but market the API
6. **Firewall blocking** → Cloak: Cloudflare CDN (rarely blocked)

---

## PART 4: PRICING & FREE TIER IMPROVEMENTS

### Current Pricing Assessment: Well-Calibrated

The $29/$99/$299 tiers are competitive:
- **$29 Starter** undercuts DocSend ($65/user) by 55% and matches Ellty ($29)
- **$99 Growth** slots below Digify ($130) and DocSend Advanced ($150)
- **$299 Scale** matches DocSend Data Rooms ($300 for 3 users) with more generous limits

**Per-account (not per-seat) pricing is a massive advantage.** A 5-person sales team on DocSend Standard = $325/mo. On Cloak Growth = $99/mo. Hammer this in marketing.

### Recommended Pricing Additions

**1. Add annual billing with 20% discount:**
- Starter: $23/mo billed annually ($278/year)
- Growth: $79/mo billed annually ($948/year)
- Scale: $239/mo billed annually ($2,868/year)

**2. Consider a $9-15/mo "Hobby" tier:**
Between free and Starter for solo developers who need 100-200 links/mo without team features. Captures the long tail and reduces free → $29 pricing gap.

**3. Add spending caps on metered overages:**
Developers fear runaway bills. Allow users to set a monthly overage cap (e.g., "don't charge me more than $20 in overages"). This is a trust signal.

### Free Tier Improvements

50 links/month is the right number. But gate these features to create natural upgrade triggers:

| Feature | Free | Starter ($29) | Growth ($99) | Scale ($299) |
|---|---|---|---|---|
| Links/month | 50 | 500 | 2,500 | 10,000 |
| Views/month | 500 | 5,000 | 25,000 | 100,000 |
| **Max link expiry** | **7 days** | 90 days | 1 year | Unlimited |
| **Webhooks** | **No** | Yes | Yes | Yes |
| **Per-page analytics** | **No** | Yes | Yes | Yes |
| Geo/device analytics | No | Basic | Full | Full |
| Custom branding | No | No | Yes | Yes |
| Custom domains | No | No | Yes | Yes |
| Embeddable viewer | No | No | Yes | Yes |
| "Secured by Cloak" badge | Yes | Removable | No | No |
| **Password protection** | **No** | Yes | Yes | Yes |
| API rate limit | 10 req/min | 60 req/min | 300 req/min | 1000 req/min |

**Rationale for gating:**
- **7-day max expiry on free**: Creates urgency; real use cases need longer-lived links
- **No webhooks on free**: This is the strongest developer upgrade trigger
- **No per-page analytics on free**: Show total views only; gate the valuable data
- **No password protection on free**: Required for serious use cases

---

## PART 5: SECURITY IMPROVEMENTS

### What Actually Works vs Security Theater

Based on deep research into browser-level document protection:

| Technique | In Spec? | Verdict | Action |
|---|---|---|---|
| Canvas rendering (no DOM text) | Yes | **Works** — good deterrent | Keep |
| Disable right-click | Yes | **Theater** — trivially bypassed | Keep (low effort, stops casual users) |
| Disable Ctrl+S/P/C | Yes | **Theater** — bypassed via DevTools | Keep (low effort) |
| Disable text selection | Yes | **Theater** — bypassed via DevTools | Keep |
| `@media print { display: none }` | Mentioned but not in code | **Works** — blocks Print-to-PDF | **ADD** |
| Visibility API (blur on tab switch) | Mentioned as optional | **Theater** — doesn't fire for screenshots | Skip for MVP |
| Dynamic visible watermark | Yes | **Actually works** — best practical deterrent | Keep, enhance |
| Short-lived signed URLs | Yes (5 min) | **Works** — standard practice | Keep |
| Forensic invisible watermark | No | **Actually works** — traces leaks | Add to Phase 2 roadmap |
| Worker-based R2 proxy | No | **Works** — eliminates URL sharing | Add to Phase 2 |

### Recommended Security Additions

**1. Add `@media print` CSS (Trivial, do in MVP):**
```css
@media print {
  body { display: none !important; }
  html::after {
    content: "Printing is disabled for this document.";
    display: block;
    text-align: center;
    padding: 50px;
    font-size: 24px;
  }
}
```

**2. Add `Permissions-Policy: display-capture=()` header:**
Blocks the Screen Capture API (`getDisplayMedia()`) in iframes. Won't stop OS-level capture but blocks browser-based screen sharing recording.

**3. Enhance watermark with unique session ID:**
Change watermark template default from `{{email}} · {{date}}` to:
```
{{email}} · {{date}} · {{session_short_id}}
```
The short session ID (6 chars) makes each viewing session uniquely traceable even in screenshots.

**4. Add forensic watermarking to Phase 2 roadmap:**
Invisible frequency-domain watermarks that survive screenshots. Use Steg.AI or IMATAG APIs rather than building in-house. This is the single most impactful security investment after MVP.

### Honest Security Philosophy (Add to Spec)

> **Cloak's security philosophy:** It is fundamentally impossible to prevent a determined user from capturing what their screen displays. Cloak focuses on **deterrence and traceability**, not impenetrable vaults. We make casual sharing inconvenient, every view traceable, and every leak identifiable. This is the same philosophy used by DocSend, Google Docs, and every successful document protection product.

---

## PART 6: TECHNICAL STACK IMPROVEMENTS

### 6.1 Turso Assessment: Valid for MVP, Plan Migration Path

Turso + Drizzle is sound for the MVP. Key considerations:

**Strengths:**
- Free tier: 3 DBs, 1 GB (Developer: $4.99/mo, 9 GB, 1B reads)
- Sub-10ms read latency from edge
- Drizzle ORM has first-class Turso support

**Risks:**
- Single-writer bottleneck (SQLite limitation). `BEGIN CONCURRENT` exists but is experimental.
- Write latency: 20-100ms depending on primary region distance
- If you need complex queries (CTEs, window functions), Postgres is better

**Recommendation:** Keep Turso for MVP. Set a migration trigger: if you hit 50+ concurrent writes/sec or need Postgres-specific features, migrate to **Neon Postgres**. Drizzle supports both, so the migration is schema + dialect translation, not a full rewrite.

### 6.2 DPI and Image Format: Spec is Correct

- **150 DPI is sufficient for web viewing.** Screens display at 72-96 PPI; 150 DPI provides ~2x resolution, sharp on Retina displays.
- **WebP is the right choice.** 95.3% browser support, 25-34% smaller than JPEG, fast encoding.
- **AVIF is 20-30% smaller but 3-10x slower to encode.** Not worth it for real-time rendering. Consider AVIF as a Phase 2 optimization with pre-rendering.

### 6.3 Fly.io Cold Start Warning

Scale-to-zero cold starts are ~5 seconds. This is **unacceptable for the viewer endpoint** — a recipient clicking a shared link should not wait 5 seconds for a blank page.

**Fix:** Set `min_machines_running = 1` in production. Cost: ~$5-7/mo for a 1GB machine. Worth it for UX.

```toml
[http_service]
  min_machines_running = 1    # Changed from 0 — never cold-start for viewers
```

---

## PART 7: SPEC GAPS (Missing Sections)

### 7.1 GDPR/CCPA Compliance (ADD)

The spec collects PII (emails, IPs, geo data, viewing behavior). This requires:
- Privacy policy covering data collection in the viewer
- Data retention policy (how long are view records kept?)
- Data deletion API (GDPR right to erasure: `DELETE /v1/viewers/:email`)
- Cookie consent for the viewer (if using cookies for sessions)
- Data processing agreement (DPA) template for enterprise customers

### 7.2 Error Recovery for Failed Renders (ADD)

What happens when rendering fails mid-way (e.g., corrupted PDF, OOM on page 30 of 50)?
- Partial renders should be cleaned up from R2
- Link status should be set to `"failed"` (add this status)
- User should be notified (webhook: `link.render_failed`)
- Retry logic: auto-retry once, then notify user

Add `status: "failed"` and `"processing"` to the link status enum:
```
status: active | processing | failed | revoked | expired
```

### 7.3 API Versioning Strategy (ADD)

The spec uses `/v1/` prefix but doesn't discuss:
- When will `/v2/` be introduced?
- How will breaking changes be communicated?
- Deprecation timeline for old versions

**Recommendation:** Add a header `X-Cloak-API-Version: 2026-02-28` (date-based, like Stripe) for fine-grained versioning within `/v1/`.

### 7.4 Observability & Monitoring (ADD)

No mention of:
- Structured logging (use Pino with Hono)
- Error tracking (Sentry)
- Uptime monitoring (BetterStack / UptimeRobot)
- Performance metrics (render time, response latency)
- Usage dashboards (Grafana or simple internal dashboard)

### 7.5 OpenAPI Specification (ADD)

The spec describes APIs in markdown but doesn't mention generating an OpenAPI spec file. This is critical for:
- Auto-generating SDKs (Phase 2)
- API documentation site (Scalar/Redoc, mentioned in Phase 2)
- Client validation
- Integration testing

**Recommendation:** Use `@hono/zod-openapi` to define routes with Zod schemas that auto-generate the OpenAPI spec.

### 7.6 Accessibility (WCAG) for Viewer (ADD)

The canvas-based viewer is inherently inaccessible (no screen reader support, no keyboard navigation described). This matters for:
- Legal compliance (ADA, Section 508)
- Enterprise customers (often require accessibility audits)

**MVP minimum:**
- Keyboard navigation (arrow keys for pages, Enter to submit email)
- ARIA labels on interactive elements
- High-contrast mode for email gate
- Alt text on canvas element describing the document

### 7.7 CORS Configuration for R2 (ADD)

The spec mentions R2 CORS in passing (Section 14) but doesn't include it in the setup instructions. Add explicit CORS config:

```json
[
  {
    "AllowedOrigins": ["https://view.cloakshare.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

**Important:** After adding CORS to a bucket with a custom domain, purge CDN cache — existing cached assets won't include CORS headers.

---

## PART 8: MARKETING & POSITIONING RECOMMENDATIONS

### Lead with API, Not Dashboard

Research confirms: no competitor in this space is API-first. This is Cloak's superpower.

**Homepage hero should be a curl command, not a dashboard screenshot:**
```bash
curl -X POST https://api.cloakshare.dev/v1/links \
  -H "Authorization: Bearer ck_live_xxx" \
  -F "file=@proposal.pdf" \
  -F "expires_in=72h" \
  -F "watermark=true"

# Returns: { "secure_url": "https://view.cloakshare.dev/s/abc123" }
```

### Positioning Statement

> **Cloak is the Stripe of secure document sharing.**
> One API call to turn any document into a tracked, watermarked, expiring link.
> No GUI required. No per-seat pricing. No enterprise sales call.

### Go-to-Market Sequence

**Phase 1 (Launch):**
- API docs as homepage hero
- "Try in 30 seconds" sandbox (5 free links, no signup)
- Launch on Hacker News, Dev.to, Indie Hackers
- Target: individual developers building SaaS products

**Phase 2 (Growth):**
- SDKs (Node, Python) generated from OpenAPI spec
- Developer content marketing (tutorials, integration guides)
- Target: sales-tech companies embedding Cloak in their products

**Phase 3 (Expansion):**
- Enterprise features (SSO, audit logs, data rooms)
- Sales-assisted motion for $299/mo+ deals
- CRM integrations (Salesforce, HubSpot)

---

## PART 9: ADDITIONAL WEBHOOK EVENTS (ADD)

The spec's webhook events are good but incomplete. Add:

| Event | Trigger | Why |
|---|---|---|
| `link.created` | New link created | So users can track link creation from multiple API keys |
| `link.ready` | Rendering completed | Critical for async rendering flow |
| `link.render_failed` | Rendering failed | Error notification |
| `link.max_views_reached` | Already in spec | Good |
| `link.password_attempt_failed` | Wrong password entered | Security monitoring |

---

## PART 10: DATABASE SCHEMA IMPROVEMENTS

### Add Missing Indexes

```sql
-- Composite index for usage enforcement queries
CREATE INDEX idx_links_user_status_created ON links(user_id, status, created_at);

-- For finding expired links efficiently
CREATE INDEX idx_links_expires_at ON links(expires_at) WHERE expires_at IS NOT NULL;

-- For webhook retry queue
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(next_retry_at)
  WHERE delivered_at IS NULL AND failed_at IS NULL;

-- For viewer session lookup
CREATE INDEX idx_views_session ON views(session_token);
```

### Add `status` Values Documentation

```typescript
// Link statuses (document in spec):
// processing - file uploaded, rendering in progress
// active     - rendered and viewable
// expired    - past expires_at or max_views reached
// revoked    - manually revoked by owner
// failed     - rendering failed
```

### Add `users` Table Missing Fields

The `users` table needs fields referenced in billing code but not in schema:
```typescript
export const users = sqliteTable('users', {
  // ... existing fields ...
  stripeLinkMeteredItemId: text('stripe_link_metered_item_id'),
  stripeViewMeteredItemId: text('stripe_view_metered_item_id'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  emailVerifiedAt: text('email_verified_at'),
});
```

---

## PART 11: BUILD PHASE ADJUSTMENTS

### Week 1 Additions
```
  ☐ Set up background job queue for async rendering
  ☐ Add presigned URL upload flow (client → R2 direct)
  ☐ Configure jemalloc in Dockerfile
  ☐ Set up Pino structured logging
```

### Week 3 Additions
```
  ☐ Add rate limiting on viewer verify endpoint
  ☐ Add @media print CSS protection
  ☐ Add Permissions-Policy headers
```

### Week 5 Adjustments
```
  ☐ Use Stripe Billing Meter API (NOT legacy Usage Records)
  ☐ Add spending cap configuration for metered overages
  ☐ Add annual billing option
```

---

## APPENDIX: RESEARCH SOURCES

### Competitive Intelligence
- DocSend: $10-65/user/mo, no API for link creation, acquired by Dropbox for $165M
- Digify: $130-480/mo, closest competitor, has API but GUI-first
- Papermark: Open-source, $900K ARR, weak security (client-side rendering)
- PandaDoc: Tangential (e-signatures focus), $19-49/user/mo
- ShareFile: Enterprise ($10-25/user/mo), dynamic watermarking

### Technical Validation
- Hono: Production-ready, but multipart uploads load files into memory
- Turso: Viable for MVP, single-writer bottleneck for heavy writes
- Poppler: Correct choice for rendering (MuPDF is faster but AGPL-licensed — incompatible with open-core)
- Sharp + jemalloc: Must-have for production memory stability
- R2 signed URLs: Standard S3 SigV4, 5-min expiry is correct
- Stripe Billing Meter API: Required for new projects (legacy deprecated)

### Security Research
- Canvas rendering: Good deterrent, does not stop screenshots (nothing does)
- Dynamic watermarking: Best practical deterrent against sharing
- Forensic watermarking: Can survive screenshots (frequency-domain techniques)
- Google Docs copy protection: Trivially bypassed — they accept this tradeoff
- DocSend security: Server-side rendering + dynamic watermarks + audit trail

---

---

## PART 12: ADDENDUM REVIEW (Open-Core Model & Marketing Site)

The addendum (`CLOAK-SPEC-ADDENDUM.md`) is **excellent** — the Supabase-style open-core model is the right call and the marketing site spec is thorough. A few improvements:

### 12.1 Open-Core Feature Gating: Adjust the Line

The current split gates webhooks, analytics dashboard, and embed viewer as cloud-only. This is mostly right, but consider:

**Move webhooks to self-hosted (basic mode):**
- A single-endpoint, no-retry webhook is trivial to implement and massively increases the value of self-hosted Cloak
- Cloud differentiator becomes: **webhooks with retries, delivery logs, and multiple endpoints** — not webhooks at all
- This follows the Supabase pattern: basic feature is open-source, reliability/scale is paid

**Keep embed viewer as cloud-only:** This is a natural enterprise upsell and adds significant complexity (PostMessage API, CORS headers, security headers per customer). Good cloud differentiator.

### 12.2 Docker Compose: Add Health Checks

The docker-compose.yml should include a health check so orchestrators know when Cloak is ready:

```yaml
services:
  cloak:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

Add a `/health` endpoint to the API:
```typescript
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));
```

### 12.3 Self-Hosted Mode: Add S3-Compatible Storage

The config shows `'local' | 'r2' | 's3'` but only implements `LocalStorage` and `R2Storage`. Since R2 is S3-compatible, the `R2Storage` class should be renamed `S3Storage` and work with any S3-compatible endpoint (MinIO, Backblaze B2, AWS S3, R2):

```typescript
class S3Storage implements StorageProvider {
  constructor(private config: {
    endpoint: string;      // R2, MinIO, S3, etc.
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }) {}
  // Same implementation, works with any S3-compatible service
}
```

This makes self-hosted users happy (they can use MinIO or Backblaze) and reduces code duplication.

### 12.4 Marketing Site: Additional Comparison Page

Add `/compare/google-docs` — this is a high-traffic search term. Many people searching "Google Docs secure sharing" or "prevent copying Google Docs" are exactly Cloak's target audience. The pitch: "Google Docs copy protection is trivially bypassed. Cloak renders documents as watermarked images on canvas — no text in the DOM, no raw file in the browser."

### 12.5 Marketing Site: Add /security Page Content Spec

The addendum lists `/security` as a page but doesn't spec its content. This page is critical for enterprise buyers. Include:

```
/security page structure:
  - Encryption: AES-256 at rest, TLS 1.3 in transit
  - Architecture: documents rendered server-side, never delivered as raw files
  - Access controls: email gate, domain restrictions, password protection, expiry
  - Watermarking: dynamic per-viewer watermarks on every page
  - Audit trail: full view history with geo, device, duration
  - Infrastructure: Cloudflare CDN, Fly.io (SOC 2 compliant)
  - Data residency: configurable (US, EU)
  - Compliance: GDPR, CCPA (link to DPA)
  - Penetration testing: annual (planned)
  - Responsible disclosure: security@cloakshare.dev
```

### 12.6 Build Order Adjustment for Open-Core

The revised build order in the addendum puts self-hostable mode first (Weeks 1-2), which is smart — it means the GitHub repo works from day one. But adjust:

- **Week 1-2 should also include the `/health` endpoint and basic error handling** — self-hosters will need these immediately
- **The rendering job queue should be in Week 1-2**, not just cloud — self-hosted users also need async rendering for large PDFs
- **Add `CONTRIBUTING.md` to Week 1-2** rather than Week 8 — early contributors need guidance from the start

### 12.7 Addendum: Missing `apps/web` in pnpm-workspace.yaml

The addendum updates the project structure to include `apps/web` (Astro marketing site) but doesn't update `pnpm-workspace.yaml`. Ensure it includes:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## SUMMARY: PRIORITY-ORDERED ACTION ITEMS

### Before You Write Any Code (Critical)
1. Fix Stripe billing to use Meter API (legacy is deprecated)
2. Bump Fly.io VM to 1024MB+ with jemalloc
3. Fix thumbnail generation bug in renderer
4. Add `sessions` and `viewerSessions` tables to DB schema
5. Add `processing` and `failed` to link status enum

### During Week 1 Build
6. Use Poppler pdftoppm instead of pdf2pic for rendering (NOT MuPDF — AGPL license)
7. Add background job queue for async rendering
8. Add presigned URL upload flow (client → R2 direct)
9. Add concurrency limits (2 renders, 3 Sharp ops)
10. Add `/health` endpoint
11. Set `min_machines_running = 1` in fly.toml

### During Week 2-3 Build
12. Add rate limiting on viewer verify endpoint
13. Add `@media print { display: none }` CSS
14. Add `Permissions-Policy: display-capture=()` header
15. Add session ID to watermark template
16. Add R2 CORS configuration
17. Add missing user table fields for Stripe metered billing

### Before Launch
18. Add GDPR/CCPA compliance (privacy policy, data deletion API)
19. Add OpenAPI spec generation with `@hono/zod-openapi`
20. Add structured logging (Pino)
21. Add error tracking (Sentry)
22. Add API versioning header strategy
23. Add annual billing option (20% discount)
24. Write the `/security` page content
25. Add basic accessibility to the viewer (keyboard nav, ARIA labels)
26. Implement demo API key infrastructure with abuse prevention
27. Build SSE progress endpoint for async rendering
28. Add content-type validation (magic bytes, not just extension) on demo uploads

---

## PART 13: ADDENDUM 2 REVIEW (Live Demo & Interactive Tutorial)

The live demo concept is **brilliant** — "the marketing site is Cloak's first customer" is exactly the right framing. Dog-fooding the API as the demo AND continuous integration testing is elegant. A few refinements:

### 13.1 Demo SSE + Sync API: Clarify the Default

The addendum proposes `?async=true` for async mode and sync as default. This is correct for the public API. However, there's a subtle issue: **the sync mode will timeout for large PDFs**.

Fly.io's default HTTP timeout is 60 seconds. A 50-page PDF could take 30-60 seconds to render. If the user's HTTP client has a shorter timeout (common: 30s), they get a timeout error even though rendering succeeds.

**Recommendation:** Make async the internal default for the rendering pipeline. The sync API endpoint should:
1. Start rendering in background (same as async)
2. Long-poll internally, checking render status every 500ms
3. Return 201 when complete, or 202 with `progress_url` if rendering exceeds 30 seconds
4. Set `X-Cloak-Render-Time` response header so developers can see timing

This gives developers the simplicity of sync with the reliability of async as a fallback.

### 13.2 Demo Abuse Prevention: Add CAPTCHA Threshold

The per-IP rate limit (5 links/hour) is good but insufficient against motivated abuse. Attackers can rotate IPs. Add:

- **First 2 demo links per IP**: No CAPTCHA
- **Links 3-5 per IP per hour**: Show Cloudflare Turnstile CAPTCHA (free, privacy-preserving)
- **After 5 per IP per hour**: Hard block with signup CTA

Cloudflare Turnstile is the right choice here because the marketing site is already on Cloudflare Pages. It's free, invisible when possible, and doesn't sell user data.

```typescript
// Demo middleware enhancement
async function demoRateLimit(c, next) {
  const ip = getClientIp(c);
  const count = await getDemoCount(ip);

  if (count >= 5) {
    return c.json({ error: { code: 'DEMO_RATE_LIMIT', ... } }, 429);
  }

  if (count >= 2) {
    // Require Turnstile token for requests 3-5
    const turnstileToken = c.req.header('X-Turnstile-Token');
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return c.json({ error: { code: 'CAPTCHA_REQUIRED', ... } }, 403);
    }
  }

  await next();
}
```

### 13.3 Demo Content Security: PDF Malware Risk

The demo accepts arbitrary PDF uploads from anonymous visitors. PDFs can contain:
- Embedded JavaScript (PDF spec allows it)
- Form actions that exfiltrate data
- Malicious font files
- Exploit payloads targeting rendering engines

The spec mentions ClamAV as "optional later." For a public demo that processes arbitrary uploads, this is **not optional** — it should be in the MVP.

**Lightweight alternative to ClamAV (for MVP):**
- Validate PDF magic bytes (`%PDF-` header)
- Check file size strictly (20MB cap is good)
- Reject PDFs with embedded JavaScript via a binary scan for `/JS` and `/JavaScript` markers
- The rendering pipeline itself (PDF → PNG via pdftoppm → WebP via Sharp) is the sanitization — no executable content survives rasterization

```typescript
function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-';
}

function hasEmbeddedJS(buffer: Buffer): boolean {
  const content = buffer.toString('binary');
  return content.includes('/JS') || content.includes('/JavaScript');
}
```

### 13.4 Sample Documents: Add Legal Disclaimer

The sample PDFs contain fake company names and data. Add a footer to each page: *"This is a sample document created for demonstration purposes. All names, data, and figures are fictitious."*

This prevents anyone from screenshotting the demo and passing the sample content off as real (unlikely, but covers liability).

### 13.5 Health Check: Don't Use the Demo Key

The health check in Section 11 should use a dedicated `ck_healthcheck_xxx` key (separate from the demo key) with its own user. Reasons:
- Demo key rate limits could block health checks during traffic spikes
- Health check views shouldn't pollute demo analytics
- Easier to filter health check traffic in logs

### 13.6 SSE Progress: Add Timeout and Connection Limits

The SSE endpoint polls every 300ms indefinitely. Add safeguards:

```typescript
app.get('/v1/links/:id/progress', async (c) => {
  return streamSSE(c, async (stream) => {
    const maxDuration = 120_000; // 2 minute max SSE connection
    const startTime = Date.now();

    while (Date.now() - startTime < maxDuration) {
      const progress = await getRenderProgress(linkId);
      await stream.writeSSE({ event: 'progress', data: JSON.stringify(progress) });

      if (progress.status === 'complete' || progress.status === 'failed') break;
      await stream.sleep(500); // 500ms is fine, 300ms is aggressive
    }

    // If we hit timeout, send a timeout event
    if (Date.now() - startTime >= maxDuration) {
      await stream.writeSSE({
        event: 'timeout',
        data: JSON.stringify({ message: 'Rendering is taking longer than expected. Check status via GET /v1/links/:id' }),
      });
    }
  });
});
```

Also limit concurrent SSE connections per IP (e.g., max 3) to prevent connection exhaustion attacks.

### 13.7 CodeMirror vs Shiki: Consider Static Highlighting

The tutorial spec suggests CodeMirror 6 for the code editor. For the non-editable language tabs (Node.js, Python, Go), full CodeMirror is overkill — use **Shiki** (Astro's built-in syntax highlighter) for static code blocks and only load CodeMirror for the editable cURL tab.

This saves ~200KB of JavaScript for visitors who never edit code.

### 13.8 The "Holy Shit" Moment: Add Timing

The analytics panel that updates live is the key conversion moment. Enhance it:

- Show a **visible counter** ticking up for "time viewing" while the viewer tab is open
- Add a subtle **"Live"** badge with a pulsing dot when tracking data is flowing in
- When the viewer closes, show a **"View session ended"** event with a summary
- Add a **"This took you X seconds to see. Your recipients get this in real-time."** message

### 13.9 Week 7 Scope: Definitely Split Into Two Weeks

The addendum correctly notes "This is a lot for one week." It is — the demo alone (SSE endpoint, progress tracking, abuse prevention, sample docs, analytics polling, cleanup jobs) is a full week of work. Split:

- **Week 7:** Marketing site (static pages) + demo component (upload → progress → result → viewer)
- **Week 8:** Developer tutorial (CodeMirror editor, language tabs, run button) + comparison pages + launch prep
- **Week 9:** GitHub open source + launch (Product Hunt, HN, blog post)

Adding a 9th week is more realistic than cramming everything into 8.

---

*This review is based on web research conducted February 2026. Verify vendor pricing and API availability before implementation.*
