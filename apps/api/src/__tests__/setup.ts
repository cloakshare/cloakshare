import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

// Point the database at a temporary test-specific SQLite file so production
// data is never touched.  The env var must be set before any application
// module (config / db client) is imported.
const testDbDir = path.resolve(__dirname, '../../data');
const testDbPath = path.join(testDbDir, 'test.db');

// Ensure the data directory exists
mkdirSync(testDbDir, { recursive: true });

// Set env vars before any module is imported
process.env.SQLITE_PATH = testDbPath;
process.env.STORAGE_PROVIDER = 'local';
process.env.LOG_LEVEL = 'silent';
process.env.ENABLE_VIDEO = 'true';

// Only initialize the DB once per fork.  With singleFork mode all test files
// share this process, so setupFiles runs once per test file.  We guard with a
// global flag so drizzle-kit push only runs on the first execution.
const INIT_KEY = '__CLOAK_TEST_DB_INITIALIZED__';
if (!(globalThis as Record<string, unknown>)[INIT_KEY]) {
  // Remove stale test database from a previous run
  try { rmSync(testDbPath, { force: true }); } catch { /* ignore */ }

  // Use drizzle-kit push to create tables from the schema.
  execSync('npx drizzle-kit push --force', {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      SQLITE_PATH: testDbPath,
    },
    stdio: 'pipe',
  });

  (globalThis as Record<string, unknown>)[INIT_KEY] = true;
}
