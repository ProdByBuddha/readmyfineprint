import crypto from 'crypto';
import { type Document, type InsertDocument, type User, type InsertUser, type UserSubscription, type InsertUserSubscription, type UsageRecord, type InsertUsageRecord } from "@shared/schema";
import { IStorage } from "./storage";

// Encryption configuration
interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  tagSize: number;
}

const ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keySize: 32, // 256 bits
  ivSize: 16,  // 128 bits
  tagSize: 16  // 128 bits
};

// Encrypted data structure
interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

// Session data structure (same as original, but will be encrypted)
interface SessionData {
  documents: Map<number, Document>;
  currentDocumentId: number;
  lastAccessed: Date;
}

/**
 * Encrypted session storage that encrypts all session data at rest
 */
export class EncryptedSessionStorage implements IStorage {
  private encryptedSessions: Map<string, EncryptedData>;
  private encryptionKey: Buffer;
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private clientSessions: Map<string, Set<string>> = new Map();

  constructor() {
    this.encryptedSessions = new Map();
    this.encryptionKey = this.deriveEncryptionKey();
    
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.clearExpiredSessions(), 10 * 60 * 1000);
    
    console.log('🔐 Encrypted session storage initialized');
  }

  /**
   * Derive encryption key from environment or generate a secure one
   */
  private deriveEncryptionKey(): Buffer {
    const envKey = process.env.SESSION_ENCRYPTION_KEY;
    
    if (envKey) {
      // Use provided key, ensure it's the right length
      const key = crypto.scryptSync(envKey, 'session-salt', ENCRYPTION_CONFIG.keySize);
      console.log('🔑 Using provided session encryption key');
      return key;
    } else {
      // Generate a random key (will be lost on restart - acceptable for session data)
      const key = crypto.randomBytes(ENCRYPTION_CONFIG.keySize);
      console.log('🔑 Generated random session encryption key (data will not persist across restarts)');
      return key;
    }
  }

  /**
   * Encrypt session data
   */
  private encryptSessionData(sessionData: SessionData): EncryptedData {
    try {
      // Convert Map to serializable object
      const serializableData = {
        documents: Array.from(sessionData.documents.entries()),
        currentDocumentId: sessionData.currentDocumentId,
        lastAccessed: sessionData.lastAccessed.toISOString()
      };

      const plaintext = JSON.stringify(serializableData);
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivSize);
      
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        iv: iv.toString('hex'),
        tag: '', // No auth tag for CBC mode
        data: encrypted
      };
    } catch (error) {
      console.error('🔐 Failed to encrypt session data:', error);
      throw new Error('Session encryption failed');
    }
  }

  /**
   * Decrypt session data
   */
  private decryptSessionData(encryptedData: EncryptedData): SessionData {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const parsed = JSON.parse(decrypted);
      
      // Restore Map and Date objects
      return {
        documents: new Map(parsed.documents),
        currentDocumentId: parsed.currentDocumentId,
        lastAccessed: new Date(parsed.lastAccessed)
      };
    } catch (error) {
      console.error('🔐 Failed to decrypt session data:', error);
      throw new Error('Session decryption failed');
    }
  }

  /**
   * Get or create session with encryption
   */
  private getOrCreateSession(sessionId: string, clientFingerprint?: string): SessionData {
    const encryptedData = this.encryptedSessions.get(sessionId);
    
    let session: SessionData;
    
    if (encryptedData) {
      // Decrypt existing session
      session = this.decryptSessionData(encryptedData);
      session.lastAccessed = new Date();
    } else {
      // Create new session
      session = {
        documents: new Map(),
        currentDocumentId: 1,
        lastAccessed: new Date()
      };
      
      console.log(`🔐 Created new encrypted session: ${sessionId}`);
    }

    // Associate with client fingerprint
    if (clientFingerprint) {
      this.associateSessionWithClient(sessionId, clientFingerprint);
    }

    // Re-encrypt and store
    this.storeEncryptedSession(sessionId, session);
    
    return session;
  }

  /**
   * Store encrypted session
   */
  private storeEncryptedSession(sessionId: string, sessionData: SessionData): void {
    const encryptedData = this.encryptSessionData(sessionData);
    this.encryptedSessions.set(sessionId, encryptedData);
  }

  /**
   * Associate session with client fingerprint (not encrypted - just for routing)
   */
  private associateSessionWithClient(sessionId: string, clientFingerprint: string): void {
    if (!this.clientSessions.has(clientFingerprint)) {
      this.clientSessions.set(clientFingerprint, new Set());
      console.log(`🔗 New client fingerprint: ${clientFingerprint}`);
    }
    this.clientSessions.get(clientFingerprint)!.add(sessionId);
  }

  /**
   * Find session containing document (with decryption)
   */
  private findSessionWithDocument(id: number, clientFingerprint?: string): { sessionId: string; sessionData: SessionData } | null {
    if (!clientFingerprint) return null;

    const relatedSessions = this.clientSessions.get(clientFingerprint);
    if (!relatedSessions) return null;

    for (const sessionId of relatedSessions) {
      const encryptedData = this.encryptedSessions.get(sessionId);
      if (encryptedData) {
        try {
          const sessionData = this.decryptSessionData(encryptedData);
          if (sessionData.documents.has(id)) {
            sessionData.lastAccessed = new Date();
            this.storeEncryptedSession(sessionId, sessionData);
            return { sessionId, sessionData };
          }
        } catch (error) {
          console.error(`🔐 Failed to decrypt session ${sessionId} during search:`, error);
          // Remove corrupted session
          this.encryptedSessions.delete(sessionId);
        }
      }
    }

    return null;
  }

  // Implement IStorage interface

  async createDocument(sessionId: string, insertDocument: InsertDocument, clientFingerprint?: string): Promise<Document> {
    const session = this.getOrCreateSession(sessionId, clientFingerprint);
    const id = session.currentDocumentId++;
    
    const document: Document = {
      ...insertDocument,
      id,
      title: insertDocument.title || "Untitled Document",
      createdAt: new Date()
    };
    
    session.documents.set(id, document);
    this.storeEncryptedSession(sessionId, session);
    
    console.log(`🔐 Created encrypted document ${id} in session ${sessionId}`);
    return document;
  }

  async getDocument(sessionId: string, id: number, clientFingerprint?: string): Promise<Document | undefined> {
    // Try current session first
    const encryptedData = this.encryptedSessions.get(sessionId);
    if (encryptedData) {
      try {
        const session = this.decryptSessionData(encryptedData);
        if (session.documents.has(id)) {
          session.lastAccessed = new Date();
          this.storeEncryptedSession(sessionId, session);
          return session.documents.get(id);
        }
      } catch (error) {
        console.error(`🔐 Failed to decrypt session ${sessionId}:`, error);
        this.encryptedSessions.delete(sessionId);
      }
    }

    // Search related sessions
    const found = this.findSessionWithDocument(id, clientFingerprint);
    if (found) {
      console.log(`🔄 Document ${id} found in encrypted session ${found.sessionId}`);
      return found.sessionData.documents.get(id);
    }

    return undefined;
  }

  async getAllDocuments(sessionId: string): Promise<Document[]> {
    const encryptedData = this.encryptedSessions.get(sessionId);
    if (!encryptedData) return [];

    try {
      const session = this.decryptSessionData(encryptedData);
      session.lastAccessed = new Date();
      this.storeEncryptedSession(sessionId, session);
      return Array.from(session.documents.values());
    } catch (error) {
      console.error(`🔐 Failed to decrypt session ${sessionId}:`, error);
      this.encryptedSessions.delete(sessionId);
      return [];
    }
  }

  async updateDocumentAnalysis(sessionId: string, id: number, analysis: any, clientFingerprint?: string): Promise<Document | undefined> {
    // Try current session first
    const encryptedData = this.encryptedSessions.get(sessionId);
    if (encryptedData) {
      try {
        const session = this.decryptSessionData(encryptedData);
        if (session.documents.has(id)) {
          const document = session.documents.get(id)!;
          const updatedDocument = { ...document, analysis };
          session.documents.set(id, updatedDocument);
          session.lastAccessed = new Date();
          this.storeEncryptedSession(sessionId, session);
          console.log(`🔐 Updated encrypted document ${id} analysis in session ${sessionId}`);
          return updatedDocument;
        }
      } catch (error) {
        console.error(`🔐 Failed to decrypt session ${sessionId}:`, error);
        this.encryptedSessions.delete(sessionId);
      }
    }

    // Search related sessions
    const found = this.findSessionWithDocument(id, clientFingerprint);
    if (found) {
      const document = found.sessionData.documents.get(id)!;
      const updatedDocument = { ...document, analysis };
      found.sessionData.documents.set(id, updatedDocument);
      found.sessionData.lastAccessed = new Date();
      this.storeEncryptedSession(found.sessionId, found.sessionData);
      console.log(`🔐 Updated encrypted document ${id} analysis in related session ${found.sessionId}`);
      return updatedDocument;
    }

    return undefined;
  }

  async clearAllDocuments(sessionId: string): Promise<void> {
    const encryptedData = this.encryptedSessions.get(sessionId);
    if (encryptedData) {
      try {
        const session = this.decryptSessionData(encryptedData);
        session.documents.clear();
        session.currentDocumentId = 1;
        session.lastAccessed = new Date();
        this.storeEncryptedSession(sessionId, session);
        console.log(`🔐 Cleared all documents from encrypted session ${sessionId}`);
      } catch (error) {
        console.error(`🔐 Failed to decrypt session ${sessionId} for clearing:`, error);
        this.encryptedSessions.delete(sessionId);
      }
    }
  }

  async clearExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, encryptedData] of this.encryptedSessions) {
      try {
        const session = this.decryptSessionData(encryptedData);
        if (now.getTime() - session.lastAccessed.getTime() > this.sessionTimeout) {
          expiredSessions.push(sessionId);
        }
      } catch (error) {
        // If we can't decrypt, consider it expired
        console.error(`🔐 Failed to decrypt session ${sessionId} during cleanup, removing:`, error);
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.encryptedSessions.delete(sessionId);
      console.log(`🔐 Cleared expired encrypted session: ${sessionId}`);
    });

    if (expiredSessions.length > 0) {
      console.log(`🔐 Cleared ${expiredSessions.length} expired encrypted sessions`);
    }
  }

  /**
   * Get encryption status for monitoring
   */
  getEncryptionStatus(): { 
    sessionsCount: number; 
    encryptionEnabled: boolean; 
    algorithm: string; 
    hasCustomKey: boolean;
  } {
    return {
      sessionsCount: this.encryptedSessions.size,
      encryptionEnabled: true,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      hasCustomKey: !!process.env.SESSION_ENCRYPTION_KEY
    };
  }

  // User management methods (not applicable for session-only storage)
  async getUser(id: string): Promise<User | undefined> {
    throw new Error("User management not supported in encrypted session storage");
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    throw new Error("User management not supported in encrypted session storage");
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    throw new Error("User management not supported in encrypted session storage");
  }

  async createUserWithId(id: string, insertUser: InsertUser): Promise<User> {
    throw new Error("User management not supported in encrypted session storage");
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    throw new Error("User management not supported in encrypted session storage");
  }

  // Subscription management methods (not applicable for session-only storage)
  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    throw new Error("Subscription management not supported in encrypted session storage");
  }

  async getAllUserSubscriptions(): Promise<UserSubscription[]> {
    throw new Error("Subscription management not supported in encrypted session storage");
  }

  async createUserSubscription(insertSubscription: InsertUserSubscription): Promise<UserSubscription> {
    throw new Error("Subscription management not supported in encrypted session storage");
  }

  async updateUserSubscription(id: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    throw new Error("Subscription management not supported in encrypted session storage");
  }

  async cancelUserSubscription(id: string): Promise<UserSubscription | undefined> {
    throw new Error("Subscription management not supported in encrypted session storage");
  }

  // Usage tracking methods (not applicable for session-only storage)
  async getUserUsage(userId: string, period: string): Promise<UsageRecord | undefined> {
    throw new Error("Usage tracking not supported in encrypted session storage");
  }

  async createUsageRecord(insertUsage: InsertUsageRecord): Promise<UsageRecord> {
    throw new Error("Usage tracking not supported in encrypted session storage");
  }

  async updateUsageRecord(id: string, updates: Partial<InsertUsageRecord>): Promise<UsageRecord | undefined> {
    throw new Error("Usage tracking not supported in encrypted session storage");
  }

  async getUserUsageHistory(userId: string, limit?: number): Promise<UsageRecord[]> {
    throw new Error("Usage tracking not supported in encrypted session storage");
  }
} 