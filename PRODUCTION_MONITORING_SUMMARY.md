# Production Monitoring - Quick Reference

## ✅ Issues Resolved
- **Server Connection Refused Errors**: Fixed by ensuring proper environment variables and server startup
- **SMTP Authentication Failures**: Fixed by configuring iCloud app-specific password

## 🚀 Production Monitoring Commands

### Development
```bash
npm run monitor                    # Single health check
npm run monitor:continuous         # Continuous monitoring (1-minute intervals)
```

### Production
```bash
npm run monitor:production         # Single health check (production mode)
npm run monitor:production:continuous  # Continuous monitoring (5-minute intervals)
npm run deploy:production          # Full deployment with monitoring
```

## 🔧 Environment Setup

### Required Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host/database
OPENAI_API_KEY=sk-your-key
ADMIN_API_KEY=your-secure-key
JWT_SECRET=your-jwt-secret
TOKEN_ENCRYPTION_KEY=your-encryption-key
PASSWORD_PEPPER=your-pepper
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
```

### Optional Production Variables
```bash
EXTERNAL_URL=https://readmyfineprint.com
MONITORING_WEBHOOK_URL=https://your-webhook.com/alerts
MONITORING_EMAIL_ALERTS=true
MONITORING_EMAIL_RECIPIENT=prodbybuddha@icloud.com
MONITORING_EMAIL_SUBJECT="ReadMyFinePrint Production Alert"
SKIP_EMAIL_TESTS=false
```

## 📊 Monitoring Features

### Development Mode
- ⏰ Check interval: 1 minute
- 🔔 Alert threshold: 3 consecutive failures
- 📈 Resource monitoring: Disabled

### Production Mode
- ⏰ Check interval: 5 minutes
- 🔔 Alert threshold: 5 consecutive failures
- 📈 Resource monitoring: Enabled (>512MB memory, >80% CPU)
- 🌐 External endpoint checks: Enabled
- 📧 Email alerts: Enabled (with 15-minute cooldown)
- 📧 Webhook alerts: Enabled

## 🔍 Health Checks

The monitoring system checks:
- ✅ Server connectivity (`/api/health`)
- ✅ Database health (`/health` in production)
- ✅ Email functionality (`/api/test-email`)
- ✅ Process health (server processes running)
- ✅ Resource usage (production only)
- ✅ External endpoint (production only)

## 🚨 Alert Types

- **failure**: Component failed multiple times or system unhealthy
- **recovery**: Component recovered after being down
- **monitoring_failure**: Monitoring system failed

Email alerts are sent for both failures and recoveries, with a 15-minute cooldown per alert type to prevent spam.

## 📋 Quick Start

### For Development
```bash
# Start server and monitoring
npm run dev &
npm run monitor:continuous
```

### For Production
```bash
# Option 1: Automated deployment
START_MONITORING=true npm run deploy:production

# Option 2: Manual deployment
npm run build
npm run start &
npm run monitor:production:continuous
```

## 🔧 Troubleshooting

### Connection Refused
- Check server is running
- Verify correct port (5000)
- Check firewall settings

### SMTP Authentication
- Verify SMTP_USER and SMTP_PASS
- Use app-specific passwords for iCloud/Gmail
- Check 2FA settings

### Database Issues
- Verify DATABASE_URL
- Check database server status
- Test network connectivity

## 📝 Logs

Monitor logs for issues:
```bash
# View monitoring logs
tail -f /tmp/production-monitor.log

# Search for alerts
grep "ALERT" /tmp/production-monitor.log
```

## 🔗 Integration

### Slack Alerts
```bash
MONITORING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Discord Alerts
```bash
MONITORING_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK
```

## 📈 Current Status

✅ **Server**: Responding normally on port 5000  
✅ **Email**: SMTP authentication working with iCloud  
✅ **Database**: Connected to Replit PostgreSQL  
✅ **Monitoring**: Production-ready with enhanced features  

The production issues you experienced are now resolved and monitored! 