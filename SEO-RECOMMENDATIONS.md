# CloakShare.dev — SEO & Growth Recommendations

**Date:** 2026-03-26
**GSC Period:** Last 3 months (Dec 25 2025 – Mar 24 2026)
**Status:** Zero impressions. Likely not fully indexed yet.
**Distribution Engine:** no llms.txt, AI BLOCKED, no MCP, 5 competitors tracked, 3 actions (3 done)

> **IMPORTANT: Implementation Guidelines**
> All recommendations below MUST be implemented in a way that:
> 1. **Does NOT negatively affect existing SEO** — no removing indexed pages, no changing URLs without redirects, no altering working meta tags or Astro-generated static HTML
> 2. **Does NOT negatively affect GEO (Generative Engine Optimization)** — currently AI crawlers are BLOCKED. Adding llms.txt and unblocking AI crawlers is a priority fix, but must be done carefully without disrupting existing robots.txt rules
> 3. **Does NOT negatively affect AEO (Answer Engine Optimization)** — existing SoftwareApplication, HowTo, and FAQ schema must be preserved when adding new schema types
> 4. **Does NOT break existing functionality** — Astro build pipeline, Vercel deployment, Turbo monorepo, embed viewer, API connections to app.cloakshare.dev, and all static page generation must continue working. Test with `pnpm turbo run build --filter=@cloak/site` before deploying.
>
> **CRITICAL:** Distribution Engine shows AI crawlers are BLOCKED and no llms.txt exists. This must be fixed as a top priority — see recommendation below.

---

## GSC Snapshot

| Metric | Value |
|--------|-------|
| Total Impressions | 0 |
| Total Clicks | 0 |
| Queries | None |
| Pages Indexed | Unknown — possibly zero |

**Zero impressions in 3 months is unusual** even for a new site. Either Google hasn't crawled/indexed the site, or there's a technical blocker. The recent rebrand (all content dated Feb 28 – Mar 6, 2026) means the new version is only ~3 weeks old, which partially explains this.

---

## Tech Stack Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| Framework | Astro 5.7.10 (SSG) | Excellent for SEO — pure static HTML |
| Hosting | Vercel | Fast CDN, good crawlability |
| Sitemap | Static, 13 URLs | **Missing 20+ pages (blog posts, comparisons)** |
| Schema Markup | Good | SoftwareApplication, HowTo, FAQ |
| robots.txt | Well-configured | AI crawlers allowed, /app/ and /api/ blocked |
| Blog Posts | 16 Astro files | Good volume for a new site |
| Comparison Pages | 6 competitors | DocSend, Papermark, PandaDoc, Peony, Digify, Google Docs |
| Use Case Pages | 5 verticals | Sales, Investors, Training, Developers, Creators |
| Analytics | PostHog (optional) | Not confirmed active |
| OG Image | MISSING | og-default.png referenced but doesn't exist |
| GSC Verification | Present | google635584da9233a19e.html exists |

---

## Priority 0: AI Visibility (Distribution Engine Alert)

Your Distribution Engine shows **AI crawlers are BLOCKED** and **no llms.txt exists**. This means ChatGPT, Claude, Perplexity, and other AI search engines cannot cite or recommend CloakShare.

### 0a. Create llms.txt
Create `/apps/site/public/llms.txt` with a structured description of CloakShare — what it does, pricing, features, competitive advantages. This file is read by AI crawlers to understand your product for citations.

### 0b. Verify AI Crawler Access in robots.txt
Your robots.txt currently says it allows AI crawlers, but the Distribution Engine reports them as blocked. Verify:
- GPTBot, ClaudeBot, PerplexityBot are explicitly `Allow: /`
- No Vercel-level or CDN-level blocking of these user agents
- Test by fetching your site with these user agent strings

### 0c. Consider MCP Server
SiteCrawlIQ, AuditKit, and OTDCheck all have MCP (Model Context Protocol) integrations. CloakShare has `@cloakshare/sdk` but no MCP server. Adding one would improve AI tool integration visibility.

---

## Priority 1: Critical Fixes (Why You Have Zero Impressions)

### 1. Update Sitemap to Include ALL Pages (CRITICAL)
Your sitemap only has 13 URLs but the site has 33+ pages. Missing from sitemap:
- All 16 individual blog posts (`/blog/track-pdf-views`, `/blog/docsend-alternatives`, etc.)
- 3 comparison pages (`/compare/digify`, `/compare/peony`, `/compare/google-docs`)
- `/for/developers`, `/for/creators`
- `/use-cases/investor-relations`, `/use-cases/training-content`

**Google can't index pages it doesn't know about.** With an SSG site, the sitemap is the primary discovery mechanism.

**Fix:** Update `/apps/site/public/sitemap.xml` to include all 33+ public pages with proper priorities:
- Blog posts: priority 0.7, changefreq monthly
- Comparison pages: priority 0.7, changefreq monthly
- Use case pages: priority 0.8, changefreq monthly

### 2. Create the OG Image (CRITICAL)
`og:image` references `/og-default.png` but the file doesn't exist. This means:
- Social sharing previews are broken (Twitter, LinkedIn, Facebook)
- Google may penalize for referencing missing resources
- Any social distribution effort is hampered

**Fix:** Create a 1200x630px branded image at `/apps/site/public/og-default.png`.

### 3. Resubmit Sitemap to GSC
After fixing the sitemap:
1. Go to GSC → Sitemaps
2. Submit `https://cloakshare.dev/sitemap.xml`
3. Request indexing for the homepage manually
4. Monitor Coverage report for crawl errors

### 4. Verify Google Can Actually Crawl the Site
Check in GSC:
- URL Inspection tool → test your homepage
- Coverage report → look for excluded/error pages
- Verify DNS, SSL, and Vercel deployment are all working

---

## Priority 2: SEO Infrastructure Gaps

### 5. Add Organization Schema
Currently only SoftwareApplication schema at site level. Add:
```json
{
  "@type": "Organization",
  "name": "CloakShare",
  "url": "https://cloakshare.dev",
  "logo": "https://cloakshare.dev/logo.png",
  "sameAs": ["https://twitter.com/cloakshare", "https://github.com/cloakshare/cloakshare"]
}
```

### 6. Add BreadcrumbList Schema
No breadcrumb structured data on blog posts or comparison pages. Add JSON-LD:
- Blog posts: Home > Blog > [Post Title]
- Comparisons: Home > Compare > [vs Competitor]
- Use cases: Home > [Use Case Name]

### 7. Add Article Schema to Blog Posts
Blog posts need proper Article/BlogPosting schema with:
- headline, description, datePublished, dateModified
- author, publisher
- wordCount, keywords

### 8. Implement Google Analytics
PostHog is optional (env var gated) and may not be active. Add GA4 for:
- Page view tracking
- CTA click tracking ("Get API Key", "Try Cloud Free")
- Blog engagement metrics

### 9. Add RSS Feed
No RSS feed exists. For a blog with 16 posts, RSS helps with:
- Feed reader discovery
- Automated syndication
- Crawler discovery of new content

---

## Priority 3: Content & Internal Linking

### 10. Optimize Logo Image
`logo.png` is 1.5 MB — should be compressed to ~100-200 KB. Use Astro's built-in image optimization or manually compress.

### 11. Add "Related Posts" to Blog Articles
Each blog post is currently isolated. Add a related posts section linking to 2-3 topically related articles. This:
- Increases crawl depth
- Keeps users on site longer
- Distributes page authority

### 12. Internal Linking Within Blog Content
Blog posts don't cross-link to each other or to product pages within the body text. Add contextual links:
- "docsend-alternatives" post → link to `/compare/docsend`
- "track-pdf-views" post → link to `/embed` (the viewer feature)
- "pitch-deck-analytics" → link to `/for/investor-relations`

### 13. Add `meta name="robots" content="index, follow"` to Key Pages
Currently only using noindex selectively. Explicitly declaring `index, follow` on important pages is a positive signal.

---

## Priority 4: Content Expansion

### Blog Post Ideas (Targeting Search Volume)
1. "How to Share a Pitch Deck Securely (2026 Guide)"
2. "DocSend Pricing in 2026: Is It Worth It?" (you have this — ensure it's optimized)
3. "Best Document Sharing Platforms for Startups"
4. "How to Track Who Viewed Your PDF"
5. "Secure File Sharing for Due Diligence"
6. "Self-Hosted vs Cloud Document Sharing: Pros & Cons"
7. "How to Add a Watermark to a PDF Before Sharing"
8. "Investor Data Room Setup Guide"
9. "PandaDoc vs DocSend vs CloakShare: Full Comparison"
10. "Open Source Document Sharing Tools Compared"

### Comparison Page Expansion
Current: DocSend, Papermark, PandaDoc, Peony, Digify, Google Docs
Add: Notion, Dropbox, Box, SharePoint, Brieflink, Pitch.com

---

## Monitoring Checklist

- [ ] Fix sitemap (add all 33+ pages) and deploy
- [ ] Create og-default.png and deploy
- [ ] Resubmit sitemap to GSC
- [ ] Request indexing for homepage + top 5 pages in GSC URL Inspection
- [ ] Verify Coverage report shows pages being indexed within 1 week
- [ ] Enable GA4 or activate PostHog
- [ ] Check for first impressions in GSC within 2 weeks
- [ ] Compress logo.png from 1.5 MB to < 200 KB

---

## Summary

CloakShare has excellent content (16 blog posts, 6 comparison pages, 5 use-case pages) and a great tech stack (Astro SSG on Vercel = fast, crawlable static HTML). But **Google doesn't know most of this content exists** because the sitemap only lists 13 of 33+ pages.

The fix is straightforward:
1. Update the sitemap to include ALL pages
2. Create the missing OG image
3. Resubmit to GSC

With Astro's static HTML output, once Google discovers the pages, indexing should be fast. You should see impressions within 1-2 weeks of fixing the sitemap.
