import { CloakShareClient } from '../client.js';

export class ViewersResource {
  constructor(private client: CloakShareClient) {}

  /** Delete all viewer data for a specific email (GDPR compliance) */
  async delete(email: string): Promise<{ deleted_views: number; deleted_sessions: number }> {
    return this.client.delete(`/v1/viewers/${encodeURIComponent(email)}`);
  }
}
