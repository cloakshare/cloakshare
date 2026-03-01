import type { users, apiKeys, sessions, organizations, orgMembers } from '../db/schema.js';

// Hono context variables set by middleware
export type Variables = {
  user: typeof users.$inferSelect;
  apiKey: typeof apiKeys.$inferSelect;
  session: typeof sessions.$inferSelect;
  org: typeof organizations.$inferSelect;
  orgId: string;
  orgRole: string;
  orgMembership: typeof orgMembers.$inferSelect;
};
