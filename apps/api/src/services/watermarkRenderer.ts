import sharp from 'sharp';
import pLimit from 'p-limit';
import { createStorage } from './storage.js';
import { logger } from '../lib/logger.js';

const watermarkLimit = pLimit(3); // Max 3 concurrent watermark operations

export interface WatermarkConfig {
  text: string;          // "john@acme.com · Mar 1, 2026 · sess_abc123"
  opacity: number;       // 0.12 — subtle but visible
  fontSize: number;      // 16px base, scales with image dimensions
  angle: number;         // -30 degrees
  tileSpacingX: number;  // 400px horizontal gap between tiles
  tileSpacingY: number;  // 120px vertical gap between tiles
  color: string;         // "128,128,128" — gray RGB
}

const DEFAULT_WATERMARK_CONFIG: Omit<WatermarkConfig, 'text'> = {
  opacity: 0.12,
  fontSize: 16,
  angle: -30,
  tileSpacingX: 400,
  tileSpacingY: 120,
  color: '128,128,128',
};

/**
 * Render a watermarked version of a clean page image.
 * Downloads the clean image from storage, composites the watermark SVG,
 * and uploads the result under a session-scoped key.
 */
export async function renderWatermarkedPage(
  cleanImageKey: string,
  watermarkText: string,
  outputKey: string,
): Promise<{ key: string; width: number; height: number }> {
  const storage = createStorage();

  // 1. Fetch the clean page image from storage
  const cleanBuffer = await storage.download(cleanImageKey);
  const metadata = await sharp(cleanBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  // 2. Generate SVG watermark overlay
  const config: WatermarkConfig = { ...DEFAULT_WATERMARK_CONFIG, text: watermarkText };
  const svgOverlay = generateWatermarkSvg(width, height, config);

  // 3. Composite the watermark onto the clean image
  const watermarkedBuffer = await sharp(cleanBuffer)
    .composite([{
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0,
      blend: 'over',
    }])
    .webp({ quality: 85 })
    .toBuffer();

  // 4. Upload watermarked image to storage under a session-scoped key
  await storage.upload(outputKey, watermarkedBuffer, 'image/webp');

  return { key: outputKey, width, height };
}

/**
 * Pre-generate watermarked images for a viewer session.
 *
 * Strategy:
 * - Small docs (≤10 pages): Generate all pages upfront
 * - Large docs (>10 pages): Generate first 3 pages upfront, rest on-demand
 */
export async function generateWatermarkedPages(
  linkId: string,
  sessionId: string,
  watermarkText: string,
  pageCount: number,
): Promise<string[]> {
  const storage = createStorage();
  const cachePrefix = `watermarked/${linkId}/${sessionId}`;

  // Determine how many to pre-render
  const preRenderCount = pageCount <= 10 ? pageCount : 3;

  const signedUrls: string[] = [];

  for (let i = 0; i < preRenderCount; i += 3) {
    const batch = Array.from(
      { length: Math.min(3, preRenderCount - i) },
      (_, idx) => i + idx + 1,
    );

    const results = await Promise.all(
      batch.map((pageNum) =>
        watermarkLimit(async () => {
          const cleanKey = `renders/${linkId}/page-${pageNum}.webp`;
          const outputKey = `${cachePrefix}/page-${pageNum}.webp`;

          await renderWatermarkedPage(cleanKey, watermarkText, outputKey);
          return storage.getSignedUrl(outputKey, 300); // 5-minute expiry
        }),
      ),
    );
    signedUrls.push(...results);
  }

  logger.info({ linkId, sessionId, pagesGenerated: preRenderCount, totalPages: pageCount }, 'Watermarked pages generated');

  return signedUrls;
}

/**
 * Generate a single watermarked page on-demand (for large documents).
 * Returns a signed URL to the watermarked version.
 */
export async function getWatermarkedPageOnDemand(
  linkId: string,
  sessionId: string,
  watermarkText: string,
  pageNumber: number,
): Promise<string> {
  const storage = createStorage();
  const cachePrefix = `watermarked/${linkId}/${sessionId}`;
  const outputKey = `${cachePrefix}/page-${pageNumber}.webp`;

  // Check if already rendered for this session
  const exists = await storage.exists(outputKey);
  if (exists) {
    return storage.getSignedUrl(outputKey, 300);
  }

  // Render on demand
  const cleanKey = `renders/${linkId}/page-${pageNumber}.webp`;
  await renderWatermarkedPage(cleanKey, watermarkText, outputKey);

  return storage.getSignedUrl(outputKey, 300);
}

function generateWatermarkSvg(
  width: number,
  height: number,
  config: WatermarkConfig,
): string {
  const { text, opacity, fontSize, angle, tileSpacingX, tileSpacingY, color } = config;

  // Scale font size proportionally to image width (base: 16px at 1000px width)
  const scaledFontSize = Math.round(fontSize * (width / 1000));

  let textElements = '';

  // Extend beyond image bounds to cover after rotation
  const extendX = width * 0.5;
  const extendY = height * 0.5;

  for (let y = -extendY; y < height + extendY; y += tileSpacingY) {
    for (let x = -extendX; x < width + extendX; x += tileSpacingX) {
      textElements += `<text x="${x}" y="${y}" transform="rotate(${angle}, ${x}, ${y})" fill="rgba(${color}, ${opacity})" font-family="monospace" font-size="${scaledFontSize}" text-anchor="middle">${escapeXml(text)}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${textElements}</svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
