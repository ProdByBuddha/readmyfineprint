import nodemailer from 'nodemailer';

interface DonationEmailData {
  amount: number;
  currency: string;
  paymentIntentId: string;
  customerEmail?: string;
  customerName?: string;
  timestamp: Date;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // Use the same SMTP configuration as security alerts (prioritized)
      const {
        SMTP_HOST = 'smtp.mail.me.com', // Default to iCloud SMTP like security system
        SMTP_PORT = '587',
        SMTP_USER,
        SMTP_PASS,
      } = process.env;

      // Primary: Use existing security SMTP configuration
      if (SMTP_USER && SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: parseInt(SMTP_PORT),
          secure: false, // true for 465, false for other ports
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false // Same as security system for compatibility
          }
        });
        this.isConfigured = true;
        console.log(`✅ Email service configured with SMTP (${SMTP_HOST})`);
        return;
      }

      // Fallback: Use Gmail service (if configured)
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
          },
        });
        this.isConfigured = true;
        console.log('✅ Email service configured with Gmail');
        return;
      }

      console.log('⚠️ Email service not configured - missing environment variables');
      console.log('Required: SMTP_USER, SMTP_PASS (using same config as security alerts) or GMAIL_USER, GMAIL_APP_PASSWORD');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  async sendDonationThankYou(data: DonationEmailData): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.log('⚠️ Email service not configured, skipping thank you email');
      return false;
    }

    try {
      const { amount, currency, customerEmail, customerName, timestamp, paymentIntentId } = data;

      // Use a default email if customer email is not provided
      const recipientEmail = customerEmail || process.env.DEFAULT_DONATION_EMAIL || 'admin@readmyfineprint.com';
      const recipientName = customerName || 'Valued Supporter';

      const mailOptions = {
        from: {
          name: 'ReadMyFinePrint',
          address: process.env.SECURITY_EMAIL_FROM || process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@readmyfineprint.com'
        },
        to: recipientEmail,
        subject: '🙏 Thank you for your generous donation!',
        html: this.generateThankYouEmailHTML(data),
        text: this.generateThankYouEmailText(data),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Thank you email sent successfully:', {
        messageId: result.messageId,
        recipient: recipientEmail,
        amount: `${currency.toUpperCase()} ${amount.toFixed(2)}`,
        paymentIntentId
      });

      return true;
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

  async testEmailConfiguration(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email configuration test successful');
      return true;
    } catch (error) {
      console.error('❌ Email configuration test failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
