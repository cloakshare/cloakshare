// ============================================
// CLOAK VIEWER — Main Entry Point
// ============================================

import Hls from 'hls.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// DOM elements
const $loading = document.getElementById('loading')!;
const $processing = document.getElementById('processing')!;
const $error = document.getElementById('error')!;
const $gate = document.getElementById('gate')!;
const $viewer = document.getElementById('viewer')!;
const $videoViewer = document.getElementById('video-viewer')!;

// Gate elements
const $gateForm = document.getElementById('gate-form') as HTMLFormElement;
const $emailField = document.getElementById('email-field')!;
const $emailInput = document.getElementById('email-input') as HTMLInputElement;
const $emailError = document.getElementById('email-error')!;
const $passwordField = document.getElementById('password-field')!;
const $passwordInput = document.getElementById('password-input') as HTMLInputElement;
const $passwordError = document.getElementById('password-error')!;
const $gateSubmit = document.getElementById('gate-submit') as HTMLButtonElement;
const $gateError = document.getElementById('gate-error')!;
const $gateTitle = document.getElementById('gate-title')!;
const $gateSubtitle = document.getElementById('gate-subtitle')!;

// Brand elements
const $brandSection = document.getElementById('brand-section')!;
const $brandLogo = document.getElementById('brand-logo') as HTMLImageElement;
const $brandName = document.getElementById('brand-name')!;

// Processing elements
const $processingMessage = document.getElementById('processing-message')!;
const $progressFill = document.getElementById('progress-fill')!;
const $progressText = document.getElementById('progress-text')!;

// Error elements
const $errorTitle = document.getElementById('error-title')!;
const $errorMessage = document.getElementById('error-message')!;

// Viewer elements
const $docName = document.getElementById('doc-name')!;
const $prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const $nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const $pageIndicator = document.getElementById('page-indicator')!;
const $canvas = document.getElementById('doc-canvas') as HTMLCanvasElement;
const $viewerBody = document.getElementById('viewer-body')!;

// Video viewer elements
const $videoDocName = document.getElementById('video-doc-name')!;
const $videoElement = document.getElementById('video-element') as HTMLVideoElement;
const $videoWatermarkCanvas = document.getElementById('video-watermark-canvas') as HTMLCanvasElement;
const $videoControls = document.getElementById('video-controls')!;
const $videoPlayBtn = document.getElementById('video-play-btn')!;
const $playIcon = document.getElementById('play-icon')!;
const $pauseIcon = document.getElementById('pause-icon')!;
const $videoSeek = document.getElementById('video-seek') as HTMLInputElement;
const $videoTimeCtrl = document.getElementById('video-time-ctrl')!;
const $videoTimeDisplay = document.getElementById('video-time-display')!;
const $videoFullscreenBtn = document.getElementById('video-fullscreen-btn')!;
const $videoQualitySelect = document.getElementById('video-quality-select') as HTMLSelectElement;

// ============================================
// STATE
// ============================================

interface LinkMetadata {
  status: string;
  file_type: string;
  require_email: boolean;
  has_password: boolean;
  allowed_domains: string[] | null;
  page_count: number;
  video_metadata?: {
    duration: number;
    width: number;
    height: number;
    qualities: string[];
  };
  brand_name: string | null;
  brand_color: string | null;
  brand_logo_url: string | null;
  watermark_enabled: boolean;
  show_badge: boolean;
  name: string | null;
  progress_url?: string;
}

interface VerifyResponse {
  session_token: string;
  viewer_email: string;
  pages: { page: number; url: string }[];
  page_count?: number;
  watermark_text: string;
  // Video-specific fields
  master_playlist_url?: string;
  session_manifest?: string;
  segment_sign_url?: string;
  video_metadata?: {
    duration: number;
    width: number;
    height: number;
    qualities: string[];
  };
}

let linkToken = '';
let metadata: LinkMetadata | null = null;
let session: VerifyResponse | null = null;
let currentPage = 1;
let totalPages = 1;
let pageImages: Map<number, HTMLImageElement> = new Map();
let trackingInterval: ReturnType<typeof setInterval> | null = null;
let pageTimes: Record<number, number> = {};
let pageStartTime = Date.now();
let totalDuration = 0;

// Video state
let hlsInstance: Hls | null = null;
let videoWatchTime = 0;
let videoMaxReached = 0;
let videoLastTrackTime = 0;
let videoWatermarkRaf = 0;

// ============================================
// ROUTING
// ============================================

function getToken(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/s\/(.+)$/);
  return match ? match[1] : null;
}

// ============================================
// SCREENS
// ============================================

function showScreen(screen: HTMLElement) {
  [$loading, $processing, $error, $gate, $viewer, $videoViewer].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function showError(title: string, message: string) {
  $errorTitle.textContent = title;
  $errorMessage.textContent = message;
  showScreen($error);
}

// ============================================
// API CALLS
// ============================================

async function fetchMetadata(token: string): Promise<LinkMetadata | null> {
  const res = await fetch(`${API_URL}/v1/viewer/${token}`);
  const json = await res.json();

  if (!res.ok) {
    const err = json.error;
    if (err?.code === 'NOT_FOUND') {
      showError('Document not found', 'This link does not exist or has been removed.');
    } else if (err?.code === 'LINK_EXPIRED') {
      showError('Link expired', 'This document link has expired.');
    } else if (err?.code === 'LINK_REVOKED') {
      showError('Access revoked', 'The sender has revoked access to this document.');
    } else if (err?.code === 'RENDER_FAILED') {
      showError('Processing failed', 'This document could not be processed. The sender has been notified.');
    } else {
      showError('Unavailable', err?.message || 'This document is not available.');
    }
    return null;
  }

  return json.data;
}

async function verifyAccess(token: string, email?: string, password?: string): Promise<VerifyResponse | null> {
  const res = await fetch(`${API_URL}/v1/viewer/${token}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();

  if (!res.ok) {
    return null;
  }

  return json.data;
}

async function trackEvent(token: string, sessionToken: string, isFinal = false) {
  // Calculate current page time
  const now = Date.now();
  const elapsed = (now - pageStartTime) / 1000;
  pageTimes[currentPage] = (pageTimes[currentPage] || 0) + elapsed;
  pageStartTime = now;
  totalDuration += elapsed;

  try {
    await fetch(`${API_URL}/v1/viewer/${token}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({
        current_page: currentPage,
        total_duration: Math.round(totalDuration),
        page_times: pageTimes,
        is_final: isFinal,
      }),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

async function trackVideoEvent(token: string, sessionToken: string, isFinal = false) {
  const currentTime = $videoElement.currentTime;
  const totalDur = $videoElement.duration || 0;

  // Accumulate watch time since last track
  const now = Date.now();
  if (videoLastTrackTime > 0 && !$videoElement.paused) {
    videoWatchTime += (now - videoLastTrackTime) / 1000;
  }
  videoLastTrackTime = now;

  // Track furthest point reached
  if (currentTime > videoMaxReached) {
    videoMaxReached = currentTime;
  }

  try {
    await fetch(`${API_URL}/v1/viewer/${token}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({
        video_watch_time: Math.round(videoWatchTime),
        video_current_time: Math.round(currentTime),
        video_total_duration: Math.round(totalDur),
        is_final: isFinal,
      }),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

// ============================================
// PROCESSING / SSE PROGRESS
// ============================================

function watchProgress(progressUrl: string) {
  showScreen($processing);

  const evtSource = new EventSource(progressUrl);

  evtSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    $processingMessage.textContent = data.message || 'Processing...';
    $progressFill.style.width = `${data.progress}%`;
    $progressText.textContent = `${data.progress}%`;
  });

  evtSource.addEventListener('complete', (e) => {
    evtSource.close();
    $progressFill.style.width = '100%';
    $progressText.textContent = '100%';
    $processingMessage.textContent = 'Ready!';
    // Reload metadata to get fresh state
    setTimeout(() => init(), 500);
  });

  evtSource.addEventListener('error', (e) => {
    if (e instanceof MessageEvent) {
      const data = JSON.parse(e.data);
      evtSource.close();
      showError('Processing failed', data.error || 'Document could not be processed.');
    }
  });

  evtSource.addEventListener('timeout', () => {
    evtSource.close();
    showError('Timed out', 'Document processing is taking longer than expected. Please refresh.');
  });

  evtSource.onerror = () => {
    evtSource.close();
    // Try reloading after brief pause
    setTimeout(() => init(), 2000);
  };
}

// ============================================
// GATE (EMAIL + PASSWORD)
// ============================================

function setupGate(meta: LinkMetadata) {
  // Branding
  if (meta.brand_name || meta.brand_logo_url) {
    $brandSection.classList.remove('hidden');
    if (meta.brand_logo_url) {
      $brandLogo.src = meta.brand_logo_url;
      $brandLogo.classList.remove('hidden');
    }
    if (meta.brand_name) {
      $brandName.textContent = meta.brand_name;
    }
  }

  // Title
  $gateTitle.textContent = meta.name ? `View "${meta.name}"` : 'View document';
  $gateSubtitle.textContent = meta.require_email
    ? 'Enter your email to access this document.'
    : meta.has_password
      ? 'Enter the password to access this document.'
      : 'Click below to view this document.';

  // Show relevant fields
  if (meta.require_email) {
    $emailField.classList.remove('hidden');
  }
  if (meta.has_password) {
    $passwordField.classList.remove('hidden');
  }

  // Apply brand color
  if (meta.brand_color) {
    $gateSubmit.style.background = meta.brand_color;
  }

  showScreen($gate);
}

// ============================================
// CANVAS RENDERER + WATERMARK
// ============================================

function renderPage(pageNum: number) {
  const img = pageImages.get(pageNum);
  if (!img || !img.complete) {
    // Page not loaded yet — try fetching on-demand for large documents
    if (session && pageNum > session.pages.length) {
      fetchPageOnDemand(pageNum);
    }
    return;
  }

  const ctx = $canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  // Size canvas to image dimensions (scaled for container)
  const containerWidth = $viewerBody.clientWidth - 48; // padding
  const scale = Math.min(1, containerWidth / img.naturalWidth);
  const displayWidth = img.naturalWidth * scale;
  const displayHeight = img.naturalHeight * scale;

  $canvas.style.width = `${displayWidth}px`;
  $canvas.style.height = `${displayHeight}px`;
  $canvas.width = displayWidth * dpr;
  $canvas.height = displayHeight * dpr;
  ctx.scale(dpr, dpr);

  // Draw page image — watermark is already baked in server-side
  ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

  // Update navigation
  $pageIndicator.textContent = `${pageNum} / ${totalPages}`;
  $prevBtn.disabled = pageNum <= 1;
  $nextBtn.disabled = pageNum >= totalPages;
}

/**
 * Fetch a watermarked page on-demand from the server.
 * Used for large documents where only the first pages are pre-loaded.
 */
async function fetchPageOnDemand(pageNum: number) {
  if (!session) return;

  try {
    const response = await fetch(
      `${API_URL}/v1/viewer/${linkToken}/page/${pageNum}`,
      { headers: { 'X-Session-Token': session.session_token } },
    );

    if (!response.ok) return;

    const json = await response.json();
    const url = json.data?.url;
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      pageImages.set(pageNum, img);
      if (currentPage === pageNum) {
        renderPage(pageNum);
      }
    };
    pageImages.set(pageNum, img);
  } catch {
    // Silent fail — page will remain blank until retried
  }
}

// ============================================
// PAGE NAVIGATION
// ============================================

function goToPage(page: number) {
  if (page < 1 || page > totalPages) return;

  // Track time on previous page
  const now = Date.now();
  const elapsed = (now - pageStartTime) / 1000;
  pageTimes[currentPage] = (pageTimes[currentPage] || 0) + elapsed;
  totalDuration += elapsed;
  pageStartTime = now;

  currentPage = page;

  // If this page isn't loaded yet, fetch it on-demand
  const img = pageImages.get(page);
  if (!img || !img.complete || !img.naturalWidth) {
    fetchPageOnDemand(page);
  }

  renderPage(currentPage);
  $viewerBody.scrollTop = 0;
}

function setupNavigation() {
  $prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  $nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if ($viewer.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  });
}

// ============================================
// DISABLE CONTEXT MENU + DRAG
// ============================================

function setupProtections() {
  $canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $canvas.addEventListener('dragstart', (e) => e.preventDefault());
  $canvas.style.userSelect = 'none';
  $canvas.style.webkitUserSelect = 'none';
}

// ============================================
// PRELOAD PAGES
// ============================================

function preloadPages(pages: { page: number; url: string }[]) {
  for (const p of pages) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = p.url;
    img.onload = () => {
      pageImages.set(p.page, img);
      // Render first page as soon as it loads
      if (p.page === 1 && currentPage === 1) {
        renderPage(1);
      }
    };
    // Set placeholder even before load
    pageImages.set(p.page, img);
  }
}

// ============================================
// VIDEO VIEWER
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.save();
  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(128, 128, 128, 0.12)';
  ctx.textAlign = 'center';
  ctx.rotate(-30 * Math.PI / 180);

  const spacingX = 350;
  const spacingY = 120;
  const extX = w * 0.5;
  const extY = h * 0.5;

  for (let y = -extY; y < h + extY; y += spacingY) {
    for (let x = -extX; x < w + extX; x += spacingX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

function drawVideoWatermark() {
  if (!session?.watermark_text) return;

  const video = $videoElement;
  const canvas = $videoWatermarkCanvas;
  const rect = video.getBoundingClientRect();

  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, rect.width, rect.height);
  drawWatermark(ctx, rect.width, rect.height, session.watermark_text);

  videoWatermarkRaf = requestAnimationFrame(drawVideoWatermark);
}

function setupVideoControls(sess: VerifyResponse, totalDur: number) {
  const video = $videoElement;

  // Play/pause
  $videoPlayBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener('play', () => {
    $playIcon.classList.add('hidden');
    $pauseIcon.classList.remove('hidden');
    videoLastTrackTime = Date.now();
  });

  video.addEventListener('pause', () => {
    $playIcon.classList.remove('hidden');
    $pauseIcon.classList.add('hidden');
    // Accumulate watch time on pause
    if (videoLastTrackTime > 0) {
      videoWatchTime += (Date.now() - videoLastTrackTime) / 1000;
      videoLastTrackTime = 0;
    }
  });

  // Seek bar
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      $videoSeek.value = String((video.currentTime / video.duration) * 100);
      const timeStr = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      $videoTimeCtrl.textContent = timeStr;
      $videoTimeDisplay.textContent = timeStr;
      if (video.currentTime > videoMaxReached) {
        videoMaxReached = video.currentTime;
      }
    }
  });

  $videoSeek.addEventListener('input', () => {
    if (video.duration) {
      video.currentTime = (parseFloat($videoSeek.value) / 100) * video.duration;
    }
  });

  // Fullscreen
  $videoFullscreenBtn.addEventListener('click', () => {
    const container = $videoViewer.querySelector('.video-container') as HTMLElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(() => {});
    }
  });

  // Anti-download protections
  video.addEventListener('contextmenu', (e) => e.preventDefault());
  video.disablePictureInPicture = true;
  (video as any).controlsList?.add('nodownload');

  // Auto-hide controls after 3s of inactivity (especially for touch/mobile)
  let controlsTimer: ReturnType<typeof setTimeout> | null = null;
  const container = $videoViewer.querySelector('.video-container') as HTMLElement;

  function showControls() {
    container.classList.add('controls-visible');
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (!video.paused) container.classList.remove('controls-visible');
    }, 3000);
  }

  container.addEventListener('mousemove', showControls);
  container.addEventListener('touchstart', showControls, { passive: true });
  video.addEventListener('pause', () => container.classList.add('controls-visible'));
  video.addEventListener('play', showControls);

  // Ended
  video.addEventListener('ended', () => {
    trackVideoEvent(linkToken, sess.session_token, true);
  });
}

function startVideoViewer(meta: LinkMetadata, sess: VerifyResponse) {
  session = sess;
  videoWatchTime = 0;
  videoMaxReached = 0;
  videoLastTrackTime = 0;

  const video = $videoElement;
  $videoDocName.textContent = meta.name || 'Video';
  showScreen($videoViewer);

  // Quality selector
  const qualities = sess.video_metadata?.qualities || meta.video_metadata?.qualities || [];
  $videoQualitySelect.innerHTML = '';
  if (qualities.length > 1) {
    qualities.forEach((q, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = q;
      $videoQualitySelect.appendChild(opt);
    });
    // Default to highest quality
    $videoQualitySelect.value = String(qualities.length - 1);
    $videoQualitySelect.classList.remove('hidden');
  } else {
    $videoQualitySelect.classList.add('hidden');
  }

  // Detect native HLS support (Safari/iOS)
  const hasNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

  if (hasNativeHls && sess.session_manifest) {
    // Safari/iOS: use session manifest with pre-signed URLs baked in
    const blob = new Blob([sess.session_manifest], { type: 'application/vnd.apple.mpegurl' });
    video.src = URL.createObjectURL(blob);
    video.play().catch(() => {});
  } else if (Hls.isSupported() && sess.master_playlist_url) {
    // HLS.js path — intercept segment requests for signing
    const hls = new Hls({
      xhrSetup: (xhr: XMLHttpRequest, url: string) => {
        // If this is a segment request, sign it
        if (url.includes('.ts') && sess.segment_sign_url) {
          // Extract the segment key from the URL
          const segmentKey = extractSegmentKey(url);
          if (segmentKey) {
            // Synchronously set up — the actual signing happens via a pre-fetched map
            // For HLS.js we need to modify the URL before the request
            // Use a synchronous approach: replace URL with our signing endpoint
            xhr.open('GET', url, true);
            return;
          }
        }
      },
    });

    // For segment signing, use the frag loading hook
    hls.on(Hls.Events.FRAG_LOADING, async (event, data) => {
      if (sess.segment_sign_url) {
        const fragUrl = data.frag.url;
        const segmentKey = extractSegmentKey(fragUrl);
        if (segmentKey) {
          try {
            const res = await fetch(sess.segment_sign_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sess.session_token,
              },
              body: JSON.stringify({ segment_key: segmentKey }),
            });
            if (res.ok) {
              const json = await res.json();
              data.frag.url = json.data.signed_url;
            }
          } catch {
            // Fall through to original URL
          }
        }
      }
    });

    hlsInstance = hls;
    hls.loadSource(sess.master_playlist_url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Set quality to highest
      if (qualities.length > 1) {
        hls.currentLevel = qualities.length - 1;
      }
      video.play().catch(() => {});
    });

    // Quality switching
    $videoQualitySelect.addEventListener('change', () => {
      hls.currentLevel = parseInt($videoQualitySelect.value, 10);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        }
      }
    });
  } else {
    showError('Playback error', 'Your browser does not support video playback.');
    return;
  }

  // Set up controls
  setupVideoControls(sess, meta.video_metadata?.duration || 0);

  // Start watermark overlay
  videoWatermarkRaf = requestAnimationFrame(drawVideoWatermark);

  // Tracking (every 5 seconds)
  trackingInterval = setInterval(() => {
    trackVideoEvent(linkToken, sess.session_token);
  }, 5000);

  // Final track on unload
  window.addEventListener('beforeunload', () => {
    trackVideoEvent(linkToken, sess.session_token, true);
  });

  // Resize watermark canvas
  window.addEventListener('resize', () => {
    // Watermark will be redrawn on next animation frame
  });
}

function extractSegmentKey(url: string): string | null {
  // Extract the key portion: renders/{linkId}/video/{quality}/segment-NNN.ts
  const match = url.match(/(renders\/[^/]+\/video\/[^/]+\/segment-\d+\.ts)/);
  return match ? match[1] : null;
}

// ============================================
// START VIEWER (Document)
// ============================================

function startViewer(meta: LinkMetadata, sess: VerifyResponse) {
  session = sess;
  totalPages = sess.page_count || meta.page_count || sess.pages.length;
  currentPage = 1;
  pageTimes = {};
  pageStartTime = Date.now();
  totalDuration = 0;

  // Show viewer
  $docName.textContent = meta.name || 'Document';
  showScreen($viewer);

  // Load and render pages
  preloadPages(sess.pages);
  setupNavigation();
  setupProtections();

  // Start tracking (5-second interval per spec)
  trackingInterval = setInterval(() => {
    trackEvent(linkToken, sess.session_token);
  }, 5000);

  // Final track on page unload
  window.addEventListener('beforeunload', () => {
    trackEvent(linkToken, sess.session_token, true);
  });

  // Re-render on resize
  window.addEventListener('resize', () => renderPage(currentPage));
}

// ============================================
// GATE FORM HANDLER
// ============================================

function setupGateForm() {
  $gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset errors
    $emailError.classList.add('hidden');
    $passwordError.classList.add('hidden');
    $gateError.classList.add('hidden');

    const email = metadata?.require_email ? $emailInput.value.trim() : undefined;
    const password = metadata?.has_password ? $passwordInput.value : undefined;

    // Validate email
    if (metadata?.require_email && !email) {
      $emailError.textContent = 'Email is required';
      $emailError.classList.remove('hidden');
      return;
    }

    // Validate email format
    if (email && !email.includes('@')) {
      $emailError.textContent = 'Please enter a valid email address';
      $emailError.classList.remove('hidden');
      return;
    }

    // Validate allowed domains
    if (metadata?.allowed_domains && email) {
      const domain = '@' + (email.split('@')[1] || '');
      if (!metadata.allowed_domains.includes(domain)) {
        $emailError.textContent = `Only ${metadata.allowed_domains.join(', ')} emails are allowed`;
        $emailError.classList.remove('hidden');
        return;
      }
    }

    $gateSubmit.disabled = true;
    $gateSubmit.textContent = 'Verifying...';

    const result = await verifyAccess(linkToken, email, password);

    if (!result) {
      $gateSubmit.disabled = false;
      $gateSubmit.textContent = 'View Document';
      $gateError.textContent = 'Access denied. Please check your credentials.';
      $gateError.classList.remove('hidden');
      return;
    }

    if (metadata!.file_type === 'video') {
      startVideoViewer(metadata!, result);
    } else {
      startViewer(metadata!, result);
    }
  });
}

// ============================================
// INIT
// ============================================

async function init() {
  linkToken = getToken() || '';

  if (!linkToken) {
    showError('Invalid link', 'This link is not valid.');
    return;
  }

  showScreen($loading);

  const meta = await fetchMetadata(linkToken);
  if (!meta) return; // Error already shown by fetchMetadata

  metadata = meta;

  // Hide "Secured by CloakShare" badge if paid plan
  if (meta.show_badge === false) {
    document.querySelectorAll('.secured-badge, .secured-by').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  // Handle processing state — show SSE progress
  if (meta.status === 'processing') {
    const progressUrl = `${API_URL}/v1/links/${linkToken}/progress`;
    watchProgress(progressUrl);
    return;
  }

  // Show email/password gate (or auto-verify if no gate)
  if (!meta.require_email && !meta.has_password) {
    // No gate needed — verify immediately
    showScreen($loading);
    const result = await verifyAccess(linkToken);
    if (!result) {
      showError('Access denied', 'Unable to access this document.');
      return;
    }
    if (meta.file_type === 'video') {
      startVideoViewer(meta, result);
    } else {
      startViewer(meta, result);
    }
  } else {
    setupGate(meta);
    setupGateForm();
  }
}

// Boot
init();
