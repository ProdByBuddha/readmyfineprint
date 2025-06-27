/**
 * Data Transfer Compliance Service
 * Handles cross-border data transfer compliance and monitoring
 */

import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

export interface DataTransferRecord {
  id: string;
  timestamp: Date;
  processor: string;
  transferType: 'openai_analysis' | 'stripe_payment' | 'email_notification';
  dataCategories: string[];
  legalBasis: string;
  safeguards: string[];
  userPseudonym?: string;
  purpose: string;
  retentionPeriod: string;
  transferCountry: string;
}

export interface TransferComplianceConfig {
  enableLogging: boolean;
  requireSCCs: boolean;
  monitoringEnabled: boolean;
  alertThreshold: number; // Number of transfers per hour to trigger alert
}

class DataTransferComplianceService {
  private config: TransferComplianceConfig;
  private transferRecords: Map<string, DataTransferRecord> = new Map();
  private hourlyTransferCount: Map<string, number> = new Map();

  constructor(config: TransferComplianceConfig = {
    enableLogging: true,
    requireSCCs: true,
    monitoringEnabled: true,
    alertThreshold: 100
  }) {
    this.config = config;
  }

  /**
   * Record a data transfer to third country
   */
  async recordTransfer(transfer: Omit<DataTransferRecord, 'id' | 'timestamp'>): Promise<string> {
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: DataTransferRecord = {
      id: transferId,
      timestamp: new Date(),
      ...transfer
    };

    // Store transfer record
    this.transferRecords.set(transferId, record);

    // Log transfer for audit trail
    if (this.config.enableLogging) {
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: `Data transfer recorded: ${transfer.transferType} to ${transfer.processor}`,
        details: {
          transferId,
          processor: transfer.processor,
          transferType: transfer.transferType,
          dataCategories: transfer.dataCategories,
          transferCountry: transfer.transferCountry,
          legalBasis: transfer.legalBasis,
          safeguards: transfer.safeguards,
          purpose: transfer.purpose
        },
        ip: 'system', // System-initiated transfer
        userAgent: 'system'
      });
    }

    // Monitor transfer frequency
    if (this.config.monitoringEnabled) {
      await this.monitorTransferFreq(transfer.processor);
    }

    return transferId;
  }

  /**
   * Record OpenAI data transfer with PII protection
   */
  async recordOpenAITransfer(userPseudonym: string, documentType: string, hasRedactedPII: boolean): Promise<string> {
    const transferId = await this.recordTransfer({
      processor: 'OpenAI, L.L.C.',
      transferType: 'openai_analysis',
      dataCategories: hasRedactedPII ? ['pseudonymized_document_content'] : ['document_content'],
      legalBasis: 'GDPR Article 6(1)(b) - Contract performance',
      safeguards: [
        'EU-US Standard Contractual Clauses (2021/914/EU)',
        'PII redaction before transfer',
        'Zero retention by processor',
        'Encryption in transit (TLS 1.3)'
      ],
      userPseudonym,
      purpose: 'Legal document analysis and summarization',
      retentionPeriod: '0 seconds (immediate deletion)',
      transferCountry: 'United States'
    });

    // Additional validation for OpenAI transfers
    if (!hasRedactedPII) {
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.MEDIUM,
        message: 'PII redaction not confirmed for OpenAI transfer',
        details: {
          transferId,
          issue: 'PII redaction not confirmed',
          recommendation: 'Review PII detection and redaction process'
        },
        ip: 'system',
        userAgent: 'system'
      });
    }

    return transferId;
  }

  /**
   * Record Stripe payment data transfer
   */
  async recordStripeTransfer(userPseudonym: string, paymentType: string): Promise<string> {
    return await this.recordTransfer({
      processor: 'Stripe, Inc.',
      transferType: 'stripe_payment',
      dataCategories: ['payment_data', 'customer_identifier'],
      legalBasis: 'GDPR Article 6(1)(b) - Contract performance',
      safeguards: [
        'PCI DSS Level 1 Service Provider',
        'Tokenization of payment data',
        'Adequacy decision (if applicable)',
        'Contractual data protection clauses'
      ],
      userPseudonym,
      purpose: 'Payment processing and subscription management',
      retentionPeriod: 'As per Stripe retention policy',
      transferCountry: 'United States'
    });
  }

  /**
   * Record email service transfer
   */
  async recordEmailTransfer(userPseudonym: string, emailType: string): Promise<string> {
    return await this.recordTransfer({
      processor: 'Email Service Provider',
      transferType: 'email_notification',
      dataCategories: ['email_address', 'name'],
      legalBasis: 'GDPR Article 6(1)(b) - Contract performance',
      safeguards: [
        'Standard Contractual Clauses',
        'Data minimization',
        'Limited retention period',
        'Encryption in transit'
      ],
      userPseudonym,
      purpose: `Email notification: ${emailType}`,
      retentionPeriod: '30 days',
      transferCountry: 'United States'
    });
  }

  /**
   * Monitor transfer frequency for compliance alerts
   */
  private async monitorTransferFreq(processor: string): Promise<void> {
    const hour = new Date().getHours();
    const key = `${processor}_${hour}`;
    
    const currentCount = this.hourlyTransferCount.get(key) || 0;
    this.hourlyTransferCount.set(key, currentCount + 1);

    // Alert if threshold exceeded
    if (currentCount + 1 > this.config.alertThreshold) {
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.MEDIUM,
        message: `Transfer frequency threshold exceeded for ${processor}`,
        details: {
          processor,
          hour,
          transferCount: currentCount + 1,
          threshold: this.config.alertThreshold
        },
        ip: 'system',
        userAgent: 'system'
      });
    }

    // Cleanup old hourly counters (keep last 24 hours)
    const currentHour = new Date().getHours();
    const keysToDelete: string[] = [];
    
    for (const [key, _] of this.hourlyTransferCount) {
      const [_, hourStr] = key.split('_');
      const keyHour = parseInt(hourStr);
      
      // Remove entries older than 24 hours
      if (Math.abs(currentHour - keyHour) > 24) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.hourlyTransferCount.delete(key));
  }

  /**
   * Get transfer records for audit purposes
   */
  getTransferRecords(processor?: string, fromDate?: Date, toDate?: Date): DataTransferRecord[] {
    let records = Array.from(this.transferRecords.values());

    if (processor) {
      records = records.filter(r => r.processor === processor);
    }

    if (fromDate) {
      records = records.filter(r => r.timestamp >= fromDate);
    }

    if (toDate) {
      records = records.filter(r => r.timestamp <= toDate);
    }

    return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate transfer compliance report
   */
  generateComplianceReport(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): any {
    const now = new Date();
    const periodMs = period === 'daily' ? 24 * 60 * 60 * 1000 :
                     period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
                     30 * 24 * 60 * 60 * 1000;
    
    const fromDate = new Date(now.getTime() - periodMs);
    const records = this.getTransferRecords(undefined, fromDate, now);

    const report = {
      period,
      reportDate: now.toISOString(),
      totalTransfers: records.length,
      transfersByProcessor: {} as Record<string, number>,
      transfersByType: {} as Record<string, number>,
      transfersByCountry: {} as Record<string, number>,
      complianceMetrics: {
        withSCCs: 0,
        withPIIRedaction: 0,
        withEncryption: 0,
        zeroRetention: 0
      },
      riskIndicators: [] as string[]
    };

    records.forEach(record => {
      // Count by processor
      report.transfersByProcessor[record.processor] = 
        (report.transfersByProcessor[record.processor] || 0) + 1;

      // Count by type
      report.transfersByType[record.transferType] = 
        (report.transfersByType[record.transferType] || 0) + 1;

      // Count by country
      report.transfersByCountry[record.transferCountry] = 
        (report.transfersByCountry[record.transferCountry] || 0) + 1;

      // Compliance metrics
      if (record.safeguards.some(s => s.includes('Standard Contractual Clauses'))) {
        report.complianceMetrics.withSCCs++;
      }
      if (record.safeguards.some(s => s.includes('PII redaction'))) {
        report.complianceMetrics.withPIIRedaction++;
      }
      if (record.safeguards.some(s => s.includes('Encryption'))) {
        report.complianceMetrics.withEncryption++;
      }
      if (record.retentionPeriod.includes('0 seconds') || record.retentionPeriod.includes('immediate deletion')) {
        report.complianceMetrics.zeroRetention++;
      }
    });

    // Risk indicators
    if (report.complianceMetrics.withSCCs < records.length) {
      report.riskIndicators.push('Some transfers lack Standard Contractual Clauses');
    }
    if (report.complianceMetrics.withPIIRedaction < records.filter(r => r.transferType === 'openai_analysis').length) {
      report.riskIndicators.push('Some OpenAI transfers may contain PII');
    }

    return report;
  }

  /**
   * Validate transfer compliance before execution
   */
  validateTransferCompliance(transfer: Omit<DataTransferRecord, 'id' | 'timestamp'>): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for required safeguards
    if (this.config.requireSCCs && !transfer.safeguards.includes('Standard Contractual Clauses')) {
      issues.push('Standard Contractual Clauses required for international transfers');
    }

    // Check for PII in OpenAI transfers
    if (transfer.transferType === 'openai_analysis' && 
        !transfer.safeguards.some(s => s.includes('PII redaction'))) {
      issues.push('PII redaction required for OpenAI transfers');
    }

    // Check for encryption
    if (!transfer.safeguards.some(s => s.includes('Encryption') || s.includes('TLS'))) {
      issues.push('Encryption in transit required for all transfers');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const dataTransferCompliance = new DataTransferComplianceService();

// Export for testing and configuration
export { DataTransferComplianceService };