import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from './client.js';
import { logger } from '../lib/logger.js';

async function runMigrations() {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Migrations complete');
}

runMigrations().catch((err) => {
  logger.error(err, 'Migration failed');
  process.exit(1);
});
