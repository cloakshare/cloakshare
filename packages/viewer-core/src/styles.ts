export const VIEWER_STYLES = /* css */ `
:host {
  display: block;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #fafafa;
  box-sizing: border-box;
  overflow: hidden;
  background: #09090b;
  border-radius: 8px;
  border: 1px solid #1a1a1d;
}

:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}

/* ── Screens ─────────────────────────────────── */

.screen {
  display: none;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.screen.active {
  display: flex;
}

/* ── Loading ─────────────────────────────────── */

.screen-loading {
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #27272a;
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 13px;
  color: #71717a;
}

/* ── Error ───────────────────────────────────── */

.screen-error {
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.error-title {
  font-size: 15px;
  font-weight: 600;
  color: #fafafa;
}

.error-message {
  font-size: 13px;
  color: #71717a;
  max-width: 320px;
}

/* ── Email / Password Gate ───────────────────── */

.screen-gate {
  gap: 16px;
  padding: 32px;
}

.gate-card {
  background: #111113;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 32px;
  max-width: 380px;
  width: 100%;
  text-align: center;
}

.gate-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  background: #1a1a1d;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gate-icon svg {
  width: 24px;
  height: 24px;
  color: #00ff88;
}

.gate-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.gate-subtitle {
  font-size: 13px;
  color: #71717a;
  margin-bottom: 20px;
}

.gate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gate-input {
  width: 100%;
  padding: 10px 14px;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 8px;
  color: #fafafa;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.gate-input:focus {
  border-color: #00ff88;
}

.gate-input::placeholder {
  color: #52525b;
}

.gate-submit {
  width: 100%;
  padding: 10px 14px;
  background: #00ff88;
  color: #09090b;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.gate-submit:hover {
  opacity: 0.9;
}

.gate-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gate-error {
  font-size: 13px;
  color: #ef4444;
  display: none;
}

.gate-error.visible {
  display: block;
}

/* ── Viewer ──────────────────────────────────── */

.screen-viewer {
  flex-direction: column;
  align-items: stretch;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  background: #111113;
  border-bottom: 1px solid #1a1a1d;
  flex-shrink: 0;
  z-index: 10;
}

.viewer-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid #27272a;
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.nav-btn:hover:not(:disabled) {
  background: #1a1a1d;
  color: #fafafa;
  border-color: #3f3f46;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.page-indicator {
  font-size: 13px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: center;
}

.viewer-title {
  font-size: 13px;
  color: #a1a1aa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.viewer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
  position: relative;
}

.canvas-container {
  position: relative;
  display: flex;
  justify-content: center;
  will-change: transform;
  touch-action: pan-y;
}

.viewer-canvas {
  display: block;
  max-width: 100%;
  user-select: none;
  -webkit-user-select: none;
}

/* ── Watermark Overlay ───────────────────────── */

.watermark-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

/* ── Branding Badge ──────────────────────────── */

.branding-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid #27272a;
  border-radius: 6px;
  font-size: 11px;
  color: #71717a;
  z-index: 20;
  text-decoration: none;
  transition: color 0.15s;
}

.branding-badge:hover {
  color: #a1a1aa;
}

.branding-badge svg {
  width: 12px;
  height: 12px;
  color: #00ff88;
}

/* ── Print Protection ────────────────────────── */

@media print {
  :host {
    display: none !important;
  }
}

/* ── Mobile Responsive ───────────────────────── */

@media (max-width: 640px) {
  .viewer-header {
    height: 40px;
    padding: 0 8px;
  }

  .viewer-title {
    display: none;
  }

  .viewer-body {
    padding: 12px;
  }

  .gate-card {
    padding: 24px 20px;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
  }
}

/* ── Light Theme ─────────────────────────────── */

:host([theme="light"]) {
  background: #ffffff;
  color: #09090b;
  border-color: #e4e4e7;
}

:host([theme="light"]) .spinner {
  border-color: #e4e4e7;
  border-top-color: #059669;
}

:host([theme="light"]) .loading-text {
  color: #71717a;
}

:host([theme="light"]) .error-title {
  color: #09090b;
}

:host([theme="light"]) .error-message {
  color: #71717a;
}

:host([theme="light"]) .gate-card {
  background: #fafafa;
  border-color: #e4e4e7;
}

:host([theme="light"]) .gate-icon {
  background: #f4f4f5;
}

:host([theme="light"]) .gate-icon svg {
  color: #059669;
}

:host([theme="light"]) .gate-title {
  color: #09090b;
}

:host([theme="light"]) .gate-subtitle {
  color: #71717a;
}

:host([theme="light"]) .gate-input {
  background: #ffffff;
  border-color: #d4d4d8;
  color: #09090b;
}

:host([theme="light"]) .gate-input:focus {
  border-color: #059669;
}

:host([theme="light"]) .gate-input::placeholder {
  color: #a1a1aa;
}

:host([theme="light"]) .gate-submit {
  background: #059669;
  color: #ffffff;
}

:host([theme="light"]) .gate-error {
  color: #dc2626;
}

:host([theme="light"]) .viewer-header {
  background: #fafafa;
  border-bottom-color: #e4e4e7;
}

:host([theme="light"]) .nav-btn {
  border-color: #d4d4d8;
  color: #71717a;
}

:host([theme="light"]) .nav-btn:hover:not(:disabled) {
  background: #f4f4f5;
  color: #09090b;
  border-color: #a1a1aa;
}

:host([theme="light"]) .page-indicator {
  color: #71717a;
}

:host([theme="light"]) .viewer-title {
  color: #71717a;
}

:host([theme="light"]) .viewer-body {
  background: #f4f4f5;
}

:host([theme="light"]) .branding-badge {
  background: rgba(255, 255, 255, 0.9);
  border-color: #e4e4e7;
  color: #71717a;
}

:host([theme="light"]) .branding-badge:hover {
  color: #52525b;
}

:host([theme="light"]) .branding-badge svg {
  color: #059669;
}

/* ── Reduced Motion ──────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 4s;
  }

  *, *::before, *::after {
    transition-duration: 0.01ms !important;
  }
}
`;
