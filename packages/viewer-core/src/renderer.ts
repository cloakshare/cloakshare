/**
 * Renderer — handles PDF and image loading/rendering to canvas.
 * PDF.js is lazy-loaded only when a .pdf src is detected.
 */

import type { CloakErrorCode } from './types.js';

export interface RenderedPage {
  pageNum: number;
  width: number;
  height: number;
  render: (ctx: CanvasRenderingContext2D, scale: number, dpr: number) => void | Promise<void>;
}

export interface RenderResult {
  pages: RenderedPage[];
  format: string;
}

/** Detect format from src URL */
export function detectFormat(src: string): 'pdf' | 'image' | 'unsupported' {
  const url = src.toLowerCase().split('?')[0].split('#')[0];
  if (url.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(url)) return 'image';
  return 'unsupported';
}

/** Check if format requires API key */
export function requiresApi(src: string): boolean {
  const url = src.toLowerCase().split('?')[0].split('#')[0];
  return /\.(docx?|pptx?|xlsx?|odt|odp|rtf|mp4|mov|webm)$/.test(url);
}

/** Load and render an image source */
async function renderImage(src: string): Promise<RenderResult> {
  const img = await loadImage(src);
  return {
    format: 'image',
    pages: [
      {
        pageNum: 1,
        width: img.naturalWidth,
        height: img.naturalHeight,
        render: (ctx, scale, dpr) => {
          const w = img.naturalWidth * scale * dpr;
          const h = img.naturalHeight * scale * dpr;
          ctx.drawImage(img, 0, 0, w, h);
        },
      },
    ],
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Load and render a PDF source using PDF.js */
async function renderPdf(
  src: string,
  useExternal: boolean,
): Promise<RenderResult> {
  const pdfjsLib = await loadPdfJs(useExternal);
  if (!pdfjsLib) {
    throw Object.assign(new Error('PDF.js could not be loaded'), {
      code: 'RENDER_ERROR' as CloakErrorCode,
    });
  }

  const loadingTask = pdfjsLib.getDocument(src);
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const pdfPage = await doc.getPage(i);
    const viewport = pdfPage.getViewport({ scale: 1 });

    pages.push({
      pageNum: i,
      width: viewport.width,
      height: viewport.height,
      render: (ctx, scale, dpr) => {
        const sv = pdfPage.getViewport({ scale: scale * dpr });
        return pdfPage.render({
          canvasContext: ctx,
          viewport: sv,
        }).promise;
      },
    });
  }

  return { format: 'pdf', pages };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfjsCache: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfJs(useExternal: boolean): Promise<any> {
  if (_pdfjsCache) return _pdfjsCache;

  // Check if PDF.js is already on window (external renderer mode or pre-loaded)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.pdfjsLib) {
    _pdfjsCache = win.pdfjsLib;
    return _pdfjsCache;
  }

  if (useExternal) {
    throw Object.assign(
      new Error(
        'renderer="external" requires PDF.js to be loaded globally (window.pdfjsLib)',
      ),
      { code: 'RENDER_ERROR' as CloakErrorCode },
    );
  }

  // Dynamic import for bundler environments.
  // Use indirect import to prevent esbuild from bundling pdfjs-dist into IIFE.
  try {
    const importFn = new Function('s', 'return import(s)') as (s: string) => Promise<typeof import('pdfjs-dist')>;
    const pdfjs = await importFn('pdfjs-dist');
    // Set worker source — use CDN for the worker to avoid bundling issues
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    _pdfjsCache = pdfjs;
    return _pdfjsCache;
  } catch {
    // Fallback: load from CDN for IIFE/script tag usage
    return loadPdfJsFromCdn();
  }
}

function loadPdfJsFromCdn(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).pdfjsLib) {
      _pdfjsCache = (window as any).pdfjsLib; // eslint-disable-line
      resolve(_pdfjsCache);
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
    script.type = 'module';
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
        _pdfjsCache = lib;
        resolve(lib);
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib not found on window'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });
}

/** Main render entry point */
export async function renderSource(
  src: string,
  useExternalRenderer: boolean,
): Promise<RenderResult> {
  const format = detectFormat(src);

  switch (format) {
    case 'pdf':
      return renderPdf(src, useExternalRenderer);
    case 'image':
      return renderImage(src);
    case 'unsupported':
      throw Object.assign(
        new Error(
          `Unsupported format. Use apiKey for Office docs and video.`,
        ),
        { code: 'UNSUPPORTED_FORMAT' as CloakErrorCode },
      );
  }
}
