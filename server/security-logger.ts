import crypto from 'crypto';
import { piiProtectionService } from './pii-protection-service';

// Security event types
export enum SecurityEventType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RATE_LIMIT = 'RATE_LIMIT',
  INPUT_VALIDATION = 'INPUT_VALIDATION',
  FILE_UPLOAD = 'FILE_UPLOAD',
  SESSION_MANAGEMENT = 'SESSION_MANAGEMENT',
  API_ACCESS = 'API_ACCESS',
  ERROR = 'ERROR',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  USER_ACTIVITY = 'USER_ACTIVITY',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  ADMIN_ACTION = 'ADMIN_ACTION',
  ACCOUNT_ACTIVITY = 'ACCOUNT_ACTIVITY',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  MAILING_LIST_SIGNUP = 'MAILING_LIST_SIGNUP',
  MAILING_LIST_RESUBSCRIBE = 'MAILING_LIST_RESUBSCRIBE',
  SYSTEM = 'SYSTEM'
}

// Security event severity levels
export enum SecuritySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Security event interface
export interface SecurityEvent {
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  ip: string;
  userAgent?: string;
  sessionId?: string;
  endpoint?: string;
  details?: Record<string, any>;
  fingerprint?: string;
  // New hashed fields for privacy protection
  ipHash?: string;
  userAgentHash?: string;
  // Alias for eventType for backward compatibility
  type?: SecurityEventType;
}

class SecurityLogger {
  private static instance: SecurityLogger;
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events in memory

  private constructor() {}

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  /**
   * Generate a privacy-safe fingerprint for tracking related events
   */
  private generateFingerprint(ip: string, userAgent?: string): string {
    const data = `${ip}:${userAgent || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Log a security event with PII protection
   */
  public async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'fingerprint' | 'ipHash' | 'userAgentHash'>): Promise<void> {
    try {
      // Create protected version of the event
      const protectedEntry = await piiProtectionService.createProtectedSecurityLogEntry({
        ip: event.ip,
        userAgent: event.userAgent,
        endpoint: event.endpoint,
        userId: event.details?.userId,
        message: event.message,
        eventType: event.eventType,
        severity: event.severity,
        details: event.details,
      });

      const fullEvent: SecurityEvent = {
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        severity: event.severity,
        message: event.message,
        ip: event.ip,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        endpoint: event.endpoint,
        details: event.details,
        fingerprint: this.generateFingerprint(event.ip, event.userAgent),
        type: event.eventType,
        ipHash: protectedEntry.ipHash,
        userAgentHash: protectedEntry.userAgentHash
      };

      // Store event in memory (with rotation) - keeping original IP for now during migration
      this.events.push(fullEvent);
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(-this.maxEvents);
      }

      // Format log message based on severity (using original IP for console logs during migration)
      const logMessage = this.formatLogMessage(fullEvent);

      // Log to console with appropriate level
      switch (fullEvent.severity) {
        case SecuritySeverity.CRITICAL:
          console.error(logMessage);
          break;
        case SecuritySeverity.HIGH:
          console.warn(logMessage);
          break;
        case SecuritySeverity.MEDIUM:
          console.warn(logMessage);
          break;
        case SecuritySeverity.LOW:
          console.info(logMessage);
          break;
      }

      // In production, you might want to send to external logging service
      if (process.env.NODE_ENV === 'production') {
        this.sendToExternalLogger(fullEvent);
      }
    } catch (error) {
      console.error('❌ Failed to log security event with PII protection:', error);
      // Fallback to original logging without PII protection
      this.logSecurityEventLegacy(event);
    }
  }

  /**
   * Legacy security event logging (fallback without PII protection)
   */
  private logSecurityEventLegacy(event: Omit<SecurityEvent, 'timestamp' | 'fingerprint' | 'ipHash' | 'userAgentHash'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      fingerprint: this.generateFingerprint(event.ip, event.userAgent),
      type: event.eventType
    };

    // Store event in memory (with rotation)
    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Format log message based on severity
    const logMessage = this.formatLogMessage(fullEvent);

    // Log to console with appropriate level
    switch (fullEvent.severity) {
      case SecuritySeverity.CRITICAL:
        console.error(logMessage);
        break;
      case SecuritySeverity.HIGH:
        console.warn(logMessage);
        break;
      case SecuritySeverity.MEDIUM:
        console.warn(logMessage);
        break;
      case SecuritySeverity.LOW:
        console.info(logMessage);
        break;
    }

    // In production, you might want to send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalLogger(fullEvent);
    }
  }

  /**
   * Get emoji prefix for log severity
   */
  private getLogPrefix(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.CRITICAL:
        return '🚨';
      case SecuritySeverity.HIGH:
        return '⚠️';
      case SecuritySeverity.MEDIUM:
        return '🔍';
      case SecuritySeverity.LOW:
        return 'ℹ️';
    }
  }

  /**
   * Format security event for logging
   */
  private formatLogMessage(event: SecurityEvent): string {
    const prefix = this.getLogPrefix(event.severity);
    const fingerprint = event.fingerprint?.substring(0, 8);

    let message = `${prefix} [SECURITY] ${event.eventType} | ${event.severity} | ${fingerprint} | ${event.message}`;

    if (event.endpoint) {
      message += ` | ${event.endpoint}`;
    }

    if (event.details && Object.keys(event.details).length > 0) {
      message += ` | ${JSON.stringify(event.details)}`;
    }

    return message;
  }

  /**
   * Send to external logging service (placeholder for production)
   */
  private sendToExternalLogger(event: SecurityEvent): void {
    // In production, implement integration with services like:
    // - Datadog
    // - Splunk
    // - ELK Stack
    // - CloudWatch
    // - Sentry for error tracking

    // For now, just log that we would send it
    if (event.severity === SecuritySeverity.CRITICAL || event.severity === SecuritySeverity.HIGH) {
      console.log(`[EXTERNAL] Would send ${event.severity} security event to monitoring service`);
    }
  }

  // Convenience methods for common security events

  /**
   * Log failed authentication attempt
   */
  public logFailedAuth(ip: string, userAgent: string, reason: string, endpoint?: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.HIGH,
      message: `Failed authentication attempt: ${reason}`,
      ip,
      userAgent,
      endpoint,
      details: { reason }
    });
  }

  /**
   * Log successful admin authentication
   */
  public logAdminAuth(ip: string, userAgent: string, endpoint?: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      message: 'Admin authentication successful',
      ip,
      userAgent,
      endpoint
    });
  }

  /**
   * Log rate limit exceeded
   */
  public logRateLimit(ip: string, userAgent: string, endpoint: string, limit: number): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.RATE_LIMIT,
      severity: SecuritySeverity.MEDIUM,
      message: `Rate limit exceeded on ${endpoint}`,
      ip,
      userAgent,
      endpoint,
      details: { limit }
    });
  }

  /**
   * Log suspicious file upload
   */
  public logSuspiciousUpload(ip: string, userAgent: string, filename: string, fileType: string, reason: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.FILE_UPLOAD,
      severity: SecuritySeverity.HIGH,
      message: `Suspicious file upload blocked: ${reason}`,
      ip,
      userAgent,
      endpoint: '/api/documents/upload',
      details: { filename, fileType, reason }
    });
  }

  /**
   * Log successful file upload
   */
  public logFileUpload(ip: string, userAgent: string, filename: string, fileSize: number, sessionId: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.FILE_UPLOAD,
      severity: SecuritySeverity.LOW,
      message: 'File uploaded successfully',
      ip,
      userAgent,
      sessionId,
      endpoint: '/api/documents/upload',
      details: { filename, fileSize }
    });
  }

  /**
   * Log input validation failure
   */
  public logValidationFailure(ip: string, userAgent: string, endpoint: string, field: string, value: string): void {
    // Sanitize sensitive values
    const sanitizedValue = value.length > 50 ? value.substring(0, 50) + '...' : value;

    this.logSecurityEvent({
      eventType: SecurityEventType.INPUT_VALIDATION,
      severity: SecuritySeverity.MEDIUM,
      message: `Input validation failed for field: ${field}`,
      ip,
      userAgent,
      endpoint,
      details: { field, value: sanitizedValue }
    });
  }

  /**
   * Log session creation
   */
  public logSessionCreated(ip: string, userAgent: string, sessionId: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.SESSION_MANAGEMENT,
      severity: SecuritySeverity.LOW,
      message: 'New session created',
      ip,
      userAgent,
      sessionId
    });
  }

  /**
   * Log suspicious API access patterns
   */
  public logSuspiciousActivity(ip: string, userAgent: string, activity: string, details: Record<string, any>): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecuritySeverity.HIGH,
      message: `Suspicious activity detected: ${activity}`,
      ip,
      userAgent,
      details
    });
  }

  /**
   * Log application errors that might indicate security issues
   */
  public logSecurityError(ip: string, userAgent: string, error: string, endpoint?: string): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.ERROR,
      severity: SecuritySeverity.MEDIUM,
      message: `Security-related error: ${error}`,
      ip,
      userAgent,
      endpoint,
      details: { error }
    });
  }

  /**
   * Log OpenAI API usage for audit purposes
   */
  public logOpenAIUsage(ip: string, userAgent: string, sessionId: string, documentTitle: string, tokensUsed?: number): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.API_ACCESS,
      severity: SecuritySeverity.LOW,
      message: 'Document sent to OpenAI for analysis',
      ip,
      userAgent,
      sessionId,
      endpoint: '/api/documents/*/analyze',
      details: { documentTitle, tokensUsed, service: 'OpenAI' }
    });
  }

  /**
   * Log file upload rejection
   */
  public logFileUploadRejected(req: any, filename: string, fileType: string, reason: string): void {
    const { ip, userAgent } = getClientInfo(req);
    this.logSecurityEvent({
      eventType: SecurityEventType.FILE_UPLOAD,
      severity: SecuritySeverity.MEDIUM,
      message: `File upload rejected: ${reason}`,
      ip,
      userAgent,
      sessionId: req.sessionId,
      endpoint: '/api/documents/upload',
      details: { filename, fileType, reason }
    });
  }

  /**
   * Log successful file upload
   */
  public logFileUploadSuccess(req: any, filename: string, fileType: string, fileSize: number, fileHash: string): void {
    const { ip, userAgent } = getClientInfo(req);
    this.logSecurityEvent({
      eventType: SecurityEventType.FILE_UPLOAD,
      severity: SecuritySeverity.LOW,
      message: 'File uploaded successfully',
      ip,
      userAgent,
      sessionId: req.sessionId,
      endpoint: '/api/documents/upload',
      details: { filename, fileType, fileSize, fileHash: fileHash.substring(0, 16) }
    });
  }

  /**
   * Log file validation failure
   */
  public logFileValidationFailed(req: any, filename: string, fileType: string, reason: string): void {
    const { ip, userAgent } = getClientInfo(req);
    this.logSecurityEvent({
      eventType: SecurityEventType.FILE_UPLOAD,
      severity: SecuritySeverity.HIGH,
      message: `File validation failed: ${reason}`,
      ip,
      userAgent,
      sessionId: req.sessionId,
      endpoint: '/api/documents/upload',
      details: { filename, fileType, reason }
    });
  }

  /**
   * Log email change request submission
   */
  public logEmailChangeRequest(
    ip: string, 
    userAgent: string, 
    userId: string, 
    currentEmail: string, 
    newEmail: string, 
    reason: string
  ): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      message: 'Email change request submitted',
      ip,
      userAgent,
      endpoint: '/api/auth/request-email-change',
      details: { 
        userId, 
        currentEmail, 
        newEmail, 
        reasonLength: reason.length 
      }
    });
  }

  /**
   * Log successful email change
   */
  public logEmailChanged(
    ip: string, 
    userAgent: string, 
    userId: string, 
    oldEmail: string, 
    newEmail: string
  ): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.HIGH,
      message: 'User email address changed',
      ip,
      userAgent,
      details: { userId, oldEmail, newEmail }
    });
  }

  /**
   * Log failed email change verification
   */
  public logEmailChangeVerificationFailed(
    ip: string, 
    userAgent: string, 
    requestId: string, 
    userId: string,
    attempts: number
  ): void {
    this.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.HIGH,
      message: 'Email change verification failed',
      ip,
      userAgent,
      endpoint: '/api/auth/verify-email-change',
      details: { requestId, userId, attempts }
    });
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): Record<string, any> {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    const last7Days = now - (7 * 24 * 60 * 60 * 1000);

    const recent24h = this.events.filter(e => new Date(e.timestamp).getTime() > last24Hours);
    const recent7d = this.events.filter(e => new Date(e.timestamp).getTime() > last7Days);

    const getEventStats = (events: SecurityEvent[]) => {
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      
      events.forEach(event => {
        byType[event.eventType] = (byType[event.eventType] || 0) + 1;
        bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      });

      return { byType, bySeverity, total: events.length };
    };

    return {
      totalEvents: this.events.length,
      last24Hours: getEventStats(recent24h),
      last7Days: getEventStats(recent7d),
      topFingerprints: this.getTopFingerprints(recent24h),
      recentCritical: this.events
        .filter(e => e.severity === SecuritySeverity.CRITICAL)
        .slice(-10)
        .map(e => ({ timestamp: e.timestamp, message: e.message, fingerprint: e.fingerprint }))
    };
  }

  /**
   * Get recent security events
   */
  public getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit).reverse(); // Return most recent first
  }

  /**
   * Get top fingerprints by activity
   */
  private getTopFingerprints(events: SecurityEvent[]): Array<{ fingerprint: string; count: number; types: string[] }> {
    const fingerprintMap: Record<string, { count: number; types: Set<string> }> = {};

    events.forEach(event => {
      if (event.fingerprint) {
        if (!fingerprintMap[event.fingerprint]) {
          fingerprintMap[event.fingerprint] = { count: 0, types: new Set() };
        }
        fingerprintMap[event.fingerprint].count++;
        fingerprintMap[event.fingerprint].types.add(event.eventType);
      }
    });

    return Object.entries(fingerprintMap)
      .map(([fingerprint, data]) => ({
        fingerprint,
        count: data.count,
        types: Array.from(data.types)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get security events with filtering
   */
  getSecurityEvents(options: {
    page?: number;
    limit?: number;
    severity?: string;
    timeframe?: string;
    type?: string;
  } = {}) {
    const { page = 1, limit = 50, severity, timeframe, type } = options;
    
    let filteredEvents = [...this.events];
    
    // Filter by timeframe
    if (timeframe && timeframe !== 'all') {
      const now = Date.now();
      let cutoff: number;
      
      switch (timeframe) {
        case '1h':
          cutoff = now - (60 * 60 * 1000);
          break;
        case '24h':
          cutoff = now - (24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoff = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoff = now - (30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = 0;
      }
      
      filteredEvents = filteredEvents.filter(e => 
        new Date(e.timestamp).getTime() > cutoff
      );
    }
    
    // Filter by severity
    if (severity && severity !== 'all') {
      filteredEvents = filteredEvents.filter(e => 
        e.severity.toLowerCase() === severity.toLowerCase()
      );
    }
    
    // Filter by type
    if (type && type !== 'all') {
      filteredEvents = filteredEvents.filter(e => 
        e.eventType === type
      );
    }
    
    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Paginate
    const total = filteredEvents.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const events = filteredEvents.slice(startIndex, endIndex);
    
    return {
      events: events.map(event => ({
        id: event.fingerprint || crypto.randomUUID(),
        type: event.eventType,
        severity: event.severity,
        message: event.message,
        ip: event.ip,
        userAgent: event.userAgent || 'Unknown',
        timestamp: event.timestamp,
        userId: event.details?.userId
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();

// Helper function to get client IP and User Agent from request
export function getClientInfo(req: any): { ip: string; userAgent: string } {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return { ip, userAgent };
}
