import { processWebhookDeliveries } from '../services/webhooks.js';
import { logger } from '../lib/logger.js';

const POLL_INTERVAL = 5000; // 5 seconds
let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (!running) return;
  try {
    await processWebhookDeliveries();
  } catch (error) {
    logger.error({ error }, 'Webhook worker poll error');
  }
}

export function startWebhookWorker() {
  if (running) return;
  running = true;
  logger.info('Webhook worker started');
  pollTimer = setInterval(poll, POLL_INTERVAL);
}

export function stopWebhookWorker() {
  running = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  logger.info('Webhook worker stopped');
}
