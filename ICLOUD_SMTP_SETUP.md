# iCloud SMTP Setup Instructions

## Step 1: Generate App-Specific Password

1. Go to: https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Go to "Security" section
4. Under "App-Specific Passwords", click "Generate Password"
5. Name it: "ReadMyFinePrint SMTP"
6. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

## Step 2: Add to .env

Add these lines to your `.env` file:

```bash
# iCloud SMTP Configuration
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=prodbybuddha@icloud.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # Your app-specific password from Step 1
FROM_EMAIL=prodbybuddha@icloud.com
```

**Important:** Use the app-specific password exactly as shown (with or without dashes, both work)

## Step 3: Run Test Emails

After adding SMTP config to `.env`, run:

```bash
tsx server/test-emails.ts
```

This will send 5 test emails to prodbybuddha@icloud.com:
1. Subscription Created (Welcome)
2. Subscription Updated (Active status)
3. Subscription Canceled
4. Payment Failed
5. Trial Ending (3 days)

## Troubleshooting

### "Authentication failed"
- Make sure 2FA is enabled on your Apple ID
- Regenerate the app-specific password
- Check that SMTP_USER matches your iCloud email exactly

### "Connection timeout"
- iCloud SMTP can be slow, wait 30 seconds
- Check your internet connection
- Try port 465 instead of 587 (change SMTP_PORT)

### Emails not received
- Check spam/junk folder
- Wait a few minutes (iCloud can delay)
- Try sending to a different email to test

## iCloud SMTP Limits

- **Rate limit**: ~200 emails per day
- **Attachment limit**: 20MB per email
- **Recipients per email**: 100 max
- For production with higher volume, consider SendGrid or Amazon SES

## Alternative Port Configuration

If port 587 doesn't work, try port 465 (SSL):

```bash
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=465  # SSL port
SMTP_USER=prodbybuddha@icloud.com
SMTP_PASS=your-app-password
FROM_EMAIL=prodbybuddha@icloud.com
```
