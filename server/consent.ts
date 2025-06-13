import crypto from 'crypto';

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
  private dbUrl: string;
  private masterKey: string;

  constructor() {
    this.dbUrl = process.env.REPLIT_DB_URL || '';
    this.masterKey = process.env.CONSENT_MASTER_KEY || 'readmyfineprint-master-2024';

    if (!this.dbUrl) {
      console.warn('REPLIT_DB_URL not found. Consent logging will be disabled.');
    } else {
      console.log('✓ Consent logging enabled with Replit KV store');
    }
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
   * Hash sensitive data for analytics while protecting privacy
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
    if (!this.dbUrl) {
      return {
        success: false,
        message: 'Consent logging unavailable - no database URL'
      };
    }

    try {
      const timestamp = new Date().toISOString();
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const userPseudonym = this.createUserPseudonym(ip, userAgent);
      const consentId = this.generateConsentId();
      const verificationToken = this.createVerificationToken(userPseudonym, timestamp);

      const consentRecord: ConsentRecord = {
        user_pseudonym: userPseudonym,
        timestamp,
        ip_hash: this.hashSensitiveData(ip),
        user_agent_hash: this.hashSensitiveData(userAgent),
        terms_version: '1.0',
        consent_id: consentId,
        verification_token: verificationToken
      };

      // Store in Replit KV with consent- prefix
      const key = `consent-${consentId}`;
      const response = await fetch(this.dbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `${key}=${encodeURIComponent(JSON.stringify(consentRecord))}`
      });

      if (!response.ok) {
        throw new Error(`Failed to log consent: ${response.statusText}`);
      }

      // Also store by user pseudonym for lookup
      const userKey = `user-consent-${userPseudonym}`;
      await fetch(this.dbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `${userKey}=${encodeURIComponent(JSON.stringify({
          latest_consent_id: consentId,
          latest_timestamp: timestamp,
          terms_version: '1.0'
        }))}`
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
   * Verify that a specific user has consented
   * This allows proving consent for a specific user/browser combination
   */
  async verifyUserConsent(ip: string, userAgent: string): Promise<ConsentProof | null> {
    if (!this.dbUrl) return null;

    try {
      const userPseudonym = this.createUserPseudonym(ip, userAgent);
      const userKey = `user-consent-${userPseudonym}`;

      const response = await fetch(`${this.dbUrl}/${userKey}`);
      if (!response.ok) return null;

      const userData = JSON.parse(await response.text());
      const consentKey = `consent-${userData.latest_consent_id}`;

      const consentResponse = await fetch(`${this.dbUrl}/${consentKey}`);
      if (!consentResponse.ok) return null;

      const consentRecord: ConsentRecord = JSON.parse(await consentResponse.text());

      // Create verification signature
      const verificationSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(`${consentRecord.user_pseudonym}:${consentRecord.timestamp}:${consentRecord.terms_version}`)
        .digest('hex');

      return {
        user_pseudonym: consentRecord.user_pseudonym,
        timestamp: consentRecord.timestamp,
        terms_version: consentRecord.terms_version,
        consent_id: consentRecord.consent_id,
        verification_signature: verificationSignature
      };

    } catch (error) {
      console.error('Error verifying consent:', error);
      return null;
    }
  }

  /**
   * Allow users to verify their own consent using their verification token
   */
  async verifyConsentByToken(consentId: string, verificationToken: string): Promise<ConsentProof | null> {
    if (!this.dbUrl) return null;

    try {
      const consentKey = `consent-${consentId}`;
      const response = await fetch(`${this.dbUrl}/${consentKey}`);

      if (!response.ok) return null;

      const consentRecord: ConsentRecord = JSON.parse(await response.text());

      // Verify the token matches
      if (consentRecord.verification_token !== verificationToken) {
        return null;
      }

      const verificationSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(`${consentRecord.user_pseudonym}:${consentRecord.timestamp}:${consentRecord.terms_version}`)
        .digest('hex');

      return {
        user_pseudonym: consentRecord.user_pseudonym,
        timestamp: consentRecord.timestamp,
        terms_version: consentRecord.terms_version,
        consent_id: consentRecord.consent_id,
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
    if (!this.dbUrl) return null;

    try {
      // List all consent keys
      const response = await fetch(`${this.dbUrl}?prefix=consent-`);
      if (!response.ok) return null;

      const keys = await response.text();
      const consentKeys = keys.split('\n').filter(k => k.trim() && k.startsWith('consent-'));

      // List all user keys for unique user count
      const userResponse = await fetch(`${this.dbUrl}?prefix=user-consent-`);
      const userKeys = userResponse.ok ?
        (await userResponse.text()).split('\n').filter(k => k.trim() && k.startsWith('user-consent-')) : [];

      return {
        total: consentKeys.length,
        unique_users: userKeys.length,
        today: 0 // Would need to fetch and parse timestamps for accurate count
      };

    } catch (error) {
      console.error('Error getting consent stats:', error);
      return null;
    }
  }
}

export const consentLogger = new ConsentLogger();
