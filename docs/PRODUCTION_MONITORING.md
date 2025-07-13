# Production Monitoring Guide

This guide explains how to set up and use the production monitoring system for ReadMyFinePrint.

## Overview

The monitoring system provides comprehensive health checks for:
- Server connectivity (detects connection refused errors)
- SMTP email authentication
- Database connectivity
- External endpoint availability
- Resource usage (CPU, memory)
- Process health

## Quick Start

### Development Environment
```bash
# Single health check
npm run monitor

# Continuous monitoring (1-minute intervals)
npm run monitor:continuous
```

### Production Environment
```bash
# Single health check in production mode
npm run monitor:production

# Continuous monitoring in production mode (5-minute intervals)
npm run monitor:production:continuous

# Full production deployment with monitoring
npm run deploy:production
```

## Environment Configuration

### Required Environment Variables

For basic monitoring:
```bash
# Core application variables (required)
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host/database
OPENAI_API_KEY=sk-your-openai-key
ADMIN_API_KEY=your-secure-admin-key
JWT_SECRET=your-jwt-secret
TOKEN_ENCRYPTION_KEY=your-encryption-key
PASSWORD_PEPPER=your-password-pepper

# SMTP configuration (for email monitoring)
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-specific-password
```

### Optional Production Monitoring Variables

```bash
# External monitoring
EXTERNAL_URL=https://readmyfineprint.com
MONITOR_HOST=localhost
PORT=5000

# Email alerts
MONITORING_EMAIL_ALERTS=true                    # Enable email alerts (default: true)
MONITORING_EMAIL_RECIPIENT=admin@example.com    # Email recipient for alerts
MONITORING_EMAIL_SUBJECT="Production Alert"     # Email subject prefix

# Webhook alerts
MONITORING_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts

# Email testing in production
SKIP_EMAIL_TESTS=false  # Set to 'true' to skip email tests in production

# Logging
LOG_PATH=/var/log/readmyfineprint/monitor.log
```

## Monitoring Features

### Development Mode
- **Check Interval**: 1 minute
- **Timeout**: 10 seconds for server, 30 seconds for email
- **Failure Threshold**: 3 consecutive failures trigger alerts
- **Resource Monitoring**: Disabled
- **External Checks**: Disabled

### Production Mode
- **Check Interval**: 5 minutes
- **Timeout**: 30 seconds for server, 60 seconds for email
- **Failure Threshold**: 5 consecutive failures trigger alerts
- **Resource Monitoring**: Enabled (alerts on >512MB memory or >80% CPU)
- **External Checks**: Enabled (if EXTERNAL_URL is set)
- **Webhook Alerts**: Enabled (if MONITORING_WEBHOOK_URL is set)

## Health Check Endpoints

The monitoring system checks these endpoints:

### Internal Health Check
- **Endpoint**: `http://localhost:5000/api/health`
- **Purpose**: Basic server connectivity and API availability
- **Response**: JSON with server status

### Production Health Check
- **Endpoint**: `http://localhost:5000/health`
- **Purpose**: Comprehensive health including database status
- **Response**: JSON with database, memory, and uptime information

### Email Test
- **Endpoint**: `http://localhost:5000/api/test-email`
- **Purpose**: SMTP authentication and email sending capability
- **Authentication**: Requires ADMIN_API_KEY header

## Webhook Alerts

Configure webhook alerts to receive notifications when issues occur:

### Webhook Payload Format
```json
{
  "timestamp": "2025-01-13T12:00:00.000Z",
  "environment": "production",
  "alert": {
    "type": "consecutive_failures",
    "component": "server",
    "message": "server has failed 5 consecutive times!",
    "failures": 5,
    "result": {
      "status": "unhealthy",
      "message": "Connection refused - server may be down",
      "error": "ECONNREFUSED"
    }
  },
  "monitoring": {
    "consecutiveFailures": {
      "server": 5,
      "email": 0,
      "database": 0,
      "external": 0
    },
    "uptime": 3600
  }
}
```

### Alert Types
- **consecutive_failures**: Component has failed multiple times in a row
- **critical_status**: Overall system health check failed
- **monitoring_failure**: The monitoring system itself failed

## Deployment Integration

### Automated Deployment
```bash
# Deploy with automatic monitoring
START_MONITORING=true npm run deploy:production
```

### Manual Deployment
```bash
# 1. Build the application
npm run build

# 2. Start production server
npm run start

# 3. Verify deployment
npm run monitor:production

# 4. Start continuous monitoring
npm run monitor:production:continuous
```

## Monitoring in Different Environments

### Replit Production
```bash
# Set environment variables in Replit Secrets
NODE_ENV=production
DATABASE_URL=your-replit-postgres-url
EXTERNAL_URL=https://your-replit-app.replit.app

# Run monitoring
npm run monitor:production:continuous
```

### Docker Production
```bash
# In your Dockerfile or docker-compose.yml
ENV NODE_ENV=production
ENV MONITORING_WEBHOOK_URL=https://your-alerts.com/webhook

# Start with monitoring
docker run -d your-app npm run monitor:production:continuous
```

### Cloud Platforms (AWS, GCP, Azure)
```bash
# Set environment variables in your cloud platform
export NODE_ENV=production
export EXTERNAL_URL=https://your-domain.com
export MONITORING_WEBHOOK_URL=https://your-monitoring-service.com/webhook

# Deploy with monitoring
npm run deploy:production
```

## Troubleshooting

### Common Issues

#### Server Connection Refused
```
❌ SERVER: Connection refused - server may be down
```
**Solutions**:
- Check if the server process is running
- Verify the correct port is being used
- Ensure no firewall is blocking the connection

#### SMTP Authentication Failed
```
❌ EMAIL: Email test failed: authentication failed
```
**Solutions**:
- Verify SMTP_USER and SMTP_PASS are correct
- For iCloud: Use app-specific password
- For Gmail: Enable 2FA and use app password

#### Database Connection Failed
```
❌ DATABASE: Database health check failed
```
**Solutions**:
- Check DATABASE_URL is correct
- Verify database server is running
- Check network connectivity to database

#### High Resource Usage
```
⚠️ RESOURCES: High memory usage: 600MB (75.2%)
```
**Solutions**:
- Monitor for memory leaks
- Consider scaling up resources
- Optimize application performance

### Monitoring Logs

Check monitoring logs for detailed information:
```bash
# View recent monitoring activity
tail -f /tmp/production-monitor.log

# Search for specific issues
grep "ALERT" /tmp/production-monitor.log
grep "unhealthy" /tmp/production-monitor.log
```

## Integration with External Services

### Slack Notifications
Create a Slack webhook and set:
```bash
MONITORING_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Discord Notifications
Create a Discord webhook and set:
```bash
MONITORING_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK
```

### Custom Monitoring Services
Integrate with services like:
- Datadog
- New Relic
- Prometheus
- Grafana

## Best Practices

1. **Always monitor in production**: Use continuous monitoring
2. **Set up webhook alerts**: Don't rely on manual checks
3. **Monitor external endpoints**: Check your public URL
4. **Resource monitoring**: Track memory and CPU usage
5. **Regular health checks**: Run manual checks during deployments
6. **Log monitoring**: Keep monitoring logs for troubleshooting

## Security Considerations

- **API Keys**: Never expose ADMIN_API_KEY in logs
- **Webhook URLs**: Use HTTPS for webhook endpoints
- **Access Control**: Restrict monitoring endpoints to authorized users
- **Rate Limiting**: Monitoring respects your application's rate limits

## Support

If you encounter issues with the monitoring system:
1. Check the troubleshooting section above
2. Review the monitoring logs
3. Verify environment variables are set correctly
4. Test individual components manually 