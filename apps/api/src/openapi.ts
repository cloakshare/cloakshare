/**
 * OpenAPI 3.1 specification for the CloakShare API.
 *
 * This is a hand-maintained spec that mirrors the actual route implementations.
 * It powers the Scalar API reference at /docs and the JSON spec at /v1/openapi.json.
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'CloakShare API',
    version: '1.0.0',
    description: 'Secure document and video sharing API with tokenized links, dynamic watermarks, and real-time analytics.',
    contact: {
      name: 'CloakShare',
      url: 'https://cloakshare.dev',
      email: 'support@cloakshare.dev',
    },
    license: {
      name: 'MIT',
      url: 'https://github.com/cloakshare/cloakshare/blob/main/LICENSE',
    },
  },
  servers: [
    { url: 'https://api.cloakshare.dev', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key authentication. Keys start with `ck_live_` or `ck_test_`.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'NOT_FOUND' },
          message: { type: 'string', example: 'Link not found' },
          doc_url: { type: 'string', format: 'uri', example: 'https://docs.cloakshare.dev/errors/not-found' },
        },
        required: ['code', 'message'],
      },
      Link: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'lnk_xK9mP2qR' },
          secure_url: { type: 'string', format: 'uri', example: 'https://view.cloakshare.dev/s/lnk_xK9mP2qR' },
          analytics_url: { type: 'string', format: 'uri' },
          progress_url: { type: 'string', format: 'uri' },
          name: { type: 'string', nullable: true, example: 'Q4 Pitch Deck' },
          file_type: { type: 'string', example: 'pdf' },
          status: { type: 'string', enum: ['processing', 'active', 'expired', 'revoked', 'failed'] },
          rules: {
            type: 'object',
            properties: {
              expires_at: { type: 'string', nullable: true },
              max_views: { type: 'integer', nullable: true },
              require_email: { type: 'boolean' },
              allowed_domains: { type: 'array', items: { type: 'string' }, nullable: true },
              has_password: { type: 'boolean' },
              block_download: { type: 'boolean' },
              watermark: { type: 'boolean' },
            },
          },
          view_count: { type: 'integer', example: 42 },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'whk_a1b2c3' },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          secret: { type: 'string', description: 'Only returned on creation' },
          active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  tags: [
    { name: 'Links', description: 'Create, manage, and analyze secure links' },
    { name: 'Webhooks', description: 'Manage webhook endpoints for real-time notifications' },
    { name: 'Viewers', description: 'Viewer verification and GDPR data management' },
    { name: 'Teams', description: 'Organization and team member management' },
    { name: 'Audit Log', description: 'View organization activity history' },
    { name: 'Notifications', description: 'Real-time view notifications via SSE' },
    { name: 'System', description: 'Health and status endpoints' },
  ],
  paths: {
    '/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'Health check',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'Service is healthy',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } },
          },
        },
      },
    },
    '/v1/links': {
      post: {
        operationId: 'createLink',
        summary: 'Create a secure link',
        description: 'Upload a file and create a tokenized secure link with optional email gate, watermark, password, and expiry. Supports PDF, DOCX, PPTX, XLSX, MP4, MOV, WebM, and more.',
        tags: ['Links'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'File to secure' },
                  name: { type: 'string', description: 'Display name', example: 'Q4 Pitch Deck' },
                  require_email: { type: 'boolean', description: 'Require email to view', example: true },
                  watermark: { type: 'boolean', description: 'Enable dynamic watermark', example: true },
                  watermark_template: { type: 'string', example: '{{email}} · {{date}}' },
                  password: { type: 'string', description: 'Password protect the link' },
                  expires_in: { type: 'string', description: 'Expiry duration', example: '7d' },
                  max_views: { type: 'integer', description: 'Max views before expiry', example: 50 },
                  allowed_domains: { type: 'string', description: 'Comma-separated email domains', example: '@acme.com,@partner.com' },
                },
                required: ['file'],
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  upload_r2_key: { type: 'string', description: 'Key from presigned upload' },
                  filename: { type: 'string' },
                  name: { type: 'string' },
                  require_email: { type: 'boolean' },
                  watermark: { type: 'boolean' },
                  password: { type: 'string' },
                  expires_in: { type: 'string' },
                  max_views: { type: 'integer' },
                  allowed_domains: { type: 'array', items: { type: 'string' } },
                },
                required: ['upload_r2_key', 'filename'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Link created',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Link' }, error: { type: 'null' } } } } },
          },
          400: { description: 'Validation error' },
          401: { description: 'Invalid or missing API key' },
          429: { description: 'Rate limit exceeded' },
        },
      },
      get: {
        operationId: 'listLinks',
        summary: 'List links',
        description: 'List all links for the authenticated user with optional filtering and pagination.',
        tags: ['Links'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'expired', 'revoked', 'processing', 'failed'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['created_at', 'view_count', 'name'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { description: 'List of links' },
          401: { description: 'Invalid API key' },
        },
      },
    },
    '/v1/links/{id}': {
      get: {
        operationId: 'getLink',
        summary: 'Get a link',
        tags: ['Links'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Link details', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Link' } } } } } },
          404: { description: 'Link not found' },
        },
      },
      delete: {
        operationId: 'revokeLink',
        summary: 'Revoke a link',
        description: 'Revoke a link, preventing all future access. This action cannot be undone.',
        tags: ['Links'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Link revoked' },
          404: { description: 'Link not found' },
        },
      },
    },
    '/v1/links/{id}/analytics': {
      get: {
        operationId: 'getLinkAnalytics',
        summary: 'Get link analytics',
        description: 'Get detailed view analytics including per-viewer engagement data, page times, and completion rates.',
        tags: ['Links'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Analytics data' },
          404: { description: 'Link not found' },
        },
      },
    },
    '/v1/links/upload-url': {
      post: {
        operationId: 'getUploadUrl',
        summary: 'Get presigned upload URL',
        description: 'Get a presigned URL for direct file upload (for files > 10MB). Upload the file directly to the URL, then create a link using the returned upload_key.',
        tags: ['Links'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  filename: { type: 'string', example: 'pitch-deck.pdf' },
                  content_type: { type: 'string', example: 'application/pdf' },
                  file_size: { type: 'integer', example: 50000000 },
                },
                required: ['filename', 'content_type', 'file_size'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Presigned upload URL and key' },
          400: { description: 'Invalid request' },
        },
      },
    },
    '/v1/viewer/{token}': {
      get: {
        operationId: 'getViewerMetadata',
        summary: 'Get link metadata for viewer',
        description: 'Get metadata about a link for the viewer UI. Returns gate requirements (email, password), status, and branding.',
        tags: ['Viewers'],
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Link metadata' },
          202: { description: 'Link is still processing' },
          404: { description: 'Link not found' },
          410: { description: 'Link expired or revoked' },
        },
      },
    },
    '/v1/viewer/{token}/verify': {
      post: {
        operationId: 'verifyViewer',
        summary: 'Verify viewer access',
        description: 'Verify email and/or password to start a view session. Returns session token and page URLs (with server-side watermarks baked in).',
        tags: ['Viewers'],
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'viewer@acme.com' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Session created with page URLs' },
          403: { description: 'Access denied (wrong password, domain not allowed)' },
          404: { description: 'Link not found or not active' },
          410: { description: 'Link expired' },
          429: { description: 'Too many verification attempts' },
        },
      },
    },
    '/v1/viewer/{token}/page/{pageNumber}': {
      get: {
        operationId: 'getViewerPage',
        summary: 'Get watermarked page on-demand',
        description: 'Get a signed URL for a specific watermarked page. Used for lazy-loading pages in large documents (>10 pages).',
        tags: ['Viewers'],
        security: [],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'pageNumber', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
          { name: 'X-Session-Token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Signed URL for the watermarked page' },
          401: { description: 'Session expired or invalid' },
          400: { description: 'Invalid page number' },
        },
      },
    },
    '/v1/viewer/{token}/track': {
      post: {
        operationId: 'trackView',
        summary: 'Track view engagement',
        description: 'Report viewer engagement data (page times, duration, completion). Called every 5 seconds by the viewer client.',
        tags: ['Viewers'],
        security: [],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-Session-Token', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  current_page: { type: 'integer' },
                  total_duration: { type: 'number' },
                  page_times: { type: 'object', additionalProperties: { type: 'number' } },
                  is_final: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          204: { description: 'Tracking recorded' },
        },
      },
    },
    '/v1/viewers/{email}': {
      delete: {
        operationId: 'deleteViewerData',
        summary: 'Delete viewer data (GDPR)',
        description: 'Delete all viewing data associated with an email address. Required for GDPR compliance.',
        tags: ['Viewers'],
        parameters: [{ name: 'email', in: 'path', required: true, schema: { type: 'string', format: 'email' } }],
        responses: {
          200: { description: 'Viewer data deleted' },
          401: { description: 'Invalid API key' },
        },
      },
    },
    '/v1/webhooks': {
      post: {
        operationId: 'createWebhook',
        summary: 'Create a webhook',
        description: 'Register a webhook endpoint to receive real-time notifications for link events.',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri', example: 'https://your-app.com/webhook' },
                  events: { type: 'array', items: { type: 'string', enum: ['link.created', 'link.viewed', 'link.expired', 'link.revoked', 'link.ready', 'link.render_failed'] } },
                },
                required: ['url', 'events'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Webhook created (includes signing secret)' },
          400: { description: 'Invalid URL or events' },
        },
      },
      get: {
        operationId: 'listWebhooks',
        summary: 'List webhooks',
        tags: ['Webhooks'],
        responses: {
          200: { description: 'List of webhook endpoints' },
        },
      },
    },
    '/v1/webhooks/{id}': {
      get: {
        operationId: 'getWebhook',
        summary: 'Get a webhook',
        tags: ['Webhooks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Webhook details' },
          404: { description: 'Not found' },
        },
      },
      delete: {
        operationId: 'deleteWebhook',
        summary: 'Delete a webhook',
        tags: ['Webhooks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Webhook deleted' },
          404: { description: 'Not found' },
        },
      },
    },
    '/v1/notifications/stream': {
      get: {
        operationId: 'streamNotifications',
        summary: 'Stream notifications (SSE)',
        description: 'Real-time notification stream via Server-Sent Events. Emits events when links are viewed, expire, or complete rendering.',
        tags: ['Notifications'],
        responses: {
          200: { description: 'SSE event stream', content: { 'text/event-stream': {} } },
        },
      },
    },
    '/v1/notifications': {
      get: {
        operationId: 'listNotifications',
        summary: 'List notifications',
        tags: ['Notifications'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'unread', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'List of notifications' },
        },
      },
    },
    '/v1/notifications/{id}/read': {
      patch: {
        operationId: 'markNotificationRead',
        summary: 'Mark notification as read',
        tags: ['Notifications'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Notification marked as read' },
        },
      },
    },
    '/v1/org/members': {
      get: {
        operationId: 'listOrgMembers',
        summary: 'List organization members',
        tags: ['Teams'],
        responses: {
          200: { description: 'Members and pending invites' },
        },
      },
    },
    '/v1/org/members/invite': {
      post: {
        operationId: 'inviteMember',
        summary: 'Invite a member',
        tags: ['Teams'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['viewer', 'member', 'admin'] },
                },
                required: ['email', 'role'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Invite sent' },
        },
      },
    },
    '/v1/org/members/{id}': {
      patch: {
        operationId: 'changeMemberRole',
        summary: 'Change member role',
        tags: ['Teams'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string' } }, required: ['role'] } } },
        },
        responses: {
          200: { description: 'Role updated' },
        },
      },
      delete: {
        operationId: 'removeMember',
        summary: 'Remove a member',
        tags: ['Teams'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Member removed' },
        },
      },
    },
    '/v1/org/audit-log': {
      get: {
        operationId: 'getAuditLog',
        summary: 'Get audit log',
        description: 'View organization activity history. Available on Growth and Scale plans.',
        tags: ['Audit Log'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Audit log entries' },
        },
      },
    },
  },
};
