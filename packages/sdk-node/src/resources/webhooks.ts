import { CloakShareClient } from '../client.js';
import type { Webhook } from '../types.js';

export class WebhooksResource {
  constructor(private client: CloakShareClient) {}

  /** Create a webhook endpoint */
  async create(url: string, events: string[]): Promise<Webhook> {
    return this.client.post<Webhook>('/v1/webhooks', { url, events });
  }

  /** List all webhook endpoints */
  async list(): Promise<{ webhooks: Webhook[] }> {
    return this.client.get('/v1/webhooks');
  }

  /** Get a webhook endpoint by ID */
  async get(id: string): Promise<Webhook> {
    return this.client.get<Webhook>(`/v1/webhooks/${id}`);
  }

  /** Delete a webhook endpoint */
  async delete(id: string): Promise<void> {
    return this.client.delete<void>(`/v1/webhooks/${id}`);
  }
}
