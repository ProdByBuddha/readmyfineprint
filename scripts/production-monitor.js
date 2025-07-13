#!/usr/bin/env node

/**
 * Production Monitoring Script
 * 
 * This script monitors the production environment for:
 * 1. Server connectivity issues (connection refused errors)
 * 2. SMTP authentication failures
 * 3. Other critical service health checks
 * 
 * Usage: node scripts/production-monitor.js
 * For continuous monitoring: node scripts/production-monitor.js --continuous
 * For external monitoring: node scripts/production-monitor.js --external
 */

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Auto-detect environment and configure accordingly
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const MONITORING_CONFIG = {
  server: {
    host: process.env.MONITOR_HOST || 'localhost',
    port: parseInt(process.env.PORT || '5000'),
    healthEndpoint: '/api/health',
    timeout: isProduction ? 30000 : 10000, // 30s in prod, 10s in dev
    // In production, use external URL for health checks if available
    externalUrl: process.env.EXTERNAL_URL || null // e.g., 'https://readmyfineprint.com'
  },
  email: {
    testEndpoint: '/api/test-email',
    timeout: isProduction ? 60000 : 30000, // 60s in prod, 30s in dev
    skipInProduction: process.env.SKIP_EMAIL_TESTS === 'true' // Skip email tests in prod if desired
  },
  database: {
    healthEndpoint: '/health', // Production server has this endpoint
    timeout: 15000
  },
  alerts: {
    maxConsecutiveFailures: isProduction ? 5 : 3,
    checkInterval: isProduction ? 300000 : 60000, // 5min in prod, 1min in dev
    webhookUrl: process.env.MONITORING_WEBHOOK_URL || null,
    emailAlerts: {
      enabled: process.env.MONITORING_EMAIL_ALERTS === 'true' || true, // Enable by default
      recipient: process.env.MONITORING_EMAIL_RECIPIENT || 'prodbybuddha@icloud.com',
      subject: process.env.MONITORING_EMAIL_SUBJECT || 'ReadMyFinePrint Production Alert',
      sendOnFailure: true,
      sendOnRecovery: true,
      cooldownMinutes: 15 // Don't spam emails - wait 15 minutes between same alert types
    },
    logToFile: isProduction,
    logPath: process.env.LOG_PATH || '/tmp/production-monitor.log'
  },
  production: {
    enableExternalChecks: true,
    enableResourceMonitoring: true,
    enableSecurityChecks: true,
    alertOnHighMemory: 512, // MB
    alertOnHighCpu: 80 // %
  }
};

class ProductionMonitor {
  constructor() {
    this.consecutiveFailures = {
      server: 0,
      email: 0,
      database: 0,
      external: 0
    };
    this.lastStatus = {
      server: null,
      email: null,
      database: null,
      external: null
    };
    this.startTime = Date.now();
    this.environment = isProduction ? 'production' : (isDevelopment ? 'development' : 'unknown');
    this.emailCooldowns = new Map(); // Track email cooldowns by alert type
    
    console.log(`🚀 Production Monitor initialized for ${this.environment} environment`);
    if (MONITORING_CONFIG.alerts.emailAlerts.enabled) {
      console.log(`📧 Email alerts enabled for: ${MONITORING_CONFIG.alerts.emailAlerts.recipient}`);
    }
    if (isProduction) {
      console.log('📊 Production mode: Enhanced monitoring enabled');
    }
  }

  async checkServerHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MONITORING_CONFIG.server.timeout);

      // In production, use external URL if available, otherwise fall back to localhost
      const baseUrl = isProduction && MONITORING_CONFIG.server.externalUrl 
        ? MONITORING_CONFIG.server.externalUrl
        : `http://${MONITORING_CONFIG.server.host}:${MONITORING_CONFIG.server.port}`;

      const response = await fetch(
        `${baseUrl}${MONITORING_CONFIG.server.healthEndpoint}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        this.consecutiveFailures.server = 0;
        return { status: 'healthy', message: 'Server responding normally' };
      } else {
        this.consecutiveFailures.server++;
        return { 
          status: 'unhealthy', 
          message: `Server responded with status ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      this.consecutiveFailures.server++;
      
      if (error.name === 'AbortError') {
        return { status: 'unhealthy', message: 'Server health check timed out' };
      }
      
      if (error.code === 'ECONNREFUSED') {
        return { 
          status: 'unhealthy', 
          message: 'Connection refused - server may be down',
          error: 'ECONNREFUSED'
        };
      }
      
      return { 
        status: 'unhealthy', 
        message: `Server health check failed: ${error.message}`,
        error: error.code || error.name
      };
    }
  }

  async checkExternalHealth() {
    if (!MONITORING_CONFIG.server.externalUrl || !isProduction) {
      return { status: 'skipped', message: 'External health check not configured' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MONITORING_CONFIG.server.timeout);

      const response = await fetch(
        `${MONITORING_CONFIG.server.externalUrl}${MONITORING_CONFIG.server.healthEndpoint}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        this.consecutiveFailures.external = 0;
        return { status: 'healthy', message: 'External endpoint responding normally' };
      } else {
        this.consecutiveFailures.external++;
        return { 
          status: 'unhealthy', 
          message: `External endpoint responded with status ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      this.consecutiveFailures.external++;
      
      if (error.name === 'AbortError') {
        return { status: 'unhealthy', message: 'External health check timed out' };
      }
      
      return { 
        status: 'unhealthy', 
        message: `External health check failed: ${error.message}`,
        error: error.code || error.name
      };
    }
  }

  async checkDatabaseHealth() {
    if (!isProduction) {
      // In development, use the regular health endpoint
      return await this.checkServerHealth();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MONITORING_CONFIG.database.timeout);

      // In production, use external URL if available, otherwise fall back to localhost
      const baseUrl = isProduction && MONITORING_CONFIG.server.externalUrl 
        ? MONITORING_CONFIG.server.externalUrl
        : `http://${MONITORING_CONFIG.server.host}:${MONITORING_CONFIG.server.port}`;

      const response = await fetch(
        `${baseUrl}${MONITORING_CONFIG.database.healthEndpoint}`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        this.consecutiveFailures.database = 0;
        
        if (healthData.database && healthData.database.status === 'healthy') {
          return { 
            status: 'healthy', 
            message: `Database healthy (${healthData.database.type})`,
            details: healthData.database
          };
        } else {
          this.consecutiveFailures.database++;
          return { 
            status: 'unhealthy', 
            message: 'Database reported as unhealthy',
            details: healthData.database
          };
        }
      } else {
        this.consecutiveFailures.database++;
        return { 
          status: 'unhealthy', 
          message: `Database health check failed with status ${response.status}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      this.consecutiveFailures.database++;
      
      if (error.name === 'AbortError') {
        return { status: 'unhealthy', message: 'Database health check timed out' };
      }
      
      return { 
        status: 'unhealthy', 
        message: `Database health check failed: ${error.message}`,
        error: error.code || error.name
      };
    }
  }

  async checkEmailHealth() {
    if (MONITORING_CONFIG.email.skipInProduction && isProduction) {
      return { status: 'skipped', message: 'Email testing disabled in production' };
    }

    try {
      const adminKey = process.env.ADMIN_API_KEY;
      if (!adminKey) {
        return { 
          status: 'configuration_error', 
          message: 'ADMIN_API_KEY not configured' 
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MONITORING_CONFIG.email.timeout);

      // In production, use external URL if available, otherwise fall back to localhost
      const baseUrl = isProduction && MONITORING_CONFIG.server.externalUrl 
        ? MONITORING_CONFIG.server.externalUrl
        : `http://${MONITORING_CONFIG.server.host}:${MONITORING_CONFIG.server.port}`;

      // Use monitoring-specific endpoint for email tests
      const monitoringEndpoint = '/api/monitoring/test-email';
      const response = await fetch(
        `${baseUrl}${monitoringEndpoint}`,
        {
          method: 'POST',
          headers: {
            'x-admin-key': adminKey,
            'Content-Type': 'application/json',
            'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        
        if (result.configured) {
          this.consecutiveFailures.email = 0;
          return { status: 'healthy', message: 'Email service configured and ready' };
        } else {
          return { 
            status: 'configuration_error', 
            message: result.message || 'Email service not configured properly' 
          };
        }
      } else {
        this.consecutiveFailures.email++;
        const errorResult = await response.json().catch(() => ({}));
        return { 
          status: 'unhealthy', 
          message: `Email test failed: ${errorResult.error || errorResult.message || 'Unknown error'}`,
          httpStatus: response.status
        };
      }
    } catch (error) {
      this.consecutiveFailures.email++;
      
      if (error.name === 'AbortError') {
        return { status: 'unhealthy', message: 'Email health check timed out' };
      }
      
      return { 
        status: 'unhealthy', 
        message: `Email health check failed: ${error.message}`,
        error: error.code || error.name
      };
    }
  }

  async checkProcessHealth() {
    try {
      const { stdout } = await execAsync('ps aux | grep -E "(npm|tsx|node.*server)" | grep -v grep | wc -l');
      const processCount = parseInt(stdout.trim());
      
      if (processCount > 0) {
        return { status: 'healthy', message: `${processCount} server processes running` };
      } else {
        return { status: 'unhealthy', message: 'No server processes found' };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Process health check failed: ${error.message}` 
      };
    }
  }

  async checkResourceUsage() {
    if (!isProduction || !MONITORING_CONFIG.production.enableResourceMonitoring) {
      return { status: 'skipped', message: 'Resource monitoring disabled' };
    }

    try {
      // Memory usage
      const memInfo = await execAsync('free -m').then(result => result.stdout).catch(() => '');
      const memMatch = memInfo.match(/Mem:\s+(\d+)\s+(\d+)\s+(\d+)/);
      
      let memoryStatus = 'healthy';
      let memoryMessage = 'Memory usage normal';
      
      if (memMatch) {
        const [, total, used] = memMatch;
        const usedMB = parseInt(used);
        const totalMB = parseInt(total);
        const usagePercent = (usedMB / totalMB) * 100;
        
        if (usedMB > MONITORING_CONFIG.production.alertOnHighMemory) {
          memoryStatus = 'warning';
          memoryMessage = `High memory usage: ${usedMB}MB (${usagePercent.toFixed(1)}%)`;
        } else {
          memoryMessage = `Memory usage: ${usedMB}MB (${usagePercent.toFixed(1)}%)`;
        }
      }

      // CPU usage
      const cpuInfo = await execAsync('top -bn1 | grep "Cpu(s)"').then(result => result.stdout).catch(() => '');
      const cpuMatch = cpuInfo.match(/(\d+\.\d+)%us/);
      
      let cpuStatus = 'healthy';
      let cpuMessage = 'CPU usage normal';
      
      if (cpuMatch) {
        const cpuUsage = parseFloat(cpuMatch[1]);
        if (cpuUsage > MONITORING_CONFIG.production.alertOnHighCpu) {
          cpuStatus = 'warning';
          cpuMessage = `High CPU usage: ${cpuUsage}%`;
        } else {
          cpuMessage = `CPU usage: ${cpuUsage}%`;
        }
      }

      const overallStatus = memoryStatus === 'warning' || cpuStatus === 'warning' ? 'warning' : 'healthy';
      
      return { 
        status: overallStatus, 
        message: `${memoryMessage}, ${cpuMessage}`,
        details: { memory: memoryMessage, cpu: cpuMessage }
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Resource monitoring failed: ${error.message}` 
      };
    }
  }

  async sendWebhookAlert(alert) {
    if (!MONITORING_CONFIG.alerts.webhookUrl) {
      return false;
    }

    try {
      const payload = {
        timestamp: new Date().toISOString(),
        environment: this.environment,
        alert: alert,
        monitoring: {
          consecutiveFailures: this.consecutiveFailures,
          uptime: Math.round((Date.now() - this.startTime) / 1000)
        }
      };

      const response = await fetch(MONITORING_CONFIG.alerts.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
        },
        body: JSON.stringify(payload)
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Failed to send webhook alert:', error.message);
      return false;
    }
  }

  async sendEmailAlert(alert) {
    const emailConfig = MONITORING_CONFIG.alerts.emailAlerts;
    
    if (!emailConfig.enabled) {
      return false;
    }

    // Check cooldown to prevent spam
    const alertKey = `${alert.component}-${alert.type}`;
    const now = Date.now();
    const cooldownUntil = this.emailCooldowns.get(alertKey) || 0;
    
    if (now < cooldownUntil) {
      console.log(`📧 Email alert cooldown active for ${alertKey}, skipping...`);
      return false;
    }

    try {
      // Use external URL in production, otherwise use local server
      const serverUrl = isProduction && MONITORING_CONFIG.server.externalUrl 
        ? MONITORING_CONFIG.server.externalUrl
        : `http://${MONITORING_CONFIG.server.host}:${MONITORING_CONFIG.server.port}`;
      
      // Create email content
      const isFailure = alert.type === 'failure';
      const isRecovery = alert.type === 'recovery';
      
      if (isFailure && !emailConfig.sendOnFailure) return false;
      if (isRecovery && !emailConfig.sendOnRecovery) return false;

      const statusEmoji = isFailure ? '🚨' : (isRecovery ? '✅' : '⚠️');
      const statusText = isFailure ? 'FAILURE' : (isRecovery ? 'RECOVERY' : 'WARNING');
      
      const emailSubject = `${statusEmoji} ${emailConfig.subject} - ${alert.component.toUpperCase()} ${statusText}`;
      
      const emailBody = `
ReadMyFinePrint Production Alert

${statusEmoji} Alert Type: ${statusText}
🔧 Component: ${alert.component}
🌍 Environment: ${this.environment}
⏰ Timestamp: ${new Date().toLocaleString()}

📋 Details:
${alert.message}

${alert.details ? `🔍 Additional Info:
${alert.details}` : ''}

📊 System Status:
- Server Failures: ${this.consecutiveFailures.server}
- Email Failures: ${this.consecutiveFailures.email}
- Database Failures: ${this.consecutiveFailures.database}
- External Failures: ${this.consecutiveFailures.external}
- Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s

${isFailure ? '⚠️ This alert indicates a production issue that requires attention.' : ''}
${isRecovery ? '✅ This alert indicates the issue has been resolved.' : ''}

---
ReadMyFinePrint Production Monitor
Generated: ${new Date().toISOString()}
      `.trim();

      // Send email using the existing email service
      const emailPayload = {
        to: emailConfig.recipient,
        subject: emailSubject,
        text: emailBody,
        html: emailBody.replace(/\n/g, '<br>')
      };

      const response = await fetch(`${serverUrl}/api/monitoring/send-alert-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
          'User-Agent': 'ReadMyFinePrint-Monitor/1.0'
        },
        body: JSON.stringify(emailPayload),
        timeout: 30000
      });

      if (response.ok) {
        // Set cooldown
        this.emailCooldowns.set(alertKey, now + (emailConfig.cooldownMinutes * 60 * 1000));
        console.log(`📧 Email alert sent successfully to ${emailConfig.recipient}`);
        return true;
      } else {
        console.error('❌ Failed to send email alert:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send email alert:', error.message);
      return false;
    }
  }

  formatStatus(component, result) {
    const statusEmoji = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      configuration_error: '🔧',
      warning: '⚠️',
      skipped: '⏭️'
    };

    const emoji = statusEmoji[result.status] || '❓';
    return `${emoji} ${component.toUpperCase()}: ${result.message}`;
  }

  async runHealthCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 Production Health Check - ${timestamp}`);
    console.log(`🌍 Environment: ${this.environment}`);
    console.log('─'.repeat(60));

    const checks = [
      { name: 'server', check: () => this.checkServerHealth() },
      { name: 'database', check: () => this.checkDatabaseHealth() },
      { name: 'email', check: () => this.checkEmailHealth() },
      { name: 'processes', check: () => this.checkProcessHealth() }
    ];

    // Add production-specific checks
    if (isProduction) {
      if (MONITORING_CONFIG.server.externalUrl) {
        checks.push({ name: 'external', check: () => this.checkExternalHealth() });
      }
      if (MONITORING_CONFIG.production.enableResourceMonitoring) {
        checks.push({ name: 'resources', check: () => this.checkResourceUsage() });
      }
    }

    const results = {};
    let overallHealthy = true;
    let criticalIssues = [];

    for (const { name, check } of checks) {
      const result = await check();
      results[name] = result;
      
      console.log(this.formatStatus(name, result));
      
      if (result.status === 'unhealthy') {
        overallHealthy = false;
        criticalIssues.push(`${name}: ${result.message}`);
      }
      
      // Update status tracking for recovery detection
      const previousStatus = this.lastStatus[name];
      this.lastStatus[name] = result.status;
      
      // Check for alert conditions
      if (['server', 'email', 'database', 'external'].includes(name)) {
        if (this.consecutiveFailures[name] >= MONITORING_CONFIG.alerts.maxConsecutiveFailures) {
          const alertMessage = `${name} has failed ${this.consecutiveFailures[name]} consecutive times!`;
          console.log(`🚨 ALERT: ${alertMessage}`);
          
          const alertData = {
            type: 'failure',
            component: name,
            message: alertMessage,
            details: `Consecutive failures: ${this.consecutiveFailures[name]}\nLast error: ${result.error || result.message}`,
            failures: this.consecutiveFailures[name],
            result: result
          };
          
          // Send webhook alert
          await this.sendWebhookAlert(alertData);
          
          // Send email alert
          await this.sendEmailAlert(alertData);
        }
        
        // Check for recovery (was failing, now healthy)
        if (previousStatus === 'unhealthy' && result.status === 'healthy') {
          const recoveryMessage = `${name} has recovered after ${this.consecutiveFailures[name]} failures`;
          console.log(`✅ RECOVERY: ${recoveryMessage}`);
          
          const recoveryData = {
            type: 'recovery',
            component: name,
            message: recoveryMessage,
            details: `Service is now healthy after being down`,
            previousFailures: this.consecutiveFailures[name],
            result: result
          };
          
          // Send webhook alert
          await this.sendWebhookAlert(recoveryData);
          
          // Send email alert
          await this.sendEmailAlert(recoveryData);
        }
      }
    }

    console.log('─'.repeat(60));
    const overallStatus = overallHealthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED';
    console.log(`Overall Status: ${overallStatus}`);
    
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      criticalIssues.forEach(issue => console.log(`  • ${issue}`));
    }

    // Send critical alert if overall unhealthy
    if (!overallHealthy) {
      const criticalAlertData = {
        type: 'failure',
        component: 'system',
        message: 'System health check failed',
        details: `Critical issues detected:\n${criticalIssues.join('\n')}`,
        issues: criticalIssues,
        results: results
      };
      
      await this.sendWebhookAlert(criticalAlertData);
      await this.sendEmailAlert(criticalAlertData);
    }

    return { results, overallHealthy, timestamp, criticalIssues };
  }

  async startContinuousMonitoring() {
    console.log('🚀 Starting continuous production monitoring...');
    console.log(`📊 Environment: ${this.environment}`);
    console.log(`⏰ Check interval: ${MONITORING_CONFIG.alerts.checkInterval / 1000} seconds`);
    if (MONITORING_CONFIG.alerts.webhookUrl) {
      console.log(`🔔 Webhook alerts enabled`);
    }
    console.log('Press Ctrl+C to stop\n');

    const runCheck = async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        console.error('❌ Monitoring check failed:', error.message);
        
        // Send webhook alert for monitoring failure
        await this.sendWebhookAlert({
          type: 'monitoring_failure',
          message: 'Monitoring check itself failed',
          error: error.message
        });
      }
    };

    // Run initial check
    await runCheck();

    // Schedule periodic checks
    const intervalId = setInterval(runCheck, MONITORING_CONFIG.alerts.checkInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping production monitoring...');
      clearInterval(intervalId);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, stopping monitoring...');
      clearInterval(intervalId);
      process.exit(0);
    });
  }
}

async function main() {
  const monitor = new ProductionMonitor();
  const args = process.argv.slice(2);

  if (args.includes('--continuous')) {
    await monitor.startContinuousMonitoring();
  } else {
    const result = await monitor.runHealthCheck();
    process.exit(result.overallHealthy ? 0 : 1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ProductionMonitor }; 