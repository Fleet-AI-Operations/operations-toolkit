import { Resend } from 'resend';
import { prisma } from '@repo/database';

/**
 * Escapes HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Lazy initialize Resend to avoid build-time errors when env var is not available
let resend: Resend | null = null;
function getResendClient(): Resend {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  if (!resend) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return resend;
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'notifications@yourdomain.com';
}

interface NotificationRecipient {
  email: string;
  name: string | null;
}

/**
 * Fetches admin users who have enabled a specific notification type
 */
async function getNotificationRecipients(notificationType: string): Promise<NotificationRecipient[]> {
  const settings = await prisma.notificationSetting.findMany({
    where: {
      notificationType,
      enabled: true
    },
    include: {
      profile: {
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  return settings.map(setting => ({
    email: setting.profile.email,
    name: setting.profile.firstName && setting.profile.lastName
      ? `${setting.profile.firstName} ${setting.profile.lastName}`
      : setting.profile.firstName || setting.profile.lastName || null
  }));
}

/**
 * Sends an email notification
 */
async function sendEmail(
  to: string[],
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured. Skipping email notification.');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  if (to.length === 0) {
    console.log('No recipients for notification. Skipping email.');
    return { success: false, error: 'No recipients' };
  }

  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Sends notification when a new bug report is created
 */
export async function notifyBugReportCreated(bugReport: {
  number: number;
  title: string;
  description: string;
  createdByEmail: string;
  createdByName?: string | null;
}) {
  const recipients = await getNotificationRecipients('BUG_REPORT_CREATED');

  if (recipients.length === 0) {
    return { success: false, error: 'No recipients configured' };
  }

  const subject = `New Bug Report #${bugReport.number}: ${escapeHtml(bugReport.title)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Bug Report Submitted</h2>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Report #${bugReport.number}</strong></p>
        <h3 style="margin: 0 0 15px 0; color: #555;">${escapeHtml(bugReport.title)}</h3>
        <p style="color: #666; line-height: 1.6;">${escapeHtml(bugReport.description)}</p>
      </div>

      <p style="color: #666;">
        <strong>Reported by:</strong> ${escapeHtml(bugReport.createdByName || bugReport.createdByEmail)}
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from Operations Toolkit.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(
    recipients.map(r => r.email),
    subject,
    html
  );
}

/**
 * Sends notification when a new user is created
 */
export async function notifyUserCreated(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}) {
  const recipients = await getNotificationRecipients('USER_CREATED');

  if (recipients.length === 0) {
    return { success: false, error: 'No recipients configured' };
  }

  const userName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.lastName || user.email;

  const subject = `New User Created: ${escapeHtml(userName)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New User Account Created</h2>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>User Details</strong></p>
        <p style="color: #666; line-height: 1.8; margin: 0;">
          <strong>Name:</strong> ${escapeHtml(userName)}<br>
          <strong>Email:</strong> ${escapeHtml(user.email)}<br>
          <strong>Role:</strong> ${escapeHtml(user.role)}
        </p>
      </div>

      <p style="color: #666;">
        A new user account has been created in the system.
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from Operations Toolkit.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(
    recipients.map(r => r.email),
    subject,
    html
  );
}

/**
 * Sends notification when an AI call is used
 */
export async function notifyAICallUsed(aiCall: {
  operation: string;
  model: string;
  cost?: number;
  userId?: string;
  userEmail?: string;
}) {
  const recipients = await getNotificationRecipients('AI_CALL_USED');

  if (recipients.length === 0) {
    return { success: false, error: 'No recipients configured' };
  }

  const subject = `AI Call: ${escapeHtml(aiCall.operation)}`;
  const costInfo = aiCall.cost ? `$${aiCall.cost.toFixed(4)}` : 'Free (local)';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">AI Operation Performed</h2>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Operation Details</strong></p>
        <p style="color: #666; line-height: 1.8; margin: 0;">
          <strong>Operation:</strong> ${escapeHtml(aiCall.operation)}<br>
          <strong>Model:</strong> ${escapeHtml(aiCall.model)}<br>
          <strong>Cost:</strong> ${escapeHtml(costInfo)}
          ${aiCall.userEmail ? `<br><strong>User:</strong> ${escapeHtml(aiCall.userEmail)}` : ''}
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #999; font-size: 12px;">
          This is an automated notification from Operations Toolkit.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(
    recipients.map(r => r.email),
    subject,
    html
  );
}
