import { createHmac, timingSafeEqual } from 'crypto';

// ============================================
// Types
// ============================================

interface CloakOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

interface CreateLinkOptions {
  file?: Uint8Array;
  filename?: string;
  upload_r2_key?: string;
  name?: string;
  expires_in?: string;
  expires_at?: string;
  max_views?: number;
  require_email?: boolean;
  allowed_domains?: string[];
  password?: string;
  block_download?: boolean;
  watermark?: boolean;
  watermark_template?: string;
  notify_url?: string;
  notify_email?: string;
}

interface Link {
  id: string;
  secure_url: string;
  analytics_url: string;
  progress_url: string;
  name: string | null;
  file_type: string;
  status: string;
  rules: Record<string, unknown>;
  view_count: number;
  created_at: string;
}

interface LinkList {
  links: Link[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

interface Analytics {
  link_id: string;
  total_views: number;
  unique_viewers: number;
  avg_duration: number;
  avg_completion_rate: number;
  viewers: Array<{
    email: string;
    total_views: number;
    first_viewed: string;
    last_viewed: string;
    total_duration: number;
    avg_completion_rate: number;
  }>;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  created_at: string;
}

// ============================================
// Error
// ============================================

export class CloakError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'CloakError';
  }
}

// ============================================
// Client
// ============================================

export class Cloak {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  public links: LinksResource;
  public webhooks: WebhooksResource;

  constructor(options: CloakOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || 'https://api.cloakshare.dev').replace(/\/$/, '');
    this.timeout = options.timeout || 30_000;
    this.maxRetries = options.maxRetries ?? 3;

    this.links = new LinksResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
        const jitter = delay * 0.5 * Math.random();
        await new Promise((r) => setTimeout(r, delay + jitter));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const reqHeaders: Record<string, string> = {
          'Authorization': `Bearer ${this.apiKey}`,
          ...headers,
        };

        if (body && !headers?.['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }

        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: reqHeaders,
          body: body && !headers?.['Content-Type'] ? JSON.stringify(body) : body as any,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
          if (attempt < this.maxRetries) {
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }
          const json = await res.json().catch(() => ({ error: { code: 'RATE_LIMITED', message: 'Rate limited' } }));
          throw new CloakError(json.error?.code || 'RATE_LIMITED', json.error?.message || 'Rate limited', 429, retryAfter);
        }

        if (res.status >= 500 && attempt < this.maxRetries) {
          lastError = new CloakError('SERVER_ERROR', `Server error: ${res.status}`, res.status);
          continue;
        }

        const json = await res.json();

        if (!res.ok) {
          throw new CloakError(
            json.error?.code || 'UNKNOWN',
            json.error?.message || `HTTP ${res.status}`,
            res.status,
          );
        }

        return json.data as T;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof CloakError) throw err;
        if ((err as Error).name === 'AbortError') {
          lastError = new CloakError('TIMEOUT', 'Request timed out', 0);
        } else {
          lastError = err as Error;
        }
        if (attempt === this.maxRetries) break;
      }
    }

    throw lastError || new CloakError('UNKNOWN', 'Request failed', 0);
  }

  /**
   * Verify a webhook signature (HMAC-SHA256).
   * Returns true if the signature is valid within the timestamp tolerance.
   */
  static verifyWebhook(
    payload: string | Buffer,
    signature: string,
    secret: string,
    toleranceSeconds = 300,
  ): boolean {
    const parts = signature.split(',');
    const tsStr = parts.find((p) => p.startsWith('t='))?.slice(2);
    const sigHex = parts.find((p) => p.startsWith('v1='))?.slice(3);

    if (!tsStr || !sigHex) return false;

    const timestamp = parseInt(tsStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestamp) > toleranceSeconds) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(sigHex, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }
}

// ============================================
// Resources
// ============================================

class LinksResource {
  constructor(private client: Cloak) {}

  async create(options: CreateLinkOptions): Promise<Link> {
    if (options.file) {
      // Multipart upload
      const formData = new FormData();
      formData.append('file', new Blob([options.file.slice().buffer as ArrayBuffer]), options.filename || 'document.pdf');
      if (options.name) formData.append('name', options.name);
      if (options.expires_in) formData.append('expires_in', options.expires_in);
      if (options.max_views != null) formData.append('max_views', String(options.max_views));
      if (options.require_email != null) formData.append('require_email', String(options.require_email));
      if (options.password) formData.append('password', options.password);
      if (options.block_download != null) formData.append('block_download', String(options.block_download));
      if (options.watermark != null) formData.append('watermark', String(options.watermark));

      return this.client.request('POST', '/v1/links', formData as any);
    }

    return this.client.request<Link>('POST', '/v1/links', options);
  }

  async get(id: string): Promise<Link> {
    return this.client.request<Link>('GET', `/v1/links/${id}`);
  }

  async list(params?: { page?: number; limit?: number; status?: string }): Promise<LinkList> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    return this.client.request<LinkList>('GET', `/v1/links?${qs}`);
  }

  /**
   * Async iterator for paginating through all links.
   */
  async *listAll(params?: { status?: string; limit?: number }): AsyncGenerator<Link> {
    let page = 1;
    const limit = params?.limit || 100;
    while (true) {
      const result = await this.list({ page, limit, status: params?.status });
      for (const link of result.links) {
        yield link;
      }
      if (page >= result.pagination.pages) break;
      page++;
    }
  }

  async analytics(id: string): Promise<Analytics> {
    return this.client.request<Analytics>('GET', `/v1/links/${id}/analytics`);
  }

  async revoke(id: string): Promise<{ id: string; status: string; revoked_at: string }> {
    return this.client.request('DELETE', `/v1/links/${id}`);
  }
}

class WebhooksResource {
  constructor(private client: Cloak) {}

  async create(url: string, events: string[]): Promise<Webhook> {
    return this.client.request<Webhook>('POST', '/v1/webhooks', { url, events });
  }

  async list(): Promise<{ webhooks: Webhook[] }> {
    return this.client.request('GET', '/v1/webhooks');
  }

  async get(id: string): Promise<Webhook> {
    return this.client.request<Webhook>('GET', `/v1/webhooks/${id}`);
  }

  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.client.request('DELETE', `/v1/webhooks/${id}`);
  }
}

export default Cloak;
