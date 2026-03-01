import { readFileSync } from 'fs';
import { basename } from 'path';
import { CloakShareClient } from '../client.js';
import type {
  Link, CreateLinkParams, ListLinksParams, LinkList,
  LinkAnalytics, UploadUrlParams, UploadUrlResponse,
} from '../types.js';

export class LinksResource {
  constructor(private client: CloakShareClient) {}

  /**
   * Create a secure link.
   *
   * @example
   * // From a file path
   * const link = await cloakshare.links.create({
   *   file: './pitch-deck.pdf',
   *   requireEmail: true,
   *   watermark: true,
   *   expiresIn: '7d',
   * });
   *
   * @example
   * // From a Buffer
   * const link = await cloakshare.links.create({
   *   file: pdfBuffer,
   *   filename: 'pitch-deck.pdf',
   *   requireEmail: true,
   * });
   *
   * @example
   * // From a pre-uploaded key
   * const link = await cloakshare.links.create({
   *   uploadKey: 'temp/abc123/pitch-deck.pdf',
   *   filename: 'pitch-deck.pdf',
   * });
   */
  async create(params: CreateLinkParams): Promise<Link> {
    // File path upload
    if (typeof params.file === 'string' && !params.uploadKey) {
      const buffer = readFileSync(params.file);
      const filename = params.filename || basename(params.file);
      return this.uploadFormData(buffer, filename, params);
    }

    // Buffer / Uint8Array upload
    if (params.file && typeof params.file !== 'string') {
      const buffer = Buffer.isBuffer(params.file) ? params.file : Buffer.from(params.file);
      return this.uploadFormData(buffer, params.filename || 'document', params);
    }

    // Pre-uploaded key
    if (params.uploadKey) {
      return this.client.post<Link>('/v1/links', {
        upload_r2_key: params.uploadKey,
        filename: params.filename,
        name: params.name,
        require_email: params.requireEmail,
        watermark: params.watermark,
        watermark_template: params.watermarkTemplate,
        password: params.password,
        expires_in: params.expiresIn,
        max_views: params.maxViews,
        allowed_domains: params.allowedDomains,
        block_download: params.blockDownload,
        notify_url: params.notifyUrl,
        notify_email: params.notifyEmail,
      });
    }

    throw new Error('Must provide file (path or Buffer) or uploadKey');
  }

  private uploadFormData(buffer: Buffer, filename: string, params: CreateLinkParams): Promise<Link> {
    const formData = new FormData();
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    formData.append('file', new Blob([ab]), filename);
    if (params.name) formData.append('name', params.name);
    if (params.requireEmail !== undefined) formData.append('require_email', String(params.requireEmail));
    if (params.watermark !== undefined) formData.append('watermark', String(params.watermark));
    if (params.watermarkTemplate) formData.append('watermark_template', params.watermarkTemplate);
    if (params.password) formData.append('password', params.password);
    if (params.expiresIn) formData.append('expires_in', params.expiresIn);
    if (params.maxViews) formData.append('max_views', String(params.maxViews));
    if (params.allowedDomains) formData.append('allowed_domains', params.allowedDomains.join(','));
    if (params.blockDownload !== undefined) formData.append('block_download', String(params.blockDownload));
    if (params.notifyUrl) formData.append('notify_url', params.notifyUrl);
    if (params.notifyEmail) formData.append('notify_email', params.notifyEmail);

    return this.client.postForm<Link>('/v1/links', formData);
  }

  /** Get a link by ID */
  async get(id: string): Promise<Link> {
    return this.client.get<Link>(`/v1/links/${id}`);
  }

  /** List links with optional filtering and pagination */
  async list(params?: ListLinksParams): Promise<LinkList> {
    return this.client.get<LinkList>('/v1/links', params as Record<string, string | number | boolean | undefined>);
  }

  /** Async iterator for paginating through all links */
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

  /** Revoke a link (stops all future access) */
  async revoke(id: string): Promise<void> {
    return this.client.delete<void>(`/v1/links/${id}`);
  }

  /** Get analytics for a link */
  async analytics(id: string): Promise<LinkAnalytics> {
    return this.client.get<LinkAnalytics>(`/v1/links/${id}/analytics`);
  }

  /** Get a presigned upload URL for large files */
  async getUploadUrl(params: UploadUrlParams): Promise<UploadUrlResponse> {
    return this.client.post<UploadUrlResponse>('/v1/links/upload-url', params);
  }
}
