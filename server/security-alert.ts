import { SecurityEvent, SecurityEventType, SecuritySeverity } from './security-logger';
import * as nodemailer from 'nodemailer';

// Alert thresholds and configuration
interface AlertThreshold {
  eventType: SecurityEventType;
  count: number;
  timeWindowMs: number;
  severity: SecuritySeverity;
  description: string;
}

// Default alert thresholds
const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    eventType: SecurityEventType.AUTHENTICATION,
    count: 5,
    timeWindowMs: 5 * 60 * 1000, // 5 minutes
    severity: SecuritySeverity.HIGH,
    description: 'Multiple authentication failures from same source'
  },
  {
    eventType: SecurityEventType.RATE_LIMIT,
    count: 3,
    timeWindowMs: 10 * 60 * 1000, // 10 minutes
    severity: SecuritySeverity.MEDIUM,
    description: 'Repeated rate limit violations'
  },
  {
    eventType: SecurityEventType.INPUT_VALIDATION,
    count: 10,
    timeWindowMs: 15 * 60 * 1000, // 15 minutes
    severity: SecuritySeverity.MEDIUM,
    description: 'Multiple input validation failures'
  },
  {
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    count: 1,
    timeWindowMs: 1 * 60 * 1000, // 1 minute
    severity: SecuritySeverity.CRITICAL,
    description: 'Suspicious activity detected'
  }
];

// Alert notification interface
interface SecurityAlert {
  id: string;
  timestamp: string;
  threshold: AlertThreshold;
  triggeringEvents: SecurityEvent[];
  fingerprint: string;
  message: string;
  acknowledged: boolean;
}

// Alert handler interface for extensibility
interface AlertHandler {
  name: string;
  handle(alert: SecurityAlert): Promise<void>;
}

// Console alert handler
class ConsoleAlertHandler implements AlertHandler {
  name = 'console';

  async handle(alert: SecurityAlert): Promise<void> {
    const emoji = this.getSeverityEmoji(alert.threshold.severity);
    console.error(`${emoji} [SECURITY ALERT] ${alert.id}`);
    console.error(`   Type: ${alert.threshold.eventType}`);
    console.error(`   Severity: ${alert.threshold.severity}`);
    console.error(`   Message: ${alert.message}`);
    console.error(`   Fingerprint: ${alert.fingerprint}`);
    console.error(`   Event Count: ${alert.triggeringEvents.length}`);
    console.error(`   Time Window: ${alert.threshold.timeWindowMs / 1000}s`);
    console.error(`   First Event: ${alert.triggeringEvents[0]?.timestamp}`);
    console.error(`   Last Event: ${alert.triggeringEvents[alert.triggeringEvents.length - 1]?.timestamp}`);
  }

  private getSeverityEmoji(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.CRITICAL: return '🚨';
      case SecuritySeverity.HIGH: return '⚠️';
      case SecuritySeverity.MEDIUM: return '🔍';
      case SecuritySeverity.LOW: return 'ℹ️';
    }
  }
}

// Email alert handler with iCloud SMTP support
class EmailAlertHandler implements AlertHandler {
  name = 'email';
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const {
      SMTP_HOST = 'smtp.mail.me.com',
      SMTP_PORT = '587',
      SMTP_USER,
      SMTP_PASS,
      SECURITY_EMAIL_FROM,
      SECURITY_EMAIL_TO
    } = process.env;

    if (SMTP_USER && SMTP_PASS && SECURITY_EMAIL_FROM && SECURITY_EMAIL_TO) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT),
        secure: false, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      if (this.transporter) {
        this.transporter.verify((error, success) => {
          if (error) {
            console.error('[EMAIL ALERT] SMTP connection failed:', error.message);
            this.transporter = null;
          } else {
            console.log('[EMAIL ALERT] SMTP server ready for email alerts');
          }
        });
      }
    }
  }

  async handle(alert: SecurityAlert): Promise<void> {
    if (!this.transporter) {
      console.log(`[EMAIL ALERT SIMULATION] ${alert.id}: ${alert.message}`);
      console.log('[EMAIL ALERT] SMTP not configured. Set SMTP_USER, SMTP_PASS, SECURITY_EMAIL_FROM, SECURITY_EMAIL_TO');
      return;
    }

    try {
      const severity = alert.threshold.severity;
      const subject = `🚨 Security Alert [${severity}] - ${alert.threshold.eventType}`;
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${this.getSeverityColor(severity)}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${this.getSeverityEmoji(severity)} Security Alert</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Alert ID: ${alert.id}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6;">
            <h2 style="color: #495057; margin-top: 0;">Alert Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Severity:</td><td>${severity}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Event Type:</td><td>${alert.threshold.eventType}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Timestamp:</td><td>${alert.timestamp}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Event Count:</td><td>${alert.triggeringEvents.length}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Fingerprint:</td><td><code>${alert.fingerprint}</code></td></tr>
            </table>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <h3 style="color: #495057; margin-top: 0;">Message</h3>
            <p style="background: #f8f9fa; padding: 15px; border-left: 4px solid ${this.getSeverityColor(severity)}; margin: 0;">
              ${alert.message}
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="margin: 0; color: #6c757d; font-size: 12px;">
              ReadMyFinePrint Security System - ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `;

      const textBody = `
SECURITY ALERT [${severity}]
Alert ID: ${alert.id}

Event Type: ${alert.threshold.eventType}
Severity: ${severity}
Timestamp: ${alert.timestamp}
Event Count: ${alert.triggeringEvents.length}
Fingerprint: ${alert.fingerprint}

Message: ${alert.message}

---
ReadMyFinePrint Security System
Generated: ${new Date().toISOString()}
      `;

      await this.transporter.sendMail({
        from: process.env.SECURITY_EMAIL_FROM,
        to: process.env.SECURITY_EMAIL_TO,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[EMAIL ALERT] Successfully sent ${severity} alert: ${alert.id}`);
    } catch (error) {
      console.error('[EMAIL ALERT] Failed to send email:', error);
      // Fallback to console logging
      console.log(`[EMAIL ALERT FALLBACK] ${alert.id}: ${alert.message}`);
    }
  }

  private getSeverityColor(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.CRITICAL: return '#dc3545';
      case SecuritySeverity.HIGH: return '#fd7e14';
      case SecuritySeverity.MEDIUM: return '#ffc107';
      case SecuritySeverity.LOW: return '#28a745';
    }
  }

  private getSeverityEmoji(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.CRITICAL: return '🚨';
      case SecuritySeverity.HIGH: return '⚠️';
      case SecuritySeverity.MEDIUM: return '🔍';
      case SecuritySeverity.LOW: return 'ℹ️';
    }
  }
}

// Webhook alert handler (placeholder for production use)
class WebhookAlertHandler implements AlertHandler {
  name = 'webhook';

  async handle(alert: SecurityAlert): Promise<void> {
    if (process.env.SECURITY_WEBHOOK_URL) {
      try {
        // In production, send to webhook endpoint
        console.log(`[WEBHOOK ALERT] Would POST to ${process.env.SECURITY_WEBHOOK_URL}`);
        console.log(`   Payload: ${JSON.stringify({
          id: alert.id,
          severity: alert.threshold.severity,
          type: alert.threshold.eventType,
          message: alert.message,
          timestamp: alert.timestamp,
          eventCount: alert.triggeringEvents.length
        })}`);
      } catch (error) {
        console.error('[WEBHOOK ALERT] Failed to send webhook:', error);
      }
    } else {
      console.log(`[WEBHOOK ALERT SIMULATION] ${alert.id}: ${alert.message}`);
    }
  }
}

export class SecurityAlertManager {
  private static instance: SecurityAlertManager;
  private thresholds: AlertThreshold[] = DEFAULT_THRESHOLDS;
  private alerts: Map<string, SecurityAlert> = new Map();
  private handlers: AlertHandler[] = [
    new ConsoleAlertHandler(),
    new EmailAlertHandler(),
    new WebhookAlertHandler()
  ];

  private constructor() {}

  public static getInstance(): SecurityAlertManager {
    if (!SecurityAlertManager.instance) {
      SecurityAlertManager.instance = new SecurityAlertManager();
    }
    return SecurityAlertManager.instance;
  }

  /**
   * Check if events should trigger an alert
   */
  public async checkForAlerts(events: SecurityEvent[]): Promise<void> {
    for (const threshold of this.thresholds) {
      await this.checkThreshold(threshold, events);
    }
  }

  /**
   * Check a specific threshold against recent events
   */
  private async checkThreshold(threshold: AlertThreshold, allEvents: SecurityEvent[]): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - threshold.timeWindowMs;

    // Filter events by type and time window, group by fingerprint
    const eventsByFingerprint = new Map<string, SecurityEvent[]>();

    allEvents.forEach(event => {
      if (event.eventType === threshold.eventType && 
          new Date(event.timestamp).getTime() > cutoffTime &&
          event.fingerprint) {
        
        if (!eventsByFingerprint.has(event.fingerprint)) {
          eventsByFingerprint.set(event.fingerprint, []);
        }
        eventsByFingerprint.get(event.fingerprint)!.push(event);
      }
    });

    // Check each fingerprint for threshold breach
    for (const [fingerprint, events] of eventsByFingerprint) {
      if (events.length >= threshold.count) {
        await this.triggerAlert(threshold, events, fingerprint);
      }
    }
  }

  /**
   * Trigger a security alert
   */
  private async triggerAlert(
    threshold: AlertThreshold,
    triggeringEvents: SecurityEvent[],
    fingerprint: string
  ): Promise<void> {
    const alertId = `${threshold.eventType}_${fingerprint}_${Date.now()}`;
    
    // Check if we've already alerted for this fingerprint recently (avoid spam)
    const existingAlert = Array.from(this.alerts.values()).find(alert => 
      alert.fingerprint === fingerprint && 
      alert.threshold.eventType === threshold.eventType &&
      (Date.now() - new Date(alert.timestamp).getTime()) < threshold.timeWindowMs
    );

    if (existingAlert) {
      console.log(`[ALERT] Suppressing duplicate alert for ${fingerprint} (recent alert: ${existingAlert.id})`);
      return;
    }

    const alert: SecurityAlert = {
      id: alertId,
      timestamp: new Date().toISOString(),
      threshold,
      triggeringEvents,
      fingerprint,
      message: `${threshold.description}: ${triggeringEvents.length} events from ${fingerprint} in ${threshold.timeWindowMs / 1000}s`,
      acknowledged: false
    };

    // Store alert
    this.alerts.set(alertId, alert);

    // Send to all handlers
    for (const handler of this.handlers) {
      try {
        await handler.handle(alert);
      } catch (error) {
        console.error(`[ALERT] Handler ${handler.name} failed:`, error);
      }
    }

    // Clean up old alerts (keep last 1000)
    if (this.alerts.size > 1000) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort(([,a], [,b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      this.alerts.clear();
      sortedAlerts.slice(0, 1000).forEach(([id, alert]) => {
        this.alerts.set(id, alert);
      });
    }
  }

  /**
   * Get recent alerts
   */
  public getRecentAlerts(limit: number = 50): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`[ALERT] Alert ${alertId} acknowledged`);
      return true;
    }
    return false;
  }

  /**
   * Add custom alert handler
   */
  public addHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
    console.log(`[ALERT] Added alert handler: ${handler.name}`);
  }

  /**
   * Update alert thresholds
   */
  public updateThresholds(newThresholds: AlertThreshold[]): void {
    this.thresholds = newThresholds;
    console.log(`[ALERT] Updated alert thresholds: ${newThresholds.length} rules`);
  }
}

export const securityAlertManager = SecurityAlertManager.getInstance(); 