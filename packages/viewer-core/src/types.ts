/** Props accepted by <cloak-viewer> */
export interface CloakViewerProps {
  src: string;
  watermark?: string;
  emailGate?: boolean;
  password?: string;
  email?: string;
  theme?: 'dark' | 'light';
  allowDownload?: boolean;
  expires?: string;
  apiKey?: string;
  apiUrl?: string;
  renderer?: 'auto' | 'external';
  branding?: boolean;
  width?: string;
  height?: string;
}

/** Emitted on each page view */
export interface CloakViewEvent {
  page: number;
  email: string | null;
  timestamp: string;
  sessionId: string;
  duration: number;
  scrollDepth: number;
  referrer: string;
  device: 'desktop' | 'mobile' | 'tablet';
}

/** Emitted when viewer is ready */
export interface CloakReadyEvent {
  pageCount: number;
  format: string;
}

/** Emitted on error */
export interface CloakErrorEvent {
  code: CloakErrorCode;
  message: string;
  details?: string;
}

export type CloakErrorCode =
  | 'LOAD_FAILED'
  | 'PARSE_FAILED'
  | 'EXPIRED'
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_INCORRECT'
  | 'EMAIL_REQUIRED'
  | 'API_ERROR'
  | 'API_UNAUTHORIZED'
  | 'UNSUPPORTED_FORMAT'
  | 'RENDER_ERROR';

/** Internal page representation */
export interface PageData {
  pageNum: number;
  image: HTMLImageElement | null;
  rendered: boolean;
}

/** API metadata response */
export interface ViewerMetadata {
  status: string;
  file_type: string;
  require_email: boolean;
  has_password: boolean;
  allowed_domains: string[] | null;
  page_count: number;
  name: string | null;
  watermark_enabled: boolean;
  show_badge: boolean;
  view_count?: number;
}

/** API verify response */
export interface ViewerSession {
  session_token: string;
  viewer_email: string;
  pages: Array<{ page: number; url: string }>;
  watermark_text: string;
}
