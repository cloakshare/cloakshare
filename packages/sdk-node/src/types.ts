export interface Link {
  id: string;
  name: string | null;
  secure_url: string;
  analytics_url: string;
  status: 'processing' | 'active' | 'expired' | 'revoked' | 'failed';
  file_type: string;
  page_count: number | null;
  view_count: number;
  rules: LinkRules;
  created_at: string;
}

export interface LinkRules {
  expires_at: string | null;
  max_views: number | null;
  require_email: boolean;
  allowed_domains: string[] | null;
  has_password: boolean;
  block_download: boolean;
  watermark: boolean;
}

export interface CreateLinkParams {
  file?: string | Buffer | Uint8Array;
  uploadKey?: string;
  filename?: string;
  name?: string;
  requireEmail?: boolean;
  watermark?: boolean;
  watermarkTemplate?: string;
  password?: string;
  expiresIn?: string;
  maxViews?: number;
  allowedDomains?: string[];
  blockDownload?: boolean;
  notifyUrl?: string;
  notifyEmail?: string;
}

export interface ListLinksParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface LinkList {
  links: Link[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface LinkAnalytics {
  link_id: string;
  total_views: number;
  unique_viewers: number;
  avg_duration: number;
  avg_completion_rate: number;
  viewers: ViewerAnalytics[];
}

export interface ViewerAnalytics {
  email: string;
  total_views: number;
  first_viewed: string;
  last_viewed: string;
  total_duration: number;
  avg_completion_rate: number;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
}

export interface UploadUrlParams {
  filename: string;
  content_type: string;
  file_size: number;
}

export interface UploadUrlResponse {
  upload_url: string;
  upload_key: string;
  expires_in: number;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: { id: string | null; type: string; label: string | null };
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface CloakShareOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}
