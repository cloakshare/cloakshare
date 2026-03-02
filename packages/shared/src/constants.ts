// Link statuses
export const LINK_STATUS = {
  PROCESSING: 'processing',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  FAILED: 'failed',
} as const;

// API key prefix
export const API_KEY_PREFIX = 'ck_';
export const API_KEY_LIVE_PREFIX = 'ck_live_';
export const API_KEY_TEST_PREFIX = 'ck_test_';
export const API_KEY_DEMO_PREFIX = 'ck_demo_';

// Rendering
export const RENDER_DPI = 150;
export const RENDER_MAX_WIDTH = 1600;
export const RENDER_WEBP_QUALITY = 85;
export const THUMBNAIL_WIDTH = 400;
export const THUMBNAIL_WEBP_QUALITY = 75;

// Concurrency limits
export const MAX_CONCURRENT_RENDERS = 2;
export const MAX_CONCURRENT_SHARP_OPS = 3;

// File limits
export const MAX_FILE_SIZE = 100_000_000; // 100 MB
export const DEMO_MAX_FILE_SIZE = 20_000_000; // 20 MB
export const DEMO_MAX_PAGES = 10;

// Video support
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'avi'] as const;
export const VIDEO_MAX_FILE_SIZE = 500_000_000; // 500 MB
export const MAX_CONCURRENT_TRANSCODES = 1;
export const VIDEO_SEGMENT_DURATION = 6; // HLS segment seconds
export const VIDEO_SIGNED_URL_EXPIRY = 300; // 5 min for segment URLs

export const VIDEO_TRANSCODE_PROFILES = {
  '720p': { width: 1280, height: 720, videoBitrate: '2500k', audioBitrate: '128k' },
  '1080p': { width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
} as const;

export type VideoQuality = keyof typeof VIDEO_TRANSCODE_PROFILES;

// Free tier limits
export const FREE_TIER_LIMITS = {
  linksPerMonth: 50,
  viewsPerMonth: 500,
  maxExpiryDays: 7,
  apiRateLimit: 10, // per minute
  storageGb: 1,
} as const;

// Paid tier limits
export const PLAN_LIMITS = {
  free: {
    linksPerMonth: 50,
    viewsPerMonth: 500,
    maxExpiryDays: 7,
    apiRateLimit: 10,
    webhooks: false,
    passwordProtection: false,
    perPageAnalytics: false,
  },
  starter: {
    linksPerMonth: 500,
    viewsPerMonth: 10_000,
    maxExpiryDays: 90,
    apiRateLimit: 60,
    webhooks: true,
    passwordProtection: true,
    perPageAnalytics: true,
  },
  growth: {
    linksPerMonth: 2_500,
    viewsPerMonth: 25_000,
    maxExpiryDays: 365,
    apiRateLimit: 300,
    webhooks: true,
    passwordProtection: true,
    perPageAnalytics: true,
  },
  scale: {
    linksPerMonth: 10_000,
    viewsPerMonth: 100_000,
    maxExpiryDays: -1, // unlimited
    apiRateLimit: 1_000,
    webhooks: true,
    passwordProtection: true,
    perPageAnalytics: true,
  },
} as const;

// Webhook events
export const WEBHOOK_EVENTS = [
  'link.created',
  'link.viewed',
  'link.expired',
  'link.revoked',
  'link.ready',
  'link.render_failed',
  'link.max_views_reached',
  'link.password_failed',
] as const;

// Watermark defaults
export const DEFAULT_WATERMARK_TEMPLATE = '{{email}} · {{date}} · {{session_id}}';

// Office document extensions (supported for conversion to PDF)
export const OFFICE_FILE_EXTENSIONS = [
  'docx', 'doc', 'odt', 'rtf',
  'pptx', 'ppt', 'odp',
  'xlsx', 'xls', 'ods',
] as const;

// All supported file extensions (images + PDF + Office + Video)
export const ALL_SUPPORTED_EXTENSIONS = [
  'pdf', 'png', 'jpg', 'jpeg', 'webp',
  ...OFFICE_FILE_EXTENSIONS,
  ...VIDEO_FILE_EXTENSIONS,
] as const;

// MIME type to extension mapping for video files
export const VIDEO_MIME_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
};

// MIME type to extension mapping for Office documents
export const OFFICE_MIME_TYPES: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.oasis.opendocument.text': 'odt',
  'text/rtf': 'rtf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
};

// Organization roles
export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

// Seat limits per plan
export const SEAT_LIMITS = {
  free: { included: 1, additional: false as const },
  starter: { included: 2, additional: true as const, perSeatPrice: 10 },
  growth: { included: 5, additional: true as const, perSeatPrice: 10 },
  scale: { included: 15, additional: true as const, perSeatPrice: 10 },
} as const;

// Rate limits per tier (requests per minute)
export const RATE_LIMITS = {
  free:    { default: 30,   upload: 3,   analytics: 10  },
  starter: { default: 120,  upload: 10,  analytics: 60  },
  growth:  { default: 300,  upload: 25,  analytics: 120 },
  scale:   { default: 1000, upload: 100, analytics: 300 },
} as const;

// Audit log retention (days)
export const AUDIT_RETENTION_DAYS = {
  free: 0,
  starter: 0,
  growth: 90,
  scale: 365,
} as const;
