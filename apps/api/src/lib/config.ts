import type { CloakMode, StorageProvider, DatabaseProvider } from '@cloak/shared';

const INSECURE_DEFAULT = 'change-me-in-production';

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  viewerUrl: process.env.VIEWER_URL || 'http://localhost:5173',
  dashboardUrl: process.env.DASHBOARD_URL || process.env.WEB_URL || 'http://localhost:5174',
  apiVersion: 'v1',

  // Mode
  mode: (process.env.CLOAK_MODE || 'self-hosted') as CloakMode,

  // Database
  database: {
    provider: (process.env.DB_PROVIDER || 'sqlite') as DatabaseProvider,
    sqlitePath: process.env.SQLITE_PATH || './data/cloak.db',
    tursoUrl: process.env.TURSO_DATABASE_URL,
    tursoToken: process.env.TURSO_AUTH_TOKEN,
  },

  // Storage
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'local') as StorageProvider,
    localPath: process.env.STORAGE_LOCAL_PATH || './data/renders',
    s3Endpoint: process.env.S3_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    s3Region: process.env.S3_REGION || 'auto',
    s3AccessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
    s3BucketName: process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'cloak-renders',
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },

  // Auth
  sessionSecret: process.env.SESSION_SECRET || INSECURE_DEFAULT,
  jwtSecret: process.env.JWT_SECRET || INSECURE_DEFAULT,
  signingSecret: process.env.CLOAK_SIGNING_SECRET || INSECURE_DEFAULT,

  // CORS origins (configurable via env)
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['https://cloakshare.dev', 'https://app.cloakshare.dev'],

  // Stripe (cloud mode only)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    starterPriceId: process.env.STRIPE_STARTER_PRICE_ID,
    growthPriceId: process.env.STRIPE_GROWTH_PRICE_ID,
    scalePriceId: process.env.STRIPE_SCALE_PRICE_ID,
    linkMeterId: process.env.STRIPE_LINK_METER_ID,
    viewMeterId: process.env.STRIPE_VIEW_METER_ID,
  },

  // Email (cloud mode only)
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@cloakshare.dev',
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Features gated by mode
  features: {
    webhooks: true, // Webhooks available for all modes
    analyticsDashboard: process.env.CLOAK_MODE === 'cloud',
    customDomains: process.env.CLOAK_MODE === 'cloud',
    billing: process.env.CLOAK_MODE === 'cloud',
    emailNotifications: process.env.CLOAK_MODE === 'cloud',
    geoEnrichment: process.env.CLOAK_MODE === 'cloud',
    embedViewer: process.env.CLOAK_MODE === 'cloud',
    video: process.env.CLOAK_MODE === 'cloud' || process.env.ENABLE_VIDEO === 'true',
    branding: process.env.CLOAK_MODE === 'cloud',
  },

  get isDev() {
    return this.nodeEnv === 'development';
  },

  get isProd() {
    return this.nodeEnv === 'production';
  },

  get isSelfHosted() {
    return this.mode === 'self-hosted';
  },

  get isCloud() {
    return this.mode === 'cloud';
  },
};

// ============================================
// STARTUP VALIDATION
// ============================================

if (config.isProd) {
  const insecureSecrets: string[] = [];
  if (config.sessionSecret === INSECURE_DEFAULT) insecureSecrets.push('SESSION_SECRET');
  if (config.jwtSecret === INSECURE_DEFAULT) insecureSecrets.push('JWT_SECRET');
  if (config.signingSecret === INSECURE_DEFAULT) insecureSecrets.push('CLOAK_SIGNING_SECRET');

  if (insecureSecrets.length > 0) {
    console.error(
      `\n[FATAL] The following secrets are using insecure defaults:\n` +
      insecureSecrets.map(s => `  - ${s}`).join('\n') +
      `\n\nSet unique, random values for these environment variables before running in production.\n` +
      `Example: openssl rand -hex 32\n`
    );
    process.exit(1);
  }
}
