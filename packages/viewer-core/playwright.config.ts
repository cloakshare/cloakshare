import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3999',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx serve fixtures -l 3999 --no-clipboard',
    port: 3999,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
