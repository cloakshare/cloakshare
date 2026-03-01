import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15000,
    setupFiles: ['./src/__tests__/setup.ts'],
    // SQLite cannot handle concurrent connections — run sequentially
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
