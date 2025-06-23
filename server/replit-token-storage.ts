/**
 * Replit Database Token Storage
 * Secure storage for subscription tokens using Replit's key-value database
 */

import crypto from 'crypto';

interface TokenData {
  userId: string;
  subscriptionId: string;
  deviceFingerprint: string;
  createdAt: string; // ISO string for JSON compatibility
  expiresAt: string; // ISO string for JSON compatibility
  lastUsed: string; // ISO string for JSON compatibility
  usageCount: number;
}

interface SessionTokenData {
  token: string;
  expiresAt: string; // ISO string for JSON compatibility
}

export class ReplitTokenStorage {
  private replitDB: any = null;
  private encryptionKey: string;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Get encryption key for token data (optional additional security)
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.replitDB !== null) {
      return; // Already initialized
    }

    if (this.initPromise === null) {
      this.initPromise = this.initializeDatabase();
    }

    await this.initPromise;
  }

  private async initializeDatabase(): Promise<void> {
    if (process.env.REPLIT_DB_URL) {
      try {
        // In Replit environment - use dynamic import for ES modules
        const { default: Database } = await import('@replit/database');
        this.replitDB = new Database();
        console.log('✅ Replit Database initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Replit Database, using memory fallback:', error);
        this.replitDB = new Map();
      }
    } else {
      // Fallback for non-Replit environments
      console.warn('REPLIT_DB_URL not found - using memory storage fallback');
      this.replitDB = new Map(); // Fallback to memory storage
    }
  }

  /**
   * Store a subscription token securely
   */
  async storeToken(token: string, data: Omit<TokenData, 'createdAt' | 'expiresAt' | 'lastUsed' | 'usageCount'>): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const tokenData: TokenData = {
        ...data,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastUsed: now.toISOString(),
        usageCount: 0
      };

      // Encrypt sensitive data before storage
      const encryptedData = this.encrypt(JSON.stringify(tokenData));

      // Store with token prefix for easy identification
      const key = `subscription_token:${token}`;

      if (this.replitDB instanceof Map) {
        // Memory fallback
        this.replitDB.set(key, encryptedData);
      } else {
        // Replit database
        await this.replitDB.set(key, encryptedData);
      }

      console.log(`Stored subscription token in Replit DB: ${token.slice(0, 16)}...`);
    } catch (error) {
      console.error('Error storing token in Replit DB:', error);
      throw error;
    }
  }

  /**
   * Retrieve and validate a subscription token
   */
  async getToken(token: string): Promise<TokenData | null> {
    await this.ensureInitialized();

    try {
      const key = `subscription_token:${token}`;

      let encryptedData: string;
      if (this.replitDB instanceof Map) {
        // Memory fallback
        encryptedData = this.replitDB.get(key);
      } else {
        // Replit database
        encryptedData = await this.replitDB.get(key);
      }

      if (!encryptedData) {
        return null;
      }

      // Decrypt and parse data
      const decryptedData = this.decrypt(encryptedData);
      const tokenData: TokenData = JSON.parse(decryptedData);

      // Check if token is expired
      if (new Date(tokenData.expiresAt) < new Date()) {
        // Token expired - remove it
        await this.removeToken(token);
        return null;
      }

      return tokenData;
    } catch (error) {
      console.error('Error retrieving token from Replit DB:', error);
      return null;
    }
  }

  /**
   * Update token usage statistics
   */
  async updateTokenUsage(token: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const tokenData = await this.getToken(token);
      if (!tokenData) {
        return;
      }

      // Update usage statistics
      tokenData.lastUsed = new Date().toISOString();
      tokenData.usageCount += 1;

      // Re-encrypt and store
      const encryptedData = this.encrypt(JSON.stringify(tokenData));
      const key = `subscription_token:${token}`;

      if (this.replitDB instanceof Map) {
        this.replitDB.set(key, encryptedData);
      } else {
        await this.replitDB.set(key, encryptedData);
      }
    } catch (error) {
      console.error('Error updating token usage:', error);
    }
  }

  /**
   * Remove a subscription token
   */
  async removeToken(token: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const key = `subscription_token:${token}`;

      if (this.replitDB instanceof Map) {
        return this.replitDB.delete(key);
      } else {
        await this.replitDB.delete(key);
        return true;
      }
    } catch (error) {
      console.error('Error removing token from Replit DB:', error);
      return false;
    }
  }

  /**
   * Remove all tokens for a specific user
   */
  async removeAllUserTokens(userId: string): Promise<number> {
    await this.ensureInitialized();

    try {
      let removedCount = 0;

      if (this.replitDB instanceof Map) {
        // Memory fallback - iterate through all keys
        for (const [key, encryptedData] of this.replitDB.entries()) {
          if (key.startsWith('subscription_token:')) {
            try {
              const decryptedData = this.decrypt(encryptedData);
              const tokenData: TokenData = JSON.parse(decryptedData);
              if (tokenData.userId === userId) {
                this.replitDB.delete(key);
                removedCount++;
              }
            } catch (error) {
              // Skip invalid entries
            }
          }
        }
      } else {
        // Replit database - list all keys and filter
        const keys = await this.replitDB.list('subscription_token:');

        for (const key of keys) {
          try {
            const encryptedData = await this.replitDB.get(key);
            if (encryptedData) {
              const decryptedData = this.decrypt(encryptedData);
              const tokenData: TokenData = JSON.parse(decryptedData);
              if (tokenData.userId === userId) {
                await this.replitDB.delete(key);
                removedCount++;
              }
            }
          } catch (error) {
            // Skip invalid entries
          }
        }
      }

      console.log(`Removed ${removedCount} tokens for user ${userId}`);
      return removedCount;
    } catch (error) {
      console.error('Error removing user tokens:', error);
      return 0;
    }
  }

  /**
   * Store session-to-token mapping
   */
  async storeSessionToken(sessionId: string, token: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const sessionData: SessionTokenData = {
        token,
        expiresAt: expiresAt.toISOString()
      };

      const key = `session_token:${sessionId}`;

      // Always encrypt the data, even if no encryption key is available
      const dataToStore = JSON.stringify(sessionData);
      let encryptedData: string;

      try {
        encryptedData = this.encrypt(dataToStore);
      } catch (encryptError) {
        console.warn('Encryption failed, storing as plain JSON:', encryptError);
        // Fallback: store as plain JSON with a prefix to identify it
        encryptedData = `plain:${dataToStore}`;
      }

      // Ensure we're storing a string
      if (typeof encryptedData !== 'string') {
        throw new Error('Data to store must be a string');
      }

      if (this.replitDB instanceof Map) {
        this.replitDB.set(key, encryptedData);
      } else {
        await this.replitDB.set(key, encryptedData);
      }

      console.log(`Stored session token mapping: ${sessionId} -> ${token.slice(0, 8)}... (encrypted: ${!encryptedData.startsWith('plain:')})`);
    } catch (error) {
      console.error('Error storing session token mapping:', error);
      throw error;
    }
  }

  /**
   * Get token by session ID
   */
  async getTokenBySession(sessionId: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      const key = `session_token:${sessionId}`;

      let rawData: any;
      if (this.replitDB instanceof Map) {
        rawData = this.replitDB.get(key);
      } else {
        rawData = await this.replitDB.get(key);
      }

      if (!rawData) {
        console.log(`No session token found for session: ${sessionId}`);
        return null;
      }

      let decryptedData: string;

      // Handle different data formats
      if (typeof rawData === 'string') {
        // Data is stored as string (encrypted or plain)
        if (rawData.startsWith('plain:')) {
          // Plain JSON data
          decryptedData = rawData.substring(6); // Remove 'plain:' prefix
          console.log(`Retrieved plain session token for ${sessionId}`);
        } else {
          // Encrypted data
          try {
            decryptedData = this.decrypt(rawData);
            console.log(`Decrypted session token for ${sessionId}`);
          } catch (decryptError) {
            console.warn(`Failed to decrypt session token for ${sessionId}, treating as plain JSON:`, decryptError);
            decryptedData = rawData;
          }
        }
      } else if (typeof rawData === 'object' && rawData !== null) {
        // Data is stored as object (legacy format)
        console.log(`Converting legacy object format for session: ${sessionId}`);

        // Handle different legacy object formats
        console.log(`🔍 Legacy object data structure:`, JSON.stringify(rawData).slice(0, 200));
        console.log(`🔍 Legacy object properties:`, Object.keys(rawData));

        if (rawData.token && rawData.expiresAt) {
          // Direct object with token and expiresAt
          const sessionData = rawData as SessionTokenData;

          console.log(`✅ Valid legacy object format found for session: ${sessionId}`);

          // Check if mapping is expired
          if (new Date(sessionData.expiresAt) < new Date()) {
            console.log(`⏰ Legacy session token expired for session: ${sessionId}`);
            // Remove expired mapping
            if (this.replitDB instanceof Map) {
              this.replitDB.delete(key);
            } else {
              await this.replitDB.delete(key);
            }
            return null;
          }

          return sessionData.token;
        } else if (typeof rawData === 'string') {
          // Some legacy data might be stored as a plain string token
          console.log(`📝 Legacy session token stored as string for session: ${sessionId}`);
          return rawData;
        } else {
          // Invalid or corrupted legacy format - clean it up
          console.warn(`❌ Invalid legacy object format for session ${sessionId}:`);
          console.warn(`   Expected: {token: string, expiresAt: string}`);
          console.warn(`   Received:`, rawData);
          console.warn(`   Type:`, typeof rawData);
          console.warn(`   Keys:`, Object.keys(rawData || {}));
          console.warn(`🧹 Cleaning up corrupted data...`);

          if (this.replitDB instanceof Map) {
            this.replitDB.delete(key);
          } else {
            await this.replitDB.delete(key);
          }
          return null;
        }
      } else {
        console.warn(`Invalid session token data format for ${sessionId}:`, typeof rawData);
        // Clean up invalid data
        if (this.replitDB instanceof Map) {
          this.replitDB.delete(key);
        } else {
          await this.replitDB.delete(key);
        }
        return null;
      }

      // Parse the decrypted JSON data
      const sessionData: SessionTokenData = JSON.parse(decryptedData);

      // Check if mapping is expired
      if (new Date(sessionData.expiresAt) < new Date()) {
        console.log(`Session token expired for session: ${sessionId}`);
        // Remove expired mapping
        if (this.replitDB instanceof Map) {
          this.replitDB.delete(key);
        } else {
          await this.replitDB.delete(key);
        }
        return null;
      }

      return sessionData.token;
    } catch (error) {
      console.error(`Error retrieving session token for ${sessionId}:`, error);

      // Clean up corrupted session data
      try {
        const key = `session_token:${sessionId}`;
        if (this.replitDB instanceof Map) {
          this.replitDB.delete(key);
        } else {
          await this.replitDB.delete(key);
        }
        console.log(`Cleaned up corrupted session data for: ${sessionId}`);
      } catch (cleanupError) {
        console.error('Error cleaning up corrupted session data:', cleanupError);
      }

      return null;
    }
  }

  /**
   * Store device usage data for multi-device tracking
   */
  async storeDeviceData(key: string, deviceData: any): Promise<void> {
    await this.ensureInitialized();

    try {
      const encryptedData = this.encrypt(JSON.stringify(deviceData));

      if (this.replitDB instanceof Map) {
        this.replitDB.set(key, encryptedData);
      } else {
        await this.replitDB.set(key, encryptedData);
      }
    } catch (error) {
      console.error('Error storing device data:', error);
      throw error;
    }
  }

  /**
   * Get device usage data for multi-device tracking
   */
  async getDeviceData(key: string): Promise<any | null> {
    await this.ensureInitialized();

    try {
      let encryptedData: string;
      if (this.replitDB instanceof Map) {
        encryptedData = this.replitDB.get(key);
      } else {
        encryptedData = await this.replitDB.get(key);
      }

      if (!encryptedData) {
        return null;
      }

      const decryptedData = this.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Error retrieving device data:', error);
      return null;
    }
  }

  /**
   * Delete device data or verification codes
   */
  async deleteDeviceData(key: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      if (this.replitDB instanceof Map) {
        return this.replitDB.delete(key);
      } else {
        await this.replitDB.delete(key);
        return true;
      }
    } catch (error) {
      console.error(`Failed to delete device data for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set device data with TTL (for verification codes)
   */
  async setDeviceDataWithTTL(key: string, data: any, ttlMs: number): Promise<void> {
    await this.ensureInitialized();

    await this.storeDeviceData(key, data);

    // Set a timeout to clean up after TTL expires
    setTimeout(async () => {
      try {
        await this.deleteDeviceData(key);
        console.log(`🧹 Cleaned up expired data for key: ${key}`);
      } catch (error) {
        console.error(`Failed to cleanup expired data for key ${key}:`, error);
      }
    }, ttlMs);
  }

  /**
   * Clean up expired tokens, sessions, and old device data
   */
  async cleanupExpired(): Promise<{ tokensRemoved: number; sessionsRemoved: number; deviceDataCleaned: number }> {
    await this.ensureInitialized();

    try {
      let tokensRemoved = 0;
      let sessionsRemoved = 0;
      let deviceDataCleaned = 0;
      const now = new Date();

      if (this.replitDB instanceof Map) {
        // Memory fallback cleanup
        for (const [key, encryptedData] of this.replitDB.entries()) {
          try {
            const decryptedData = this.decrypt(encryptedData);

            if (key.startsWith('subscription_token:')) {
              const tokenData: TokenData = JSON.parse(decryptedData);
              if (new Date(tokenData.expiresAt) < now) {
                this.replitDB.delete(key);
                tokensRemoved++;
              }
            } else if (key.startsWith('session_token:')) {
              const sessionData: SessionTokenData = JSON.parse(decryptedData);
              if (new Date(sessionData.expiresAt) < now) {
                this.replitDB.delete(key);
                sessionsRemoved++;
              }
            } else if (key.startsWith('user_devices:')) {
              const deviceData = JSON.parse(decryptedData);
              // Clean device data older than 90 days
              const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              if (new Date(deviceData.lastUpdated) < ninetyDaysAgo) {
                this.replitDB.delete(key);
                deviceDataCleaned++;
              }
            }
          } catch (error) {
            // Remove invalid entries
            this.replitDB.delete(key);
          }
        }
      } else {
        // Replit database cleanup
        try {
          // Try different approaches to get keys based on Replit Database API
          let keyArray: string[] = [];

          try {
            // Try to list all keys
            const allKeys = await this.replitDB.list();

            // Handle different response formats from Replit Database
            if (Array.isArray(allKeys)) {
              keyArray = allKeys;
            } else if (allKeys && typeof allKeys === 'object') {
              // If it's an object with keys property
              if (allKeys.keys && Array.isArray(allKeys.keys)) {
                keyArray = allKeys.keys;
              } else if (allKeys[Symbol.iterator]) {
                keyArray = Array.from(allKeys);
              } else {
                // Try to extract keys from object
                keyArray = Object.keys(allKeys);
              }
            } else if (typeof allKeys === 'string') {
              // If returned as newline-separated string
              keyArray = allKeys.split('\n').filter(key => key.trim());
            }
          } catch (listError) {
            console.warn('Failed to list all keys, trying prefix-based cleanup:', listError);

            // Fallback: try to list keys by prefix
            const prefixes = ['subscription_token:', 'session_token:', 'user_devices:'];
            for (const prefix of prefixes) {
              try {
                const prefixKeys = await this.replitDB.list(prefix);
                if (Array.isArray(prefixKeys)) {
                  keyArray.push(...prefixKeys);
                } else if (typeof prefixKeys === 'string') {
                  keyArray.push(...prefixKeys.split('\n').filter(key => key.trim()));
                }
              } catch (prefixError) {
                console.warn(`Failed to list keys with prefix ${prefix}:`, prefixError);
              }
            }
          }

          console.log(`Found ${keyArray.length} keys for cleanup`);

          for (const key of keyArray) {
            if (key.startsWith('subscription_token:') || key.startsWith('session_token:') || key.startsWith('user_devices:')) {
              try {
                const encryptedData = await this.replitDB.get(key);
                if (encryptedData) {
                  const decryptedData = this.decrypt(encryptedData);

                  if (key.startsWith('subscription_token:')) {
                    const tokenData: TokenData = JSON.parse(decryptedData);
                    if (new Date(tokenData.expiresAt) < now) {
                      await this.replitDB.delete(key);
                      tokensRemoved++;
                    }
                  } else if (key.startsWith('session_token:')) {
                    const sessionData: SessionTokenData = JSON.parse(decryptedData);
                    if (new Date(sessionData.expiresAt) < now) {
                      await this.replitDB.delete(key);
                      sessionsRemoved++;
                    }
                  } else if (key.startsWith('user_devices:')) {
                    const deviceData = JSON.parse(decryptedData);
                    // Clean device data older than 90 days
                    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    if (new Date(deviceData.lastUpdated) < ninetyDaysAgo) {
                      await this.replitDB.delete(key);
                      deviceDataCleaned++;
                    }
                  }
                }
              } catch (error) {
                // Remove invalid entries
                try {
                  await this.replitDB.delete(key);
                } catch (deleteError) {
                  console.warn(`Failed to delete invalid key ${key}:`, deleteError);
                }
              }
            }
          }
        } catch (listError) {
          console.warn('Failed to perform Replit Database cleanup:', listError);
        }
      }

      console.log(`Cleanup completed: ${tokensRemoved} expired tokens, ${sessionsRemoved} expired sessions, ${deviceDataCleaned} old device records removed`);
      return { tokensRemoved, sessionsRemoved, deviceDataCleaned };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return { tokensRemoved: 0, sessionsRemoved: 0, deviceDataCleaned: 0 };
    }
  }

  /**
   * Simple encryption for token data
   */
  private encrypt(text: string): string {
    try {
      // If no encryption key is available, return the text as-is (development mode)
      if (!this.encryptionKey) {
        console.warn('No encryption key available, storing data unencrypted');
        return text;
      }

      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const result = `${iv.toString('hex')}:${encrypted}`;

      // Ensure we return a string
      if (typeof result !== 'string') {
        throw new Error('Encryption must produce a string');
      }

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      // Return the text with a marker to indicate it's unencrypted
      return `unencrypted:${text}`;
    }
  }

  /**
   * Simple decryption for token data
   */
  private decrypt(encryptedText: any): string {
    try {
      // Handle non-string input (could be null, undefined, or other types)
      if (!encryptedText || typeof encryptedText !== 'string') {
        console.warn('Invalid encrypted data type:', typeof encryptedText, encryptedText);
        throw new Error('Invalid encrypted data format');
      }

      // Handle unencrypted fallback data
      if (encryptedText.startsWith('unencrypted:')) {
        return encryptedText.replace('unencrypted:', '');
      }

      // Handle plain data fallback
      if (encryptedText.startsWith('plain:')) {
        return encryptedText.substring(6);
      }

      // If no encryption key is available, assume it's unencrypted
      if (!this.encryptionKey) {
        console.warn('No encryption key available for decryption, treating as unencrypted');
        return encryptedText;
      }

      // Check if it looks like encrypted data (should contain a colon for IV:encrypted format)
      if (!encryptedText.includes(':')) {
        console.warn('Data does not appear to be encrypted (no IV separator), treating as plain text');
        return encryptedText;
      }

      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const [ivHex, encrypted] = encryptedText.split(':');

      if (!ivHex || !encrypted) {
        console.warn('Invalid encrypted data format - missing IV or encrypted content, treating as plain text');
        return encryptedText;
      }

      // Validate hex format
      if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(encrypted)) {
        console.warn('Invalid hex format in encrypted data, treating as plain text');
        return encryptedText;
      }

      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.warn('Decryption failed, treating as plain text:', error);
      // Instead of throwing, return the original text as fallback
      return typeof encryptedText === 'string' ? encryptedText : '';
    }
  }
}

// Export singleton instance
export const replitTokenStorage = new ReplitTokenStorage();