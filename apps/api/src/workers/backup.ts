import { copyFile, readdir, unlink, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const BACKUP_DIR = resolve(config.database.sqlitePath, '..', 'backups');

let backupTimer: ReturnType<typeof setInterval> | null = null;

async function performBackup() {
  try {
    const dbPath = resolve(config.database.sqlitePath);
    await mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `cloak-${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupFilename);

    // WAL checkpoint to flush all writes to the main DB file
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: `file:${dbPath}` });
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    client.close();

    // Copy the DB file
    await copyFile(dbPath, backupPath);

    const backupStat = await stat(backupPath);
    logger.info(
      { backupPath, sizeBytes: backupStat.size },
      `Database backup created: ${backupFilename}`,
    );

    // Rotate old backups — keep only the most recent N
    await rotateBackups();
  } catch (error) {
    logger.error({ error }, 'Database backup failed');
  }
}

async function rotateBackups() {
  try {
    const files = await readdir(BACKUP_DIR);
    const backups = files
      .filter((f) => f.startsWith('cloak-') && f.endsWith('.db'))
      .sort()
      .reverse(); // newest first

    const toDelete = backups.slice(config.backup.retainCount);
    for (const file of toDelete) {
      await unlink(join(BACKUP_DIR, file));
      logger.info({ file }, 'Rotated old backup');
    }
  } catch (error) {
    logger.error({ error }, 'Backup rotation failed');
  }
}

export function startBackupWorker() {
  if (!config.backup.enabled) {
    logger.debug('Database backup worker disabled');
    return;
  }

  const intervalMs = config.backup.intervalHours * 60 * 60 * 1000;

  // Run first backup after 2 minutes (let the server finish starting)
  setTimeout(performBackup, 2 * 60 * 1000);
  backupTimer = setInterval(performBackup, intervalMs);

  logger.info(
    { intervalHours: config.backup.intervalHours, retainCount: config.backup.retainCount },
    'Database backup worker started',
  );
}

export function stopBackupWorker() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  logger.info('Database backup worker stopped');
}
