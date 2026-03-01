import { CloakShareClient } from './client.js';
import { LinksResource } from './resources/links.js';
import { WebhooksResource } from './resources/webhooks.js';
import { ViewersResource } from './resources/viewers.js';
import { OrgResource } from './resources/org.js';
import { verifyWebhookSignature } from './webhookVerify.js';
import type { CloakShareOptions } from './types.js';

const VERSION = '0.1.0';

/**
 * CloakShare Node.js SDK — secure document and video sharing API.
 *
 * @example
 * ```ts
 * import CloakShare from '@cloakshare/sdk';
 *
 * const cloakshare = new CloakShare('ck_live_xxx');
 *
 * const link = await cloakshare.links.create({
 *   file: './pitch-deck.pdf',
 *   requireEmail: true,
 *   watermark: true,
 *   expiresIn: '7d',
 * });
 *
 * console.log(link.secure_url);
 * ```
 */
export class CloakShare {
  private client: CloakShareClient;

  links: LinksResource;
  webhooks: WebhooksResource;
  viewers: ViewersResource;
  org: OrgResource;

  constructor(apiKey: string, options?: CloakShareOptions) {
    if (!apiKey) throw new Error('API key is required. Get one at https://app.cloakshare.dev');
    if (!apiKey.startsWith('ck_')) {
      throw new Error('Invalid API key format. Keys start with ck_live_ or ck_test_');
    }

    this.client = new CloakShareClient({
      apiKey,
      baseUrl: (options?.baseUrl ?? 'https://api.cloakshare.dev').replace(/\/$/, ''),
      timeout: options?.timeout ?? 30_000,
      maxRetries: options?.maxRetries ?? 2,
    });

    this.links = new LinksResource(this.client);
    this.webhooks = new WebhooksResource(this.client);
    this.viewers = new ViewersResource(this.client);
    this.org = new OrgResource(this.client);
  }

  /**
   * Verify a webhook signature. Can be used without instantiating CloakShare.
   *
   * @example
   * const isValid = CloakShare.webhooks.verify(rawBody, signature, secret);
   */
  static webhooks = {
    verify: verifyWebhookSignature,
  };

  /** SDK version */
  static version = VERSION;
}

export default CloakShare;

// Re-export types and errors
export * from './types.js';
export { CloakShareError, RateLimitError, AuthenticationError } from './errors.js';
export { verifyWebhookSignature } from './webhookVerify.js';
