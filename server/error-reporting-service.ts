import { emailService } from './email-service';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';
import crypto from 'crypto';

export interface UserError {
  errorId: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  errorType: 'frontend' | 'backend' | 'api' | 'authentication' | 'security_questions' | 'document_processing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  sessionId?: string;
  additionalContext?: Record<string, any>;
  reproductionSteps?: string[];
  frequency?: number;
}

interface ErrorSuggestion {
  category: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  suggestedFix: string;
  codeExample?: string;
  preventionTip?: string;
  estimatedTime?: string;
}

interface ErrorReport {
  summary: {
    totalErrors: number;
    criticalErrors: number;
    newErrors: number;
    timeRange: string;
  };
  errors: Array<UserError & { suggestions: ErrorSuggestion[] }>;
  trends: {
    mostCommon: string[];
    increasingErrors: string[];
    userImpact: number;
  };
}

class ErrorReportingService {
  private errorBuffer: UserError[] = [];
  private errorHashes = new Set<string>();
  private lastReportSent = new Date();
  private readonly REPORT_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_BUFFER_SIZE = 50;
  private readonly ADMIN_EMAIL = 'admin@readmyfineprint.com';

  constructor() {
    // Send periodic reports
    setInterval(() => {
      this.sendPeriodicReport();
    }, this.REPORT_INTERVAL);

    // Send immediate alerts for critical errors
    this.setupCriticalErrorAlerts();
  }

  /**
   * Report an error to the system
   */
  async reportError(error: UserError): Promise<void> {
    try {
      // Generate unique error ID
      error.errorId = crypto.randomUUID();
      error.timestamp = new Date();

      // Add to buffer
      this.errorBuffer.push(error);

      // Log security event
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: this.mapSeverity(error.severity),
        message: `User error reported: ${error.message}`,
        ip: error.ip || 'unknown',
        userAgent: error.userAgent || 'unknown',
        endpoint: error.url || 'unknown',
        details: {
          errorId: error.errorId,
          errorType: error.errorType,
          userId: error.userId,
          additionalContext: error.additionalContext
        }
      });

      // Send immediate alert for critical errors
      if (error.severity === 'critical') {
        await this.sendImmediateAlert(error);
      }

      // Trim buffer if too large
      if (this.errorBuffer.length > this.MAX_BUFFER_SIZE) {
        this.errorBuffer = this.errorBuffer.slice(-this.MAX_BUFFER_SIZE);
      }

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Send immediate alert for critical errors
   */
  private async sendImmediateAlert(error: UserError): Promise<void> {
    const suggestions = this.generateSuggestions(error);
    const errorHash = this.getErrorHash(error);

    // Avoid spam - only send if we haven't seen this error recently
    if (this.errorHashes.has(errorHash)) {
      return;
    }
    this.errorHashes.add(errorHash);

    const emailContent = this.generateCriticalErrorEmail(error, suggestions);

    await emailService.sendEmail({
      to: this.ADMIN_EMAIL,
      subject: `🚨 CRITICAL ERROR - ${error.errorType.toUpperCase()}: ${error.message.substring(0, 50)}...`,
      html: emailContent.html,
      text: emailContent.text
    });
  }

  /**
   * Send periodic error report
   */
  private async sendPeriodicReport(): Promise<void> {
    if (this.errorBuffer.length === 0) {
      return;
    }

    try {
      const report = this.generateErrorReport();
      const emailContent = this.generateReportEmail(report);

      await emailService.sendEmail({
        to: this.ADMIN_EMAIL,
        subject: `📊 Error Report - ${report.summary.totalErrors} errors (${report.summary.criticalErrors} critical)`,
        html: emailContent.html,
        text: emailContent.text
      });

      // Clear buffer after sending
      this.errorBuffer = [];
      this.lastReportSent = new Date();

    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  }

  /**
   * Generate intelligent suggestions for fixing errors
   */
  private generateSuggestions(error: UserError): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    // Security Questions specific fixes
    if (error.errorType === 'security_questions') {
      if (error.message.includes('SECURITY_QUESTIONS_REQUIRED')) {
        suggestions.push({
          category: 'UX Flow',
          priority: 'high',
          suggestedFix: 'User hit security questions requirement but modal may not be showing. Check SecurityQuestionsModal component and useSecurityQuestionsHandler hook.',
          codeExample: `// Check if SecurityQuestionsModal is properly integrated
const { showSecurityQuestionsModal, handleApiError } = useSecurityQuestionsHandler();`,
          preventionTip: 'Add better error logging in handleApiError function',
          estimatedTime: '15 minutes'
        });
      }
    }

    // Authentication errors
    if (error.errorType === 'authentication') {
      if (error.message.includes('Invalid token') || error.message.includes('Token expired')) {
        suggestions.push({
          category: 'Token Management',
          priority: 'immediate',
          suggestedFix: 'Check JOSE token validation in jose-auth-service.ts. Verify token expiration times and refresh logic.',
          codeExample: `// Check token validation
const validation = await joseAuthService.validateAccessToken(token);
if (validation.expired) {
  // Trigger token refresh
}`,
          preventionTip: 'Implement automatic token refresh before expiration',
          estimatedTime: '30 minutes'
        });
      }
    }

    // Document processing errors
    if (error.errorType === 'document_processing') {
      if (error.message.includes('Failed to analyze document')) {
        suggestions.push({
          category: 'OpenAI Integration',
          priority: 'high',
          suggestedFix: 'Check OpenAI API key and rate limits. Verify document content sanitization.',
          codeExample: `// Check OpenAI service health
const response = await openai.chat.completions.create({
  // Verify API configuration
});`,
          preventionTip: 'Add retry logic and better error handling for OpenAI requests',
          estimatedTime: '20 minutes'
        });
      }
    }

    // Frontend errors
    if (error.errorType === 'frontend') {
      if (error.message.includes('Cannot read properties') || error.message.includes('undefined')) {
        suggestions.push({
          category: 'Type Safety',
          priority: 'medium',
          suggestedFix: 'Add null checks and optional chaining. Review TypeScript types.',
          codeExample: `// Add safe property access
const value = data?.property?.nestedProperty ?? fallbackValue;`,
          preventionTip: 'Use TypeScript strict mode and add runtime type validation',
          estimatedTime: '10 minutes'
        });
      }
    }

    // API errors
    if (error.errorType === 'api') {
      if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
        suggestions.push({
          category: 'Network Resilience',
          priority: 'high',
          suggestedFix: 'Add retry logic with exponential backoff. Check CORS configuration.',
          codeExample: `// Add retry wrapper
const retryApiCall = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};`,
          preventionTip: 'Implement circuit breaker pattern for external APIs',
          estimatedTime: '25 minutes'
        });
      }
    }

    // Generic fallback suggestions
    if (suggestions.length === 0) {
      suggestions.push({
        category: 'General Debugging',
        priority: 'medium',
        suggestedFix: 'Add more detailed logging around the error location. Check recent code changes.',
        preventionTip: 'Add error boundary or try-catch blocks around the failing operation',
        estimatedTime: '15 minutes'
      });
    }

    return suggestions;
  }

  /**
   * Generate comprehensive error report
   */
  private generateErrorReport(): ErrorReport {
    const now = new Date();
    const timeRange = `${this.lastReportSent.toISOString()} - ${now.toISOString()}`;

    const errorsWithSuggestions = this.errorBuffer.map(error => ({
      ...error,
      suggestions: this.generateSuggestions(error)
    }));

    const criticalErrors = errorsWithSuggestions.filter(e => e.severity === 'critical');
    const errorTypes = this.errorBuffer.map(e => e.message);
    const uniqueErrors = [...new Set(errorTypes)];

    return {
      summary: {
        totalErrors: this.errorBuffer.length,
        criticalErrors: criticalErrors.length,
        newErrors: uniqueErrors.length,
        timeRange
      },
      errors: errorsWithSuggestions,
      trends: {
        mostCommon: this.getMostCommonErrors(),
        increasingErrors: this.getIncreasingErrors(),
        userImpact: this.calculateUserImpact()
      }
    };
  }

  /**
   * Generate email content for critical error
   */
  private generateCriticalErrorEmail(error: UserError, suggestions: ErrorSuggestion[]) {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
              🚨 CRITICAL ERROR ALERT
            </h1>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #d32f2f;">Error Details</h2>
              <p><strong>Error ID:</strong> ${error.errorId}</p>
              <p><strong>Time:</strong> ${error.timestamp.toISOString()}</p>
              <p><strong>Type:</strong> ${error.errorType}</p>
              <p><strong>User:</strong> ${error.userEmail || error.userId || 'Anonymous'}</p>
              <p><strong>URL:</strong> ${error.url || 'N/A'}</p>
              <p><strong>Message:</strong> ${error.message}</p>
              ${error.stack ? `<p><strong>Stack:</strong><br><code style="background: #fff; padding: 10px; display: block; white-space: pre-wrap; font-size: 12px;">${error.stack}</code></p>` : ''}
            </div>

            <h2 style="color: #1976d2;">💡 Suggested Fixes</h2>
            ${suggestions.map(suggestion => `
              <div style="border-left: 4px solid #1976d2; padding-left: 15px; margin: 15px 0;">
                <h3 style="margin: 0 0 5px 0; color: #1976d2;">${suggestion.category} (${suggestion.priority} priority)</h3>
                <p style="margin: 5px 0;"><strong>Fix:</strong> ${suggestion.suggestedFix}</p>
                ${suggestion.codeExample ? `<pre style="background: #f9f9f9; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;"><code>${suggestion.codeExample}</code></pre>` : ''}
                ${suggestion.preventionTip ? `<p style="margin: 5px 0; font-style: italic;"><strong>Prevention:</strong> ${suggestion.preventionTip}</p>` : ''}
                ${suggestion.estimatedTime ? `<p style="margin: 5px 0; color: #666;"><strong>Est. Time:</strong> ${suggestion.estimatedTime}</p>` : ''}
              </div>
            `).join('')}

            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Quick Action:</strong> This error needs immediate attention due to its critical severity. Consider implementing the highest priority fix first.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
CRITICAL ERROR ALERT

Error ID: ${error.errorId}
Time: ${error.timestamp.toISOString()}
Type: ${error.errorType}
User: ${error.userEmail || error.userId || 'Anonymous'}
URL: ${error.url || 'N/A'}
Message: ${error.message}

SUGGESTED FIXES:
${suggestions.map(s => `
${s.category} (${s.priority} priority):
- Fix: ${s.suggestedFix}
${s.preventionTip ? `- Prevention: ${s.preventionTip}` : ''}
${s.estimatedTime ? `- Time: ${s.estimatedTime}` : ''}
`).join('\n')}
    `;

    return { html, text };
  }

  /**
   * Generate email content for periodic report
   */
  private generateReportEmail(report: ErrorReport) {
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
              📊 ReadMyFinePrint Error Report
            </h1>
            
            <div style="display: flex; gap: 20px; margin: 20px 0;">
              <div style="background: ${report.summary.criticalErrors > 0 ? '#ffebee' : '#e8f5e8'}; padding: 15px; border-radius: 5px; flex: 1;">
                <h3 style="margin: 0 0 10px 0; color: ${report.summary.criticalErrors > 0 ? '#d32f2f' : '#2e7d32'};">Summary</h3>
                <p style="margin: 5px 0;"><strong>Total Errors:</strong> ${report.summary.totalErrors}</p>
                <p style="margin: 5px 0;"><strong>Critical:</strong> ${report.summary.criticalErrors}</p>
                <p style="margin: 5px 0;"><strong>New Issues:</strong> ${report.summary.newErrors}</p>
                <p style="margin: 5px 0;"><strong>Period:</strong> ${report.summary.timeRange}</p>
              </div>
            </div>

            <h2 style="color: #1976d2;">🔍 Error Details</h2>
            ${report.errors.slice(0, 10).map(error => `
              <div style="border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 15px 0; ${error.severity === 'critical' ? 'border-color: #d32f2f; background: #ffebee;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <strong style="color: ${error.severity === 'critical' ? '#d32f2f' : '#1976d2'};">${error.errorType.replace('_', ' ').toUpperCase()}</strong>
                  <span style="background: ${error.severity === 'critical' ? '#d32f2f' : '#1976d2'}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${error.severity.toUpperCase()}</span>
                </div>
                <p style="margin: 5px 0;"><strong>Message:</strong> ${error.message}</p>
                <p style="margin: 5px 0;"><strong>User:</strong> ${error.userEmail || 'Anonymous'}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${error.timestamp.toISOString()}</p>
                
                <h4 style="color: #1976d2; margin: 15px 0 5px 0;">💡 Suggested Fixes:</h4>
                ${error.suggestions.map(suggestion => `
                  <div style="background: #f9f9f9; padding: 10px; border-radius: 3px; margin: 5px 0;">
                    <strong>${suggestion.category}</strong> (${suggestion.priority} priority): ${suggestion.suggestedFix}
                    ${suggestion.estimatedTime ? `<br><small>⏱️ Est. time: ${suggestion.estimatedTime}</small>` : ''}
                  </div>
                `).join('')}
              </div>
            `).join('')}

            ${report.errors.length > 10 ? `<p style="color: #666; font-style: italic;">... and ${report.errors.length - 10} more errors</p>` : ''}

            <h2 style="color: #1976d2;">📈 Trends</h2>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
              <p><strong>Most Common:</strong> ${report.trends.mostCommon.join(', ') || 'None'}</p>
              <p><strong>User Impact:</strong> ${report.trends.userImpact} users affected</p>
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Next Steps:</strong> Focus on critical errors first, then address high-priority suggestions. Monitor trends for recurring issues.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `ReadMyFinePrint Error Report\n\nSummary:\n- Total Errors: ${report.summary.totalErrors}\n- Critical: ${report.summary.criticalErrors}\n- New Issues: ${report.summary.newErrors}\n\nMost Critical Errors:\n${report.errors.filter(e => e.severity === 'critical').map(e => `- ${e.message}`).join('\n')}`;

    return { html, text };
  }

  private setupCriticalErrorAlerts(): void {
    // Clear error hashes periodically to allow re-alerting
    setInterval(() => {
      this.errorHashes.clear();
    }, 60 * 60 * 1000); // 1 hour
  }

  private mapSeverity(severity: string): SecuritySeverity {
    switch (severity) {
      case 'critical': return SecuritySeverity.CRITICAL;
      case 'high': return SecuritySeverity.HIGH;
      case 'medium': return SecuritySeverity.MEDIUM;
      default: return SecuritySeverity.LOW;
    }
  }

  private getErrorHash(error: UserError): string {
    return crypto.createHash('md5')
      .update(`${error.errorType}:${error.message}:${error.url}`)
      .digest('hex');
  }

  private getMostCommonErrors(): string[] {
    const errorCounts = new Map<string, number>();
    this.errorBuffer.forEach(error => {
      const key = error.message.substring(0, 100);
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    });
    
    return Array.from(errorCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([error]) => error);
  }

  private getIncreasingErrors(): string[] {
    // Simple implementation - could be enhanced with historical data
    return this.getMostCommonErrors();
  }

  private calculateUserImpact(): number {
    const uniqueUsers = new Set(
      this.errorBuffer
        .map(e => e.userId || e.userEmail)
        .filter(Boolean)
    );
    return uniqueUsers.size;
  }
}

export const errorReportingService = new ErrorReportingService();