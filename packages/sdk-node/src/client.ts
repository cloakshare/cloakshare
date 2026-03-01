import { CloakShareError, RateLimitError, AuthenticationError } from './errors.js';

export class CloakShareClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
    this.maxRetries = config.maxRetries;
  }

  async request<T>(method: string, path: string, options?: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    isFormData?: boolean;
  }): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    let bodyPayload: BodyInit | undefined;

    if (options?.isFormData && options.body instanceof FormData) {
      bodyPayload = options.body;
    } else if (options?.body) {
      headers['Content-Type'] = 'application/json';
      bodyPayload = JSON.stringify(options.body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
        const jitter = delay * 0.5 * Math.random();
        await sleep(delay + jitter);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: bodyPayload,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          if (response.status === 204) return undefined as T;
          const json = await response.json();
          return json.data as T;
        }

        const errorBody = await response.json().catch(() => ({
          error: { code: 'UNKNOWN', message: `HTTP ${response.status}` },
        }));
        const errorData = errorBody.error || errorBody;
        const requestId = response.headers.get('x-request-id') || undefined;

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          if (attempt < this.maxRetries) {
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new RateLimitError(
            errorData.message || 'Rate limit exceeded',
            retryAfter,
            requestId,
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            errorData.message || 'Authentication failed',
            response.status,
            requestId,
          );
        }

        if (response.status >= 500 && attempt < this.maxRetries) {
          lastError = new CloakShareError(
            errorData.message,
            response.status,
            errorData.code,
            requestId,
            errorData.doc_url,
          );
          continue;
        }

        throw new CloakShareError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          requestId,
          errorData.doc_url,
        );
      } catch (error) {
        if (error instanceof CloakShareError) throw error;
        if (error instanceof RateLimitError) throw error;
        if (error instanceof AuthenticationError) throw error;

        if (attempt < this.maxRetries) {
          lastError = error as Error;
          continue;
        }

        throw new CloakShareError(
          `Network error: ${(error as Error).message}`,
          0,
          'NETWORK_ERROR',
        );
      }
    }

    throw lastError || new CloakShareError('Request failed after retries', 0, 'MAX_RETRIES');
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }

  postForm<T>(path: string, formData: FormData) {
    return this.request<T>('POST', path, { body: formData, isFormData: true });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
