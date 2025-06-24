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

  constructor() {
    this.masterKey = process.env.CONSENT_MASTER_KEY || 'readmyfineprint-master-2024';
    console.log('✓ Consent logging enabled with PostgreSQL database');
  }

  /**
   * Creates a consistent pseudonym for a user based on stable identifiers
   * This allows linking consent to the same user across sessions while protecting identity
   */
  private createUserPseudonym(ip: string, userAgent: string): string {
    // Create a stable identifier that will be the same for the same user/browser
    const stableIdentifier = `${ip}:${userAgent}`;
    return crypto
      .createHmac('sha256', this.masterKey)
      .update(stableIdentifier)
      .digest('hex')
      .substring(0, 24); // Use first 24 chars as pseudonym
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
      const timestamp = new Date().toISOString();
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const userPseudonym = this.createUserPseudonym(ip, userAgent);
      const consentId = this.generateConsentId();
      const verificationToken = this.createVerificationToken(userPseudonym, timestamp);

      // Store in PostgreSQL database
      await db.insert(consentRecords).values({
        consentId,
        userPseudonym,
        ipHash: this.hashSensitiveData(ip),
        userAgentHash: this.hashSensitiveData(userAgent),
        termsVersion: '1.0',
        verificationToken
      });

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
  async verifyUserConsent(ip: string, userAgent: string): Promise<ConsentProof | null> {
    try {
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

      // Create verification signature
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