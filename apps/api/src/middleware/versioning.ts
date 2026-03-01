import type { Context, Next } from 'hono';

/**
 * Adds X-API-Version header to all responses.
 */
export async function apiVersionHeader(c: Context, next: Next) {
  await next();
  c.header('X-API-Version', 'v1');
}

/**
 * Sunset middleware for deprecated API versions.
 * Adds RFC 8594 Sunset and RFC 9745 Deprecation headers.
 */
export function sunsetMiddleware(deprecationDate: string, sunsetDate: string, successorUrl: string) {
  return async (c: Context, next: Next) => {
    c.header('Deprecation', deprecationDate);
    c.header('Sunset', sunsetDate);
    c.header('Link', `<${successorUrl}>; rel="successor-version"`);
    await next();
  };
}

/**
 * Handler for unknown API versions.
 * Catches /v{N}/* where N is not a recognized version.
 */
export function unknownVersionHandler(c: Context) {
  const path = c.req.path;
  const match = path.match(/^\/v(\d+)\//);
  const version = match?.[1] || '?';

  return c.json({
    data: null,
    error: {
      code: 'UNKNOWN_API_VERSION',
      message: `API version v${version} does not exist. Current version: v1.`,
      docs_url: 'https://docs.cloakshare.dev/api-versions',
    },
  }, 404);
}

/**
 * Handler for sunsetted API versions that no longer function.
 */
export function goneHandler(migrationUrl: string) {
  return (c: Context) => {
    return c.json({
      data: null,
      error: {
        code: 'API_VERSION_SUNSET',
        message: 'This API version is no longer available. Please migrate to the latest version.',
        migration_guide: migrationUrl,
      },
    }, 410);
  };
}
