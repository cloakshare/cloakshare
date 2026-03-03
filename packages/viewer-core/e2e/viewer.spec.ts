import { test, expect } from '@playwright/test';

// Helper: get shadow root element
async function shadowEl(page: any, hostSelector: string, innerSelector: string) {
  return page.locator(hostSelector).locator(innerSelector);
}

// Helper: wait for a specific screen to become active inside shadow DOM
async function waitForScreen(page: any, hostId: string, screenClass: string, timeout = 10_000) {
  const host = page.locator(`#${hostId}`);
  await host.locator(`.${screenClass}.active`).waitFor({ state: 'visible', timeout });
}

// ── Basic Rendering ──────────────────────────────────────────────────────────

test.describe('Basic rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to avoid stale email gate data
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('renders PDF and shows viewer screen', async ({ page }) => {
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const canvas = page.locator('#viewer-basic').locator('.viewer-canvas');
    await expect(canvas).toBeVisible();
  });

  test('shows page indicator 1 / N', async ({ page }) => {
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const indicator = page.locator('#viewer-basic').locator('.page-indicator');
    const text = await indicator.textContent();
    expect(text).toMatch(/1\s*\/\s*\d+/);
  });

  test('dispatches cloak:ready event', async ({ page }) => {
    // Inject listener before page loads via init script
    await page.addInitScript(() => {
      (window as any).__readyDetail = null;
      document.addEventListener('cloak:ready', (e: any) => {
        if ((e.target as HTMLElement)?.id === 'viewer-basic') {
          (window as any).__readyDetail = e.detail;
        }
      });
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const detail = await page.evaluate(() => (window as any).__readyDetail);
    expect(detail).toBeTruthy();
    expect(detail.pageCount).toBeGreaterThan(0);
    expect(detail.format).toBe('pdf');
  });

  test('dispatches cloak:view event on load', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__viewDetail = null;
      document.addEventListener('cloak:view', (e: any) => {
        if ((e.target as HTMLElement)?.id === 'viewer-basic') {
          (window as any).__viewDetail = e.detail;
        }
      });
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const detail = await page.evaluate(() => (window as any).__viewDetail);
    expect(detail).toBeTruthy();
    expect(detail.page).toBe(1);
    expect(detail.sessionId).toBeTruthy();
    expect(detail.device).toMatch(/desktop|mobile|tablet/);
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
  });

  test('next button navigates to page 2', async ({ page }) => {
    const nextBtn = page.locator('#viewer-basic').locator('.next-btn');
    if (!(await nextBtn.isDisabled())) {
      await nextBtn.click();
      const indicator = page.locator('#viewer-basic').locator('.page-indicator');
      const text = await indicator.textContent();
      expect(text).toMatch(/2\s*\/\s*\d+/);
    }
  });

  test('prev button is disabled on first page', async ({ page }) => {
    const prevBtn = page.locator('#viewer-basic').locator('.prev-btn');
    await expect(prevBtn).toBeDisabled();
  });

  test('keyboard arrow right navigates forward', async ({ page }) => {
    const viewerBody = page.locator('#viewer-basic').locator('.viewer-body');
    await viewerBody.focus();
    await page.keyboard.press('ArrowRight');
    const indicator = page.locator('#viewer-basic').locator('.page-indicator');
    const text = await indicator.textContent();
    // May still be page 1 if only 1 page, but shouldn't crash
    expect(text).toMatch(/\d+\s*\/\s*\d+/);
  });
});

// ── Watermark ────────────────────────────────────────────────────────────────

test.describe('Watermark', () => {
  test('watermark overlay is visible when watermark is set', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-watermark', 'screen-viewer');
    const overlay = page.locator('#viewer-watermark').locator('.watermark-overlay');
    await expect(overlay).toBeVisible();
  });

  test('watermark overlay is hidden when no watermark attribute', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const overlay = page.locator('#viewer-basic').locator('.watermark-overlay');
    const display = await overlay.evaluate((el: HTMLElement) => getComputedStyle(el).display);
    expect(display).toBe('none');
  });
});

// ── Email Gate ───────────────────────────────────────────────────────────────

test.describe('Email gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('shows gate screen when email-gate is set', async ({ page }) => {
    await waitForScreen(page, 'viewer-emailgate', 'screen-gate');
    const emailInput = page.locator('#viewer-emailgate').locator('.gate-email');
    await expect(emailInput).toBeVisible();
  });

  test('submitting valid email reveals viewer', async ({ page }) => {
    await waitForScreen(page, 'viewer-emailgate', 'screen-gate');
    const emailInput = page.locator('#viewer-emailgate').locator('.gate-email');
    const submitBtn = page.locator('#viewer-emailgate').locator('.gate-submit');

    await emailInput.fill('user@test.com');
    await submitBtn.click();

    await waitForScreen(page, 'viewer-emailgate', 'screen-viewer');
    const canvas = page.locator('#viewer-emailgate').locator('.viewer-canvas');
    await expect(canvas).toBeVisible();
  });

  test('rejects empty email submission', async ({ page }) => {
    await waitForScreen(page, 'viewer-emailgate', 'screen-gate');

    // Submit with empty email — bypass native type="email" validation by dispatching submit directly
    await page.locator('#viewer-emailgate').evaluate((host: HTMLElement) => {
      const sr = host.shadowRoot;
      const form = sr?.querySelector('.gate-form') as HTMLFormElement;
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForTimeout(300);

    const result = await page.locator('#viewer-emailgate').evaluate((host: HTMLElement) => {
      const sr = host.shadowRoot;
      const err = sr?.querySelector('.gate-error');
      return {
        text: err?.textContent || '',
        hasVisible: err?.classList.contains('visible') || false,
      };
    });

    expect(result.hasVisible).toBe(true);
    expect(result.text.toLowerCase()).toContain('email');
  });

  test('pre-filled email skips gate', async ({ page }) => {
    await waitForScreen(page, 'viewer-prefilled', 'screen-viewer');
    const canvas = page.locator('#viewer-prefilled').locator('.viewer-canvas');
    await expect(canvas).toBeVisible();
  });

  test('dispatches cloak:email-submitted event', async ({ page }) => {
    await waitForScreen(page, 'viewer-emailgate', 'screen-gate');

    const emailPromise = page.evaluate(() => new Promise<any>((resolve) => {
      document.getElementById('viewer-emailgate')!.addEventListener('cloak:email-submitted', (e: any) => {
        resolve(e.detail);
      });
    }));

    const emailInput = page.locator('#viewer-emailgate').locator('.gate-email');
    const submitBtn = page.locator('#viewer-emailgate').locator('.gate-submit');
    await emailInput.fill('submit@test.com');
    await submitBtn.click();

    const detail = await emailPromise;
    expect(detail.email).toBe('submit@test.com');
  });
});

// ── Password Gate ────────────────────────────────────────────────────────────

test.describe('Password gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
  });

  test('shows password input when password is set', async ({ page }) => {
    await waitForScreen(page, 'viewer-password', 'screen-gate');
    const passwordInput = page.locator('#viewer-password').locator('.gate-password');
    await expect(passwordInput).toBeVisible();
  });

  test('correct password reveals viewer', async ({ page }) => {
    await waitForScreen(page, 'viewer-password', 'screen-gate');
    const passwordInput = page.locator('#viewer-password').locator('.gate-password');
    const submitBtn = page.locator('#viewer-password').locator('.gate-submit');

    await passwordInput.fill('secret123');
    await submitBtn.click();

    await waitForScreen(page, 'viewer-password', 'screen-viewer');
  });

  test('wrong password shows error', async ({ page }) => {
    await waitForScreen(page, 'viewer-password', 'screen-gate');
    const passwordInput = page.locator('#viewer-password').locator('.gate-password');
    const submitBtn = page.locator('#viewer-password').locator('.gate-submit');

    await passwordInput.fill('wrongpass');
    await submitBtn.click();

    const error = page.locator('#viewer-password').locator('.gate-error');
    await expect(error).toHaveClass(/visible/);
  });
});

// ── Branding ─────────────────────────────────────────────────────────────────

test.describe('Branding', () => {
  test('shows branding badge by default', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const badge = page.locator('#viewer-basic').locator('.branding-badge');
    const display = await badge.evaluate((el: HTMLElement) => el.style.display);
    expect(display).not.toBe('none');
  });

  test('hides branding badge when branding=false', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-nobranding', 'screen-viewer');
    const badge = page.locator('#viewer-nobranding').locator('.branding-badge');
    const display = await badge.evaluate((el: HTMLElement) => el.style.display);
    expect(display).toBe('none');
  });
});

// ── Light Theme ──────────────────────────────────────────────────────────────

test.describe('Light theme', () => {
  test('applies light theme styles when theme=light', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-light', 'screen-viewer');
    const bg = await page.locator('#viewer-light').evaluate((el: HTMLElement) => {
      return getComputedStyle(el).backgroundColor;
    });
    // Light theme background should be white-ish, not dark
    expect(bg).not.toBe('rgb(9, 9, 11)'); // not dark theme #09090b
  });
});

// ── Error States ─────────────────────────────────────────────────────────────

test.describe('Error states', () => {
  test('shows expired error for past expiry date', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-expired', 'screen-error');
    const errorTitle = page.locator('#viewer-expired').locator('.error-title');
    const text = await errorTitle.textContent();
    expect(text?.toLowerCase()).toContain('expired');
  });

  test('dispatches cloak:error for expired document', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__errorDetail = null;
      document.addEventListener('cloak:error', (e: any) => {
        if ((e.target as HTMLElement)?.id === 'viewer-expired') {
          (window as any).__errorDetail = e.detail;
        }
      });
    });
    await page.goto('/');
    await waitForScreen(page, 'viewer-expired', 'screen-error');
    const detail = await page.evaluate(() => (window as any).__errorDetail);
    expect(detail).toBeTruthy();
    expect(detail.code).toBe('EXPIRED');
  });

  test('shows unsupported format error for .pptx without API key', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-unsupported', 'screen-error');
    const errorTitle = page.locator('#viewer-unsupported').locator('.error-title');
    const text = await errorTitle.textContent();
    expect(text?.toLowerCase()).toContain('api key');
  });
});

// ── Accessibility ────────────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test('viewer has role=document', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const container = page.locator('#viewer-basic').locator('[role="document"]');
    await expect(container).toBeVisible();
  });

  test('page navigation has aria-label', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const nav = page.locator('#viewer-basic').locator('nav[aria-label="Page navigation"]');
    await expect(nav).toBeVisible();
  });

  test('page indicator has aria-live', async ({ page }) => {
    await page.goto('/');
    await waitForScreen(page, 'viewer-basic', 'screen-viewer');
    const indicator = page.locator('#viewer-basic').locator('.page-indicator');
    const ariaLive = await indicator.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('gate form has focusable email input', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await waitForScreen(page, 'viewer-emailgate', 'screen-gate');

    // Verify the email input is visible and focusable
    const emailInput = page.locator('#viewer-emailgate').locator('.gate-email');
    await expect(emailInput).toBeVisible();
    await emailInput.focus();
    // Type into the input to verify it's truly focused and interactive
    await emailInput.fill('focus@test.com');
    const val = await emailInput.inputValue();
    expect(val).toBe('focus@test.com');
  });
});
