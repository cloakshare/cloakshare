import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { escapeHtml } from '../lib/utils.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend API.
 */
async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!config.resend.apiKey) {
    logger.debug({ to, subject }, 'Email skipped — no Resend API key configured');
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resend.fromEmail,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ to, subject, status: res.status, body }, 'Email send failed');
      return;
    }

    logger.info({ to, subject }, 'Email sent');
  } catch (error) {
    logger.error({ error, to, subject }, 'Email send error');
  }
}

/**
 * Notify link owner when their document is viewed.
 */
export async function sendViewNotification(params: {
  ownerEmail: string;
  linkName: string;
  linkId: string;
  viewerEmail: string;
  viewerDevice: string;
  viewerCountry: string | null;
}) {
  const { ownerEmail, linkName, linkId, viewerEmail, viewerDevice, viewerCountry } = params;
  const dashboardUrl = config.dashboardUrl;
  const safeLinkName = escapeHtml(linkName || linkId);
  const safeViewerEmail = escapeHtml(viewerEmail);
  const safeDevice = escapeHtml(viewerDevice);
  const location = escapeHtml(viewerCountry || 'Unknown');

  await sendEmail({
    to: ownerEmail,
    subject: `${safeViewerEmail} viewed "${safeLinkName}"`,
    html: `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #09090B; border-radius: 8px; padding: 24px; color: #FAFAFA;">
          <h2 style="color: #00FF88; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 16px;">
            New View
          </h2>
          <p style="color: #A1A1AA; font-size: 13px; margin: 0 0 16px;">
            Someone viewed your document:
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #71717A; font-size: 12px; padding: 6px 0;">Document</td>
              <td style="color: #FAFAFA; font-size: 12px; padding: 6px 0; text-align: right;">${safeLinkName}</td>
            </tr>
            <tr>
              <td style="color: #71717A; font-size: 12px; padding: 6px 0;">Viewer</td>
              <td style="color: #FAFAFA; font-size: 12px; padding: 6px 0; text-align: right;">${safeViewerEmail}</td>
            </tr>
            <tr>
              <td style="color: #71717A; font-size: 12px; padding: 6px 0;">Device</td>
              <td style="color: #FAFAFA; font-size: 12px; padding: 6px 0; text-align: right;">${safeDevice}</td>
            </tr>
            <tr>
              <td style="color: #71717A; font-size: 12px; padding: 6px 0;">Location</td>
              <td style="color: #FAFAFA; font-size: 12px; padding: 6px 0; text-align: right;">${location}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; text-align: center;">
            <a href="${dashboardUrl}/dashboard/links/${linkId}"
               style="display: inline-block; background: #00FF88; color: #09090B; padding: 8px 20px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
              View Details
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #52525B; font-size: 11px; margin-top: 16px;">
          Sent by Cloak &middot; Manage notifications in your <a href="${dashboardUrl}/dashboard/settings" style="color: #71717A;">settings</a>
        </p>
      </div>
    `,
  });
}

/**
 * Notify link owner when rendering is complete.
 */
export async function sendLinkReadyNotification(params: {
  ownerEmail: string;
  linkName: string;
  linkId: string;
  pageCount: number;
}) {
  const { ownerEmail, linkName, linkId, pageCount } = params;
  const dashboardUrl = config.dashboardUrl;
  const safeLinkName = escapeHtml(linkName || linkId);

  await sendEmail({
    to: ownerEmail,
    subject: `"${safeLinkName}" is ready to share`,
    html: `
      <div style="font-family: 'JetBrains Mono', monospace, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #09090B; border-radius: 8px; padding: 24px; color: #FAFAFA;">
          <h2 style="color: #00FF88; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 16px;">
            Link Ready
          </h2>
          <p style="color: #A1A1AA; font-size: 13px; margin: 0 0 8px;">
            Your document has been processed and is ready to share.
          </p>
          <p style="color: #71717A; font-size: 12px; margin: 0 0 16px;">
            ${safeLinkName} &middot; ${pageCount} page${pageCount !== 1 ? 's' : ''}
          </p>
          <div style="text-align: center;">
            <a href="${dashboardUrl}/dashboard/links/${linkId}"
               style="display: inline-block; background: #00FF88; color: #09090B; padding: 8px 20px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
              View &amp; Share
            </a>
          </div>
        </div>
      </div>
    `,
  });
}
