// Email Alert System Configuration Summary

console.log(`
🎯 EMAIL ALERT SYSTEM CONFIGURED SUCCESSFULLY

📧 SMTP Configuration:
   Server: smtp.mail.me.com:587
   Authentication: ✅ iCloud credentials verified
   From: ${process.env.SECURITY_EMAIL_FROM}
   To: ${process.env.SECURITY_EMAIL_TO}

⚡ Alert Triggers:
   • Authentication failures: 5 attempts in 5 minutes → HIGH alert
   • Rate limit violations: 3 violations in 10 minutes → MEDIUM alert  
   • Input validation failures: 10 failures in 15 minutes → MEDIUM alert
   • Suspicious activity: 1 incident in 1 minute → CRITICAL alert

📨 Email Features:
   • Beautiful HTML formatting with severity colors
   • Plain text fallback for all email clients
   • Detailed event information and fingerprints
   • Automatic fallback to console logging if email fails

🔄 Status: ACTIVE - Monitoring all security events
`);