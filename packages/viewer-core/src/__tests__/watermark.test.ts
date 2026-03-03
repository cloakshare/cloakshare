import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveWatermarkText } from '../watermark.js';

describe('resolveWatermarkText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:30:00Z'));
  });

  it('replaces {{email}} with provided email', () => {
    const result = resolveWatermarkText('Viewed by {{email}}', 'test@example.com');
    expect(result).toBe('Viewed by test@example.com');
  });

  it('replaces {{email}} with "anonymous" when email is null', () => {
    const result = resolveWatermarkText('Viewed by {{email}}', null);
    expect(result).toBe('Viewed by anonymous');
  });

  it('replaces {{date}} with current date in YYYY-MM-DD format', () => {
    const result = resolveWatermarkText('Date: {{date}}', 'test@example.com');
    expect(result).toBe('Date: 2026-03-15');
  });

  it('replaces {{session_id}} with provided session ID', () => {
    const result = resolveWatermarkText('Session: {{session_id}}', null, 'abc123');
    expect(result).toBe('Session: abc123');
  });

  it('replaces {{session_id}} with "local" when no session ID', () => {
    const result = resolveWatermarkText('Session: {{session_id}}', null);
    expect(result).toBe('Session: local');
  });

  it('replaces all template variables in a combined string', () => {
    const result = resolveWatermarkText(
      '{{email}} · {{date}} · {{session_id}}',
      'viewer@co.com',
      's_abc',
    );
    expect(result).toBe('viewer@co.com · 2026-03-15 · s_abc');
  });

  it('handles multiple occurrences of the same variable', () => {
    const result = resolveWatermarkText('{{email}} - {{email}}', 'a@b.com');
    expect(result).toBe('a@b.com - a@b.com');
  });

  it('returns string unchanged when no template variables present', () => {
    const result = resolveWatermarkText('Confidential', 'test@example.com');
    expect(result).toBe('Confidential');
  });

  it('pads single-digit months and days with zero', () => {
    vi.setSystemTime(new Date('2026-01-05T10:30:00Z'));
    const result = resolveWatermarkText('{{date}}', null);
    expect(result).toBe('2026-01-05');
  });
});
