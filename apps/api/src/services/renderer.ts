import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, readdir, mkdir, rm } from 'fs/promises';
import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import { createStorage } from './storage.js';
import { logger } from '../lib/logger.js';
import {
  RENDER_DPI,
  RENDER_MAX_WIDTH,
  RENDER_WEBP_QUALITY,
  THUMBNAIL_WIDTH,
  THUMBNAIL_WEBP_QUALITY,
  MAX_CONCURRENT_RENDERS,
  MAX_CONCURRENT_SHARP_OPS,
} from '@cloak/shared';

const execFile = promisify(execFileCb);

// Concurrency limits (per CORRECTIONS doc ARCH 4)
export const renderLimit = pLimit(MAX_CONCURRENT_RENDERS); // Max 2 concurrent renders
const sharpLimit = pLimit(MAX_CONCURRENT_SHARP_OPS); // Max 3 concurrent Sharp ops per render

export interface RenderPage {
  page: number;
  r2Key: string;
  width: number;
  height: number;
}

export interface RenderResult {
  pageCount: number;
  pages: RenderPage[];
  thumbnailKey: string;
}

export type ProgressCallback = (progress: {
  currentPage: number;
  totalPages: number;
  message: string;
}) => void;

/**
 * Get page count from a PDF using pdfinfo (part of poppler-utils)
 */
async function getPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFile('pdfinfo', [pdfPath]);
  const match = stdout.match(/Pages:\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Render a single PDF page to PNG using pdftoppm (poppler-utils)
 */
async function renderPageToPng(pdfPath: string, page: number, outputDir: string): Promise<string> {
  const outputPrefix = join(outputDir, 'page');

  await execFile('pdftoppm', [
    '-png',
    '-r', String(RENDER_DPI),       // 150 DPI
    '-f', String(page),             // First page
    '-l', String(page),             // Last page (same = single page)
    '-scale-to-x', String(RENDER_MAX_WIDTH), // Max width 1600
    '-scale-to-y', '-1',            // Maintain aspect ratio
    pdfPath,
    outputPrefix,
  ]);

  // pdftoppm names output: page-{padded_number}.png
  const files = await readdir(outputDir);
  const pageFile = files.find(f => f.startsWith('page-') && f.endsWith('.png'));
  if (!pageFile) throw new Error(`Failed to render page ${page}`);

  return join(outputDir, pageFile);
}

/**
 * Render a full PDF: pdftoppm → Sharp → WebP → storage
 * Per CORRECTIONS doc ARCH 1 (Poppler, NOT MuPDF)
 */
export async function renderPdf(
  fileBuffer: Buffer,
  linkId: string,
  onProgress?: ProgressCallback,
): Promise<RenderResult> {
  const workDir = join(tmpdir(), `cloak-render-${nanoid()}`);
  await mkdir(workDir, { recursive: true });

  const pdfPath = join(workDir, 'input.pdf');
  await writeFile(pdfPath, fileBuffer);

  const storage = createStorage();
  const pageCount = await getPageCount(pdfPath);

  let firstPageWebpBuffer: Buffer | null = null;
  const pages: RenderPage[] = [];

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.({
      currentPage: i,
      totalPages: pageCount,
      message: `Rendering page ${i} of ${pageCount}`,
    });

    const pageDir = join(workDir, `p${i}`);
    await mkdir(pageDir, { recursive: true });

    // Render page to PNG via Poppler
    const pngPath = await renderPageToPng(pdfPath, i, pageDir);
    const pngBuffer = await readFile(pngPath);

    // Convert to WebP via Sharp (with concurrency limit)
    const webpBuffer = await sharpLimit(() =>
      sharp(pngBuffer)
        .webp({ quality: RENDER_WEBP_QUALITY })
        .toBuffer()
    );

    // Cache first page buffer for thumbnail (FIX 3 from CORRECTIONS)
    if (i === 1) firstPageWebpBuffer = webpBuffer;

    const metadata = await sharpLimit(() => sharp(webpBuffer).metadata());
    const r2Key = `renders/${linkId}/page-${i}.webp`;
    await storage.upload(r2Key, webpBuffer, 'image/webp');

    pages.push({
      page: i,
      r2Key,
      width: metadata.width || RENDER_MAX_WIDTH,
      height: metadata.height || 2400,
    });
  }

  // Generate thumbnail from cached first page buffer (NOT from R2 key)
  const thumbBuffer = await sharpLimit(() =>
    sharp(firstPageWebpBuffer!)
      .resize(THUMBNAIL_WIDTH)
      .webp({ quality: THUMBNAIL_WEBP_QUALITY })
      .toBuffer()
  );

  const thumbnailKey = `renders/${linkId}/thumb.webp`;
  await storage.upload(thumbnailKey, thumbBuffer, 'image/webp');

  // Clean up work directory
  await rm(workDir, { recursive: true, force: true }).catch(() => {});

  logger.info({ linkId, pageCount }, 'PDF rendering complete');

  return { pageCount, pages, thumbnailKey };
}

/**
 * Render a single image (PNG/JPG/WebP) — no Poppler needed.
 * Just convert to WebP and generate thumbnail.
 */
export async function renderImage(
  fileBuffer: Buffer,
  linkId: string,
  onProgress?: ProgressCallback,
): Promise<RenderResult> {
  const storage = createStorage();

  onProgress?.({ currentPage: 1, totalPages: 1, message: 'Processing image' });

  // Convert to WebP
  const webpBuffer = await sharpLimit(() =>
    sharp(fileBuffer)
      .resize({ width: RENDER_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: RENDER_WEBP_QUALITY })
      .toBuffer()
  );

  const metadata = await sharpLimit(() => sharp(webpBuffer).metadata());
  const r2Key = `renders/${linkId}/page-1.webp`;
  await storage.upload(r2Key, webpBuffer, 'image/webp');

  // Generate thumbnail
  const thumbBuffer = await sharpLimit(() =>
    sharp(fileBuffer)
      .resize(THUMBNAIL_WIDTH)
      .webp({ quality: THUMBNAIL_WEBP_QUALITY })
      .toBuffer()
  );

  const thumbnailKey = `renders/${linkId}/thumb.webp`;
  await storage.upload(thumbnailKey, thumbBuffer, 'image/webp');

  logger.info({ linkId }, 'Image rendering complete');

  return {
    pageCount: 1,
    pages: [{
      page: 1,
      r2Key,
      width: metadata.width || RENDER_MAX_WIDTH,
      height: metadata.height || 2400,
    }],
    thumbnailKey,
  };
}
