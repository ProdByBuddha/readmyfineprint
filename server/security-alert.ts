import { SecurityEvent, SecurityEventType, SecuritySeverity } from './security-logger';

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

// Email alert handler (placeholder for production use)
class EmailAlertHandler implements AlertHandler {
  name = 'email';

  async handle(alert: SecurityAlert): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // In production, implement actual email sending
      console.log(`[EMAIL ALERT] Would send ${alert.threshold.severity} alert to security team`);
      console.log(`   Subject: Security Alert - ${alert.threshold.eventType} - ${alert.id}`);
      console.log(`   Body: ${alert.message}`);
    } else {
      console.log(`[EMAIL ALERT SIMULATION] ${alert.id}: ${alert.message}`);
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