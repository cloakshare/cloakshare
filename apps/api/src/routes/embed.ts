import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { links } from '../db/schema.js';
import { config } from '../lib/config.js';
import { successResponse, errorResponse, Errors } from '../lib/errors.js';
import type { Variables } from '../lib/types.js';

const embedRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/embed/:id — Get embed configuration
// ============================================

embedRouter.get('/v1/embed/:id', async (c) => {
  const linkId = c.req.param('id');

  const link = await db.select().from(links)
    .where(eq(links.id, linkId))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  if (link.status !== 'active') {
    return errorResponse(c, Errors.validation(`Link is ${link.status}`));
  }

  // Embed config for the PostMessage API
  return successResponse(c, {
    id: link.id,
    viewer_url: `${config.viewerUrl}/s/${link.id}?embed=true`,
    page_count: link.pageCount,
    require_email: link.requireEmail,
    has_password: !!link.passwordHash,
    brand_name: link.brandName,
    brand_color: link.brandColor,
  });
});

// ============================================
// GET /v1/embed/:id/snippet — Get embeddable HTML snippet
// ============================================

embedRouter.get('/v1/embed/:id/snippet', async (c) => {
  const linkId = c.req.param('id');
  const rawWidth = c.req.query('width') || '100%';
  const rawHeight = c.req.query('height') || '600px';
  // Sanitize width/height to prevent XSS via attribute injection
  const width = rawWidth.replace(/[^a-zA-Z0-9%_.]/g, '');
  const height = rawHeight.replace(/[^a-zA-Z0-9%_.]/g, '');

  const link = await db.select({ id: links.id, status: links.status })
    .from(links)
    .where(eq(links.id, linkId))
    .get();

  if (!link) {
    return errorResponse(c, Errors.notFound('Link'));
  }

  const viewerUrl = `${config.viewerUrl}/s/${linkId}?embed=true`;

  const snippet = `<!-- Cloak Embedded Viewer -->
<iframe
  src="${viewerUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="clipboard-write"
  style="border: 1px solid #27272A; border-radius: 8px;"
></iframe>
<script>
  // Cloak PostMessage API
  window.addEventListener('message', function(e) {
    if (e.origin !== '${config.viewerUrl}') return;
    var data = e.data;
    if (data.type === 'cloak:ready') {
      if (window.CloakEmbed && window.CloakEmbed.onReady) window.CloakEmbed.onReady(data);
    } else if (data.type === 'cloak:view') {
      if (window.CloakEmbed && window.CloakEmbed.onView) window.CloakEmbed.onView(data);
    } else if (data.type === 'cloak:complete') {
      if (window.CloakEmbed && window.CloakEmbed.onComplete) window.CloakEmbed.onComplete(data);
    }
  });
</script>`;

  return successResponse(c, { snippet, viewer_url: viewerUrl });
});

export default embedRouter;
