import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import * as schema from './schema.js';

function createDbClient() {
  if (config.database.provider === 'turso' && config.database.tursoUrl) {
    logger.info('Connecting to Turso database');
    const client = createClient({
      url: config.database.tursoUrl,
      authToken: config.database.tursoToken,
    });
    return drizzle(client, { schema });
  }

  // Local SQLite for development and self-hosted mode
  logger.info({ path: config.database.sqlitePath }, 'Using local SQLite database');
  const client = createClient({
    url: `file:${config.database.sqlitePath}`,
  });
  return drizzle(client, { schema });
}

export const db = createDbClient();

export type Database = typeof db;
