/**
 * Watermark engine — draws tiled diagonal watermark text on a canvas.
 * Matches CloakShare server-side watermark pattern exactly.
 */

const FONT = '14px monospace';
const COLOR = 'rgba(128, 128, 128, 0.12)';
const ANGLE = (-30 * Math.PI) / 180; // -30° rotation
const SPACING_X = 350;
const SPACING_Y = 120;

/**
 * Resolve template variables in watermark text.
 * Supported: {{email}}, {{date}}, {{session_id}}
 */
export function resolveWatermarkText(
  template: string,
  email: string | null,
  sessionId?: string,
): string {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return template
    .replace(/\{\{email\}\}/g, email || 'anonymous')
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{session_id\}\}/g, sessionId || 'local');
}

/**
 * Draw tiled watermark on a canvas context.
 * Canvas should already be sized to match the display area.
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  if (!text) return;

  ctx.save();
  ctx.font = FONT;
  ctx.fillStyle = COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Rotate the entire context
  ctx.translate(width / 2, height / 2);
  ctx.rotate(ANGLE);
  ctx.translate(-width / 2, -height / 2);

  // Extend beyond bounds to cover after rotation
  const extX = height;
  const extY = width;

  for (let y = -extY; y < height + extY; y += SPACING_Y) {
    for (let x = -extX; x < width + extX; x += SPACING_X) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
}

/**
 * Create and position a watermark canvas overlay on top of a target element.
 */
export function createWatermarkCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'watermark-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

/**
 * Update watermark canvas to match container size and redraw.
 */
export function updateWatermark(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  text: string,
): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();

  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawWatermark(ctx, rect.width, rect.height, text);
}
