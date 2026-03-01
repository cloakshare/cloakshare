import { Hono } from 'hono';
import { openApiSpec } from '../openapi.js';
import type { Variables } from '../lib/types.js';

const docsRouter = new Hono<{ Variables: Variables }>();

// ============================================
// GET /v1/openapi.json — OpenAPI spec
// ============================================

docsRouter.get('/v1/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// ============================================
// GET /docs — Interactive API reference (Scalar)
// ============================================

docsRouter.get('/docs', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloakShare API Reference</title>
  <meta name="description" content="Full API reference for the CloakShare secure document and video sharing API.">
  <style>
    :root {
      --scalar-color-1: #FAFAFA;
      --scalar-color-2: #A1A1AA;
      --scalar-color-3: #71717A;
      --scalar-color-accent: #00FF88;
      --scalar-background-1: #09090B;
      --scalar-background-2: #111113;
      --scalar-background-3: #1A1A1D;
      --scalar-border-color: #27272A;
      --scalar-font: 'Geist Sans', 'General Sans', -apple-system, sans-serif;
      --scalar-font-code: 'JetBrains Mono', 'Fira Code', monospace;
    }
  </style>
</head>
<body>
  <script id="api-reference" data-url="/v1/openapi.json" data-configuration='${JSON.stringify({
    theme: 'kepler',
    metaData: {
      title: 'CloakShare API Reference',
      description: 'Full API reference for the CloakShare secure document and video sharing API.',
    },
    hideModels: false,
    hideDownloadButton: false,
    hiddenClients: [],
  })}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return c.html(html);
});

export default docsRouter;
