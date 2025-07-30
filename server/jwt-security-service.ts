import crypto from 'crypto';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  payload?: any;
  errors: string[];
  securityIssues: string[];
}

interface TokenAttempt {
  token: string;
  timestamp: Date;
  success: boolean;
  ip: string;
  userAgent: string;
  errorReason?: string;
}

/**
 * JWT Security Service - ASVS V2.2, V3.2, V3.3 Compliance
 * Implements secure JWT token validation and management for passwordless authentication
 */
class JWTSecurityService {
  private tokenAttempts = new Map<string, TokenAttempt[]>();
  private blockedTokens = new Set<string>(); // Token blacklist
  private suspiciousIPs = new Map<string, number>(); // IP-based rate limiting
  
  // Configuration - ASVS compliant settings
  private readonly MAX_TOKEN_ATTEMPTS_PER_IP = 10; // Per 5 minutes
  private readonly TOKEN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_TOKEN_LENGTH = 2048; // Prevent token flooding attacks
  private readonly MIN_TOKEN_ENTROPY = 128; // Minimum bits of entropy expected
  
  constructor() {
    // Clean up old attempts every 10 minutes
    setInterval(() => {
      this.cleanupOldAttempts();
    }, 10 * 60 * 1000);
  }

  /**
   * Validate JWT token with security checks (ASVS V3.2.1, V3.2.2)
   */
  async validateTokenSecurity(token: string, ip: string, userAgent: string): Promise<TokenValidationResult> {
    const result: TokenValidationResult = {
      isValid: false,
      isExpired: false,
      errors: [],
      securityIssues: []
    };

    try {
      // Basic token format validation
      if (!this.validateTokenFormat(token, result)) {
        this.recordTokenAttempt(token, false, ip, userAgent, 'Invalid format');
        return result;
      }

      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        result.errors.push('Token has been revoked');
        result.securityIssues.push('Attempted use of blacklisted token');
        this.recordTokenAttempt(token, false, ip, userAgent, 'Blacklisted token');
        
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.HIGH,
          message: 'Attempted use of blacklisted JWT token',
          ip,
          userAgent,
          endpoint: 'jwt-validation',
          details: { tokenHash: this.hashToken(token) }
        });
        
        return result;
      }

      // Rate limiting check (ASVS V2.1.2 adapted for tokens)
      if (!this.checkRateLimit(ip)) {
        result.errors.push('Too many token validation attempts');
        result.securityIssues.push('Rate limit exceeded');
        
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.RATE_LIMIT,
          severity: SecuritySeverity.HIGH,
          message: `JWT validation rate limit exceeded for IP ${ip}`,
          ip,
          userAgent,
          endpoint: 'jwt-validation',
          details: { attempts: this.suspiciousIPs.get(ip) }
        });
        
        return result;
      }

      // Import the actual JWT validation service
      const { joseAuthService } = await import('./jose-auth-service');
      const validation = await joseAuthService.validateAccessToken(token);
      
      if (validation.valid && validation.payload) {
        result.isValid = true;
        result.payload = validation.payload;
        this.recordTokenAttempt(token, true, ip, userAgent);
        
        // Additional security checks on valid tokens
        this.performAdditionalSecurityChecks(validation.payload, ip, userAgent);
        
      } else {
        result.isExpired = validation.expired || false;
        result.errors.push(validation.error || 'Token validation failed');
        this.recordTokenAttempt(token, false, ip, userAgent, validation.error);
        
        // Log failed validation attempt
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.MEDIUM,
          message: 'JWT token validation failed',
          ip,
          userAgent,
          endpoint: 'jwt-validation',
          details: { 
            reason: validation.error,
            expired: validation.expired,
            tokenHash: this.hashToken(token)
          }
        });
      }

    } catch (error) {
      result.errors.push('Token validation error');
      result.securityIssues.push('Unexpected validation error');
      this.recordTokenAttempt(token, false, ip, userAgent, 'Validation error');
      
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'JWT validation system error',
        ip,
        userAgent,
        endpoint: 'jwt-validation',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          tokenHash: this.hashToken(token)
        }
      });
    }

    return result;
  }

  /**
   * Validate basic token format and structure
   */
  private validateTokenFormat(token: string, result: TokenValidationResult): boolean {
    // Check token length (prevent DoS attacks)
    if (token.length > this.MAX_TOKEN_LENGTH) {
      result.errors.push('Token exceeds maximum length');
      result.securityIssues.push('Potential DoS attack - oversized token');
      return false;
    }

    // Check if token is empty or just whitespace
    if (!token || token.trim().length === 0) {
      result.errors.push('Token is empty');
      return false;
    }

    // Basic JWT format check (should have two dots for three parts)
    const parts = token.split('.');
    if (parts.length !== 3) {
      result.errors.push('Invalid JWT format');
      return false;
    }

    // Check for suspicious characters that might indicate injection attempts
    if (/[<>'"&]/.test(token)) {
      result.errors.push('Token contains suspicious characters');
      result.securityIssues.push('Potential injection attempt in token');
      return false;
    }

    // Validate Base64URL format for each part
    for (let i = 0; i < parts.length; i++) {
      if (!this.isValidBase64URL(parts[i])) {
        result.errors.push(`Invalid Base64URL encoding in token part ${i + 1}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if string is valid Base64URL
   */
  private isValidBase64URL(str: string): boolean {
    // Base64URL uses A-Z, a-z, 0-9, -, _ characters
    return /^[A-Za-z0-9_-]+$/.test(str);
  }

  /**
   * Check rate limiting for token validation attempts
   */
  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const attempts = this.suspiciousIPs.get(ip) || 0;
    
    if (attempts >= this.MAX_TOKEN_ATTEMPTS_PER_IP) {
      return false;
    }
    
    this.suspiciousIPs.set(ip, attempts + 1);
    
    // Reset counter after window
    setTimeout(() => {
      const currentAttempts = this.suspiciousIPs.get(ip) || 0;
      if (currentAttempts > 0) {
        this.suspiciousIPs.set(ip, Math.max(0, currentAttempts - 1));
      }
    }, this.TOKEN_ATTEMPT_WINDOW_MS);
    
    return true;
  }

  /**
   * Check if token is blacklisted
   */
  private isTokenBlacklisted(token: string): boolean {
    const tokenHash = this.hashToken(token);
    return this.blockedTokens.has(tokenHash);
  }

  /**
   * Add token to blacklist (ASVS V3.2.2 - Session invalidation)
   */
  blacklistToken(token: string, reason: string, adminEmail?: string): void {
    const tokenHash = this.hashToken(token);
    this.blockedTokens.add(tokenHash);
    
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.SESSION_MANAGEMENT,
      severity: SecuritySeverity.MEDIUM,
      message: `JWT token blacklisted: ${reason}`,
      ip: 'system',
      userAgent: 'security-service',
      endpoint: 'token-blacklist',
      details: { 
        reason,
        adminEmail,
        tokenHash 
      }
    });
  }

  /**
   * Perform additional security checks on valid tokens
   */
  private performAdditionalSecurityChecks(payload: any, ip: string, userAgent: string): void {
    // Check for unusual token usage patterns
    if (payload.userId) {
      const recentAttempts = this.getRecentTokenAttempts(payload.userId);
      
      // Check for rapid token usage from different IPs (potential account compromise)
      const uniqueIPs = new Set(recentAttempts.map(attempt => attempt.ip));
      if (uniqueIPs.size > 3) { // More than 3 different IPs in recent attempts
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.HIGH,
          message: `JWT token used from multiple IPs: ${Array.from(uniqueIPs).join(', ')}`,
          ip,
          userAgent,
          endpoint: 'jwt-security-check',
          details: { 
            userId: payload.userId,
            uniqueIPs: Array.from(uniqueIPs),
            attemptCount: recentAttempts.length
          }
        });
      }
    }

    // Check token age vs. usage pattern
    if (payload.iat) {
      const tokenAge = Date.now() / 1000 - payload.iat;
      const maxReasonableAge = 24 * 60 * 60; // 24 hours
      
      if (tokenAge > maxReasonableAge) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.MEDIUM,
          message: 'Very old JWT token still in use',
          ip,
          userAgent,
          endpoint: 'jwt-security-check',
          details: { 
            tokenAge: Math.round(tokenAge / 3600) + ' hours',
            userId: payload.userId
          }
        });
      }
    }
  }

  /**
   * Record a token validation attempt
   */
  private recordTokenAttempt(token: string, success: boolean, ip: string, userAgent: string, errorReason?: string): void {
    const tokenHash = this.hashToken(token);
    const attempt: TokenAttempt = {
      token: tokenHash,
      timestamp: new Date(),
      success,
      ip,
      userAgent,
      errorReason
    };

    const attempts = this.tokenAttempts.get(tokenHash) || [];
    attempts.push(attempt);
    this.tokenAttempts.set(tokenHash, attempts);
  }

  /**
   * Get recent token attempts for a user/token
   */
  private getRecentTokenAttempts(userId: string): TokenAttempt[] {
    const cutoff = new Date(Date.now() - this.TOKEN_ATTEMPT_WINDOW_MS);
    const allAttempts: TokenAttempt[] = [];
    
    for (const attempts of this.tokenAttempts.values()) {
      const recentAttempts = attempts.filter(attempt => 
        attempt.timestamp > cutoff
      );
      allAttempts.push(...recentAttempts);
    }
    
    return allAttempts;
  }

  /**
   * Hash token for secure storage and comparison
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Clean up old token attempts to prevent memory leaks
   */
  private cleanupOldAttempts(): void {
    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours
    
    for (const [tokenHash, attempts] of this.tokenAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoff);
      if (recentAttempts.length === 0) {
        this.tokenAttempts.delete(tokenHash);
      } else {
        this.tokenAttempts.set(tokenHash, recentAttempts);
      }
    }

    // Clean up IP tracking
    this.suspiciousIPs.clear();
  }

  /**
   * Get token security statistics
   */
  getTokenStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    blacklistedTokens: number;
    suspiciousIPs: number;
  } {
    let totalAttempts = 0;
    let successfulAttempts = 0;
    let failedAttempts = 0;
    
    for (const attempts of this.tokenAttempts.values()) {
      totalAttempts += attempts.length;
      successfulAttempts += attempts.filter(a => a.success).length;
      failedAttempts += attempts.filter(a => !a.success).length;
    }
    
    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      blacklistedTokens: this.blockedTokens.size,
      suspiciousIPs: this.suspiciousIPs.size
    };
  }

  /**
   * Manual token revocation (admin function)
   */
  revokeToken(token: string, reason: string, adminEmail: string): boolean {
    try {
      this.blacklistToken(token, reason, adminEmail);
      return true;
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Failed to revoke JWT token',
        ip: 'system',
        userAgent: 'admin',
        endpoint: 'token-revocation',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          adminEmail,
          reason
        }
      });
      return false;
    }
  }
}

export const jwtSecurityService = new JWTSecurityService();