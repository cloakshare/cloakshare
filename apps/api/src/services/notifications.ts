import { logger } from '../lib/logger.js';

const SLACK_SIGNUP_WEBHOOK_URL = process.env.SLACK_SIGNUP_WEBHOOK_URL;

type ActivityAction =
  | 'link.created'
  | 'link.viewed'
  | 'link.expired'
  | 'link.revoked'
  | 'user.upgraded'
  | 'user.login';

interface SignupPayload {
  email: string;
  plan: string;
  orgName: string;
}

interface ActivityPayload {
  action: ActivityAction;
  email: string;
  detail?: string;
}

/**
 * Send a Slack notification when a new user registers.
 * Fire-and-forget - never throws.
 */
export async function notifySignup(payload: SignupPayload): Promise<void> {
  if (!SLACK_SIGNUP_WEBHOOK_URL) {
    logger.debug('SLACK_SIGNUP_WEBHOOK_URL not set, skipping signup notification');
    return;
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'New Signup',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Email:*\n${payload.email}`,
        },
        {
          type: 'mrkdwn',
          text: `*Plan:*\n${payload.plan}`,
        },
        {
          type: 'mrkdwn',
          text: `*Organization:*\n${payload.orgName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Timestamp:*\n${new Date().toISOString()}`,
        },
      ],
    },
  ];

  await fetch(SLACK_SIGNUP_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}

/**
 * Send a Slack notification for key user actions.
 * Fire-and-forget - never throws.
 */
export async function notifyActivity(payload: ActivityPayload): Promise<void> {
  if (!SLACK_SIGNUP_WEBHOOK_URL) {
    return;
  }

  const actionLabels: Record<ActivityAction, string> = {
    'link.created': 'Link Created',
    'link.viewed': 'Link Viewed',
    'link.expired': 'Link Expired',
    'link.revoked': 'Link Revoked',
    'user.upgraded': 'Plan Upgraded',
    'user.login': 'User Login',
  };

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${actionLabels[payload.action] || payload.action}* - ${payload.email}${payload.detail ? `\n${payload.detail}` : ''}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: new Date().toISOString(),
        },
      ],
    },
  ];

  await fetch(SLACK_SIGNUP_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}
