import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

interface DonationEmailData {
  amount: number;
  currency: string;
  paymentIntentId: string;
  customerEmail?: string;
  customerName?: string;
  timestamp: Date;
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private useSendGrid = false;
  private useSmtp = false;
  private isConfigured = false;
  private lastHealthCheck: Date | null = null;
  private lastHealthStatus: boolean = false;
  private healthCheckCacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const { SENDGRID_API_KEY, SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS } = process.env;

      // Priority 1: SendGrid (recommended for production)
      if (SENDGRID_API_KEY && SENDGRID_API_KEY.trim().length > 0) {
        try {
          sgMail.setApiKey(SENDGRID_API_KEY);
          this.useSendGrid = true;
          this.isConfigured = true;
          console.log('✅ Email service configured with SendGrid');
          
          // Test SendGrid connectivity
          this.testSendGridConnection().then(success => {
            if (!success) {
              console.warn('⚠️ SendGrid API key may be invalid or inactive');
              this.isConfigured = false;
              this.useSendGrid = false;
            }
          });
          return;
        } catch (error) {
          console.error('❌ Failed to initialize SendGrid:', error);
          this.useSendGrid = false;
        }
      }

      // Priority 2: SMTP fallback
      if (SMTP_USER && SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: SMTP_HOST || 'smtp.sendgrid.net',
          port: parseInt(SMTP_PORT),
          secure: false,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        this.useSmtp = true;
        
        // Test the connection before marking as configured
        this.transporter.verify()
          .then(() => {
            this.isConfigured = true;
            console.log(`✅ Email service configured with SMTP (${SMTP_HOST || 'smtp.sendgrid.net'})`);
          })
          .catch((error) => {
            console.warn(`⚠️ SMTP verification failed: ${error.message}`);
            console.warn('Email service will be disabled. Check SMTP credentials.');
            this.isConfigured = false;
            this.useSmtp = false;
            this.transporter = null;
          });
        return;
      }

      console.log('⚠️ Email service not configured - missing environment variables');
      console.log('Required: SENDGRID_API_KEY (recommended) or SMTP_USER + SMTP_PASS');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  /**
   * Test SendGrid API connectivity
   */
  private async testSendGridConnection(): Promise<boolean> {
    try {
      // SendGrid validation: try to get API key info
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('SendGrid connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Send generic email
   */
  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('⚠️ Email service not configured - skipping email send');
      return false;
    }

    try {
      if (this.useSendGrid) {
        return await this.sendWithSendGrid(emailData);
      } else if (this.useSmtp && this.transporter) {
        return await this.sendWithSmtp(emailData);
      } else {
        console.error('❌ No email provider configured');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send email via SendGrid
   */
  private async sendWithSendGrid(emailData: EmailData): Promise<boolean> {
    try {
      const msg = {
        to: emailData.to,
        from: {
          email: 'admin@readmyfineprint.com',
          name: 'ReadMyFinePrint'
        },
        replyTo: {
          email: 'admin@readmyfineprint.com',
          name: 'ReadMyFinePrint Support'
        },
        subject: emailData.subject,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
        html: emailData.html,
      };

      await sgMail.send(msg);
      console.log('✅ Email sent successfully via SendGrid:', {
        recipient: emailData.to,
        subject: emailData.subject
      });
      return true;
    } catch (error: any) {
      console.error('❌ SendGrid send failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.body
      });
      
      // If SendGrid fails, mark service as unhealthy
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendWithSmtp(emailData: EmailData): Promise<boolean> {
    try {
      const mailOptions = {
        from: {
          name: 'ReadMyFinePrint',
          address: 'admin@readmyfineprint.com'
        },
        replyTo: {
          name: 'ReadMyFinePrint Support',
          address: 'admin@readmyfineprint.com'
        },
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
      };

      const result = await this.transporter!.sendMail(mailOptions);
      console.log('✅ Email sent successfully via SMTP:', {
        messageId: result.messageId,
        recipient: emailData.to,
        subject: emailData.subject
      });
      return true;
    } catch (error) {
      console.error('❌ SMTP send failed:', error);
      return false;
    }
  }

  async sendDonationThankYou(data: DonationEmailData): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('⚠️ Email service not configured, skipping thank you email');
      return false;
    }

    try {
      const { amount, currency, customerEmail, customerName, timestamp, paymentIntentId } = data;

      // Use a default email if customer email is not provided
      const recipientEmail = customerEmail;
      const recipientName = customerName || 'Valued Supporter';

      return await this.sendEmail({
        to: recipientEmail,
        subject: '🙏 Thank you for your generous donation!',
        html: this.generateThankYouEmailHTML(data),
        text: this.generateThankYouEmailText(data),
      });
    } catch (error) {
      console.error('❌ Failed to send thank you email:', error);
      return false;
    }
  }

  private generateThankYouEmailHTML(data: DonationEmailData): string {
    const { amount, currency, customerName, timestamp } = data;
    const formattedAmount = `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    const formattedDate = timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Your Donation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .donation-details { background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .donation-amount { font-size: 24px; font-weight: 700; color: #0891b2; text-align: center; margin-bottom: 10px; }
        .donation-date { text-align: center; color: #64748b; font-size: 14px; }
        .message { font-size: 16px; line-height: 1.7; margin: 20px 0; }
        .impact { background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { display: inline-block; background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        .social-links { margin: 15px 0; }
        .social-links a { color: #0891b2; text-decoration: none; margin: 0 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🙏 Thank You, ${customerName || 'Valued Supporter'}!</h1>
            <p>Your generosity makes a real difference</p>
        </div>

        <div class="content">
            <div class="donation-details">
                <div class="donation-amount">${formattedAmount}</div>
                <div class="donation-date">Donated on ${formattedDate}</div>
            </div>

            <div class="message">
                <p>Dear ${customerName || 'Friend'},</p>
                <p>We are incredibly grateful for your generous donation of <strong>${formattedAmount}</strong>. Your support directly helps us continue our mission to make legal documents accessible and understandable for everyone.</p>
            </div>

            <div class="impact">
                <h3 style="margin-top: 0; color: #059669;">🌟 Your Impact</h3>
                <p style="margin-bottom: 0;">Your contribution helps us:</p>
                <ul style="margin: 10px 0;">
                    <li>Keep our document analysis service free for everyone</li>
                    <li>Improve our AI capabilities to understand more document types</li>
                    <li>Expand access to legal literacy resources</li>
                    <li>Support those who need legal document help the most</li>
                </ul>
            </div>

                        <div class="cta">
                <a href="https://readmyfineprint.com" class="button">Visit Our Site</a>
            </div>

            <div class="impact">
                <h3 style="margin-top: 0; color: #059669;">🤝 Help Us Spread the Word</h3>
                <p style="margin-bottom: 15px;">Love what we're doing? Here are easy ways to help others discover our mission:</p>

                <div style="margin: 20px 0;">
                    <h4 style="margin: 10px 0 8px 0; color: #374151;">📱 Share on Social Media</h4>
                    <div style="margin: 10px 0;">
                        <a href="https://twitter.com/intent/tweet?url=https%3A//readmyfineprint.com&text=Check%20out%20Read%20My%20Fine%20Print%20-%20they%27re%20making%20legal%20documents%20accessible%20to%20everyone!%20%23legaltech%20%23accessibility" style="display: inline-block; background: #1da1f2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin: 4px; font-size: 14px;">Share on Twitter</a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A//readmyfineprint.com&quote=Check%20out%20Read%20My%20Fine%20Print%20-%20making%20legal%20documents%20accessible!" style="display: inline-block; background: #4267B2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin: 4px; font-size: 14px;">Share on Facebook</a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A//readmyfineprint.com&title=Read%20My%20Fine%20Print&summary=Making%20legal%20documents%20accessible%20to%20everyone" style="display: inline-block; background: #0077b5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin: 4px; font-size: 14px;">Share on LinkedIn</a>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <h4 style="margin: 10px 0 8px 0; color: #374151;">💝 Encourage Others to Donate</h4>
                    <p style="margin: 5px 0 10px 0; font-size: 14px;">Share our donation page with friends and family:</p>
                    <a href="https://readmyfineprint.com/donate" style="display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px 0;">Share Donation Page</a>
                </div>

                <div style="margin: 20px 0;">
                    <h4 style="margin: 10px 0 8px 0; color: #374151;">📧 Forward This Email</h4>
                    <p style="margin: 5px 0; font-size: 14px;">Know someone who cares about legal accessibility? Forward this email to show them the impact of supporting our mission!</p>
                </div>

                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">💬 Sample Message to Share:</h4>
                    <p style="margin: 0; font-style: italic; color: #6b7280; font-size: 13px; line-height: 1.4;">
                        "I just supported ReadMyFinePrint - they're making legal documents easier to understand for everyone! Check out their mission at readmyfineprint.com and consider supporting them too. Every contribution helps make legal literacy accessible to all! 🌟"
                    </p>
                </div>
            </div>

            <div class="message">
                <p>Thank you for being part of our community and supporting our vision of democratizing legal document understanding. Together, we're making legal literacy accessible to all!</p>
                <p>With heartfelt gratitude,<br><strong>The ReadMyFinePrint Team</strong></p>
            </div>
        </div>

        <div class="footer">
            <p>ReadMyFinePrint - Making Legal Documents Accessible</p>
            <div class="social-links">
                <a href="https://readmyfineprint.com/privacy">Privacy Policy</a> |
                <a href="https://readmyfineprint.com/terms">Terms of Service</a> |
                <a href="mailto:admin@readmyfineprint.com">Contact Us</a>
            </div>
            <p style="margin-top: 15px; font-size: 12px;">
                This email was sent because you made a donation to ReadMyFinePrint.<br>
                If you have any questions, please contact us at admin@readmyfineprint.com
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateThankYouEmailText(data: DonationEmailData): string {
    const { amount, currency, customerName, timestamp } = data;
    const formattedAmount = `${currency.toUpperCase()} ${amount.toFixed(2)}`;
    const formattedDate = timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
Thank You for Your Generous Donation!

Dear ${customerName || 'Valued Supporter'},

We are incredibly grateful for your generous donation of ${formattedAmount} made on ${formattedDate}.

Your support directly helps us continue our mission to make legal documents accessible and understandable for everyone.

YOUR IMPACT:
Your contribution helps us:
• Keep our document analysis service free for everyone
• Improve our AI capabilities to understand more document types
• Expand access to legal literacy resources
• Support those who need legal document help the most

HELP US SPREAD THE WORD:
Love what we're doing? Here are easy ways to help others discover our mission:

📱 SHARE ON SOCIAL MEDIA:
• Twitter: https://twitter.com/intent/tweet?url=https%3A//readmyfineprint.com&text=Check%20out%20Read%20My%20Fine%20Print%20-%20they%27re%20making%20legal%20documents%20accessible%20to%20everyone!%20%23legaltech%20%23accessibility
• Facebook: https://www.facebook.com/sharer/sharer.php?u=https%3A//readmyfineprint.com&quote=Check%20out%20Read%20My%20Fine%20Print%20-%20making%20legal%20documents%20accessible!
• LinkedIn: https://www.linkedin.com/sharing/share-offsite/?url=https%3A//readmyfineprint.com&title=Read%20My%20Fine%20Print&summary=Making%20legal%20documents%20accessible%20to%20everyone

💝 ENCOURAGE OTHERS TO DONATE:
Share our donation page: https://readmyfineprint.com/donate

📧 FORWARD THIS EMAIL:
Know someone who cares about legal accessibility? Forward this email to show them the impact of supporting our mission!

💬 SAMPLE MESSAGE TO SHARE:
"I just supported ReadMyFinePrint - they're making legal documents easier to understand for everyone! Check out their mission at readmyfineprint.com and consider supporting them too. Every contribution helps make legal literacy accessible to all! 🌟"

Thank you for being part of our community and supporting our vision of democratizing legal document understanding. Together, we're making legal literacy accessible to all!

With heartfelt gratitude,
The ReadMyFinePrint Team

---
ReadMyFinePrint - Making Legal Documents Accessible
Website: https://readmyfineprint.com
Contact: admin@readmyfineprint.com

This email was sent because you made a donation to ReadMyFinePrint.
If you have any questions, please contact us at admin@readmyfineprint.com
    `;
  }

  /**
   * Test email configuration and return detailed status
   */
  async testEmailConfiguration(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      if (this.useSendGrid) {
        const isHealthy = await this.testSendGridConnection();
        if (isHealthy) {
          console.log('✅ SendGrid configuration test successful');
        } else {
          console.error('❌ SendGrid configuration test failed');
        }
        return isHealthy;
      } else if (this.useSmtp && this.transporter) {
        await this.transporter.verify();
        console.log('✅ SMTP configuration test successful');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Email configuration test failed:', error);
      return false;
    }
  }

  /**
   * Get email service health status (with caching)
   */
  async getHealthStatus(): Promise<{ 
    isConfigured: boolean; 
    provider: string; 
    isHealthy: boolean;
    lastChecked: Date | null;
  }> {
    // Use cached result if recent
    const now = new Date();
    if (this.lastHealthCheck && 
        (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCheckCacheDuration) {
      return {
        isConfigured: this.isConfigured,
        provider: this.useSendGrid ? 'sendgrid' : this.useSmtp ? 'smtp' : 'none',
        isHealthy: this.lastHealthStatus,
        lastChecked: this.lastHealthCheck
      };
    }

    // Perform fresh health check
    const isHealthy = await this.testEmailConfiguration();
    this.lastHealthCheck = now;
    this.lastHealthStatus = isHealthy;

    return {
      isConfigured: this.isConfigured,
      provider: this.useSendGrid ? 'sendgrid' : this.useSmtp ? 'smtp' : 'none',
      isHealthy,
      lastChecked: now
    };
  }
}

export const emailService = new EmailService();