# Email Setup for Donation Thank You Emails

This guide explains how to configure email functionality to automatically send thank you emails after successful Stripe donations.

## 🚀 Quick Start

For production deployments, we **recommend using iCloud SMTP** for reliable email delivery. See the [iCloud SMTP Setup Guide](./ICLOUD_SMTP_SETUP.md) for detailed instructions.

## Email Service Options

The email service supports multiple providers with automatic priority:

### Option 1: iCloud SMTP (Recommended for Production)

**Best for**: Production deployments with Apple/iCloud account

✅ **Benefits**:
- **Reliable**: Apple's email infrastructure
- **Free**: No cost with iCloud account
- **Secure**: TLS 1.2+ encryption
- **Simple**: Standard SMTP configuration
- **Flexible**: Works with any sender domain

**Quick Setup**:

```bash
# iCloud SMTP Configuration
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=your-apple-id@icloud.com
SMTP_PASS=your-app-specific-password

# Sender address
EMAIL_FROM=noreply@readmyfineprint.com
```

**Requirements**:
1. ✅ iCloud account
2. ✅ 2-Factor Authentication enabled
3. ✅ App-Specific Password generated

📖 **[Complete iCloud SMTP Setup Guide →](./ICLOUD_SMTP_SETUP.md)**

### Option 2: SendGrid (Alternative for High-Volume)

**Best for**: High-volume email sending (10k+ emails/day)

```bash
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@readmyfineprint.com
```

**Benefits**: API-based, high deliverability, detailed analytics

### Option 3: Other SMTP Providers

**Best for**: Using an existing SMTP service

**Note**: If you already have security alerts configured, donation emails will automatically use the same SMTP settings.

```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=your-email@example.com
```

**Common SMTP Providers**:
- **Gmail**: smtp.gmail.com (Port 587) - Requires App Password, development only
- **Mailgun**: smtp.mailgun.org (Port 587)
- **AWS SES**: email-smtp.region.amazonaws.com (Port 587)
- **Postmark**: smtp.postmarkapp.com (Port 587)

**Gmail Setup** (development/testing only):
1. Enable 2-Factor Authentication on Google Account
2. Generate App Password: Google Account → Security → App passwords
3. Set `SMTP_USER=your-email@gmail.com` and `SMTP_PASS=app-password`
4. Note: Gmail has daily sending limits (500 emails/day)

## Provider Selection Priority

The system automatically selects the best available provider:

1. **SendGrid** - If `SENDGRID_API_KEY` is set
2. **SMTP** (iCloud, Gmail, etc.) - If `SMTP_USER` and `SMTP_PASS` are set

## Configuration Variables

### Sender Address (Required)

```bash
# Primary sender address (required for all providers)
EMAIL_FROM=noreply@readmyfineprint.com

# Legacy fallbacks (deprecated, use EMAIL_FROM instead)
# SECURITY_EMAIL_FROM=your-email@icloud.com
# FROM_EMAIL=noreply@readmyfineprint.com
```

### Optional Configuration

```bash
# Default recipient if customer email is not available
DEFAULT_DONATION_EMAIL=admin@readmyfineprint.com

# Admin email for system notifications
ADMIN_EMAIL=admin@readmyfineprint.com
```

## Testing Email Configuration

Once configured, you can test the email service:

```bash
# Make a POST request to test endpoint (admin auth required)
curl -X POST http://localhost:5000/api/test-email \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "configured": true,
  "testEmailSent": true,
  "provider": "smtp",
  "fromAddress": "noreply@readmyfineprint.com",
  "isHealthy": true,
  "message": "Test email sent successfully"
}
```

**Check Application Logs:**
```
🍎 Configuring for iCloud SMTP
✅ Email service configured with iCloud SMTP
✅ Using sender address: noreply@readmyfineprint.com
✅ Email sent successfully via SMTP
```

## Email Features

### Automatic Emails
- Sent automatically after successful Stripe payments
- Triggered by Stripe webhook events
- Includes donation amount, date, and personalized message

### Email Content
- **HTML Version**: Beautiful, responsive design with your branding
- **Text Version**: Plain text fallback for all email clients
- **Personalization**: Uses customer name if available
- **Impact Message**: Shows how their donation helps your mission

### Fallback Behavior
- If email service is not configured, donations still work normally
- Errors in email sending don't affect payment processing
- Logs all email attempts for debugging

## Security & Best Practices

### Security
- ✅ Never commit email credentials to version control
- ✅ Use environment variables for all sensitive configuration
- ✅ Always use App-Specific Passwords (never regular account passwords)
- ✅ Enable 2-Factor Authentication on email accounts
- ✅ Rotate credentials regularly
- ✅ Use TLS/STARTTLS for encrypted connections

### Deliverability
- ✅ Use a reputable SMTP provider (iCloud, SendGrid, etc.)
- ✅ Configure SPF and DKIM DNS records for your domain
- ✅ Use a consistent sender address
- ✅ Implement proper unsubscribe handling
- ✅ Maintain clean recipient lists (remove bounces)
- ✅ Monitor bounce rates and spam reports

## Troubleshooting

### General Email Issues

### iCloud SMTP Issues

For detailed iCloud troubleshooting, see **[iCloud SMTP Setup Guide](./ICLOUD_SMTP_SETUP.md#troubleshooting)**.

**Common issues**:
- **Authentication failed**: Must use App-Specific Password, not iCloud password
- **Connection timeout**: Check firewall allows port 587 outbound
- **Sender rejected**: Verify sender email is valid

### General Email Issues

**Email Not Sending:**
1. Check environment variables are set correctly
2. Verify SMTP credentials (use app-specific passwords)
3. Check application logs for detailed errors
4. Test with `/api/test-email` endpoint
5. Ensure 2FA is enabled and app password is generated

**Wrong Provider Selected:**

Check logs to see which provider initialized:
```bash
# iCloud SMTP
🍎 Configuring for iCloud SMTP
✅ Email service configured with iCloud SMTP

# SendGrid
✅ Email service configured with SendGrid

# Generic SMTP
✅ Email service configured with SMTP (smtp.example.com)
```

**SendGrid Issues:**
- Verify API key is valid and not expired
- Check SendGrid account status and limits
- Ensure sender domain is verified in SendGrid

**Generic SMTP Issues:**
- Verify SMTP server hostname and port
- Check if hosting provider blocks outbound SMTP
- Ensure credentials are correct
- Try port 2525 if 587 is blocked

**Gmail Development Issues:**
- Ensure 2FA is enabled
- Use App Password, not regular password
- Check Google Account security settings

## Additional Resources

- 📖 **[iCloud SMTP Setup Guide](./ICLOUD_SMTP_SETUP.md)** - Comprehensive production setup
- 🔧 **[Environment Variables Reference](../../.env.example)** - All configuration options
- 📬 **[Email Templates](../../server/email-service.ts)** - Customize email content

## Support

For email configuration help:
1. Check application logs for detailed error messages
2. Review provider-specific guides above
3. Test with `/api/test-email` endpoint
4. Contact support: admin@readmyfineprint.com
