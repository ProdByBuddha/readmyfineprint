# Email Configuration Diagnosis

Based on what I can see, you have `SMTP_USER=prodbybuddha@icloud.com` configured, but the email isn't sending. Here's what to check:

## Current Status
✅ **SMTP_USER**: `prodbybuddha@icloud.com` (Set)
❓ **SMTP_PASS**: Need to verify this is set
❓ **SECURITY_EMAIL_FROM**: Need to verify this is set

## Most Likely Issues

### 1. Missing SMTP_PASS (App-Specific Password)
For iCloud email, you need an **app-specific password**, not your regular iCloud password.

**To create an iCloud app-specific password:**
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to "Security" section
4. Under "App-Specific Passwords", click "Generate Password"
5. Enter a label like "ReadMyFinePrint Email"
6. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

**Set this environment variable:**
```bash
SMTP_PASS=your-app-specific-password
```

### 2. Missing SECURITY_EMAIL_FROM
This should be set to your email address:
```bash
SECURITY_EMAIL_FROM=prodbybuddha@icloud.com
```

### 3. Two-Factor Authentication
Make sure 2FA is enabled on your Apple ID account (required for app-specific passwords).

## Quick Test Commands

**Check if variables are set:**
```bash
echo "SMTP_USER: $SMTP_USER"
echo "SMTP_PASS: $SMTP_PASS"
echo "SECURITY_EMAIL_FROM: $SECURITY_EMAIL_FROM"
```

**Test the email service:**
```bash
# From your project root
cd server && npm run dev
# Then in another terminal, test the email endpoint
curl -X POST http://localhost:8080/api/test-email -H "Authorization: Bearer admin"
```

## Complete Environment Variables Needed

Add these to your environment (`.env` file or Replit secrets):

```bash
# iCloud SMTP Configuration
SMTP_USER=prodbybuddha@icloud.com
SMTP_PASS=your-app-specific-password
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SECURITY_EMAIL_FROM=prodbybuddha@icloud.com

# Optional: Default recipient for donations without customer email
DEFAULT_DONATION_EMAIL=prodbybuddha@icloud.com
```

## Common Error Messages

**"Authentication failed"** → Wrong app-specific password
**"Connection timeout"** → Wrong SMTP host/port or network issue
**"Email service not configured"** → Missing SMTP_USER or SMTP_PASS

## Alternative: Use Gmail Instead

If iCloud continues to have issues, you can use Gmail:

```bash
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
```

## Next Steps

1. **Set the missing environment variables** (especially SMTP_PASS)
2. **Restart your server** after setting variables
3. **Test with a donation** or use the test endpoint
4. **Check server logs** for any error messages

The most common issue is missing the app-specific password for iCloud!
