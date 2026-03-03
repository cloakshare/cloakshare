import { VIEWER_STYLES } from './styles.js';
import { renderSource, requiresApi, type RenderedPage } from './renderer.js';
import {
  resolveWatermarkText,
  createWatermarkCanvas,
  updateWatermark,
} from './watermark.js';
import type { CloakErrorCode, CloakViewEvent } from './types.js';

// ── SVG Icons ───────────────────────────────────────────────────────────────

const ICON_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICON_PREV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const ICON_NEXT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
const ICON_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

// ── Observed attributes ─────────────────────────────────────────────────────

const OBSERVED = [
  'src',
  'watermark',
  'email-gate',
  'password',
  'email',
  'theme',
  'allow-download',
  'expires',
  'api-key',
  'api-url',
  'renderer',
  'branding',
  'width',
  'height',
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDevice(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent;
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

const LS_EMAIL_KEY = 'cloakshare:email';

function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(LS_EMAIL_KEY);
  } catch {
    return null;
  }
}

function storeEmail(email: string): void {
  try {
    localStorage.setItem(LS_EMAIL_KEY, email);
  } catch {
    /* localStorage unavailable */
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export class CloakViewerElement extends HTMLElement {
  static get observedAttributes() {
    return [...OBSERVED];
  }

  private shadow: ShadowRoot;
  private pages: RenderedPage[] = [];
  private currentPage = 1;
  private totalPages = 0;
  private sessionId = generateSessionId();
  private viewerEmail: string | null = null;
  private pageStartTime = 0;
  private pageTimes: Record<number, number> = {};
  private totalDuration = 0;
  private format = '';
  private initialized = false;

  // DOM refs (created in buildDOM)
  private $loading!: HTMLElement;
  private $error!: HTMLElement;
  private $gate!: HTMLElement;
  private $viewer!: HTMLElement;
  private $canvas!: HTMLCanvasElement;
  private $watermarkCanvas!: HTMLCanvasElement;
  private $pageIndicator!: HTMLElement;
  private $prevBtn!: HTMLButtonElement;
  private $nextBtn!: HTMLButtonElement;
  private $gateEmail!: HTMLInputElement;
  private $gatePassword!: HTMLInputElement;
  private $gateError!: HTMLElement;
  private $gateSubmit!: HTMLButtonElement;
  private $brandingBadge!: HTMLElement;
  private $canvasContainer!: HTMLElement;
  private $viewerBody!: HTMLElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.buildDOM();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  private _keydownHandler?: (e: Event) => void;
  private _contextMenuHandler?: (e: Event) => void;
  private _dragStartHandler?: (e: Event) => void;

  connectedCallback() {
    if (!this.initialized) {
      this.applySize();
      this.setupProtections();
      this.setupKeyboardNav();
      this.setupSwipe();
      this.setupResizeObserver();
      this.initialized = true;
    }
    this.load();
  }

  disconnectedCallback() {
    // Final tracking event
    this.trackPageTime();

    // Clean up ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }

    // Clean up keyboard listener
    if (this._keydownHandler) {
      this.shadow.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = undefined;
    }

    // Clean up protection listeners
    if (this._contextMenuHandler) {
      this.$canvas.removeEventListener('contextmenu', this._contextMenuHandler);
      this._contextMenuHandler = undefined;
    }
    if (this._dragStartHandler) {
      this.$canvas.removeEventListener('dragstart', this._dragStartHandler);
      this._dragStartHandler = undefined;
    }

    // Allow re-initialization if re-connected
    this.initialized = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    if (name === 'width' || name === 'height') {
      this.applySize();
    }

    if (name === 'src' && this.initialized) {
      this.load();
    }

    if (name === 'watermark' && this.initialized) {
      this.renderWatermark();
    }

    if (name === 'branding') {
      this.updateBranding();
    }
  }

  // ── DOM Construction ────────────────────────────────────────────────────

  private buildDOM() {
    const style = document.createElement('style');
    style.textContent = VIEWER_STYLES;

    const container = document.createElement('div');
    container.setAttribute('role', 'document');
    container.setAttribute('aria-label', 'Document viewer');
    container.style.cssText = 'width:100%;height:100%;position:relative;';

    container.innerHTML = `
      <!-- Loading -->
      <div class="screen screen-loading active" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <div class="loading-text">Loading document...</div>
      </div>

      <!-- Error -->
      <div class="screen screen-error" role="alert">
        <div class="error-icon" aria-hidden="true">!</div>
        <div class="error-title">Unable to load document</div>
        <div class="error-message"></div>
      </div>

      <!-- Gate -->
      <div class="screen screen-gate">
        <div class="gate-card">
          <div class="gate-icon">${ICON_LOCK}</div>
          <div class="gate-title">Enter your details to view</div>
          <div class="gate-subtitle">This document requires verification.</div>
          <form class="gate-form" autocomplete="off">
            <input class="gate-input gate-email" type="email" placeholder="your@email.com" aria-label="Email address" autocomplete="email" />
            <input class="gate-input gate-password" type="password" placeholder="Password" aria-label="Password" style="display:none" />
            <div class="gate-error" role="alert"></div>
            <button type="submit" class="gate-submit">Continue</button>
          </form>
        </div>
      </div>

      <!-- Viewer -->
      <div class="screen screen-viewer">
        <div class="viewer-header">
          <nav class="viewer-nav" aria-label="Page navigation">
            <button class="nav-btn prev-btn" aria-label="Previous page" disabled>${ICON_PREV}</button>
            <span class="page-indicator" aria-live="polite">1 / 1</span>
            <button class="nav-btn next-btn" aria-label="Next page" disabled>${ICON_NEXT}</button>
          </nav>
          <span class="viewer-title"></span>
        </div>
        <div class="viewer-body" tabindex="0">
          <div class="canvas-container">
            <canvas class="viewer-canvas"></canvas>
          </div>
        </div>
        <a class="branding-badge" href="https://cloakshare.dev" target="_blank" rel="noopener" aria-label="Secured by CloakShare">
          ${ICON_SHIELD}
          <span>Secured by CloakShare</span>
        </a>
      </div>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);

    // Cache DOM refs
    this.$loading = this.shadow.querySelector('.screen-loading')!;
    this.$error = this.shadow.querySelector('.screen-error')!;
    this.$gate = this.shadow.querySelector('.screen-gate')!;
    this.$viewer = this.shadow.querySelector('.screen-viewer')!;
    this.$canvas = this.shadow.querySelector('.viewer-canvas')!;
    this.$canvasContainer = this.shadow.querySelector('.canvas-container')!;
    this.$viewerBody = this.shadow.querySelector('.viewer-body')!;
    this.$pageIndicator = this.shadow.querySelector('.page-indicator')!;
    this.$prevBtn = this.shadow.querySelector('.prev-btn')!;
    this.$nextBtn = this.shadow.querySelector('.next-btn')!;
    this.$gateEmail = this.shadow.querySelector('.gate-email')!;
    this.$gatePassword = this.shadow.querySelector('.gate-password')!;
    this.$gateError = this.shadow.querySelector('.gate-error')!;
    this.$gateSubmit = this.shadow.querySelector('.gate-submit')!;
    this.$brandingBadge = this.shadow.querySelector('.branding-badge')!;

    // Watermark canvas
    this.$watermarkCanvas = createWatermarkCanvas();
    this.$canvasContainer.appendChild(this.$watermarkCanvas);

    // Event wiring
    this.$prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    this.$nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));

    const form = this.shadow.querySelector('.gate-form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleGateSubmit();
    });
  }

  // ── Screen Management ───────────────────────────────────────────────────

  private showScreen(el: HTMLElement) {
    for (const screen of this.shadow.querySelectorAll('.screen')) {
      screen.classList.remove('active');
    }
    el.classList.add('active');
  }

  private showError(code: CloakErrorCode, message: string, details?: string) {
    const titleEl = this.$error.querySelector('.error-title')!;
    const msgEl = this.$error.querySelector('.error-message')!;
    titleEl.textContent = message;
    msgEl.textContent = details || '';
    this.showScreen(this.$error);

    this.dispatchEvent(
      new CustomEvent('cloak:error', {
        detail: { code, message, details },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Size ────────────────────────────────────────────────────────────────

  private applySize() {
    const w = this.getAttribute('width') || '100%';
    const h = this.getAttribute('height') || '600px';
    this.style.width = w;
    this.style.height = h;
  }

  // ── Branding ────────────────────────────────────────────────────────────

  private updateBranding() {
    const show = this.getAttribute('branding') !== 'false';
    this.$brandingBadge.style.display = show ? 'flex' : 'none';
  }

  // ── Main Load Flow ──────────────────────────────────────────────────────

  private async load() {
    const src = this.getAttribute('src');
    if (!src) return;

    this.showScreen(this.$loading);
    this.updateBranding();

    // Check expiry
    const expires = this.getAttribute('expires');
    if (expires) {
      const expiresAt = new Date(expires).getTime();
      const now = await this.getServerTime();
      if (now > expiresAt) {
        this.showError('EXPIRED', 'This document has expired');
        return;
      }
    }

    // Check if format requires API
    if (requiresApi(src)) {
      const apiKey = this.getAttribute('api-key');
      if (!apiKey) {
        this.showError(
          'UNSUPPORTED_FORMAT',
          'This format requires an API key',
          'Office documents and video require server-side processing. Add an api-key attribute to enable.',
        );
        return;
      }
    }

    // API-connected mode: api-key is set
    const apiKey = this.getAttribute('api-key');
    if (apiKey) {
      await this.loadFromApi(src, apiKey);
      return;
    }

    // Client-only mode: check gates then render
    const needsEmail = this.getAttribute('email-gate') !== null;
    const needsPassword = !!this.getAttribute('password');
    const prefilledEmail = this.getAttribute('email');

    if (prefilledEmail) {
      this.viewerEmail = prefilledEmail;
      storeEmail(prefilledEmail);
    } else if (needsEmail) {
      const stored = getStoredEmail();
      if (stored) {
        this.viewerEmail = stored;
      }
    }

    // Show gate if needed and not already resolved
    if ((needsEmail && !this.viewerEmail) || needsPassword) {
      this.setupGate(needsEmail && !this.viewerEmail, needsPassword);
      return;
    }

    // Render directly
    await this.renderDocument(src);
  }

  // ── Server Time (Expiry Mitigation) ─────────────────────────────────────

  private async getServerTime(): Promise<number> {
    try {
      const apiUrl = this.getAttribute('api-url') || 'https://api.cloakshare.dev';
      const res = await fetch(`${apiUrl}/v1/time`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        return new Date(data.timestamp || data.data?.timestamp).getTime();
      }
    } catch {
      /* fallback to local */
    }
    return Date.now();
  }

  // ── API-Connected Mode ─────────────────────────────────────────────────

  private apiSessionToken: string | null = null;

  private async loadFromApi(src: string, apiKey: string) {
    const apiUrl = this.getAttribute('api-url') || 'https://api.cloakshare.dev';

    // Step 1: Fetch link metadata
    try {
      const metaRes = await fetch(`${apiUrl}/v1/viewer/${encodeURIComponent(src)}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        const code = metaRes.status === 401 ? 'API_UNAUTHORIZED' : 'API_ERROR';
        this.showError(code as CloakErrorCode, err?.error?.message || `API error (${metaRes.status})`);
        return;
      }
      const meta = (await metaRes.json()).data;

      if (meta.status === 'processing') {
        this.showError('API_ERROR', 'Document is still processing. Please try again in a moment.');
        return;
      }

      // Step 2: Handle gates (server-side verification)
      const needsEmail = meta.require_email;
      const needsPassword = meta.has_password;
      const prefilledEmail = this.getAttribute('email');

      if (prefilledEmail) {
        this.viewerEmail = prefilledEmail;
      } else if (needsEmail) {
        const stored = getStoredEmail();
        if (stored) this.viewerEmail = stored;
      }

      if ((needsEmail && !this.viewerEmail) || needsPassword) {
        this.setupApiGate(src, apiKey, apiUrl, needsEmail && !this.viewerEmail, needsPassword);
        return;
      }

      // Step 3: Verify and get pages
      await this.verifyAndRender(src, apiKey, apiUrl, this.viewerEmail, null);
    } catch (err) {
      this.showError('API_ERROR', 'Failed to connect to CloakShare API', (err as Error).message);
    }
  }

  private setupApiGate(src: string, apiKey: string, apiUrl: string, showEmail: boolean, showPassword: boolean) {
    this.setupGate(showEmail, showPassword);

    // Override gate submit handler for API mode
    this.$gateSubmit.onclick = null;

    const apiSubmitHandler = async (e: Event) => {
      e.preventDefault();
      const email = showEmail ? this.$gateEmail.value.trim() : this.viewerEmail;
      const password = showPassword ? this.$gatePassword.value : null;

      if (showEmail && (!email || !email.includes('@'))) {
        this.$gateError.textContent = 'Please enter a valid email address.';
        this.$gateError.classList.add('visible');
        return;
      }

      this.$gateSubmit.disabled = true;
      this.$gateSubmit.textContent = 'Verifying...';

      if (email) {
        this.viewerEmail = email;
        storeEmail(email);
        this.dispatchEvent(new CustomEvent('cloak:email-submitted', {
          detail: { email },
          bubbles: true,
          composed: true,
        }));
      }

      await this.verifyAndRender(src, apiKey, apiUrl, email || null, password);
    };

    // Replace submit button click handler
    this.$gateSubmit.addEventListener('click', apiSubmitHandler);
    // Replace form enter key handler
    this.$gatePassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apiSubmitHandler(e);
    });
    this.$gateEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apiSubmitHandler(e);
    });
  }

  private async verifyAndRender(
    src: string,
    apiKey: string,
    apiUrl: string,
    email: string | null,
    password: string | null,
  ) {
    try {
      const verifyRes = await fetch(`${apiUrl}/v1/viewer/${encodeURIComponent(src)}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        const msg = err?.error?.message || `Verification failed (${verifyRes.status})`;
        if (verifyRes.status === 401 || verifyRes.status === 403) {
          this.$gateError.textContent = msg;
          this.$gateError.classList.add('visible');
          this.$gateSubmit.disabled = false;
          this.$gateSubmit.textContent = 'Continue';
          return;
        }
        this.showError('API_ERROR', msg);
        return;
      }

      const session = (await verifyRes.json()).data;
      this.apiSessionToken = session.session_token;
      this.viewerEmail = session.viewer_email || email;

      // Load pre-rendered pages as images
      const pages: RenderedPage[] = [];
      for (const pageData of session.pages || []) {
        const img = await this.loadApiImage(pageData.url);
        pages.push({
          pageNum: pageData.page,
          width: img.naturalWidth,
          height: img.naturalHeight,
          render: (ctx, scale) => {
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.drawImage(img, 0, 0, w, h);
          },
        });
      }

      this.pages = pages;
      this.totalPages = pages.length;
      this.format = 'api';
      this.currentPage = 1;
      this.pageStartTime = Date.now();
      this.pageTimes = {};
      this.totalDuration = 0;

      this.updateNavigation();
      this.showScreen(this.$viewer);
      this.renderCurrentPage();

      // Server already burned watermarks for API mode, but also apply client watermark if set
      const watermark = this.getAttribute('watermark');
      if (watermark) this.renderWatermark();

      this.dispatchEvent(new CustomEvent('cloak:ready', {
        detail: { pageCount: this.totalPages, format: 'api' },
        bubbles: true,
        composed: true,
      }));

      this.emitViewEvent();
    } catch (err) {
      this.showError('API_ERROR', 'Failed to load document from API', (err as Error).message);
    }
  }

  private loadApiImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load page image'));
      img.src = url;
    });
  }

  // ── Gate ─────────────────────────────────────────────────────────────────

  private setupGate(showEmail: boolean, showPassword: boolean) {
    this.$gateEmail.style.display = showEmail ? 'block' : 'none';
    this.$gatePassword.style.display = showPassword ? 'block' : 'none';
    this.$gateError.classList.remove('visible');

    if (showEmail) {
      this.$gateEmail.value = '';
    }
    if (showPassword) {
      this.$gatePassword.value = '';
    }

    this.showScreen(this.$gate);

    // Focus the first visible input
    requestAnimationFrame(() => {
      if (showEmail) this.$gateEmail.focus();
      else if (showPassword) this.$gatePassword.focus();
    });
  }

  private async handleGateSubmit() {
    const needsEmail = this.$gateEmail.style.display !== 'none';
    const needsPassword = this.$gatePassword.style.display !== 'none';

    if (needsEmail) {
      const email = this.$gateEmail.value.trim();
      if (!email || !email.includes('@')) {
        this.$gateError.textContent = 'Please enter a valid email address.';
        this.$gateError.classList.add('visible');
        return;
      }
      this.viewerEmail = email;
      storeEmail(email);

      this.dispatchEvent(
        new CustomEvent('cloak:email-submitted', {
          detail: { email },
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (needsPassword) {
      const password = this.$gatePassword.value;
      const expected = this.getAttribute('password');
      if (password !== expected) {
        this.$gateError.textContent = 'Incorrect password.';
        this.$gateError.classList.add('visible');
        return;
      }
    }

    // Gate passed — render
    this.$gateSubmit.disabled = true;
    this.$gateSubmit.textContent = 'Loading...';

    const src = this.getAttribute('src');
    if (src) {
      await this.renderDocument(src);
    }
  }

  // ── Document Rendering ──────────────────────────────────────────────────

  private async renderDocument(src: string) {
    this.showScreen(this.$loading);

    try {
      const useExternal = this.getAttribute('renderer') === 'external';
      const result = await renderSource(src, useExternal);

      this.pages = result.pages;
      this.totalPages = result.pages.length;
      this.format = result.format;
      this.currentPage = 1;
      this.pageStartTime = Date.now();
      this.pageTimes = {};
      this.totalDuration = 0;

      // Update UI
      this.updateNavigation();
      this.showScreen(this.$viewer);
      this.renderCurrentPage();
      this.renderWatermark();

      // Dispatch ready
      this.dispatchEvent(
        new CustomEvent('cloak:ready', {
          detail: { pageCount: this.totalPages, format: this.format },
          bubbles: true,
          composed: true,
        }),
      );

      // Track initial view
      this.emitViewEvent();
    } catch (err) {
      const error = err as Error & { code?: CloakErrorCode };
      const code = error.code || 'LOAD_FAILED';
      this.showError(code, error.message || 'Failed to load document');
    }
  }

  // ── Page Rendering ──────────────────────────────────────────────────────

  private renderCurrentPage() {
    const page = this.pages[this.currentPage - 1];
    if (!page) return;

    const canvas = this.$canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = this.$viewerBody.clientWidth - 48; // 24px padding each side
    const scale = Math.min(1, containerWidth / page.width);

    const displayW = page.width * scale;
    const displayH = page.height * scale;

    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // PDF.js render returns a promise, image render is sync
    const result = page.render(ctx, scale, dpr);
    if (result instanceof Promise) {
      result.then(() => this.renderWatermark());
    } else {
      this.renderWatermark();
    }
  }

  // ── Watermark ───────────────────────────────────────────────────────────

  private renderWatermark() {
    const template = this.getAttribute('watermark');
    if (!template) {
      this.$watermarkCanvas.style.display = 'none';
      return;
    }

    this.$watermarkCanvas.style.display = 'block';
    const text = resolveWatermarkText(template, this.viewerEmail, this.sessionId);
    updateWatermark(this.$watermarkCanvas, this.$canvasContainer, text);
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  private goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;

    this.trackPageTime();
    this.currentPage = page;
    this.pageStartTime = Date.now();

    this.resetZoom();
    this.updateNavigation();
    this.renderCurrentPage();
    this.$viewerBody.scrollTop = 0;

    this.emitViewEvent();
  }

  private updateNavigation() {
    this.$pageIndicator.textContent = `${this.currentPage} / ${this.totalPages}`;
    this.$prevBtn.disabled = this.currentPage <= 1;
    this.$nextBtn.disabled = this.currentPage >= this.totalPages;

    // ARIA
    this.$prevBtn.setAttribute('aria-label', `Previous page (${this.currentPage - 1} of ${this.totalPages})`);
    this.$nextBtn.setAttribute('aria-label', `Next page (${this.currentPage + 1} of ${this.totalPages})`);
  }

  // ── Keyboard Navigation ─────────────────────────────────────────────────

  private setupKeyboardNav() {
    this._keydownHandler = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (!this.$viewer.classList.contains('active')) return;

      switch (ke.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          ke.preventDefault();
          this.goToPage(this.currentPage - 1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          ke.preventDefault();
          this.goToPage(this.currentPage + 1);
          break;
        case 'Home':
          ke.preventDefault();
          this.goToPage(1);
          break;
        case 'End':
          ke.preventDefault();
          this.goToPage(this.totalPages);
          break;
      }
    };
    this.shadow.addEventListener('keydown', this._keydownHandler);
  }

  // ── Protections ─────────────────────────────────────────────────────────

  private setupProtections() {
    this._contextMenuHandler = (e: Event) => e.preventDefault();
    this._dragStartHandler = (e: Event) => e.preventDefault();
    this.$canvas.addEventListener('contextmenu', this._contextMenuHandler);
    this.$canvas.addEventListener('dragstart', this._dragStartHandler);
    this.$canvas.style.userSelect = 'none';
    this.$canvas.style.webkitUserSelect = 'none';
  }

  // ── Touch / Swipe / Pinch-to-Zoom ──────────────────────────────────────

  private zoomScale = 1;
  private zoomOffsetX = 0;
  private zoomOffsetY = 0;
  private pinchStartDist = 0;
  private pinchStartScale = 1;
  private panStartX = 0;
  private panStartY = 0;
  private isPinching = false;
  private isPanning = false;
  private lastTapTime = 0;

  private setupSwipe() {
    let swipeStartX = 0;
    let swipeStartY = 0;
    let touchCount = 0;

    this.$viewerBody.addEventListener(
      'touchstart',
      (e) => {
        touchCount = e.touches.length;

        if (touchCount === 1 && this.zoomScale > 1) {
          // Pan while zoomed
          this.isPanning = true;
          this.panStartX = e.touches[0].clientX - this.zoomOffsetX;
          this.panStartY = e.touches[0].clientY - this.zoomOffsetY;
        } else if (touchCount === 1) {
          swipeStartX = e.touches[0].clientX;
          swipeStartY = e.touches[0].clientY;
        }

        if (touchCount === 2) {
          this.isPinching = true;
          this.isPanning = false;
          this.pinchStartDist = this.getTouchDistance(e.touches);
          this.pinchStartScale = this.zoomScale;
          e.preventDefault();
        }
      },
      { passive: false },
    );

    this.$viewerBody.addEventListener(
      'touchmove',
      (e) => {
        if (this.isPinching && e.touches.length === 2) {
          const dist = this.getTouchDistance(e.touches);
          const scale = this.pinchStartScale * (dist / this.pinchStartDist);
          this.setZoom(Math.max(1, Math.min(5, scale)));
          e.preventDefault();
        } else if (this.isPanning && e.touches.length === 1 && this.zoomScale > 1) {
          this.zoomOffsetX = e.touches[0].clientX - this.panStartX;
          this.zoomOffsetY = e.touches[0].clientY - this.panStartY;
          this.clampPanOffset();
          this.applyZoomTransform();
          e.preventDefault();
        }
      },
      { passive: false },
    );

    this.$viewerBody.addEventListener(
      'touchend',
      (e) => {
        if (this.isPinching) {
          this.isPinching = false;
          // Snap to 1x if close
          if (this.zoomScale < 1.1) this.resetZoom();
          return;
        }

        if (this.isPanning) {
          this.isPanning = false;
          return;
        }

        // Double-tap to zoom/reset
        if (e.changedTouches.length === 1 && touchCount === 1 && this.zoomScale <= 1) {
          const now = Date.now();
          if (now - this.lastTapTime < 300) {
            this.setZoom(2.5);
            // Center zoom on tap point
            const rect = this.$canvasContainer.getBoundingClientRect();
            const tapX = e.changedTouches[0].clientX - rect.left;
            const tapY = e.changedTouches[0].clientY - rect.top;
            this.zoomOffsetX = -(tapX * (this.zoomScale - 1));
            this.zoomOffsetY = -(tapY * (this.zoomScale - 1));
            this.clampPanOffset();
            this.applyZoomTransform();
            this.lastTapTime = 0;
            return;
          }
          this.lastTapTime = now;
        } else if (touchCount === 1 && this.zoomScale > 1) {
          // Double-tap to reset when zoomed
          const now = Date.now();
          if (now - this.lastTapTime < 300) {
            this.resetZoom();
            this.lastTapTime = 0;
            return;
          }
          this.lastTapTime = now;
        }

        // Swipe navigation (only at 1x zoom)
        if (touchCount === 1 && this.zoomScale <= 1) {
          const dx = e.changedTouches[0].clientX - swipeStartX;
          const dy = e.changedTouches[0].clientY - swipeStartY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) this.goToPage(this.currentPage + 1);
            else this.goToPage(this.currentPage - 1);
          }
        }

        touchCount = 0;
      },
      { passive: true },
    );
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private setZoom(scale: number) {
    this.zoomScale = scale;
    this.clampPanOffset();
    this.applyZoomTransform();
  }

  private resetZoom() {
    this.zoomScale = 1;
    this.zoomOffsetX = 0;
    this.zoomOffsetY = 0;
    this.applyZoomTransform();
  }

  private clampPanOffset() {
    if (this.zoomScale <= 1) {
      this.zoomOffsetX = 0;
      this.zoomOffsetY = 0;
      return;
    }
    const rect = this.$canvasContainer.getBoundingClientRect();
    const maxX = (rect.width * (this.zoomScale - 1)) / 2;
    const maxY = (rect.height * (this.zoomScale - 1)) / 2;
    this.zoomOffsetX = Math.max(-maxX, Math.min(maxX, this.zoomOffsetX));
    this.zoomOffsetY = Math.max(-maxY, Math.min(maxY, this.zoomOffsetY));
  }

  private applyZoomTransform() {
    this.$canvasContainer.style.transform =
      this.zoomScale <= 1
        ? ''
        : `translate(${this.zoomOffsetX}px, ${this.zoomOffsetY}px) scale(${this.zoomScale})`;
    this.$canvasContainer.style.transformOrigin = 'center center';
  }

  // ── Tracking ────────────────────────────────────────────────────────────

  private trackPageTime() {
    const elapsed = (Date.now() - this.pageStartTime) / 1000;
    if (!this.pageTimes[this.currentPage]) {
      this.pageTimes[this.currentPage] = 0;
    }
    this.pageTimes[this.currentPage] += elapsed;
    this.totalDuration += elapsed;
  }

  private emitViewEvent() {
    const detail: CloakViewEvent = {
      page: this.currentPage,
      email: this.viewerEmail,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      duration: Math.round(this.totalDuration * 10) / 10,
      scrollDepth: this.totalPages > 0 ? Math.round((this.currentPage / this.totalPages) * 100) : 0,
      referrer: document.referrer,
      device: getDevice(),
    };

    this.dispatchEvent(
      new CustomEvent('cloak:view', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );

    // API-connected mode: send tracking data to server
    if (this.apiSessionToken) {
      const src = this.getAttribute('src');
      const apiUrl = this.getAttribute('api-url') || 'https://api.cloakshare.dev';
      if (src) {
        fetch(`${apiUrl}/v1/viewer/${encodeURIComponent(src)}/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': this.apiSessionToken,
          },
          body: JSON.stringify({
            current_page: this.currentPage,
            total_duration: this.totalDuration,
            page_times: this.pageTimes,
          }),
        }).catch(() => { /* non-blocking */ });
      }
    }
  }

  // ── Resize Observer ─────────────────────────────────────────────────────

  private _resizeObserver?: ResizeObserver;

  private setupResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => {
      if (this.$viewer.classList.contains('active') && this.pages.length > 0) {
        this.renderCurrentPage();
      }
    });
    this._resizeObserver.observe(this);
  }
}
