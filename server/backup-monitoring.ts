/**
 * Backup Monitoring and Alerting Service
 * Monitors backup health and sends alerts for failures or issues
 */

import { backupService } from './backup-service';
import { disasterRecoveryService } from './disaster-recovery-service';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  threshold?: number;
  timeWindow?: number; // in minutes
  lastTriggered?: Date;
  suppressionPeriod?: number; // in minutes
}

interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  details: any;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number; // in minutes
  alerts: {
    email: {
      enabled: boolean;
      recipients: string[];
    };
    webhook: {
      enabled: boolean;
      url?: string;
    };
    console: {
      enabled: boolean;
    };
  };
  thresholds: {
    backupAge: number; // hours
    backupSize: number; // bytes
    failureRate: number; // percentage
    diskUsage: number; // percentage
  };
}

export class BackupMonitoringService {
  private config: MonitoringConfig;
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertHistory: Alert[] = [];

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: true,
      checkInterval: 5, // Check every 5 minutes
      alerts: {
        email: {
          enabled: process.env.SENDGRID_API_KEY ? true : false,
          recipients: process.env.BACKUP_ALERT_EMAILS ? 
            process.env.BACKUP_ALERT_EMAILS.split(',') : 
            ['admin@readmyfineprint.com']
        },
        webhook: {
          enabled: process.env.BACKUP_WEBHOOK_URL ? true : false,
          url: process.env.BACKUP_WEBHOOK_URL
        },
        console: {
          enabled: true
        }
      },
      thresholds: {
        backupAge: 24, // Alert if no backup in 24 hours
        backupSize: 10 * 1024 * 1024, // Alert if backup < 10MB
        failureRate: 50, // Alert if > 50% failure rate
        diskUsage: 85 // Alert if disk usage > 85%
      },
      ...config
    };

    this.initializeAlertRules();
    this.startMonitoring();
  }

  /**
   * Initialize monitoring alert rules
   */
  private initializeAlertRules(): void {
    this.alertRules = [
      {
        id: 'backup_overdue',
        name: 'Backup Overdue',
        condition: 'Last backup is older than threshold',
        severity: 'error',
        enabled: true,
        threshold: this.config.thresholds.backupAge * 60 * 60 * 1000, // Convert to milliseconds
        suppressionPeriod: 60 // Don't spam alerts
      },
      {
        id: 'backup_failed',
        name: 'Backup Failed',
        condition: 'Recent backup failed',
        severity: 'critical',
        enabled: true,
        suppressionPeriod: 30
      },
      {
        id: 'backup_size_anomaly',
        name: 'Backup Size Anomaly',
        condition: 'Backup size is unusually small',
        severity: 'warning',
        enabled: true,
        threshold: this.config.thresholds.backupSize,
        suppressionPeriod: 120
      },
      {
        id: 'storage_low',
        name: 'Low Storage Space',
        condition: 'Backup storage space is running low',
        severity: 'warning',
        enabled: true,
        threshold: this.config.thresholds.diskUsage,
        suppressionPeriod: 240
      },
      {
        id: 'backup_integrity_failed',
        name: 'Backup Integrity Check Failed',
        condition: 'Backup verification failed',
        severity: 'critical',
        enabled: true,
        suppressionPeriod: 60
      },
      {
        id: 'backup_service_down',
        name: 'Backup Service Down',
        condition: 'Backup service is not responding',
        severity: 'critical',
        enabled: true,
        suppressionPeriod: 15
      },
      {
        id: 'disaster_recovery_triggered',
        name: 'Disaster Recovery Triggered',
        condition: 'Disaster recovery procedure has been initiated',
        severity: 'critical',
        enabled: true,
        suppressionPeriod: 5
      }
    ];

    console.log(`📊 Initialized ${this.alertRules.length} backup monitoring rules`);
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (!this.config.enabled) {
      console.log('⏭️  Backup monitoring disabled');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Monitoring health check failed:', error);
      }
    }, this.config.checkInterval * 60 * 1000);

    console.log(`👁️  Started backup monitoring (interval: ${this.config.checkInterval} minutes)`);
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const checks = [
      this.checkBackupAge(),
      this.checkBackupFailures(),
      this.checkBackupSize(),
      this.checkStorageSpace(),
      this.checkBackupIntegrity(),
      this.checkBackupService(),
      this.checkDisasterRecovery()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Health check ${index} failed:`, result.reason);
      }
    });
  }

  /**
   * Check if backups are overdue
   */
  private async checkBackupAge(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'backup_overdue')!;
    if (!rule.enabled) return;

    const backupStatus = backupService.getBackupStatus();
    
    if (!backupStatus.lastBackup) {
      await this.triggerAlert(rule, {
        title: 'No Backups Found',
        message: 'No backups have been created yet',
        details: { backupStatus }
      });
      return;
    }

    const timeSinceLastBackup = Date.now() - backupStatus.lastBackup.getTime();
    
    if (timeSinceLastBackup > rule.threshold!) {
      await this.triggerAlert(rule, {
        title: 'Backup Overdue',
        message: `Last backup was ${this.formatDuration(timeSinceLastBackup)} ago`,
        details: {
          lastBackup: backupStatus.lastBackup,
          threshold: rule.threshold,
          overdue: timeSinceLastBackup - rule.threshold!
        }
      });
    }
  }

  /**
   * Check for recent backup failures
   */
  private async checkBackupFailures(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'backup_failed')!;
    if (!rule.enabled) return;

    // This would check backup history for recent failures
    // For now, implement a placeholder check
    const backupStatus = backupService.getBackupStatus();
    
    if (backupStatus.isRunning) {
      // Check if backup has been running too long
      const maxRunTime = 4 * 60 * 60 * 1000; // 4 hours
      // Implementation would check actual start time
    }
  }

  /**
   * Check backup size anomalies
   */
  private async checkBackupSize(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'backup_size_anomaly')!;
    if (!rule.enabled) return;

    const backupStatus = backupService.getBackupStatus();
    
    // Check if recent backup is unusually small
    if (backupStatus.totalSize < rule.threshold!) {
      await this.triggerAlert(rule, {
        title: 'Backup Size Anomaly',
        message: `Recent backup size (${this.formatSize(backupStatus.totalSize)}) is smaller than expected`,
        details: {
          actualSize: backupStatus.totalSize,
          expectedMinimum: rule.threshold,
          backupCount: backupStatus.totalBackups
        }
      });
    }
  }

  /**
   * Check storage space
   */
  private async checkStorageSpace(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'storage_low')!;
    if (!rule.enabled) return;

    try {
      const { execSync } = await import('child_process');
      const backupPath = process.env.BACKUP_PATH || '/tmp/backups';
      const dfOutput = execSync(`df "${backupPath}"`, { encoding: 'utf8' });
      
      const lines = dfOutput.split('\n');
      const dataLine = lines[1];
      const columns = dataLine.split(/\s+/);
      const usagePercent = parseInt(columns[4]);

      if (usagePercent > rule.threshold!) {
        await this.triggerAlert(rule, {
          title: 'Low Storage Space',
          message: `Backup storage is ${usagePercent}% full`,
          details: {
            usagePercent,
            threshold: rule.threshold,
            path: backupPath
          }
        });
      }
    } catch (error) {
      console.warn('Could not check storage space:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check backup integrity
   */
  private async checkBackupIntegrity(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'backup_integrity_failed')!;
    if (!rule.enabled) return;

    // This would verify the latest backup
    // Implementation depends on backup service providing verification methods
    try {
      // Placeholder for backup verification
      const verificationPassed = true; // Would call actual verification
      
      if (!verificationPassed) {
        await this.triggerAlert(rule, {
          title: 'Backup Integrity Check Failed',
          message: 'Latest backup failed integrity verification',
          details: { verificationTime: new Date() }
        });
      }
    } catch (error) {
      await this.triggerAlert(rule, {
        title: 'Backup Verification Error',
        message: 'Could not verify backup integrity',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Check backup service health
   */
  private async checkBackupService(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'backup_service_down')!;
    if (!rule.enabled) return;

    try {
      // Test if backup service is responsive
      const status = backupService.getBackupStatus();
      // If we can get status, service is responsive
    } catch (error) {
      await this.triggerAlert(rule, {
        title: 'Backup Service Down',
        message: 'Backup service is not responding',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Check disaster recovery status
   */
  private async checkDisasterRecovery(): Promise<void> {
    const rule = this.alertRules.find(r => r.id === 'disaster_recovery_triggered')!;
    if (!rule.enabled) return;

    const activePlans = disasterRecoveryService.listRecoveryPlans()
      .filter(plan => plan.status === 'in_progress');

    for (const plan of activePlans) {
      await this.triggerAlert(rule, {
        title: 'Disaster Recovery Active',
        message: `Disaster recovery procedure is active: ${plan.scenario}`,
        details: {
          planId: plan.scenario,
          triggeredAt: plan.triggeredAt,
          currentStep: plan.currentStep,
          totalSteps: plan.totalSteps
        }
      });
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, alertData: {
    title: string;
    message: string;
    details: any;
  }): Promise<void> {
    // Check suppression period
    if (rule.lastTriggered && rule.suppressionPeriod) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
      if (timeSinceLastTrigger < rule.suppressionPeriod * 60 * 1000) {
        return; // Skip alert due to suppression
      }
    }

    const alertId = `${rule.id}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      title: alertData.title,
      message: alertData.message,
      details: alertData.details,
      resolved: false
    };

    // Store alert
    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    rule.lastTriggered = new Date();

    // Send notifications
    await this.sendNotifications(alert);

    // Log security event
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.SYSTEM,
      severity: this.mapAlertSeverity(alert.severity),
      message: `Backup alert triggered: ${alert.title}`,
      ip: 'system',
      userAgent: 'backup-monitoring',
      endpoint: 'alert-trigger',
      details: {
        alertId,
        ruleId: rule.id,
        severity: alert.severity,
        details: alert.details
      }
    });
  }

  /**
   * Send alert notifications
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    const notifications = [];

    // Console notification
    if (this.config.alerts.console.enabled) {
      notifications.push(this.sendConsoleNotification(alert));
    }

    // Email notification
    if (this.config.alerts.email.enabled) {
      notifications.push(this.sendEmailNotification(alert));
    }

    // Webhook notification
    if (this.config.alerts.webhook.enabled && this.config.alerts.webhook.url) {
      notifications.push(this.sendWebhookNotification(alert));
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Send console notification
   */
  private async sendConsoleNotification(alert: Alert): Promise<void> {
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨'
    };

    console.log(`${severityEmoji[alert.severity]} BACKUP ALERT [${alert.severity.toUpperCase()}]`);
    console.log(`📢 ${alert.title}`);
    console.log(`💬 ${alert.message}`);
    console.log(`🕐 ${alert.timestamp.toISOString()}`);
    if (alert.details) {
      console.log(`📊 Details:`, JSON.stringify(alert.details, null, 2));
    }
    console.log('─'.repeat(60));
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    try {
      const { emailService } = await import('./email-service');
      
      const subject = `[BACKUP ALERT] ${alert.title} - ${alert.severity.toUpperCase()}`;
      const html = this.generateAlertEmailHTML(alert);

      for (const recipient of this.config.alerts.email.recipients) {
        await emailService.sendEmail({
          to: recipient,
          subject,
          html
        });
      }
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    try {
      const payload = {
        alert: {
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp,
          details: alert.details
        },
        source: 'readmyfineprint-backup-monitoring',
        environment: process.env.NODE_ENV || 'development'
      };

      const response = await fetch(this.config.alerts.webhook.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReadMyFinePrint-BackupMonitoring/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Generate HTML email for alert
   */
  private generateAlertEmailHTML(alert: Alert): string {
    const severityColor = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      critical: '#dc2626'
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${severityColor[alert.severity]}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">🚨 Backup Alert - ${alert.severity.toUpperCase()}</h2>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">${alert.title}</h3>
          <p style="margin: 10px 0; color: #666; font-size: 16px;">${alert.message}</p>
          <p style="margin: 0; color: #999; font-size: 14px;">
            <strong>Time:</strong> ${alert.timestamp.toLocaleString()}<br>
            <strong>Alert ID:</strong> ${alert.id}
          </p>
        </div>
        
        ${alert.details ? `
          <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h4 style="margin-top: 0; color: #333;">Details:</h4>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(alert.details, null, 2)}</pre>
          </div>
        ` : ''}
        
        <div style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
          <p>This alert was automatically generated by ReadMyFinePrint Backup Monitoring.</p>
          <p>To manage alert settings, please contact your system administrator.</p>
        </div>
      </div>
    `;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolvedBy) {
      alert.acknowledgedBy = resolvedBy;
      alert.acknowledgedAt = new Date();
    }

    this.activeAlerts.delete(alertId);

    console.log(`✅ Alert resolved: ${alert.title} (${alertId})`);
    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    activeAlerts: number;
    totalAlerts: number;
    alertsByService: Record<string, number>;
    lastCheck: Date;
    uptime: number;
  } {
    const alertsByService: Record<string, number> = {};
    this.alertHistory.forEach(alert => {
      const service = alert.ruleId.split('_')[0];
      alertsByService[service] = (alertsByService[service] || 0) + 1;
    });

    return {
      activeAlerts: this.activeAlerts.size,
      totalAlerts: this.alertHistory.length,
      alertsByService,
      lastCheck: new Date(),
      uptime: process.uptime()
    };
  }

  // Helper methods

  private mapAlertSeverity(severity: string): SecuritySeverity {
    switch (severity) {
      case 'critical': return SecuritySeverity.CRITICAL;
      case 'error': return SecuritySeverity.HIGH;
      case 'warning': return SecuritySeverity.MEDIUM;
      case 'info': return SecuritySeverity.LOW;
      default: return SecuritySeverity.MEDIUM;
    }
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Cleanup - stop monitoring when service is destroyed
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Export singleton instance
export const backupMonitoringService = new BackupMonitoringService();