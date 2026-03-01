import { createHash, randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

// Generate IDs with prefixes
export function generateId(prefix?: string): string {
  const id = nanoid(12);
  return prefix ? `${prefix}_${id}` : id;
}

// SHA-256 hash
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// Generate a secure random token
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

// Parse duration string to milliseconds
// Supports: "1h", "24h", "72h", "7d", "30d", "1y"
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(h|d|y)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'y': return value * 365 * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

// Get current billing period start (first of the month)
export function getCurrentBillingPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Get current month as "YYYY-MM" string
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Format date for watermark
export function formatDateForWatermark(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Render watermark template
export function renderWatermarkTemplate(
  template: string,
  vars: { email?: string; date?: string; session_id?: string },
): string {
  let result = template;
  if (vars.email) result = result.replace('{{email}}', vars.email);
  if (vars.date) result = result.replace('{{date}}', vars.date);
  if (vars.session_id) result = result.replace('{{session_id}}', vars.session_id);
  return result;
}

// Escape HTML special characters to prevent injection
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Validate URL is not targeting internal/private networks (SSRF prevention)
export function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    // Block private IPs, localhost, metadata endpoints
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname === '0.0.0.0' || hostname === '169.254.169.254') return true;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return true;
    return false;
  } catch {
    return true;
  }
}

// Get client IP from request headers
export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

// Parse user agent into device/browser/os
export function parseUserAgent(ua: string | null): {
  device: string;
  browser: string;
  os: string;
} {
  if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown' };

  const device = /Mobile|Android|iPhone|iPad/i.test(ua)
    ? (/iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile')
    : 'desktop';

  let browser = 'unknown';
  if (/Chrome\/(\d+)/i.test(ua) && !/Edge|Edg|OPR/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/(\d+)/i)?.[1]}`;
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/(\d+)/i)?.[1]}`;
  } else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = `Safari ${ua.match(/Version\/(\d+)/i)?.[1] || ''}`;
  } else if (/Edg\/(\d+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/(\d+)/i)?.[1]}`;
  }

  let os = 'unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';

  return { device, browser, os };
}
