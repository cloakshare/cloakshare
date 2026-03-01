# CLOAK — Secure Content Delivery API
## Claude Code Build Specification v1.0

> **What this is:** A complete build spec for an MVP that turns any document into a tracked, watermarked, expiring secure link via API. This spec is designed to be fed directly to Claude Code for implementation.

---

## TABLE OF CONTENTS

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Specification](#5-api-specification)
6. [Document Rendering Pipeline](#6-document-rendering-pipeline)
7. [Secure Viewer](#7-secure-viewer)
8. [Authentication & API Keys](#8-authentication--api-keys)
9. [Webhook System](#9-webhook-system)
10. [Analytics & Tracking](#10-analytics--tracking)
11. [Custom Domains](#11-custom-domains)
12. [Embedded Viewer (iframe)](#12-embedded-viewer-iframe)
13. [Billing Integration](#13-billing-integration)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Build Phases](#15-build-phases)
16. [Environment Variables](#16-environment-variables)
17. [Testing Strategy](#17-testing-strategy)

---

## 1. PRODUCT OVERVIEW

### What Cloak Does
1. Developer calls `POST /v1/links` with a file (upload or URL)
2. Cloak renders the document into secure page images (WebP)
3. Cloak returns a `secure_url` — a tokenized link to the viewer
4. Recipient clicks the link → email gate → sees content in a secure browser viewer
5. Every view is tracked (who, when, where, how long per page)
6. Developer gets webhooks and analytics

### MVP Scope (Phase 1 — what to build first)
- REST API with API key auth
- File upload (PDF only to start, then images)
- Document rendering (PDF → page images via pdf-to-img or similar)
- Secure viewer (email gate, canvas-based rendering, dynamic watermark)
- Link management (create, list, revoke, get analytics)
- View tracking (viewer email, IP, user agent, time per page, geo)
- Webhook on view events
- Dashboard (simple web UI for managing links and viewing analytics)
- Stripe billing (free tier + paid tiers with metered usage)
- Custom domain support
- Embeddable viewer (iframe mode)

### What is NOT in MVP
- Video support (Phase 2 — Cloudflare Stream integration)
- Office doc support (XLSX, PPTX — Phase 2, add LibreOffice rendering)
- BYO storage (Phase 3 — S3 connector)
- AI analytics / engagement scoring (Phase 3)
- SDKs (Phase 2 — generate from OpenAPI spec)
- CLI tool (Phase 3)
- Team/org accounts (Phase 2)
- SSO (Phase 3)

---

## 2. TECH STACK

### API Server
- **Runtime:** Node.js 20+
- **Framework:** Hono (lightweight, fast, runs everywhere)
- **Why Hono:** Runs on Cloudflare Workers, Node.js, Bun, Deno. Lets us start on a VPS and migrate to edge later without rewriting.

### Database
- **Primary:** SQLite via Turso (libSQL)
- **Why Turso:** Free tier (500 DBs, 9 GB storage, 500M rows read/mo), edge replicas later, embedded SQLite for local dev
- **ORM:** Drizzle ORM (type-safe, lightweight, SQLite-native)

### Object Storage
- **Provider:** Cloudflare R2
- **Why:** Zero egress fees. S3-compatible API. 10 GB free tier. Auto-CDN via Cloudflare network.
- **SDK:** `@aws-sdk/client-s3` (R2 is S3-compatible)

### Document Rendering
- **PDF → Images:** `pdf-img-convert` (uses pdfjs-dist under the hood) OR `pdf2pic` (uses GraphicsMagick/ImageMagick)
- **Image processing:** `sharp` (resize, convert to WebP, overlay watermark)
- **Fallback for complex PDFs:** `pdftoppm` (Poppler command-line tool, very reliable)
- **Strategy:** Convert each PDF page to a WebP image at 150 DPI. Store in R2. Viewer loads images, not PDF.

### Secure Viewer (Frontend)
- **Framework:** Vanilla JS + HTML (no framework needed — keep it tiny and fast)
- **Hosting:** Cloudflare Pages (free, global CDN, custom domain support)
- **Rendering:** HTML Canvas — draw page images onto canvas, overlay watermark text. Canvas prevents simple right-click-save of clean images.
- **Bundler:** Vite (fast, simple)

### Dashboard (Admin Frontend)
- **Framework:** React + Vite
- **UI:** Tailwind CSS + shadcn/ui components
- **Hosting:** Same Cloudflare Pages project, different route (`/dashboard`)
- **Auth:** Cookie-based sessions (API issues session cookie on login)

### Billing
- **Provider:** Stripe
- **Model:** Stripe Subscriptions + Stripe Metered Billing (Usage Records API)
- **How:** Report link creation and view events as usage records. Stripe calculates overages on invoices.

### Email
- **Transactional email:** Resend (free tier: 3,000 emails/mo)
- **Use cases:** Email verification codes for viewer gate, webhook failure alerts, usage alerts

### Deployment
- **API Server:** Fly.io (Docker container, scale-to-zero available)
- **Viewer + Dashboard:** Cloudflare Pages
- **Database:** Turso (hosted)
- **Storage:** Cloudflare R2 (hosted)

---

## 3. PROJECT STRUCTURE

```
cloak/
├── apps/
│   ├── api/                    # Hono API server
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point, Hono app setup
│   │   │   ├── routes/
│   │   │   │   ├── links.ts    # POST/GET/DELETE /v1/links
│   │   │   │   ├── views.ts    # View validation & tracking endpoints
│   │   │   │   ├── webhooks.ts # Webhook management
│   │   │   │   ├── analytics.ts# Analytics endpoints
│   │   │   │   ├── auth.ts     # Login, register, API key management
│   │   │   │   ├── billing.ts  # Stripe webhook handler, usage endpoints
│   │   │   │   └── domains.ts  # Custom domain management
│   │   │   ├── middleware/
│   │   │   │   ├── apiKey.ts   # API key authentication
│   │   │   │   ├── session.ts  # Dashboard session auth
│   │   │   │   ├── rateLimit.ts# Rate limiting
│   │   │   │   └── usage.ts    # Usage tracking & limit enforcement
│   │   │   ├── services/
│   │   │   │   ├── renderer.ts # PDF → image rendering pipeline
│   │   │   │   ├── storage.ts  # R2 upload/download/delete
│   │   │   │   ├── watermark.ts# Watermark image generation
│   │   │   │   ├── webhook.ts  # Webhook dispatch with retries
│   │   │   │   ├── email.ts    # Resend email service
│   │   │   │   ├── geo.ts      # IP → geo lookup
│   │   │   │   ├── billing.ts  # Stripe integration
│   │   │   │   └── tokens.ts   # Secure token generation/validation
│   │   │   ├── db/
│   │   │   │   ├── schema.ts   # Drizzle schema definitions
│   │   │   │   ├── migrate.ts  # Migration runner
│   │   │   │   └── client.ts   # Turso client setup
│   │   │   └── lib/
│   │   │       ├── config.ts   # Environment config
│   │   │       ├── errors.ts   # Error types & handlers
│   │   │       └── utils.ts    # Shared utilities
│   │   ├── Dockerfile
│   │   ├── fly.toml
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── viewer/                 # Secure viewer + dashboard
│       ├── src/
│       │   ├── viewer/         # Public secure viewer (vanilla JS)
│       │   │   ├── index.html  # Viewer page
│       │   │   ├── viewer.ts   # Canvas renderer, watermark overlay
│       │   │   ├── gate.ts     # Email gate UI & verification
│       │   │   ├── tracking.ts # Client-side time tracking
│       │   │   └── styles.css  # Viewer styles
│       │   └── dashboard/      # Admin dashboard (React)
│       │       ├── App.tsx
│       │       ├── pages/
│       │       │   ├── Links.tsx
│       │       │   ├── LinkDetail.tsx
│       │       │   ├── Analytics.tsx
│       │       │   ├── Settings.tsx
│       │       │   ├── Billing.tsx
│       │       │   ├── Domains.tsx
│       │       │   └── ApiKeys.tsx
│       │       └── components/
│       │           ├── Layout.tsx
│       │           ├── LinkCard.tsx
│       │           ├── ViewerTimeline.tsx
│       │           └── UsageChart.tsx
│       ├── vite.config.ts
│       ├── package.json
│       └── wrangler.toml       # Cloudflare Pages config
│
├── packages/
│   └── shared/                 # Shared types & utilities
│       ├── types.ts            # API types, shared interfaces
│       └── constants.ts        # Shared constants
│
├── package.json                # Workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo config (build orchestration)
└── README.md
```

---

## 4. DATABASE SCHEMA

Using Drizzle ORM with Turso (SQLite).

```typescript
// apps/api/src/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// USERS & AUTH
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                    // nanoid
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull().default('free'),   // free | starter | growth | scale
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),                    // nanoid
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),                   // "Production", "Test", etc.
  keyHash: text('key_hash').notNull(),            // SHA-256 hash of the key
  keyPrefix: text('key_prefix').notNull(),        // First 8 chars for display: "ck_live_a1b2..."
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text('revoked_at'),                  // Soft delete
});

// ============================================
// LINKS
// ============================================

export const links = sqliteTable('links', {
  id: text('id').primaryKey(),                    // nanoid (used in secure URL token)
  userId: text('user_id').notNull().references(() => users.id),
  
  // Source file info
  originalFilename: text('original_filename'),
  fileType: text('file_type').notNull(),          // pdf | png | jpg | webp
  fileSize: integer('file_size'),                 // bytes
  pageCount: integer('page_count'),
  
  // Rendered content location in R2
  r2Prefix: text('r2_prefix').notNull(),          // "renders/{linkId}/"
  
  // Security rules
  expiresAt: text('expires_at'),                  // ISO timestamp, null = never
  maxViews: integer('max_views'),                 // null = unlimited
  requireEmail: integer('require_email', { mode: 'boolean' }).default(true),
  allowedDomains: text('allowed_domains'),        // JSON array: ["@acme.com", "@partner.com"]
  password: text('password_hash'),                // Optional password protection
  blockDownload: integer('block_download', { mode: 'boolean' }).default(true),
  
  // Watermark config
  watermarkEnabled: integer('watermark_enabled', { mode: 'boolean' }).default(true),
  watermarkTemplate: text('watermark_template').default('{{email}} · {{date}}'),
  
  // Notification
  notifyUrl: text('notify_url'),                  // Webhook URL for view events
  notifyEmail: text('notify_email'),              // Email to notify on view
  
  // Branding (Growth+ tiers)
  customDomainId: text('custom_domain_id').references(() => customDomains.id),
  brandLogo: text('brand_logo'),                  // R2 path to logo image
  brandColor: text('brand_color'),                // Hex color
  brandName: text('brand_name'),                  // Displayed in viewer
  
  // Status
  status: text('status').notNull().default('active'),  // active | revoked | expired
  viewCount: integer('view_count').notNull().default(0),
  
  // Metadata
  name: text('name'),                             // Optional friendly name
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// VIEWS (Analytics Events)
// ============================================

export const views = sqliteTable('views', {
  id: text('id').primaryKey(),                    // nanoid
  linkId: text('link_id').notNull().references(() => links.id),
  
  // Viewer identity
  viewerEmail: text('viewer_email'),              // From email gate
  viewerIp: text('viewer_ip'),
  viewerUserAgent: text('viewer_user_agent'),
  viewerCountry: text('viewer_country'),
  viewerCity: text('viewer_city'),
  viewerDevice: text('viewer_device'),            // desktop | mobile | tablet
  viewerBrowser: text('viewer_browser'),
  viewerOs: text('viewer_os'),
  
  // Engagement
  duration: integer('duration'),                   // Total seconds spent viewing
  pagesViewed: integer('pages_viewed'),
  pageDetails: text('page_details'),               // JSON: [{"page":1,"seconds":12},...]
  completionRate: real('completion_rate'),          // 0.0 - 1.0
  
  // Session
  sessionToken: text('session_token'),             // Unique per view session
  returnVisit: integer('return_visit', { mode: 'boolean' }).default(false),
  
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  endedAt: text('ended_at'),                       // When they left
});

// ============================================
// WEBHOOKS
// ============================================

export const webhookEndpoints = sqliteTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  secret: text('secret').notNull(),                // For HMAC signing
  events: text('events').notNull(),                // JSON array: ["link.viewed", "link.expired"]
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull().references(() => webhookEndpoints.id),
  event: text('event').notNull(),
  payload: text('payload').notNull(),              // JSON
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRetryAt: text('next_retry_at'),
  deliveredAt: text('delivered_at'),
  failedAt: text('failed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// CUSTOM DOMAINS
// ============================================

export const customDomains = sqliteTable('custom_domains', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  domain: text('domain').notNull().unique(),       // "docs.their-saas.com"
  verified: integer('verified', { mode: 'boolean' }).default(false),
  verifiedAt: text('verified_at'),
  cnameTarget: text('cname_target').notNull(),     // "view.cloakshare.dev"
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// USAGE TRACKING (for billing)
// ============================================

export const usageRecords = sqliteTable('usage_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),                    // link_created | view_recorded
  quantity: integer('quantity').notNull().default(1),
  stripeReported: integer('stripe_reported', { mode: 'boolean' }).default(false),
  periodStart: text('period_start').notNull(),     // Billing period
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

### Indexes (add in migration)

```sql
CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_status ON links(status);
CREATE INDEX idx_links_created_at ON links(created_at);
CREATE INDEX idx_views_link_id ON views(link_id);
CREATE INDEX idx_views_created_at ON views(created_at);
CREATE INDEX idx_views_viewer_email ON views(viewer_email);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_usage_records_user_period ON usage_records(user_id, period_start);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);
```

---

## 5. API SPECIFICATION

Base URL: `https://api.cloakshare.dev/v1`

Authentication: `Authorization: Bearer ck_live_xxxxxxxxxxxxxxxx`

All responses follow:
```json
{
  "data": { ... },
  "error": null
}
// or
{
  "data": null,
  "error": { "code": "LINK_EXPIRED", "message": "This link has expired" }
}
```

### Links

#### POST /v1/links — Create a secure link

```
Headers:
  Authorization: Bearer ck_live_xxx
  Content-Type: multipart/form-data

Body (multipart):
  file: <binary>                           # The file to secure (required if no file_url)
  file_url: "https://example.com/doc.pdf"  # OR a URL to fetch the file from
  name: "Q4 Pricing Proposal"              # Optional friendly name
  
  # Rules (all optional, sensible defaults)
  expires_in: "72h"                        # Duration string: "1h", "7d", "30d"
  expires_at: "2026-03-15T00:00:00Z"       # Or explicit timestamp
  max_views: 5                             # Max total views (null = unlimited)
  require_email: true                      # Require viewer to enter email (default: true)
  allowed_domains: ["@acme.com"]           # Only these email domains can view
  password: "secret123"                    # Optional password protection
  block_download: true                     # Prevent downloads (default: true)
  
  # Watermark
  watermark: true                          # Enable dynamic watermark (default: true)
  watermark_template: "{{email}} · {{date}}" # Template with variables
  
  # Notifications  
  notify_url: "https://myapp.com/hooks"    # Webhook URL for view events
  notify_email: "sales@myapp.com"          # Email notification on views
  
  # Branding (Growth+ only)
  brand_name: "Acme Corp"
  brand_color: "#FF5500"
  brand_logo: <binary>                     # Logo image file
  domain: "docs.acme.com"                  # Use this custom domain (must be verified)

Response 201:
{
  "data": {
    "id": "lnk_a1b2c3d4e5",
    "secure_url": "https://view.cloakshare.dev/s/a1b2c3d4e5",
    "analytics_url": "https://api.cloakshare.dev/v1/links/lnk_a1b2c3d4e5/analytics",
    "name": "Q4 Pricing Proposal",
    "file_type": "pdf",
    "page_count": 12,
    "status": "active",
    "rules": {
      "expires_at": "2026-03-03T12:00:00Z",
      "max_views": 5,
      "require_email": true,
      "allowed_domains": ["@acme.com"],
      "has_password": true,
      "block_download": true,
      "watermark": true
    },
    "view_count": 0,
    "created_at": "2026-02-28T12:00:00Z"
  }
}
```

#### GET /v1/links — List all links

```
Query params:
  status: "active" | "revoked" | "expired"  # Filter by status
  page: 1                                    # Pagination
  limit: 25                                  # Per page (max 100)
  sort: "created_at"                         # Sort field
  order: "desc"                              # asc | desc

Response 200:
{
  "data": {
    "links": [ ... ],
    "pagination": {
      "total": 142,
      "page": 1,
      "limit": 25,
      "pages": 6
    }
  }
}
```

#### GET /v1/links/:id — Get link details

```
Response 200:
{
  "data": {
    "id": "lnk_a1b2c3d4e5",
    "secure_url": "https://view.cloakshare.dev/s/a1b2c3d4e5",
    "name": "Q4 Pricing Proposal",
    "file_type": "pdf",
    "page_count": 12,
    "status": "active",
    "rules": { ... },
    "view_count": 3,
    "recent_views": [
      {
        "viewer_email": "john@acme.com",
        "viewed_at": "2026-02-28T14:30:00Z",
        "duration": 245,
        "pages_viewed": 8,
        "completion_rate": 0.67,
        "country": "US",
        "city": "New York",
        "device": "desktop"
      }
    ],
    "created_at": "2026-02-28T12:00:00Z"
  }
}
```

#### DELETE /v1/links/:id — Revoke a link

```
Response 200:
{
  "data": {
    "id": "lnk_a1b2c3d4e5",
    "status": "revoked",
    "revoked_at": "2026-02-28T15:00:00Z"
  }
}
```

#### GET /v1/links/:id/analytics — Detailed analytics

```
Response 200:
{
  "data": {
    "link_id": "lnk_a1b2c3d4e5",
    "total_views": 12,
    "unique_viewers": 4,
    "avg_duration": 180,
    "avg_completion_rate": 0.72,
    "page_analytics": [
      { "page": 1, "avg_seconds": 8, "view_count": 12 },
      { "page": 2, "avg_seconds": 45, "view_count": 11 },
      { "page": 3, "avg_seconds": 120, "view_count": 10 }
    ],
    "viewers": [
      {
        "email": "john@acme.com",
        "total_views": 3,
        "first_viewed": "2026-02-28T14:30:00Z",
        "last_viewed": "2026-03-01T09:15:00Z",
        "total_duration": 540,
        "avg_completion_rate": 0.85
      }
    ],
    "views_over_time": [
      { "date": "2026-02-28", "views": 8 },
      { "date": "2026-03-01", "views": 4 }
    ]
  }
}
```

### Viewer Endpoints (Internal — called by the viewer frontend)

These are NOT part of the public API. They're called by the viewer frontend.

#### GET /v1/viewer/:token — Get link metadata for viewer

```
# No auth required (the token IS the auth)
# Returns only what the viewer needs to render

Response 200:
{
  "data": {
    "status": "active",                    # or "expired", "revoked", "max_views_reached"
    "require_email": true,
    "has_password": true,
    "allowed_domains": ["@acme.com"],
    "page_count": 12,
    "brand_name": "Acme Corp",
    "brand_color": "#FF5500",
    "brand_logo_url": "https://r2.cloakshare.dev/brands/xxx/logo.png",
    "watermark_enabled": true
  }
}

Response 410 (expired/revoked):
{
  "error": { "code": "LINK_EXPIRED", "message": "This link is no longer available" }
}
```

#### POST /v1/viewer/:token/verify — Verify viewer email / password

```
Body:
{
  "email": "john@acme.com",
  "password": "secret123"         # Only if has_password
}

Response 200:
{
  "data": {
    "session_token": "vs_xxxxxxxxxxxx",    # Short-lived session for this viewer
    "viewer_email": "john@acme.com",
    "pages": [
      { "page": 1, "url": "https://r2.cloakshare.dev/renders/xxx/page-1.webp?token=yyy" },
      { "page": 2, "url": "https://r2.cloakshare.dev/renders/xxx/page-2.webp?token=yyy" }
    ],
    "watermark_text": "john@acme.com · Feb 28, 2026"
  }
}

Response 403 (wrong domain):
{
  "error": { "code": "DOMAIN_NOT_ALLOWED", "message": "Only @acme.com email addresses can view this" }
}
```

#### POST /v1/viewer/:token/track — Track page view events

```
# Called periodically by the viewer (every 5 seconds while active)
Headers:
  X-Session-Token: vs_xxxxxxxxxxxx

Body:
{
  "session_token": "vs_xxxxxxxxxxxx",
  "page": 3,
  "seconds_on_page": 5,
  "total_duration": 45,
  "pages_viewed": [1, 2, 3]
}

Response 204 (no content)
```

### Webhooks Management

#### POST /v1/webhooks — Create webhook endpoint

```
Body:
{
  "url": "https://myapp.com/hooks/cloak",
  "events": ["link.viewed", "link.expired", "link.revoked"]
}

Response 201:
{
  "data": {
    "id": "wh_xxx",
    "url": "https://myapp.com/hooks/cloak",
    "secret": "whsec_xxxxxxxx",            # For verifying webhook signatures
    "events": ["link.viewed", "link.expired", "link.revoked"],
    "active": true
  }
}
```

### Custom Domains

#### POST /v1/domains — Add custom domain

```
Body:
{
  "domain": "docs.acme.com"
}

Response 201:
{
  "data": {
    "id": "dom_xxx",
    "domain": "docs.acme.com",
    "verified": false,
    "cname_target": "view.cloakshare.dev",
    "instructions": "Add a CNAME record: docs.acme.com → view.cloakshare.dev"
  }
}
```

#### POST /v1/domains/:id/verify — Verify CNAME is configured

```
Response 200:
{
  "data": {
    "id": "dom_xxx",
    "domain": "docs.acme.com",
    "verified": true,
    "verified_at": "2026-02-28T16:00:00Z"
  }
}
```

---

## 6. DOCUMENT RENDERING PIPELINE

### Flow

```
File received (upload or URL fetch)
    ↓
Validate: file type, file size (max 100 MB), virus scan (ClamAV optional later)
    ↓
Generate link ID (nanoid, 12 chars)
    ↓
Store original temporarily in R2: temp/{linkId}/original.pdf
    ↓
Render each page to WebP image:
  - Resolution: 150 DPI (good quality, reasonable file size)
  - Format: WebP (smaller than PNG, good quality)
  - Max width: 1600px
  - Quality: 85
    ↓
Store rendered pages in R2: renders/{linkId}/page-{N}.webp
    ↓
Generate thumbnail of page 1: renders/{linkId}/thumb.webp (400px wide)
    ↓
Delete original from R2: temp/{linkId}/original.pdf
    ↓
Update link record with page_count, status = "active"
    ↓
Return secure_url to caller
```

### Rendering Implementation

```typescript
// apps/api/src/services/renderer.ts

import { fromBuffer } from 'pdf2pic';
import sharp from 'sharp';
import { uploadToR2, deleteFromR2 } from './storage';

interface RenderResult {
  pageCount: number;
  pages: { page: number; r2Key: string; width: number; height: number }[];
  thumbnailKey: string;
}

export async function renderPdf(
  fileBuffer: Buffer,
  linkId: string
): Promise<RenderResult> {
  
  // Convert PDF pages to images
  const converter = fromBuffer(fileBuffer, {
    density: 150,           // DPI
    format: 'png',          // Intermediate format
    width: 1600,            // Max width
    height: 2400,           // Max height
    preserveAspectRatio: true,
  });

  // Get page count
  const pdfInfo = await getPdfPageCount(fileBuffer); // use pdfjs-dist
  const pages: RenderResult['pages'] = [];

  for (let i = 1; i <= pdfInfo.pageCount; i++) {
    // Convert page to image
    const result = await converter(i, { responseType: 'buffer' });
    
    // Convert to WebP with sharp
    const webpBuffer = await sharp(result.buffer)
      .webp({ quality: 85 })
      .toBuffer();

    const metadata = await sharp(webpBuffer).metadata();

    // Upload to R2
    const r2Key = `renders/${linkId}/page-${i}.webp`;
    await uploadToR2(r2Key, webpBuffer, 'image/webp');

    pages.push({
      page: i,
      r2Key,
      width: metadata.width || 1600,
      height: metadata.height || 2400,
    });
  }

  // Generate thumbnail from page 1
  const thumbBuffer = await sharp(pages[0].r2Key) // re-fetch or use cached
    .resize(400)
    .webp({ quality: 75 })
    .toBuffer();
  
  const thumbnailKey = `renders/${linkId}/thumb.webp`;
  await uploadToR2(thumbnailKey, thumbBuffer, 'image/webp');

  return {
    pageCount: pdfInfo.pageCount,
    pages,
    thumbnailKey,
  };
}
```

### Page Image Serving

Page images are NOT served as public R2 URLs. They go through a signed URL or your API:

```
Viewer requests page →
  POST /v1/viewer/:token/verify (with email) →
  Returns page URLs with short-lived signed R2 URLs (5 min expiry) →
  Viewer loads images onto canvas →
  Canvas overlays watermark text →
  User sees watermarked content
```

The signed R2 URLs expire in 5 minutes. Even if someone extracts the URL, it stops working almost immediately. The canvas rendering means right-click → save gives them a blank canvas or watermarked composite, not the clean page image.

---

## 7. SECURE VIEWER

### Architecture

The viewer is a static site on Cloudflare Pages. When a recipient clicks `https://view.cloakshare.dev/s/abc123`:

```
1. Viewer page loads (static HTML/JS/CSS from Cloudflare CDN)
2. JS extracts token from URL: "abc123"
3. Calls GET /v1/viewer/abc123 → gets link metadata
4. If link is expired/revoked → shows error page
5. If require_email → shows email gate (and password field if needed)
6. User enters email → POST /v1/viewer/abc123/verify
7. If allowed → returns session_token + signed page URLs + watermark text
8. Viewer loads page images onto HTML Canvas
9. Canvas overlays watermark text (semi-transparent, tiled across page)
10. Navigation controls: prev/next page, page counter
11. Every 5 seconds: POST /v1/viewer/abc123/track with current page + duration
12. When user leaves: final tracking call with total duration
```

### Canvas-Based Rendering (Key Security Feature)

```typescript
// apps/viewer/src/viewer/viewer.ts

class SecureViewer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentPage: number = 1;
  private watermarkText: string;

  async renderPage(pageNumber: number) {
    const img = await this.loadImage(this.pageUrls[pageNumber - 1]);
    
    // Clear canvas
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw page image
    this.ctx.drawImage(img, 0, 0);
    
    // Overlay watermark (tiled, semi-transparent, rotated)
    this.renderWatermark();
    
    // Disable right-click context menu on canvas
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private renderWatermark() {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(128, 128, 128, 0.15)';  // Very subtle
    ctx.textAlign = 'center';
    
    // Tile watermark diagonally across entire page
    const text = this.watermarkText;  // "john@acme.com · Feb 28, 2026"
    const angle = -30 * (Math.PI / 180);
    
    for (let y = -this.canvas.height; y < this.canvas.height * 2; y += 120) {
      for (let x = -this.canvas.width; x < this.canvas.width * 2; x += 400) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
    
    ctx.restore();
  }
}
```

### Security Measures in Viewer

```typescript
// Disable common copy/save vectors

// 1. Disable right-click
document.addEventListener('contextmenu', e => e.preventDefault());

// 2. Disable keyboard shortcuts (Ctrl+S, Ctrl+P, Ctrl+C, PrintScreen)
document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey && ['s', 'p', 'c', 'a', 'u'].includes(e.key.toLowerCase())) ||
    e.key === 'PrintScreen' ||
    e.key === 'F12'
  ) {
    e.preventDefault();
  }
});

// 3. Disable drag
document.addEventListener('dragstart', e => e.preventDefault());

// 4. Disable text selection on page
document.body.style.userSelect = 'none';
document.body.style.webkitUserSelect = 'none';

// 5. CSS: hide from print
// @media print { body { display: none !important; } }

// 6. Visibility API: pause/blank when tab is hidden or screen sharing detected
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Optionally blank the canvas when tab loses focus
    // This is aggressive — only enable for high-security tiers
  }
});
```

### Email Gate UI

```
+--------------------------------------------------+
|                                                    |
|              [Brand Logo]                          |
|              Brand Name                            |
|                                                    |
|    ----------------------------------------       |
|    |  📄  Q4 Pricing Proposal               |     |
|    |       12 pages · PDF                    |     |
|    ----------------------------------------       |
|                                                    |
|    Enter your email to view this document          |
|                                                    |
|    [  your.email@company.com              ]        |
|                                                    |
|    [  Password (if required)              ]        |
|                                                    |
|    [       View Document →                ]        |
|                                                    |
|    Your viewing activity will be recorded.         |
|                                                    |
|              Secured by Cloak                      |
+--------------------------------------------------+
```

### Viewer Navigation UI

```
+--------------------------------------------------+
|  [Brand]              Page 3 of 12     [✕ Close]  |
|---------------------------------------------------|
|                                                    |
|   +------------------------------------------+    |
|   |                                          |    |
|   |    [Document page rendered on canvas]    |    |
|   |                                          |    |
|   |    john@acme.com · Feb 28, 2026         |    |
|   |         (watermark overlaid)             |    |
|   |                                          |    |
|   |                                          |    |
|   +------------------------------------------+    |
|                                                    |
|          [← Prev]   3/12   [Next →]               |
+--------------------------------------------------+
```

---

## 8. AUTHENTICATION & API KEYS

### API Key Format

```
ck_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4
│  │    │
│  │    └── 32 random chars (crypto.randomBytes)
│  └── "live" or "test" (test keys don't count toward usage)
└── "ck" = Cloak Key prefix
```

### Key Storage

- Generate key: `ck_live_` + 32 random hex chars
- Store in DB: SHA-256 hash of the full key
- Display to user: only on creation (never again)
- Show in dashboard: prefix only (`ck_live_a1b2...`)
- Lookup on request: hash the provided key, query by hash

### Auth Middleware

```typescript
// apps/api/src/middleware/apiKey.ts

import { createHash } from 'crypto';

export async function apiKeyAuth(c, next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ck_')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
  }

  const key = header.replace('Bearer ', '');
  const keyHash = createHash('sha256').update(key).digest('hex');

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
    with: { user: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401);
  }

  // Update last used
  await db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, apiKey.id));

  // Attach user to context
  c.set('user', apiKey.user);
  c.set('apiKey', apiKey);

  await next();
}
```

### Dashboard Auth

- Email/password login → issues HTTP-only secure cookie
- Session stored in DB (simple sessions table, or use Turso TTL)
- Dashboard routes check cookie, API routes check Bearer token
- Separate middleware paths

---

## 9. WEBHOOK SYSTEM

### Events

| Event | Trigger | Payload includes |
|-------|---------|-----------------|
| `link.viewed` | Someone views a link | viewer email, link ID, duration, pages viewed, geo |
| `link.expired` | Link reaches expiry time | link ID, final view count |
| `link.revoked` | Link manually revoked | link ID, revoked_at |
| `link.max_views_reached` | View count hits max_views | link ID, final view count |

### Webhook Payload Format

```json
{
  "id": "evt_xxxxxxxxxxxx",
  "type": "link.viewed",
  "created_at": "2026-02-28T14:30:00Z",
  "data": {
    "link_id": "lnk_a1b2c3d4e5",
    "link_name": "Q4 Pricing Proposal",
    "viewer": {
      "email": "john@acme.com",
      "ip": "203.0.113.42",
      "country": "US",
      "city": "New York",
      "device": "desktop",
      "browser": "Chrome 122"
    },
    "engagement": {
      "duration": 245,
      "pages_viewed": 8,
      "total_pages": 12,
      "completion_rate": 0.67,
      "page_details": [
        { "page": 1, "seconds": 5 },
        { "page": 2, "seconds": 12 },
        { "page": 5, "seconds": 120 }
      ]
    }
  }
}
```

### Webhook Signing

```typescript
// Sign with HMAC-SHA256
const signature = crypto
  .createHmac('sha256', endpoint.secret)
  .update(JSON.stringify(payload))
  .digest('hex');

// Include in headers
headers: {
  'Content-Type': 'application/json',
  'X-Cloak-Signature': `sha256=${signature}`,
  'X-Cloak-Event': 'link.viewed',
  'X-Cloak-Delivery': deliveryId,
}
```

### Retry Logic

- Attempt 1: Immediate
- Attempt 2: 1 minute later
- Attempt 3: 10 minutes later
- After 3 failures: mark as failed, log error
- Use a simple polling loop on a setInterval (MVP), upgrade to proper queue (QStash) in Phase 2

---

## 10. ANALYTICS & TRACKING

### Client-Side Tracking (Viewer)

The viewer sends tracking pings every 5 seconds while the tab is active:

```typescript
// apps/viewer/src/viewer/tracking.ts

class ViewTracker {
  private interval: number;
  private startTime: number;
  private currentPage: number;
  private pageStartTime: number;
  private pageTimeMap: Map<number, number> = new Map();

  start(sessionToken: string, linkToken: string) {
    this.startTime = Date.now();
    this.pageStartTime = Date.now();
    
    // Send ping every 5 seconds
    this.interval = window.setInterval(() => {
      this.sendPing(sessionToken, linkToken);
    }, 5000);

    // Send final ping on page leave
    window.addEventListener('beforeunload', () => {
      this.sendPing(sessionToken, linkToken, true);
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
  }

  onPageChange(newPage: number) {
    // Record time on previous page
    const timeOnPage = (Date.now() - this.pageStartTime) / 1000;
    const existing = this.pageTimeMap.get(this.currentPage) || 0;
    this.pageTimeMap.set(this.currentPage, existing + timeOnPage);
    
    this.currentPage = newPage;
    this.pageStartTime = Date.now();
  }

  private async sendPing(sessionToken: string, linkToken: string, final = false) {
    const timeOnCurrentPage = (Date.now() - this.pageStartTime) / 1000;
    
    await fetch(`/v1/viewer/${linkToken}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({
        current_page: this.currentPage,
        seconds_on_page: Math.round(timeOnCurrentPage),
        total_duration: Math.round((Date.now() - this.startTime) / 1000),
        page_times: Object.fromEntries(this.pageTimeMap),
        is_final: final,
      }),
      keepalive: final,  // Ensure final ping is sent even on page close
    });
  }
}
```

### Server-Side Geo Enrichment

On each new view session, resolve IP to geo data:

```typescript
// Use a free IP geo service or Cloudflare's built-in headers
// Cloudflare provides these headers automatically:
//   cf-ipcountry: US
//   cf-ipcity: New York  (on Business+ plans)
//
// Free fallback: ip-api.com (45 req/min free)

function extractGeo(request: Request) {
  return {
    country: request.headers.get('cf-ipcountry') || null,
    city: request.headers.get('cf-ipcity') || null,
  };
}
```

---

## 11. CUSTOM DOMAINS

### Setup Flow

1. User adds domain in dashboard: `docs.acme.com`
2. Cloak shows instructions: "Add CNAME record: `docs.acme.com` → `view.cloakshare.dev`"
3. User configures DNS
4. User clicks "Verify" → Cloak does DNS lookup to confirm CNAME
5. Cloudflare Pages auto-provisions SSL for the custom domain
6. Links created with `domain: "docs.acme.com"` now use that domain in the `secure_url`

### Implementation

```typescript
// apps/api/src/routes/domains.ts

import { resolve } from 'dns/promises';

app.post('/v1/domains/:id/verify', async (c) => {
  const domain = await getDomain(c.req.param('id'));
  
  try {
    const records = await resolve(domain.domain, 'CNAME');
    const isValid = records.some(r => r === 'view.cloakshare.dev' || r === 'view.cloakshare.dev.');
    
    if (isValid) {
      await db.update(customDomains)
        .set({ verified: true, verifiedAt: new Date().toISOString() })
        .where(eq(customDomains.id, domain.id));
      
      // Trigger Cloudflare Pages custom domain addition via API
      await addCloudflareCustomDomain(domain.domain);
      
      return c.json({ data: { ...domain, verified: true } });
    } else {
      return c.json({ error: { code: 'CNAME_NOT_FOUND', message: 'CNAME record not found' } }, 400);
    }
  } catch (e) {
    return c.json({ error: { code: 'DNS_LOOKUP_FAILED', message: 'Could not resolve domain' } }, 400);
  }
});
```

### Viewer Routing with Custom Domains

The viewer (on Cloudflare Pages) needs to know which Cloak account owns a given custom domain. Two approaches:

**Option A (Simple):** The viewer always calls the API with the token. The API returns brand config regardless of which domain the viewer is served from. The token in the URL (`/s/abc123`) is the source of truth, not the domain.

**Option B (Cleaner):** Cloudflare Worker at the edge looks up the custom domain → maps to user → applies branding before the viewer even loads.

**Use Option A for MVP.** The token-based approach means custom domains "just work" with zero edge logic. The viewer page loads, extracts the token, calls the API, and gets branding config back.

---

## 12. EMBEDDED VIEWER (IFRAME)

### How it Works

Developer embeds Cloak viewer in their app:

```html
<iframe
  src="https://view.cloakshare.dev/embed/abc123xyz"
  width="100%"
  height="600"
  frameborder="0"
  allow="fullscreen"
></iframe>
```

Or with custom domain:
```html
<iframe
  src="https://docs.acme.com/embed/abc123xyz"
  width="100%"
  height="600"
></iframe>
```

### Embed vs Standard Viewer

The `/embed/` route loads a slightly different viewer:
- No header bar (the parent app has its own)
- No "Secured by Cloak" badge (this is a paid feature, removed on Growth+)
- PostMessage API for the parent app to communicate with the viewer
- Configurable via URL params: `?theme=dark&hide_nav=true`

### PostMessage API

```typescript
// Parent app can listen for events from the embedded viewer:
window.addEventListener('message', (event) => {
  if (event.data.source !== 'cloak-viewer') return;
  
  switch (event.data.type) {
    case 'cloak:ready':
      // Viewer has loaded
      break;
    case 'cloak:view_started':
      // Viewer opened by recipient, includes email
      console.log(event.data.viewer_email);
      break;
    case 'cloak:page_changed':
      // Recipient navigated to a new page
      console.log(event.data.page, event.data.total_pages);
      break;
    case 'cloak:view_ended':
      // Recipient left, includes duration + engagement data
      console.log(event.data.duration, event.data.completion_rate);
      break;
  }
});
```

### Security Headers for iframe

```typescript
// In the viewer's response headers:
// Allow embedding from any origin (or restrict per customer config)

app.use('/embed/*', async (c, next) => {
  await next();
  
  // Get the link's allowed embed origins from DB, or allow all
  c.header('X-Frame-Options', 'ALLOWALL');
  c.header('Content-Security-Policy', "frame-ancestors *");
  // For restricted: frame-ancestors https://their-saas.com
});

// Standard viewer prevents embedding:
app.use('/s/*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
});
```

---

## 13. BILLING INTEGRATION

### Stripe Setup

```
Products:
  - Cloak Starter ($29/mo)
    - Price: $29/month recurring
    - Metered add-on: Links ($0.05 per link over 500)
    - Metered add-on: Views ($0.005 per view over 5,000)
  
  - Cloak Growth ($99/mo)
    - Price: $99/month recurring
    - Metered add-on: Links ($0.04 per link over 2,500)
    - Metered add-on: Views ($0.004 per view over 25,000)
  
  - Cloak Scale ($299/mo)
    - Price: $299/month recurring
    - Metered add-on: Links ($0.03 per link over 10,000)
    - Metered add-on: Views ($0.003 per view over 100,000)
```

### Usage Reporting

```typescript
// apps/api/src/services/billing.ts

// Called when a link is created or a view is recorded
async function reportUsage(userId: string, type: 'link_created' | 'view_recorded') {
  const user = await getUser(userId);
  if (user.plan === 'free') return; // Free tier has hard limits, not metered billing
  
  // Record locally
  await db.insert(usageRecords).values({
    id: nanoid(),
    userId,
    type,
    quantity: 1,
    periodStart: getCurrentBillingPeriodStart(user),
  });

  // Report to Stripe (batch this — report every hour, not every event)
  // Use Stripe's Usage Records API
}

// Hourly cron job to batch-report usage to Stripe
async function syncUsageToStripe() {
  const unreported = await db.query.usageRecords.findMany({
    where: eq(usageRecords.stripeReported, false),
  });

  // Group by user and type
  const grouped = groupBy(unreported, r => `${r.userId}:${r.type}`);

  for (const [key, records] of Object.entries(grouped)) {
    const [userId, type] = key.split(':');
    const user = await getUser(userId);
    
    const subscriptionItemId = type === 'link_created'
      ? user.stripeLinkMeteredItemId
      : user.stripeViewMeteredItemId;

    await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity: records.length,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });

    // Mark as reported
    await db.update(usageRecords)
      .set({ stripeReported: true })
      .where(inArray(usageRecords.id, records.map(r => r.id)));
  }
}
```

### Free Tier Enforcement

Free tier has hard limits (not metered billing):

```typescript
// apps/api/src/middleware/usage.ts

async function enforceUsageLimits(c, next) {
  const user = c.get('user');
  
  if (user.plan === 'free') {
    const currentMonth = getCurrentMonth(); // "2026-02"
    
    const linkCount = await db.select({ count: count() })
      .from(links)
      .where(and(
        eq(links.userId, user.id),
        like(links.createdAt, `${currentMonth}%`)
      ));
    
    if (linkCount[0].count >= 50) {
      return c.json({
        error: {
          code: 'LIMIT_REACHED',
          message: 'Free tier limit: 50 links per month. Upgrade at https://cloakshare.dev/billing'
        }
      }, 429);
    }
  }

  await next();
}
```

---

## 14. INFRASTRUCTURE & DEPLOYMENT

### Fly.io Configuration

```toml
# apps/api/fly.toml

app = "cloak-api"
primary_region = "iad"  # US East (Virginia)

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true      # Scale to zero when idle
  auto_start_machines = true     # Wake up on request
  min_machines_running = 0       # Allow full scale-to-zero (MVP)

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512                # 512 MB enough for PDF rendering
```

### Dockerfile

```dockerfile
# apps/api/Dockerfile

FROM node:20-slim AS base

# Install system dependencies for PDF rendering
RUN apt-get update && apt-get install -y \
    poppler-utils \
    graphicsmagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy source
COPY . .

# Build
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Cloudflare Pages Configuration

```toml
# apps/viewer/wrangler.toml

name = "cloak-viewer"
compatibility_date = "2026-02-28"

[site]
  bucket = "./dist"

# Custom domains are added via Cloudflare Dashboard or API
```

### R2 Bucket Setup

```bash
# Create via Cloudflare Dashboard or wrangler CLI

# Bucket: cloak-renders
# - Stores: rendered page images, thumbnails, brand logos
# - Lifecycle: Auto-delete objects with "temp/" prefix after 24 hours

# CORS config for the bucket (allow viewer to fetch images):
[
  {
    "AllowedOrigins": ["https://view.cloakshare.dev", "https://*.cloakshare.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 15. BUILD PHASES

### Phase 1: Core MVP (Weeks 1-4)
Build in this order:

```
Week 1:
  ☐ Project scaffolding (monorepo, packages, configs)
  ☐ Database schema + Drizzle setup + Turso connection
  ☐ User registration & login (email/password)
  ☐ API key generation & auth middleware
  ☐ POST /v1/links — file upload + basic metadata storage
  ☐ PDF rendering pipeline (pdf → webp images → R2)

Week 2:
  ☐ Secure viewer — email gate
  ☐ Secure viewer — canvas-based page rendering with watermark
  ☐ Secure viewer — page navigation (prev/next)
  ☐ View tracking (create view record on email verify)
  ☐ GET /v1/links and GET /v1/links/:id
  ☐ DELETE /v1/links/:id (revoke)

Week 3:
  ☐ Link expiry enforcement (time-based + view-count)
  ☐ Allowed domains restriction
  ☐ Password protection on links
  ☐ Webhook system (create, dispatch on view, retries)
  ☐ View tracking — page-level time tracking
  ☐ GET /v1/links/:id/analytics

Week 4:
  ☐ Dashboard — login/register pages
  ☐ Dashboard — links list view
  ☐ Dashboard — link detail + analytics view
  ☐ Dashboard — API keys management page
  ☐ Dashboard — settings page
  ☐ Deploy API to Fly.io
  ☐ Deploy viewer + dashboard to Cloudflare Pages
```

### Phase 2: Monetization + Polish (Weeks 5-8)

```
Week 5:
  ☐ Stripe integration — subscription creation
  ☐ Stripe integration — metered usage reporting
  ☐ Free tier enforcement (hard limits)
  ☐ Dashboard — billing page (current plan, usage, upgrade)
  ☐ Pricing page on marketing site

Week 6:
  ☐ Custom domain support — add/verify/use
  ☐ Embedded viewer (iframe mode) with PostMessage API
  ☐ Brand customization (logo, color, name on viewer)
  ☐ "Secured by Cloak" badge (free tier) / removal (paid)
  
Week 7:
  ☐ Image file support (PNG, JPG, WebP — just serve through canvas directly)
  ☐ Rate limiting middleware
  ☐ API documentation site (use Scalar or Redoc from OpenAPI spec)
  ☐ Landing page + marketing site
  
Week 8:
  ☐ Error handling polish
  ☐ Email notifications (view alerts via Resend)
  ☐ Usage alerts (approaching limits)
  ☐ Open source the viewer component on GitHub
  ☐ Write launch blog post
  ☐ Product Hunt launch prep
```

### Phase 3: Growth (Months 3-6) — future, not in this spec

```
  ☐ Video support (Cloudflare Stream integration)
  ☐ Office doc support (XLSX, PPTX via LibreOffice)
  ☐ Python SDK
  ☐ Node.js SDK
  ☐ Team/org accounts
  ☐ BYO storage connector (S3-compatible)
  ☐ AI engagement scoring
  ☐ Salesforce / HubSpot marketplace listings
```

---

## 16. ENVIRONMENT VARIABLES

```bash
# apps/api/.env

# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
VIEWER_URL=http://localhost:5173

# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=cloak-renders
R2_PUBLIC_URL=https://pub-xxx.r2.dev   # or custom domain

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_GROWTH_PRICE_ID=price_xxx
STRIPE_SCALE_PRICE_ID=price_xxx
STRIPE_LINK_METERED_PRICE_ID=price_xxx  # Metered: links overage
STRIPE_VIEW_METERED_PRICE_ID=price_xxx  # Metered: views overage

# Email (Resend)
RESEND_API_KEY=re_xxx
FROM_EMAIL=noreply@cloakshare.dev

# Auth
SESSION_SECRET=random-64-char-string
JWT_SECRET=random-64-char-string

# Misc
CLOAK_SIGNING_SECRET=random-64-char-string  # For signing tokens
```

---

## 17. TESTING STRATEGY

### Manual Testing Checklist (MVP)

```
Link Creation:
  ☐ Upload PDF → link created → secure_url works
  ☐ Upload via URL → file fetched → rendered correctly
  ☐ Large PDF (50+ pages) → renders without timeout
  ☐ Invalid file type → proper error message
  ☐ File too large (>100MB) → proper error message

Viewer:
  ☐ Open secure_url → email gate appears
  ☐ Enter email → pages load with watermark
  ☐ Watermark shows viewer's email + timestamp
  ☐ Right-click disabled on canvas
  ☐ Ctrl+S / Ctrl+P blocked
  ☐ Page navigation works (prev/next, page counter)
  ☐ Mobile responsive (works on phone browser)
  
Security Rules:
  ☐ Expired link → shows expiry message
  ☐ Revoked link → shows revoked message
  ☐ Max views reached → shows limit message
  ☐ Wrong email domain → shows domain restriction message
  ☐ Wrong password → shows error, doesn't reveal pages
  
Analytics:
  ☐ View creates record in DB with correct geo/device
  ☐ Page-level time tracking records correctly
  ☐ Multiple views from same email counted correctly
  ☐ Analytics API returns correct aggregations
  
Webhooks:
  ☐ View event triggers webhook to configured URL
  ☐ Webhook payload has correct signature
  ☐ Failed webhook retries 3 times
  
Billing:
  ☐ Free tier: 51st link blocked with upgrade message
  ☐ Paid tier: overage usage reported to Stripe
  ☐ Stripe webhook handles subscription changes
  
Custom Domains:
  ☐ Add domain → shows CNAME instructions
  ☐ Verify domain → confirms CNAME is set
  ☐ Links with custom domain use correct URL
  
Embedded Viewer:
  ☐ iframe loads correctly on external page
  ☐ PostMessage events fire correctly
  ☐ X-Frame-Options set correctly (embed allows, standard denies)
```

### Automated Tests (add incrementally)

```
Unit tests (Vitest):
  - Token generation & validation
  - Watermark template rendering
  - Usage limit calculations
  - Webhook signature verification
  - API key hashing

Integration tests:
  - Full link creation → render → view flow
  - Stripe webhook handling
  - R2 upload/download/delete
  - Database queries & migrations

E2E tests (Playwright — Phase 2):
  - Complete viewer flow in real browser
  - Email gate interaction
  - Page navigation & tracking
  - Mobile viewport testing
```

---

## APPENDIX: KEY DECISIONS LOG

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Language | TypeScript | Type safety, shared types between API + viewer, largest ecosystem |
| API framework | Hono | Lightweight, runs everywhere (Node, Workers, Bun), easy migration path |
| Database | Turso (SQLite) | Free tier, edge replicas, embedded for local dev, no connection pooling needed |
| ORM | Drizzle | Lightweight, type-safe, SQLite-native, no heavy runtime |
| Object storage | Cloudflare R2 | Zero egress (critical for content delivery), S3-compatible, free tier |
| PDF rendering | poppler-utils + sharp | Battle-tested, runs on Linux, handles edge cases better than JS-only libs |
| Viewer rendering | HTML Canvas | Prevents right-click save of clean images, enables watermark overlay |
| Hosting (API) | Fly.io | Docker support (needed for system deps), scale-to-zero, affordable |
| Hosting (Viewer) | Cloudflare Pages | Free, global CDN, native custom domain + SSL support |
| Billing | Stripe | Industry standard, metered billing API, developer-friendly |
| Email | Resend | Developer-friendly, generous free tier, simple API |
| Monorepo | pnpm workspaces + Turborepo | Shared types, efficient builds, single repo management |

---

*This spec is version 1.0. Update as implementation reveals edge cases.*
