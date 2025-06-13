# Email Setup for Donation Thank You Emails

This guide explains how to configure email functionality to automatically send thank you emails after successful Stripe donations.

**Note**: The email service automatically uses the same SMTP configuration as your security alert system, so if you already have security emails working, donation emails will work too!

## Email Service Options

### Option 1: Use Existing Security SMTP (Recommended)

If you already have security alerts configured, the donation emails will automatically use the same SMTP settings:

```bash
# These are the same variables used for security alerts
SMTP_USER=your-icloud-email@icloud.com  # or other SMTP email
SMTP_PASS=your-app-specific-password
SMTP_HOST=smtp.mail.me.com              # defaults to iCloud SMTP
SMTP_PORT=587                           # defaults to 587
SECURITY_EMAIL_FROM=your-email@icloud.com  # used as sender for donations too
```

### Option 2: Gmail (Alternative for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Add environment variables**:
   ```bash
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-character-app-password
   ```

### Option 3: Custom SMTP Server

Add these environment variables:
```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

Common SMTP providers:
- **iCloud**: smtp.mail.me.com (Port 587) - Default
- **SendGrid**: smtp.sendgrid.net (Port 587)
- **Mailgun**: smtp.mailgun.org (Port 587)
- **AWS SES**: email-smtp.region.amazonaws.com (Port 587)

## Optional Configuration

```bash
# Custom sender email (uses SECURITY_EMAIL_FROM first, then falls back to others)
SECURITY_EMAIL_FROM=your-email@icloud.com  # Primary sender (shared with security alerts)
FROM_EMAIL=noreply@readmyfineprint.com     # Fallback sender

# Default recipient if customer email is not available
DEFAULT_DONATION_EMAIL=admin@readmyfineprint.com
```

## Testing Email Configuration

Once configured, you can test the email service:

```bash
# Make a POST request to test endpoint (admin auth required)
curl -X POST http://localhost:8080/api/test-email \
  -H "Authorization: Bearer your-admin-token"
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

## Security Notes

- Never commit email credentials to version control
- Use environment variables for all sensitive configuration
- Gmail App Passwords are safer than regular passwords
- SMTP connections use TLS encryption by default

## Troubleshooting

### Email Not Sending
1. Check environment variables are set correctly
2. Verify SMTP credentials with your provider
3. Check server logs for error messages
4. Test with the `/api/test-email` endpoint

### Gmail Issues
- Ensure 2FA is enabled on your Google account
- Use App Password, not your regular Gmail password
- Check that "Less secure app access" is not blocking the connection

### SMTP Issues
- Verify SMTP server hostname and port
- Check if your hosting provider blocks outbound SMTP
- Ensure credentials are correct with your SMTP provider
