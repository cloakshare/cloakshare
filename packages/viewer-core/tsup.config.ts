import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS — pdfjs-dist is external (user's bundler handles it)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: true,
    external: ['pdfjs-dist'],
  },
  // IIFE — for CDN <script> tag usage. PDF.js loaded dynamically from CDN.
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'CloakViewer',
    sourcemap: true,
    minify: true,
    // No external — but pdfjs-dist won't be bundled because we use indirect import()
  },
]);
