import crypto from 'crypto';
import { db } from './db';
import { consentRecords } from '../shared/schema';
import { eq, desc, count, and, gte } from 'drizzle-orm';

interface ConsentRecord {
  user_pseudonym: string; // Reproducible pseudonym for the user
  timestamp: string;
  ip_hash: string; // Hashed IP for analytics
  user_agent_hash: string; // Hashed user agent
  terms_version: string;
  consent_id: string; // Unique consent record ID
  verification_token: string; // For user to verify their own consent
}

interface ConsentProof {
  user_pseudonym: string;
  timestamp: string;
  terms_version: string;
  consent_id: string;
  verification_signature: string;
}

class ConsentLogger {
  private masterKey: string;
  private consentCache = new Map<string, { result: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  constructor() {
    this.masterKey = process.env.CONSENT_MASTER_KEY || 'readmyfineprint-master-2024';
    
    // Check if we're in development mode (only NODE_ENV, not database fallback)
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Consent logging initialized in development mode (database operations will be bypassed)');
    } else if (process.env.USE_DB_FALLBACK === 'true') {
      console.log('⚠️ Consent logging using database fallback mode');
    } else {
      console.log('✓ Consent logging enabled with PostgreSQL database');
    }
    
    // Clean cache every 5 minutes
    setInterval(() => {
      this.cleanCache();
    }, 5 * 60 * 1000);
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.consentCache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.consentCache.delete(key);
      }
    }
  }

  /**
   * Creates a consistent pseudonym for a user based on stable identifiers
   * For free users: Use session ID as stable identifier (since IP changes in load balancer)
   * For subscribers: based on user ID (portable across devices)
   */
  private createUserPseudonym(ip: string, userAgent: string, userId?: string, sessionId?: string): string {
    let stableIdentifier: string;
    
    // Normalize inputs to ensure consistency
    const normalizedIp = (ip || 'unknown').trim();
    const normalizedUserAgent = (userAgent || 'unknown').trim();
    const normalizedUserId = userId?.trim();
    const normalizedSessionId = sessionId?.trim();
    
    if (normalizedUserId && normalizedUserId !== 'anonymous' && !normalizedUserId.startsWith('session_')) {
      // Subscriber: Use user ID for cross-device consent
      stableIdentifier = `user:${normalizedUserId}`;
    } else if (normalizedSessionId && (normalizedSessionId.startsWith('session_') || normalizedSessionId.length > 10)) {
      // Free user with session: Use session ID as stable identifier (IP changes in load balancer)
      // Accept both client sessions (session_xxx) and server sessions (long hex strings)
      stableIdentifier = `session:${normalizedSessionId}`;
    } else {
      // Fallback: Use device fingerprint for per-machine consent
      stableIdentifier = `device:${normalizedIp}:${normalizedUserAgent}`;
    }
    
    const pseudonym = crypto
      .createHmac('sha256', this.masterKey)
      .update(stableIdentifier)
      .digest('hex')
      .substring(0, 24); // Use first 24 chars as pseudonym
      
    console.log(`Generated pseudonym ${pseudonym} from identifier: ${stableIdentifier.substring(0, 50)}...`);
    return pseudonym;
  }

  /**
   * Create a verification token that users can use to prove their consent
   */
  private createVerificationToken(userPseudonym: string, timestamp: string): string {
    return crypto
      .createHmac('sha256', this.masterKey)
      .update(`${userPseudonym}:${timestamp}:verification`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Hash sensitive data (IP, User Agent) for analytics while protecting privacy
   */
  private hashSensitiveData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data + this.masterKey) // Add master key as salt
      .digest('hex')
      .substring(0, 12);
  }

  /**
   * Generate unique consent ID
   */
  private generateConsentId(): string {
    return crypto.randomBytes(12).toString('hex');
  }

  /**
   * Log consent with pseudonymization for verifiability
   */
  async logConsent(req: any): Promise<{
    success: boolean;
    consentId?: string;
    verificationToken?: string;
    userPseudonym?: string;
    message: string;
  }> {
    try {
      // Check if we're in development mode and bypass consent logging
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Bypassing consent logging');
        return {
          success: true,
          consentId: 'dev-consent-' + Date.now(),
          verificationToken: 'dev-token',
          userPseudonym: 'dev-user',
          message: 'Development mode - consent logging bypassed'
        };
      }
      const timestamp = new Date().toISOString();
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userId = req.user?.id; // Get user ID if authenticated

      console.log(`Logging consent - IP: ${ip}, UA: ${userAgent?.substring(0, 20)}..., User: ${userId || 'none'}, Session: ${req.sessionId || 'none'}`);

      const userPseudonym = this.createUserPseudonym(ip, userAgent, userId, req.sessionId);
      const consentId = this.generateConsentId();
      const verificationToken = this.createVerificationToken(userPseudonym, timestamp);

      // Check if user already has recent consent (within last hour) to prevent duplicates
      const recentConsent = await db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.userPseudonym, userPseudonym))
        .orderBy(desc(consentRecords.createdAt))
        .limit(1);

      if (recentConsent.length > 0) {
        const lastConsent = recentConsent[0];
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (lastConsent.createdAt > hourAgo) {
          // Return existing consent instead of creating duplicate
          return {
            success: true,
            consentId: lastConsent.consentId,
            verificationToken: lastConsent.verificationToken,
            userPseudonym: lastConsent.userPseudonym,
            message: 'Consent already recorded recently'
          };
        }
      }

      // Store in PostgreSQL database
      await db.insert(consentRecords).values({
        consentId,
        userPseudonym,
        ipHash: this.hashSensitiveData(ip),
        userAgentHash: this.hashSensitiveData(userAgent),
        termsVersion: '1.0',
        verificationToken
      });

      // Clear cache for this user since consent status changed
      const cacheKey = `verify:${userPseudonym}`;
      this.consentCache.delete(cacheKey);

      console.log(`Consent logged - ID: ${consentId}, Pseudonym: ${userPseudonym}`);

      return {
        success: true,
        consentId,
        verificationToken,
        userPseudonym,
        message: 'Consent logged successfully'
      };

    } catch (error) {
      console.error('Error logging consent:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify that a user consented within the last 30 days
   */
  async verifyConsent(req: any): Promise<ConsentProof | null> {
    try {
      // Check if we're in development mode and bypass consent verification
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Bypassing consent verification');
        return {
          user_pseudonym: 'dev-user',
          timestamp: new Date().toISOString(),
          terms_version: '1.0',
          consent_id: 'dev-consent',
          verification_signature: 'dev-signature'
        };
      }
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userPseudonym = this.createUserPseudonym(ip, userAgent);

      // Find the latest consent record for this user
      const consentRecord = await db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.userPseudonym, userPseudonym))
        .orderBy(desc(consentRecords.createdAt))
        .limit(1);

      if (!consentRecord.length) return null;

      const record = consentRecord[0];
      const timestamp = record.createdAt.toISOString();

      const verificationSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(`${record.userPseudonym}:${timestamp}:${record.termsVersion}`)
        .digest('hex');

      return {
        user_pseudonym: record.userPseudonym,
        timestamp,
        terms_version: record.termsVersion,
        consent_id: record.consentId,
        verification_signature: verificationSignature
      };

    } catch (error) {
      console.error('Error verifying consent:', error);
      return null;
    }
  }

  /**
   * Verify that a specific user has consented
   * This allows proving consent for a specific user/browser combination
   */
  async verifyUserConsent(ip: string, userAgent: string, userId?: string, sessionId?: string): Promise<ConsentProof | null> {
    try {
      // Check if we're in development mode and bypass consent verification
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Bypassing user consent verification');
        return {
          user_pseudonym: 'dev-user',
          timestamp: new Date().toISOString(),
          terms_version: '1.0',
          consent_id: 'dev-consent',
          verification_signature: 'dev-signature'
        };
      }
      const userPseudonym = this.createUserPseudonym(ip, userAgent, userId, sessionId);
      console.log(`Verifying consent for pseudonym: ${userPseudonym} (IP: ${ip}, UA: ${userAgent?.substring(0, 20)}..., User: ${userId || 'none'}, Session: ${sessionId?.substring(0, 16) || 'none'})`);
      
      const cacheKey = `verify:${userPseudonym}`;

      // Check cache first
      const cached = this.consentCache.get(cacheKey);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        console.log(`Using cached consent result for ${userPseudonym}: ${!!cached.result}`);
        return cached.result;
      }

      // Find the latest consent record for this user
      const consentRecord = await db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.userPseudonym, userPseudonym))
        .orderBy(desc(consentRecords.createdAt))
        .limit(1);

      let result: ConsentProof | null = null;

      if (consentRecord.length > 0) {
        const record = consentRecord[0];
        const timestamp = record.createdAt.toISOString();

        // Create verification signature
        const verificationSignature = crypto
          .createHmac('sha256', this.masterKey)
          .update(`${record.userPseudonym}:${timestamp}:${record.termsVersion}`)
          .digest('hex');

        result = {
          user_pseudonym: record.userPseudonym,
          timestamp,
          terms_version: record.termsVersion,
          consent_id: record.consentId,
          verification_signature: verificationSignature
        };
      }

      // Cache the result
      this.consentCache.set(cacheKey, { result, timestamp: now });
      console.log(`Consent verification result for ${userPseudonym}: ${!!result} ${result ? `(ID: ${result.consent_id})` : ''}`);
      return result;

    } catch (error) {
      console.error('Error verifying user consent:', error);
      return null;
    }
  }

  /**
   * Allow users to verify their own consent using their verification token
   */
  async verifyConsentByToken(consentId: string, verificationToken: string): Promise<ConsentProof | null> {
    try {
      // Find the consent record by ID and verification token
      const consentRecord = await db
        .select()
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.consentId, consentId),
            eq(consentRecords.verificationToken, verificationToken)
          )
        )
        .limit(1);

      if (!consentRecord.length) return null;

      const record = consentRecord[0];
      const timestamp = record.createdAt.toISOString();

      const verificationSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(`${record.userPseudonym}:${timestamp}:${record.termsVersion}`)
        .digest('hex');

      return {
        user_pseudonym: record.userPseudonym,
        timestamp,
        terms_version: record.termsVersion,
        consent_id: record.consentId,
        verification_signature: verificationSignature
      };

    } catch (error) {
      console.error('Error verifying consent by token:', error);
      return null;
    }
  }

  /**
   * Revoke user consent by removing their consent record
   */
  async revokeConsent(ip: string, userAgent: string, userId?: string, sessionId?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const userPseudonym = this.createUserPseudonym(ip, userAgent, userId, sessionId);

      // Clear cache for this user
      const cacheKey = `verify:${userPseudonym}`;
      this.consentCache.delete(cacheKey);

      // Delete all consent records for this user
      const deletedRecords = await db
        .delete(consentRecords)
        .where(eq(consentRecords.userPseudonym, userPseudonym));

      console.log(`Consent revoked for pseudonym: ${userPseudonym}`);

      return {
        success: true,
        message: 'Consent successfully revoked'
      };

    } catch (error) {
      console.error('Error revoking consent:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get consent statistics
   */
  async getConsentStats(): Promise<{
    total: number;
    unique_users: number;
    today: number;
  } | null> {
    try {
      // Get total consent records
      const totalResult = await db
        .select({ count: count() })
        .from(consentRecords);

      const total = totalResult[0]?.count || 0;

      // Get unique users count
      const uniqueUsersResult = await db
        .selectDistinct({ userPseudonym: consentRecords.userPseudonym })
        .from(consentRecords);

      const unique_users = uniqueUsersResult.length;

      // Get today's consent records (since midnight UTC)
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const todayResult = await db
        .select({ count: count() })
        .from(consentRecords)
        .where(gte(consentRecords.createdAt, todayStart));

      const today = todayResult[0]?.count || 0;

      return {
        total,
        unique_users,
        today
      };

    } catch (error) {
      console.error('Error getting consent stats:', error);
      return null;
    }
  }
}

export const consentLogger = new ConsentLogger();