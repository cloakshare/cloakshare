import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a webhook signature from CloakShare.
 *
 * @example
 * // Express
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const signature = req.headers['x-cloakshare-signature'];
 *   const isValid = CloakShare.webhooks.verify(req.body, signature, process.env.WEBHOOK_SECRET);
 *   if (!isValid) return res.status(401).send('Invalid signature');
 *   // Handle event...
 * });
 *
 * @example
 * // Hono
 * app.post('/webhook', async (c) => {
 *   const body = await c.req.text();
 *   const signature = c.req.header('x-cloakshare-signature');
 *   const isValid = CloakShare.webhooks.verify(body, signature, process.env.WEBHOOK_SECRET);
 *   // ...
 * });
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!payload || !signature || !secret) return false;

  const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
  const expected = createHmac('sha256', secret).update(payloadString).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
