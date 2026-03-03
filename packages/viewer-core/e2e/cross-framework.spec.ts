import { test, expect } from '@playwright/test';

/**
 * Cross-framework integration tests.
 *
 * Each harness page loads <cloak-viewer> with a different framework (React 18, React 19,
 * Vue 3, Svelte 5) and sets window.__harnessResult to 'PASS' or 'FAIL' after 5 seconds.
 *
 * The harness pages check:
 * 1. Custom element is registered
 * 2. Component is mounted in the DOM
 * 3. Shadow root is attached
 * 4. Canvas is rendered inside shadow DOM
 * 5. cloak:ready event fires
 * 6. cloak:view event fires
 */

const frameworks = [
  { name: 'React 18', path: '/harness/react18.html' },
  { name: 'React 19', path: '/harness/react19.html' },
  { name: 'Vue 3', path: '/harness/vue3.html' },
  { name: 'Svelte 5', path: '/harness/svelte5.html' },
];

for (const fw of frameworks) {
  test(`${fw.name}: component mounts, renders, and fires events`, async ({ page }) => {
    await page.goto(fw.path);

    // Wait for the harness to complete its checks (up to 8s in harness + network time for CDN)
    await page.waitForFunction(
      () => (window as any).__harnessResult !== undefined,
      { timeout: 30_000 },
    );

    const result = await page.evaluate(() => (window as any).__harnessResult);
    expect(result).toBe('PASS');
  });
}
