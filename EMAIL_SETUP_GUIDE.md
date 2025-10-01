# Email Configuration Setup Guide

Your subscription email notifications are now ready! You just need to configure your SMTP settings.

## SMTP Configuration

Add these variables to your `.env` file:

```bash
# Email Configuration
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@readmyfineprint.com
```

## Recommended SMTP Providers

### 1. **Gmail/Google Workspace** (Easiest for testing)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password  # Generate at https://myaccount.google.com/apppasswords
FROM_EMAIL=your-gmail@gmail.com
```

### 2. **SendGrid** (Recommended for production)
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey  # Literally the string "apikey"
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=noreply@readmyfineprint.com
```

### 3. **Amazon SES** (AWS users)
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
FROM_EMAIL=verified-email@readmyfineprint.com
```

### 4. **Mailgun**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
FROM_EMAIL=noreply@readmyfineprint.com
```

### 5. **Postmark**
```bash
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=your-server-api-token
SMTP_PASS=your-server-api-token  # Same as username
FROM_EMAIL=noreply@readmyfineprint.com
```

## Quick Setup for Testing (Gmail)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Add to .env**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-16-char-app-password
FROM_EMAIL=youremail@gmail.com
```

## Mock Mode (No SMTP Needed)

If you don't configure SMTP, the email service runs in **mock mode**:
- Emails are logged to console instead of being sent
- Useful for development and testing
- No actual emails are sent

## Testing Your Configuration

After adding SMTP settings, restart your server and trigger a subscription event. Check the logs for:

```
✅ Email service initialized successfully
✅ Email sent successfully to user@example.com
```

## Email Templates Included

Your setup includes professional HTML email templates for:

1. **Subscription Created** - Welcome email with subscription details
2. **Subscription Canceled** - Cancellation confirmation with reactivation option
3. **Subscription Updated** - Status change notifications
4. **Payment Failed** - Payment issue alerts with action items
5. **Trial Ending** - Trial expiration reminders (for future use)

All templates are:
- Mobile-responsive
- Beautifully designed with your brand colors
- Include both HTML and plain-text versions
- Follow email best practices

## Webhook Integration

Emails are automatically sent when these Stripe events occur:
- `customer.subscription.created` → Welcome email
- `customer.subscription.updated` → Status update email  
- `customer.subscription.deleted` → Cancellation email
- `customer.subscription.trial_will_end` → Trial ending reminder

## Security Best Practices

1. **Never commit SMTP credentials** to git
2. **Use app passwords** instead of account passwords
3. **Rotate credentials** regularly
4. **Use environment-specific** FROM_EMAIL addresses
5. **Monitor email delivery** rates and bounces

## Troubleshooting

### Emails not sending?
- Check SMTP credentials are correct
- Verify SMTP_PORT (usually 587 for TLS, 465 for SSL)
- Check server logs for error messages
- Ensure FROM_EMAIL is verified with your provider

### Connection refused?
- Check firewall isn't blocking SMTP ports
- Try port 465 if 587 doesn't work
- Verify SMTP_HOST is correct

### Authentication failed?
- Regenerate app password
- Check username format (some providers need full email)
- Ensure 2FA is enabled (Gmail requirement)

## Next Steps

1. Choose an SMTP provider
2. Add configuration to `.env`
3. Restart your server
4. Test with a subscription creation
5. Monitor logs for success

For production, we recommend SendGrid or Amazon SES for reliability and deliverability.

### 6. **iCloud/Apple Mail** (Apple ID users)
```bash
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=your-apple-id@icloud.com  # Your full iCloud email
SMTP_PASS=your-app-specific-password  # Generate at appleid.apple.com
FROM_EMAIL=your-apple-id@icloud.com
```

**Important Notes for iCloud:**
- You MUST use an app-specific password (not your Apple ID password)
- 2-Factor Authentication must be enabled on your Apple ID
- Generate app password at: https://appleid.apple.com/account/manage
  1. Sign in with your Apple ID
  2. Go to "Security" section
  3. Click "Generate Password" under "App-Specific Passwords"
  4. Name it "ReadMyFinePrint SMTP" or similar
  5. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)
  6. Use this password (without dashes) in SMTP_PASS

**Testing iCloud SMTP:**
- Send a test email to yourself first
- Check spam folder if not received
- iCloud has rate limits (don't send too many emails at once)
- For production, consider switching to SendGrid or SES for reliability

