# Full Codebase Review Report

**Date:** 2026-03-02
**Scope:** Complete 6-phase review of CloakShare monorepo
**Result:** All tests passing (205/205), all builds succeeding (8/8 packages)

---

## Summary of Changes

### CRITICAL Fixes (5)

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 1 | `packages/viewer-core/src/cloak-viewer.ts` | **Memory leak** — `disconnectedCallback()` only called `trackPageTime()` but didn't clean up ResizeObserver, keyboard listener, or canvas protection listeners | Added handler reference storage (`_keydownHandler`, `_contextMenuHandler`, `_dragStartHandler`), full cleanup in `disconnectedCallback()`, reset `initialized` flag for re-mount |
| 2 | `apps/api/src/routes/auth.ts` | **Unbounded API key creation** — each login created a new Dashboard API key without revoking old ones | Revoke all existing Dashboard keys before creating a new one using `and(eq(apiKeys.userId), eq(apiKeys.name, 'Dashboard'))` |
| 3 | `apps/api/src/services/billing.ts` | **Org/user plan drift** — Stripe webhook handlers only updated `users.plan` but the system is org-centric (`organizations.plan` is what's checked for limits) | Added org plan sync in `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` handlers |
| 4 | `fly.toml` | **Data loss risk** — cloud deployment used `STORAGE_PROVIDER=local` on ephemeral Fly.io VMs | Changed to `STORAGE_PROVIDER=s3` with comment about R2 credentials via `fly secrets set` |
| 5 | `apps/api/src/routes/links.ts`, `apps/api/src/routes/views.ts` | **Unguarded JSON.parse** — 8 calls to `JSON.parse()` on DB columns (`allowedDomains`, `videoQualities`) and user input could crash with malformed data | Added `safeJsonParse<T>()` helper with try/catch fallback, replaced all 8 unguarded calls |

### HIGH Fixes (4)

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 6 | `packages/viewer-core/src/renderer.ts` | **Blurry images on HiDPI** — image renderer ignored `dpr` parameter unlike PDF renderer | Changed `ctx.drawImage()` to use `scale * dpr` for width/height |
| 7 | `apps/api/src/middleware/usage.ts`, `packages/shared/src/constants.ts` | **Pricing mismatch** — hardcoded overage rates (8/6/4 cents) disagreed with pricing page (5/4/3 cents) | Created shared `OVERAGE_RATES` constant, updated middleware to use it |
| 8 | `apps/api/src/routes/teams.ts` | **Seat count bug** — revoked invites still counted toward seat limit (query only checked `isNull(acceptedAt)`) | Added `isNull(orgInvites.revokedAt)` to the pending invite count query |
| 9 | `apps/api/src/routes/links.ts` | **Analytics first/last viewed swapped** — `first_viewed` showed newest view, `last_viewed` showed oldest | Swapped array indexing: `emailViews[0]` for first, `emailViews[length-1]` for last |

### MEDIUM Fixes (5)

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 10 | `packages/viewer-core/src/cloak-viewer.ts` | **Unused code** — `detectFormat` import, `originalHandler` variable, `panOffsetX`/`panOffsetY` properties | Removed all unused code |
| 11 | `apps/web/src/lib/api.ts` | **Dead localStorage code** — `cloak_session` read and manual Cookie header that never worked (session is httpOnly) | Removed dead code |
| 12 | `apps/api/.env.example` | **Missing env vars** — 9 environment variables used in code but not documented | Added `WEB_URL`, `EMBED_ALLOWED_ORIGINS`, annual Stripe price IDs, `SENTRY_DSN`, backup config |
| 13 | `packages/sdk-node/package.json`, `apps/api/package.json` | **Dependency misalignment** — vitest v2 in some packages, v3 in others; tsup minor version diff | Aligned all to vitest ^3.0.0, tsup ^8.3.0 |
| 14 | `apps/api/fly.toml` (duplicate) | **Duplicate fly.toml** — both root and `apps/api/` had fly.toml with conflicting config | Deleted `apps/api/fly.toml`, kept root as canonical |

### LOW / Test Fixes (3)

| # | File(s) | Issue | Fix |
|---|---------|-------|-----|
| 15 | `apps/api/src/__tests__/helpers.ts` | **Tests failed due to plan gates** — 46 API tests failed because test users were on `free` plan but tested premium features | Added `upgradeUserPlan()` helper that updates both user and org plan |
| 16 | 5 test files | **Test plan mismatch** — office-docs, video, webhooks, teams, links tests all needed plan upgrades | Added `upgradeUserPlan()` calls: starter for office/webhooks/links, growth for video, scale for teams |
| 17 | `apps/api/src/middleware/usage.ts` | **Free tier cap removed during refactor** — accidentally removed the hard cap check for free tier users | Re-added `if (linkCount >= limits.linksPerMonth)` check before spending cap logic |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| API (`apps/api`) | 181 | All passing |
| Viewer Core (`packages/viewer-core`) | 24 | All passing |
| **Total** | **205** | **All passing** |

## Build Results

| Package | Status |
|---------|--------|
| `@cloak/shared` | Built |
| `@cloakshare/viewer` | Built (ESM + CJS + IIFE) |
| `@cloakshare/react` | Built |
| `@cloakshare/sdk` | Built (ESM + CJS) |
| `@cloak/api` | Built |
| `@cloak/viewer` | Built |
| `@cloak/web` | Built |
| `@cloak/site` | Built (19 pages) |

---

## UAT Walkthrough Results

### Persona 1: Frontend Developer (Embed Flow)
**Result: PASS**
- Web Component mounts, attributes read, PDF renders, email gate works, watermark renders, events fire, cleanup works
- Minor: `allow-download` attribute defined in types but not implemented (no download button exists)

### Persona 2: API-Connected Viewer Flow
**Result: PASS** (with fixes applied)
- Upload, plan enforcement, rendering job creation, viewer metadata, verify, track, analytics all work correctly
- Fixed: analytics `first_viewed`/`last_viewed` were swapped

### Persona 3: Self-Hosted Deployment
**Result: PASS**
- Docker, SQLite, local storage, health check, CORS all correctly configured
- Note: Self-hosted users must set `CORS_ORIGINS` and `DASHBOARD_URL` in production

---

## Files Modified (17 files)

```
apps/api/src/__tests__/helpers.ts          # Added upgradeUserPlan() helper
apps/api/src/__tests__/links.test.ts       # Plan upgrade for password tests
apps/api/src/__tests__/office-docs.test.ts # Plan upgrade for office doc tests
apps/api/src/__tests__/teams.test.ts       # Plan upgrade for team invite tests
apps/api/src/__tests__/video.test.ts       # Plan upgrade for video tests
apps/api/src/__tests__/webhooks.test.ts    # Plan upgrade for webhook tests
apps/api/src/middleware/usage.ts           # Shared OVERAGE_RATES, free tier cap fix
apps/api/src/routes/auth.ts                # Revoke old Dashboard keys on login
apps/api/src/routes/links.ts               # Safe JSON.parse, analytics fix
apps/api/src/routes/teams.ts               # Seat count excludes revoked invites
apps/api/src/routes/views.ts               # Safe JSON.parse
apps/api/src/services/billing.ts           # Org plan sync
apps/api/.env.example                      # Added 9 missing env vars
apps/api/package.json                      # vitest v3 alignment
apps/web/src/lib/api.ts                    # Removed dead localStorage code
fly.toml                                   # STORAGE_PROVIDER=s3
packages/sdk-node/package.json             # vitest v3, tsup alignment
packages/shared/src/constants.ts           # Added OVERAGE_RATES
packages/viewer-core/src/cloak-viewer.ts   # Memory leak fix, unused code removal
packages/viewer-core/src/renderer.ts       # HiDPI image fix
```

## Files Deleted (1)

```
apps/api/fly.toml                          # Duplicate of root fly.toml
```
