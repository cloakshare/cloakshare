# CloakShare QA Audit Report

**Date:** 2026-03-01
**Scope:** Full code review, security audit, error handling audit, architecture review
**Result:** All HIGH and MEDIUM issues fixed. 199/199 tests pass. Build clean.

---

## Critical Issue (Production)

### CRIT-1: Missing database migration breaks all auth on prod
- **File:** `apps/api/src/db/schema.ts`
- **Cause:** `spendingCap` column added to users schema without generating a Drizzle migration. Drizzle generates SQL that references the column, causing every `SELECT` from `users` to throw on prod.
- **Impact:** Login, registration, session auth, and all authenticated endpoints return 500 "An unexpected error occurred"
- **Fix:** Generated migration `0001_calm_wasp.sql` that adds `spending_cap` column, creates `notifications` table, and adds `idx_links_org_id` index
- **Action required:** Run `npx drizzle-kit migrate` or `npx drizzle-kit push` on production

---

## HIGH Severity Fixes

### SEC-1: Path traversal in local file serving
- **Files:** `apps/api/src/index.ts`, `apps/api/src/services/storage.ts`
- **Issue:** `/internal/files/*` endpoint passed unsanitized path segments to `storage.download()`. A request like `/internal/files/../../etc/passwd` could read arbitrary files.
- **Fix:** Added `..`, `/`, `\` checks in the route handler. Added `resolve()` + prefix check in `LocalStorage.getFilePath()` to ensure resolved path stays within `basePath`.

### SEC-2: Session tokens stored unhashed
- **Files:** `apps/api/src/middleware/session.ts`, `apps/api/src/routes/auth.ts`
- **Issue:** Dashboard session tokens stored in plaintext in the `sessions` table. DB leak would expose all active sessions.
- **Fix:** Store `sha256(token)` in DB, hash the cookie value before lookup. Raw token only exists in the cookie.

### SEC-3: Viewer session tokens stored unhashed
- **Files:** `apps/api/src/routes/views.ts`
- **Issue:** Viewer session tokens stored in plaintext in `viewer_sessions` and `views` tables.
- **Fix:** Store `sha256(token)` in both tables, hash `x-session-token` header before all DB lookups.

### ERR-1: Unawaited processJob promises in renderer worker
- **File:** `apps/api/src/workers/renderer.ts`
- **Issue:** `processJob(job)` and `renderLimit(...)` called without await or catch. Unhandled rejections crash silently.
- **Fix:** Added `.catch()` handlers that log errors.

### ERR-2: User registration not transactional
- **File:** `apps/api/src/routes/auth.ts`
- **Issue:** Registration inserts user, org, orgMember, and apiKey in 4 separate queries. Partial failure leaves orphaned records.
- **Fix:** Wrapped all inserts in `db.transaction()`.

### ERR-3: pdftoppm/pdfinfo have no timeout
- **File:** `apps/api/src/services/renderer.ts`
- **Issue:** `execFile('pdfinfo', ...)` and `execFile('pdftoppm', ...)` called without timeout. Malicious PDFs could hang indefinitely.
- **Fix:** Added `{ timeout: 30_000 }` for pdfinfo, `{ timeout: 120_000 }` for pdftoppm.

---

## MEDIUM Severity Fixes

### DATA-1: Non-atomic view count increment
- **File:** `apps/api/src/routes/views.ts`
- **Issue:** `set({ viewCount: link.viewCount + 1 })` is a read-then-write race. Concurrent views could lose counts.
- **Fix:** Changed to `set({ viewCount: sql\`\${links.viewCount} + 1\` })` for atomic SQL increment.

### PERF-1: Missing index on links.orgId
- **File:** `apps/api/src/db/schema.ts`
- **Issue:** Org-scoped link queries (`WHERE org_id = ?`) had no index, causing full table scans.
- **Fix:** Added `index('idx_links_org_id').on(table.orgId)`.

### SEC-4: No SSRF check on webhook URL creation
- **File:** `apps/api/src/routes/webhooks.ts`
- **Issue:** Webhook endpoint accepted any URL including private IPs (localhost, 10.x, 169.254.169.254). Attackers could probe internal services.
- **Fix:** Added `isPrivateUrl(url)` check before inserting webhook endpoint.

### SEC-5: S3 deletePrefix doesn't paginate beyond 1000 objects
- **File:** `apps/api/src/services/storage.ts`
- **Issue:** `ListObjectsV2` returns max 1000 keys. Links with >1000 rendered pages (or many HLS segments) wouldn't be fully cleaned up on delete.
- **Fix:** Added pagination loop with `ContinuationToken`.

### ERR-4: Inconsistent error response format in viewer endpoints
- **File:** `apps/api/src/routes/views.ts`
- **Issue:** Some viewer endpoints used `c.json({ error: ... })` directly instead of the `errorResponse()` helper, producing inconsistent response shapes.
- **Fix:** Replaced all raw `c.json()` error responses with `errorResponse(c, Errors.*)` calls.

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| API (11 files) | 176 | All pass |
| SDK (1 file) | 23 | All pass |
| **Total** | **199** | **All pass** |

Build: 6/6 packages clean (shared, api, web, viewer, site, sdk)

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/index.ts` | Path traversal guard on `/internal/files/*` |
| `apps/api/src/services/storage.ts` | Path traversal in LocalStorage, S3 pagination |
| `apps/api/src/middleware/session.ts` | Hash session token before lookup |
| `apps/api/src/routes/auth.ts` | Hash session tokens, transaction for registration |
| `apps/api/src/routes/views.ts` | Hash viewer tokens, atomic view count, consistent errors |
| `apps/api/src/routes/webhooks.ts` | SSRF check on webhook URL |
| `apps/api/src/workers/renderer.ts` | Catch unawaited processJob promises |
| `apps/api/src/services/renderer.ts` | Timeouts on pdftoppm/pdfinfo |
| `apps/api/src/db/schema.ts` | Add idx_links_org_id index |
| `apps/api/drizzle/0001_calm_wasp.sql` | Migration: notifications table + spending_cap + org_id index |
| `apps/api/src/__tests__/video.test.ts` | Updated to use hashed session tokens in DB lookups |
