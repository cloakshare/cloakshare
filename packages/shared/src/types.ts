import type { LINK_STATUS, WEBHOOK_EVENTS, PLAN_LIMITS } from './constants.js';

// Plan types
export type Plan = keyof typeof PLAN_LIMITS;

// Link status
export type LinkStatus = (typeof LINK_STATUS)[keyof typeof LINK_STATUS];

// Webhook event types
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// API response envelope
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Link types
export interface LinkRules {
  expires_at: string | null;
  max_views: number | null;
  require_email: boolean;
  allowed_domains: string[] | null;
  has_password: boolean;
  block_download: boolean;
  watermark: boolean;
}

export interface LinkResponse {
  id: string;
  secure_url: string;
  analytics_url: string;
  name: string | null;
  file_type: string;
  page_count: number | null;
  status: LinkStatus;
  rules: LinkRules;
  view_count: number;
  created_at: string;
}

// View types
export interface ViewResponse {
  viewer_email: string | null;
  viewed_at: string;
  duration: number | null;
  pages_viewed: number | null;
  completion_rate: number | null;
  country: string | null;
  city: string | null;
  device: string | null;
}

// Webhook types
export interface WebhookPayload {
  id: string;
  type: WebhookEvent;
  created_at: string;
  data: Record<string, unknown>;
}

// Viewer types
export interface ViewerMetadata {
  status: LinkStatus;
  file_type: string;
  require_email: boolean;
  has_password: boolean;
  allowed_domains: string[] | null;
  page_count: number | null;
  video_metadata?: VideoMetadata;
  brand_name: string | null;
  brand_color: string | null;
  brand_logo_url: string | null;
  watermark_enabled: boolean;
}

export interface ViewerSession {
  session_token: string;
  viewer_email: string;
  pages: { page: number; url: string }[];
  watermark_text: string;
}

// Render progress
export interface RenderProgress {
  status: 'pending' | 'converting' | 'rendering' | 'watermarking' | 'transcoding' | 'complete' | 'failed';
  current_page?: number;
  total_pages?: number;
  transcode_percent?: number;
  elapsed_ms?: number;
  message?: string;
  error?: string;
}

// Video metadata
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  qualities: string[];
  codec: string;
}

// Storage mode
export type StorageProvider = 'local' | 's3';
export type DatabaseProvider = 'sqlite' | 'turso';
export type CloakMode = 'self-hosted' | 'cloud';

// Organization types
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrgResponse {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  role: OrgRole;
  created_at: string;
}

export interface OrgMemberResponse {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: OrgRole;
  joined_at: string | null;
}

export interface OrgInviteResponse {
  id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

// Audit log types
export type AuditAction =
  | 'link.created' | 'link.updated' | 'link.revoked' | 'link.deleted'
  | 'link.expired' | 'link.max_views_reached'
  | 'api_key.created' | 'api_key.revoked'
  | 'webhook.created' | 'webhook.updated' | 'webhook.deleted'
  | 'member.invited' | 'member.invite_revoked' | 'member.joined'
  | 'member.role_changed' | 'member.removed'
  | 'domain.added' | 'domain.verified' | 'domain.removed'
  | 'org.settings_updated' | 'org.ownership_transferred'
  | 'org.deletion_requested'
  | 'billing.plan_changed'
  | 'auth.login' | 'auth.login_failed' | 'auth.password_changed'
  | 'data.viewer_deleted' | 'data.export_requested'
  | 'data.audit_log_exported';

export interface AuditEntryResponse {
  id: string;
  action: AuditAction;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  actor: {
    id: string | null;
    type: string;
    label: string | null;
  };
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
