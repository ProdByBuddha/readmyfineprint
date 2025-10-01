import nodemailer from 'nodemailer';

// SMTP configuration from environment variables
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
}

/**
 * Send organization invitation email
 */
export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
  const { to, inviterName, orgName, role, acceptUrl, expiresAt } = params;

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    throw new Error('SMTP_FROM or SMTP_USER must be configured');
  }

  const expiresInDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #6c757d; }
    .role-badge { display: inline-block; padding: 4px 8px; background: #e7f3ff; color: #0056b3; border-radius: 3px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You've been invited!</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <span class="role-badge">${role}</span>.</p>
      <p>Accept this invitation to collaborate with your team and access shared workspaces and documents.</p>
      <p style="text-align: center;">
        <a href="${acceptUrl}" class="button">Accept Invitation</a>
      </p>
      <p style="font-size: 14px; color: #6c757d;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; word-break: break-all; color: #6c757d;">${acceptUrl}</p>
      <div class="footer">
        <p>This invitation will expire in ${expiresInDays} days.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
You've been invited to join ${orgName}!

${inviterName} has invited you to join ${orgName} as a ${role}.

Accept this invitation to collaborate with your team and access shared workspaces and documents.

Accept invitation:
${acceptUrl}

This invitation will expire in ${expiresInDays} days.

If you didn't expect this invitation, you can safely ignore this email.
  `.trim();

  try {
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: `${inviterName} invited you to join ${orgName}`,
      text: textContent,
      html: htmlContent,
    });

    // Log success without exposing sensitive data
    console.log(`Invitation email sent to ${to.substring(0, 3)}***@*** for org ${orgName}`);
  } catch (error) {
    console.error('Failed to send invitation email:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Failed to send invitation email');
  }
}

/**
 * Send welcome email when user joins organization
 */
export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
  orgName: string;
  role: string;
}): Promise<void> {
  const { to, userName, orgName, role } = params;

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    throw new Error('SMTP_FROM or SMTP_USER must be configured');
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e9ecef; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${orgName}!</h1>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>You've successfully joined <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
      <p>You can now collaborate with your team, access shared workspaces, and work on documents together.</p>
      <p style="text-align: center;">
        <a href="${appUrl}/orgs" class="button">Go to Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Welcome to ${orgName}!

Hi ${userName},

You've successfully joined ${orgName} as a ${role}.

You can now collaborate with your team, access shared workspaces, and work on documents together.

Go to dashboard: ${appUrl}/orgs
  `.trim();

  try {
    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: `Welcome to ${orgName}`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`Welcome email sent to ${to.substring(0, 3)}***@***`);
  } catch (error) {
    console.error('Failed to send welcome email:', error instanceof Error ? error.message : 'Unknown error');
    // Don't throw - welcome email is nice-to-have, not critical
  }
}
