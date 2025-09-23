import { 
  hashIpAddress, 
  hashUserAgent, 
  hashDeviceFingerprint, 
  createPseudonymizedEmail 
} from './argon2';

/**
 * Debug logging control for PII protection operations
 * Set PII_PROTECTION_DEBUG=true in environment to enable verbose protection logs
 */
const PII_PROTECTION_DEBUG = process.env.PII_PROTECTION_DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string): void {
  if (PII_PROTECTION_DEBUG) {
    console.log(message);
  }
}

/**
 * PII Protection Service
 * 
 * Centralized service for protecting Personally Identifiable Information (PII)
 * using Argon2id hashing. This service ensures consistent application of 
 * privacy protection across the application.
 */

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface ProtectedClientInfo {
  ipHash?: string;
  userAgentHash?: string;
  deviceFingerprintHash?: string;
  originalIp?: string; // Keep for migration period
  originalUserAgent?: string; // Keep for migration period
  originalDeviceFingerprint?: string; // Keep for migration period
}

export interface UserIdentifiers {
  email?: string;
}

export interface ProtectedUserIdentifiers {
  emailHash?: string;
  pseudonymizedEmail?: string;
  originalEmail?: string; // Keep for migration period
}

export class PIIProtectionService {
  /**
   * Protect client information by hashing PII fields
   */
  async protectClientInfo(clientInfo: ClientInfo, keepOriginal: boolean = true): Promise<ProtectedClientInfo> {
    const protectedInfo: ProtectedClientInfo = {};

    try {
      // Hash IP address if provided
      if (clientInfo.ip) {
        protectedInfo.ipHash = await hashIpAddress(clientInfo.ip);
        if (keepOriginal) {
          protectedInfo.originalIp = clientInfo.ip;
        }
      }

      // Hash user agent if provided
      if (clientInfo.userAgent) {
        protectedInfo.userAgentHash = await hashUserAgent(clientInfo.userAgent);
        if (keepOriginal) {
          protectedInfo.originalUserAgent = clientInfo.userAgent;
        }
      }

      // Hash device fingerprint if provided
      if (clientInfo.deviceFingerprint) {
        protectedInfo.deviceFingerprintHash = await hashDeviceFingerprint(clientInfo.deviceFingerprint);
        if (keepOriginal) {
          protectedInfo.originalDeviceFingerprint = clientInfo.deviceFingerprint;
        }
      }

      debugLog('🔐 Client information protected with Argon2id hashing');
      return protectedInfo;
    } catch (error) {
      console.error('❌ Failed to protect client information:', error);
      throw new Error('PII protection failed');
    }
  }

  /**
   * Protect user identifiers by hashing PII fields
   */
  async protectUserIdentifiers(userInfo: UserIdentifiers, keepOriginal: boolean = true): Promise<ProtectedUserIdentifiers> {
    const protectedIdentifiers: ProtectedUserIdentifiers = {};

    try {
      // Hash and pseudonymize email if provided
      if (userInfo.email) {
        protectedIdentifiers.pseudonymizedEmail = await createPseudonymizedEmail(userInfo.email);
        if (keepOriginal) {
          protectedIdentifiers.originalEmail = userInfo.email;
        }
      }


      debugLog('🔐 User identifiers protected with Argon2id hashing');
      return protectedIdentifiers;
    } catch (error) {
      console.error('❌ Failed to protect user identifiers:', error);
      throw new Error('User identifier protection failed');
    }
  }

  /**
   * Create protected database record for security logging
   */
  async createProtectedSecurityLogEntry(data: {
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    userId?: string;
    message: string;
    eventType: string;
    severity: string;
    details?: any;
  }): Promise<{
    ipHash?: string;
    userAgentHash?: string;
    endpoint?: string;
    userId?: string;
    message: string;
    eventType: string;
    severity: string;
    details?: any;
  }> {
    try {
      const protectedEntry: any = {
        endpoint: data.endpoint,
        userId: data.userId,
        message: data.message,
        eventType: data.eventType,
        severity: data.severity,
        details: data.details,
      };

      // Hash sensitive client information
      if (data.ip) {
        protectedEntry.ipHash = await hashIpAddress(data.ip);
      }

      if (data.userAgent) {
        protectedEntry.userAgentHash = await hashUserAgent(data.userAgent);
      }

      debugLog('🔐 Security log entry protected with Argon2id hashing');
      return protectedEntry;
    } catch (error) {
      console.error('❌ Failed to protect security log entry:', error);
      throw new Error('Security log protection failed');
    }
  }

  /**
   * Create protected email verification record
   */
  async createProtectedEmailVerification(data: {
    email: string;
    code: string;
    deviceFingerprint: string;
    clientIp: string;
    maxAttempts?: number;
    expiresAt: Date;
  }): Promise<{
    emailHash?: string;
    pseudonymizedEmail?: string;
    code: string;
    deviceFingerprintHash: string;
    clientIpHash: string;
    maxAttempts?: number;
    expiresAt: Date;
    // Keep original values during migration
    originalEmail?: string;
    originalDeviceFingerprint?: string;
    originalClientIp?: string;
  }> {
    try {
      const protectedRecord = {
        code: data.code,
        deviceFingerprintHash: await hashDeviceFingerprint(data.deviceFingerprint),
        clientIpHash: await hashIpAddress(data.clientIp),
        pseudonymizedEmail: await createPseudonymizedEmail(data.email),
        maxAttempts: data.maxAttempts,
        expiresAt: data.expiresAt,
        // Keep original values for migration period
        originalEmail: data.email,
        originalDeviceFingerprint: data.deviceFingerprint,
        originalClientIp: data.clientIp,
      };

      debugLog('🔐 Email verification record protected with Argon2id hashing');
      return protectedRecord;
    } catch (error) {
      console.error('❌ Failed to protect email verification record:', error);
      throw new Error('Email verification protection failed');
    }
  }

  /**
   * Check if a field appears to contain PII and should be hashed
   */
  isPotentialPII(fieldName: string, value: string): boolean {
    const piiFields = [
      'email', 'username', 'name', 'firstName', 'lastName',
      'ip', 'ipAddress', 'clientIp', 'userAgent', 'deviceFingerprint',
      'phone', 'phoneNumber', 'address', 'ssn', 'socialSecurity'
    ];

    const fieldLower = fieldName.toLowerCase();
    
    // Check if field name suggests PII
    const isNamedPII = piiFields.some(piiField => fieldLower.includes(piiField));
    
    // Check if value looks like PII patterns
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const phonePattern = /^\+?[\d\s()-]{10,}$/;
    
    const looksLikePII = emailPattern.test(value) || 
                        ipPattern.test(value) || 
                        phonePattern.test(value) ||
                        value.length > 50; // Long strings might be user agents or fingerprints

    return isNamedPII || looksLikePII;
  }

  /**
   * Get statistics about PII protection usage
   */
  getProtectionStats(): {
    functionsAvailable: string[];
    recommendedMigration: string[];
  } {
    return {
      functionsAvailable: [
        'hashIpAddress',
        'hashUserAgent', 
        'hashDeviceFingerprint',
        'createPseudonymizedEmail'
      ],
      recommendedMigration: [
        'Update security logger to use hashed IPs and user agents',
        'Update email verification to use hashed device fingerprints',
        'Update session tracking to use hashed client info',
        'Consider pseudonymizing emails in verification systems'
      ]
    };
  }
}

export const piiProtectionService = new PIIProtectionService();