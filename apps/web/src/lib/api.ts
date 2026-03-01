const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Active org ID for multi-org support
let activeOrgId: string | null = localStorage.getItem('cloak_active_org_id');

export function setActiveOrgId(orgId: string | null) {
  activeOrgId = orgId;
  if (orgId) localStorage.setItem('cloak_active_org_id', orgId);
  else localStorage.removeItem('cloak_active_org_id');
}

export function getActiveOrgId() {
  return activeOrgId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = localStorage.getItem('cloak_session');
  const apiKey = localStorage.getItem('cloak_api_key');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (session) {
    headers['Cookie'] = `cloak_session=${session}`;
  }

  if (activeOrgId) {
    headers['X-Org-Id'] = activeOrgId;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(json.error?.code || 'UNKNOWN', json.error?.message || 'Request failed', res.status);
  }

  return json.data;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// Auth
export const auth = {
  register: (email: string, password: string) =>
    request<{ user: { id: string; email: string; plan: string }; api_key: string }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; plan: string }; api_key: string }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request('/v1/auth/logout', { method: 'POST' }),

  me: () => request<{
    id: string;
    email: string;
    name: string | null;
    plan: string;
    default_org_id: string | null;
    orgs: Array<{ id: string; name: string; slug: string; plan: string; role: string }>;
  }>('/v1/auth/me'),
};

// Links
export const linksApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    return request<{
      links: Array<{
        id: string;
        secure_url: string;
        name: string | null;
        file_type: string;
        page_count: number;
        status: string;
        view_count: number;
        created_at: string;
      }>;
      pagination: { total: number; page: number; limit: number; pages: number };
    }>(`/v1/links?${qs}`);
  },

  get: (id: string) =>
    request<{
      id: string;
      secure_url: string;
      analytics_url: string;
      name: string | null;
      file_type: string;
      page_count: number;
      status: string;
      video_metadata?: {
        duration: number;
        width: number;
        height: number;
        qualities: string[];
      };
      rules: {
        expires_at: string | null;
        max_views: number | null;
        require_email: boolean;
        allowed_domains: string[] | null;
        has_password: boolean;
        block_download: boolean;
        watermark: boolean;
      };
      view_count: number;
      recent_views: Array<{
        viewer_email: string;
        viewed_at: string;
        duration: number;
        pages_viewed: number;
        completion_rate: number;
        country: string | null;
        city: string | null;
        device: string;
        video_watch_time?: number;
      }>;
      created_at: string;
    }>(`/v1/links/${id}`),

  analytics: (id: string) =>
    request<{
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
    }>(`/v1/links/${id}/analytics`),

  revoke: (id: string) =>
    request<{ id: string; status: string; revoked_at: string }>(`/v1/links/${id}`, {
      method: 'DELETE',
    }),
};

// API Keys
export const apiKeysApi = {
  list: () =>
    request<{
      api_keys: Array<{
        id: string;
        name: string;
        key_prefix: string;
        last_used_at: string | null;
        created_at: string;
      }>;
    }>('/v1/auth/api-keys'),

  create: (name: string) =>
    request<{ id: string; name: string; key: string; key_prefix: string }>('/v1/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  revoke: (id: string) =>
    request<{ id: string; revoked: boolean }>(`/v1/auth/api-keys/${id}`, {
      method: 'DELETE',
    }),
};

// Billing
export const billingApi = {
  checkout: (plan: 'starter' | 'growth' | 'scale', annual = false) =>
    request<{ checkout_url: string }>('/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, annual }),
    }),

  portal: () =>
    request<{ portal_url: string }>('/v1/billing/portal', {
      method: 'POST',
    }),
};

// Teams
export const teamsApi = {
  listMembers: () =>
    request<{
      members: Array<{
        id: string;
        user_id: string;
        email: string;
        name: string | null;
        role: string;
        joined_at: string;
      }>;
      pending_invites: Array<{
        id: string;
        email: string;
        role: string;
        invited_at: string;
        expires_at: string;
      }>;
    }>('/v1/org/members'),

  invite: (email: string, role: string) =>
    request<{ id: string; email: string; role: string; invite_token: string; expires_at: string }>('/v1/org/members/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  revokeInvite: (id: string) =>
    request<{ id: string; status: string }>(`/v1/org/invites/${id}`, {
      method: 'DELETE',
    }),

  changeRole: (memberId: string, role: string) =>
    request<{ id: string; role: string }>(`/v1/org/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (memberId: string) =>
    request<{ id: string; status: string }>(`/v1/org/members/${memberId}`, {
      method: 'DELETE',
    }),

  getSettings: () =>
    request<{ id: string; name: string; slug: string; plan: string; created_at: string }>('/v1/org/settings'),

  updateSettings: (data: { name?: string; slug?: string }) =>
    request<{ id: string; name: string; slug: string }>('/v1/org/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Notifications
export const notificationsApi = {
  list: (params?: { page?: number; limit?: number; unread?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.unread) qs.set('unread', 'true');
    return request<{
      notifications: Array<{
        id: string;
        type: string;
        link_id: string | null;
        link_name: string | null;
        message: string;
        metadata: Record<string, unknown> | null;
        read: boolean;
        created_at: string;
      }>;
      unread_count: number;
      pagination: { total: number; page: number; limit: number; pages: number };
    }>(`/v1/notifications?${qs}`);
  },

  markRead: (ids: string[]) =>
    request<{ marked_read: number }>('/v1/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  markAllRead: () =>
    request<{ marked_read: string }>('/v1/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    }),
};

// Audit Log
export const auditApi = {
  list: (params?: { cursor?: string; limit?: number; action?: string; resource_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.action) qs.set('action', params.action);
    if (params?.resource_type) qs.set('resource_type', params.resource_type);
    return request<{
      entries: Array<{
        id: string;
        actor: { id: string; type: string; label: string };
        action: string;
        resource: { type: string; id: string; label: string } | null;
        metadata: Record<string, unknown> | null;
        ip_address: string | null;
        created_at: string;
      }>;
      pagination: { has_more: boolean; next_cursor: string | null };
    }>(`/v1/org/audit-log?${qs}`);
  },
};
