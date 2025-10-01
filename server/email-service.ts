import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email Service for ReadMyFinePrint
 * Handles transactional emails for subscription events
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SubscriptionEmailData {
  userEmail: string;
  userName?: string;
  tier: string;
  priceAmount: number;
  billingInterval: 'month' | 'year';
  subscriptionId: string;
  customerId: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string;
  private isConfigured: boolean = false;

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@readmyfineprint.com';
    this.initialize();
  }

  private initialize() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.warn('⚠️  Email service not configured - SMTP credentials missing');
      console.warn('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.isConfigured = true;
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  public async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.log('📧 [MOCK] Would send email to:', options.to);
      console.log('📧 [MOCK] Subject:', options.subject);
      return true; // Return success in mock mode
    }

    try {
      await this.transporter.sendMail({
        from: `ReadMyFinePrint <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`✅ Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Send subscription created confirmation email
   */
  async sendSubscriptionCreated(data: SubscriptionEmailData): Promise<boolean> {
    const { userEmail, userName, tier, priceAmount, billingInterval } = data;
    
    const subject = `Welcome to ${tier} - Subscription Confirmed`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to ${tier}!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${userName ? `Hi ${userName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Thank you for subscribing to ReadMyFinePrint! Your <strong>${tier}</strong> subscription is now active.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
      <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">Subscription Details</h2>
      <p style="margin: 10px 0;"><strong>Plan:</strong> ${tier}</p>
      <p style="margin: 10px 0;"><strong>Amount:</strong> $${(priceAmount / 100).toFixed(2)} / ${billingInterval}</p>
      <p style="margin: 10px 0;"><strong>Subscription ID:</strong> ${data.subscriptionId}</p>
    </div>
    
    <h3 style="color: #667eea; font-size: 18px;">What's Next?</h3>
    <ul style="padding-left: 20px;">
      <li style="margin-bottom: 10px;">Start analyzing your documents with enhanced AI capabilities</li>
      <li style="margin-bottom: 10px;">Access your subscription dashboard to manage your plan</li>
      <li style="margin-bottom: 10px;">Enjoy all the premium features included in your tier</li>
    </ul>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://readmyfineprint.com/dashboard" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Questions? Contact us at <a href="mailto:support@readmyfineprint.com" style="color: #667eea;">support@readmyfineprint.com</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Welcome to ${tier}!

${userName ? `Hi ${userName},` : 'Hi there,'}

Thank you for subscribing to ReadMyFinePrint! Your ${tier} subscription is now active.

Subscription Details:
- Plan: ${tier}
- Amount: $${(priceAmount / 100).toFixed(2)} / ${billingInterval}
- Subscription ID: ${data.subscriptionId}

What's Next?
- Start analyzing your documents with enhanced AI capabilities
- Access your subscription dashboard to manage your plan
- Enjoy all the premium features included in your tier

Go to your dashboard: https://readmyfineprint.com/dashboard

Questions? Contact us at support@readmyfineprint.com
    `;

    return this.sendEmail({ to: userEmail, subject, html, text });
  }

  /**
   * Send subscription canceled notification
   */
  async sendSubscriptionCanceled(data: SubscriptionEmailData): Promise<boolean> {
    const { userEmail, userName, tier } = data;
    
    const subject = `Subscription Canceled - ${tier}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Canceled</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f3f4f6; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #374151; margin: 0; font-size: 28px;">Subscription Canceled</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${userName ? `Hi ${userName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We're sorry to see you go! Your <strong>${tier}</strong> subscription has been canceled.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
      <h2 style="margin-top: 0; color: #f59e0b; font-size: 20px;">What This Means</h2>
      <ul style="padding-left: 20px; margin: 10px 0;">
        <li style="margin-bottom: 10px;">You'll retain access until the end of your current billing period</li>
        <li style="margin-bottom: 10px;">You won't be charged again</li>
        <li style="margin-bottom: 10px;">Your account will switch to the Free tier after the period ends</li>
      </ul>
    </div>
    
    <p style="font-size: 16px;">
      Changed your mind? You can reactivate your subscription anytime from your dashboard.
    </p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://readmyfineprint.com/subscription" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reactivate Subscription</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      We'd love to hear your feedback: <a href="mailto:feedback@readmyfineprint.com" style="color: #667eea;">feedback@readmyfineprint.com</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Subscription Canceled

${userName ? `Hi ${userName},` : 'Hi there,'}

We're sorry to see you go! Your ${tier} subscription has been canceled.

What This Means:
- You'll retain access until the end of your current billing period
- You won't be charged again
- Your account will switch to the Free tier after the period ends

Changed your mind? You can reactivate your subscription anytime from your dashboard.

Reactivate: https://readmyfineprint.com/subscription

We'd love to hear your feedback: feedback@readmyfineprint.com
    `;

    return this.sendEmail({ to: userEmail, subject, html, text });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(data: SubscriptionEmailData): Promise<boolean> {
    const { userEmail, userName, tier, priceAmount } = data;
    
    const subject = `⚠️ Payment Failed - Action Required`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #ef4444; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Payment Failed</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${userName ? `Hi ${userName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We were unable to process your payment for your <strong>${tier}</strong> subscription ($${(priceAmount / 100).toFixed(2)}).
    </p>
    
    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ef4444;">
      <h2 style="margin-top: 0; color: #ef4444; font-size: 20px;">Action Required</h2>
      <p style="margin: 10px 0;">
        Please update your payment method to maintain uninterrupted access to your premium features.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://readmyfineprint.com/subscription" style="display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Update Payment Method</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Need help? Contact us at <a href="mailto:support@readmyfineprint.com" style="color: #667eea;">support@readmyfineprint.com</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
⚠️ Payment Failed - Action Required

${userName ? `Hi ${userName},` : 'Hi there,'}

We were unable to process your payment for your ${tier} subscription ($${(priceAmount / 100).toFixed(2)}).

Action Required:
Please update your payment method to maintain uninterrupted access to your premium features.

Update payment method: https://readmyfineprint.com/subscription

Need help? Contact us at support@readmyfineprint.com
    `;

    return this.sendEmail({ to: userEmail, subject, html, text });
  }

  /**
   * Send subscription updated notification
   */
  async sendSubscriptionUpdated(data: SubscriptionEmailData & { status: string }): Promise<boolean> {
    const { userEmail, userName, tier, status } = data;
    
    const subject = `Subscription Updated - ${tier}`;
    
    const statusMessages: Record<string, string> = {
      'active': 'Your subscription is now active and ready to use.',
      'past_due': 'Your subscription payment is past due. Please update your payment method.',
      'canceled': 'Your subscription has been canceled.',
      'unpaid': 'Your subscription is unpaid. Please update your payment method.',
    };

    const statusMessage = statusMessages[status] || `Your subscription status is now: ${status}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Updated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #667eea; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Updated</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${userName ? `Hi ${userName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your <strong>${tier}</strong> subscription has been updated.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
      <p style="margin: 10px 0; font-size: 16px;">
        ${statusMessage}
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://readmyfineprint.com/subscription" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Subscription</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Questions? Contact us at <a href="mailto:support@readmyfineprint.com" style="color: #667eea;">support@readmyfineprint.com</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Subscription Updated

${userName ? `Hi ${userName},` : 'Hi there,'}

Your ${tier} subscription has been updated.

${statusMessage}

View your subscription: https://readmyfineprint.com/subscription

Questions? Contact us at support@readmyfineprint.com
    `;

    return this.sendEmail({ to: userEmail, subject, html, text });
  }

  /**
   * Send trial ending notification (for future use when trials are implemented)
   */
  async sendTrialEnding(data: SubscriptionEmailData & { daysLeft: number }): Promise<boolean> {
    const { userEmail, userName, tier, daysLeft } = data;
    
    const subject = `Your ${tier} trial ends in ${daysLeft} days`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
  <title>Trial Ending Soon</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f59e0b; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">⏰ Your Trial is Ending Soon</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      ${userName ? `Hi ${userName},` : 'Hi there,'}
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your <strong>${tier}</strong> trial will end in <strong>${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}</strong>.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
      <h2 style="margin-top: 0; color: #f59e0b; font-size: 20px;">Don't Lose Access</h2>
      <p style="margin: 10px 0;">
        Update your payment method now to continue enjoying all premium features without interruption.
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://readmyfineprint.com/subscription" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Add Payment Method</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Questions? Contact us at <a href="mailto:support@readmyfineprint.com" style="color: #667eea;">support@readmyfineprint.com</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
⏰ Your Trial is Ending Soon

${userName ? `Hi ${userName},` : 'Hi there,'}

Your ${tier} trial will end in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.

Don't Lose Access:
Update your payment method now to continue enjoying all premium features without interruption.

Add payment method: https://readmyfineprint.com/subscription

Questions? Contact us at support@readmyfineprint.com
    `;

    return this.sendEmail({ to: userEmail, subject, html, text });
  }

  async sendOrganizationInvitation(data: {
    to: string;
    organizationName: string;
    inviterName: string;
    invitationUrl: string;
    role: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const { to, organizationName, inviterName, invitationUrl, role, expiresAt } = data;
    const expirationDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const subject = `You've been invited to join ${organizationName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team Invitation</h2>
        <p>You've been invited by ${inviterName} to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>
        <p><a href="${invitationUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
        <p>Or copy and paste this link: ${invitationUrl}</p>
        <p><small>This invitation expires on ${expirationDate}</small></p>
      </div>
    `;
    const text = `You've been invited to join ${organizationName} as a ${role}. Visit: ${invitationUrl} (Expires: ${expirationDate})`;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendDonationThankYou(data: {
    to: string;
    amount: number;
    donorName?: string;
  }): Promise<boolean> {
    const { to, amount, donorName } = data;
    const subject = 'Thank you for your donation!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You!</h2>
        <p>${donorName ? `Dear ${donorName},` : 'Dear Supporter,'}</p>
        <p>Thank you for your generous donation of $${amount.toFixed(2)}. Your support helps us continue our mission.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `;
    const text = `Thank you for your donation of $${amount.toFixed(2)}!`;

    return this.sendEmail({ to, subject, html, text });
  }

  async getHealthStatus(): Promise<{ 
    configured: boolean; 
    transporter: boolean;
    isConfigured: boolean;
    isHealthy: boolean;
    provider: string;
    fromAddress: string;
    lastChecked?: Date;
  }> {
    return {
      configured: this.isConfigured,
      transporter: this.transporter !== null,
      isConfigured: this.isConfigured,
      isHealthy: this.transporter !== null && this.isConfigured,
      provider: process.env.EMAIL_PROVIDER || 'none',
      fromAddress: this.fromEmail,
      lastChecked: new Date()
    };
  }
  async testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured || !this.transporter) {
        return { success: false, error: 'Email service not configured' };
      }
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

// Export singleton instance
}
export const emailService = new EmailService();
