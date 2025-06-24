import { type Document, type InsertDocument, type Consent, type User, type InsertUser, type UserSubscription, type InsertUserSubscription, type UsageRecord, type InsertUsageRecord } from "@shared/schema";

export interface IStorage {
  // Document management
  createDocument(sessionId: string, document: InsertDocument, clientFingerprint?: string): Promise<Document>;
  getDocument(sessionId: string, id: number, clientFingerprint?: string): Promise<Document | undefined>;
  getAllDocuments(sessionId: string): Promise<Document[]>;
  updateDocumentAnalysis(sessionId: string, id: number, analysis: any, clientFingerprint?: string): Promise<Document | undefined>;
  clearAllDocuments(sessionId: string): Promise<void>;
  clearExpiredSessions(): Promise<void>;
  getAllSessions(): Map<string, SessionData>;

  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  createUserWithId(id: string, insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Subscription management
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  getAllUserSubscriptions(): Promise<UserSubscription[]>;
  createUserSubscription(insertSubscription: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(id: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  cancelUserSubscription(id: string): Promise<UserSubscription | undefined>;

  // Usage tracking
  getUserUsage(userId: string, period: string): Promise<UsageRecord | undefined>;
  createUsageRecord(insertUsage: InsertUsageRecord): Promise<UsageRecord>;
  updateUsageRecord(id: string, updates: Partial<InsertUsageRecord>): Promise<UsageRecord | undefined>;
  getUserUsageHistory(userId: string, limit?: number): Promise<UsageRecord[]>;
}

interface SessionData {
  documents: Map<number, Document>;
  currentDocumentId: number;
  lastAccessed: Date;
}

export class SessionStorage {
  private sessions: Map<string, SessionData>;
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  // Track client fingerprints to handle session ID inconsistencies
  private clientSessions: Map<string, Set<string>> = new Map();

  constructor() {
    this.sessions = new Map();
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.clearExpiredSessions(), 10 * 60 * 1000);
  }

  private getOrCreateSession(sessionId: string, clientFingerprint?: string): SessionData {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        documents: new Map(),
        currentDocumentId: 1,
        lastAccessed: new Date()
      };
      this.sessions.set(sessionId, session);

      // Track this session for the client fingerprint
      if (clientFingerprint) {
        this.associateSessionWithClient(sessionId, clientFingerprint);
      }
    } else {
      session.lastAccessed = new Date();
    }
    return session;
  }

  private associateSessionWithClient(sessionId: string, clientFingerprint: string): void {
    if (!this.clientSessions.has(clientFingerprint)) {
      this.clientSessions.set(clientFingerprint, new Set());
      console.log(`🔗 New client fingerprint: ${clientFingerprint}`);
    }
    this.clientSessions.get(clientFingerprint)!.add(sessionId);
    // Only log first session association for a client
    if (this.clientSessions.get(clientFingerprint)!.size === 1) {
      console.log(`🔗 Associated session ${sessionId} with client ${clientFingerprint}`);
    }
  }

  async createDocument(sessionId: string, data: InsertDocument, clientFingerprint?: string, specifiedId?: number): Promise<Document> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        documents: new Map(),
        currentDocumentId: 1,
        lastAccessed: new Date(),
      };
      this.sessions.set(sessionId, session);
    }

    const documentId = specifiedId || session.currentDocumentId++;

    // If we're using a specified ID and it's higher than current, update the counter
    if (specifiedId && specifiedId >= session.currentDocumentId) {
      session.currentDocumentId = specifiedId + 1;
    }

    const document: Document = {
      id: documentId,
      title: data.title || "Untitled Document",
      content: data.content,
      fileType: data.fileType || "text",
      analysis: data.analysis || null,
      createdAt: new Date(),
    };

    session.documents.set(document.id, document);
    session.lastAccessed = new Date();

    // Track client fingerprint for session consolidation
    if (clientFingerprint) {
      if (!this.clientSessions.has(clientFingerprint)) {
        this.clientSessions.set(clientFingerprint, new Set());
      }
      this.clientSessions.get(clientFingerprint)!.add(sessionId);
    }

    return document;
  }

  async getDocument(sessionId: string, id: number, clientFingerprint?: string): Promise<Document | undefined> {
    let session = this.sessions.get(sessionId);

    // If document not found in current session, try related sessions from same client
    if (!session?.documents.has(id) && clientFingerprint) {
      console.log(`🔍 Document ${id} not in session ${sessionId}, searching related sessions for client ${clientFingerprint}`);
      const relatedSessions = this.clientSessions.get(clientFingerprint);
      if (relatedSessions) {
        console.log(`🔍 Found ${relatedSessions.size} related sessions: ${Array.from(relatedSessions).join(', ')}`);
        Array.from(relatedSessions).forEach(relatedSessionId => {
          const relatedSession = this.sessions.get(relatedSessionId);
          if (relatedSession?.documents.has(id)) {
            console.log(`🔄 Document ${id} found in related session ${relatedSessionId} for client ${clientFingerprint}`);
            relatedSession.lastAccessed = new Date();
            session = relatedSession; // Update reference to return correct document
          } else {
            const docCount = relatedSession?.documents.size || 0;
            console.log(`🔍 Session ${relatedSessionId} has ${docCount} documents, but not ID ${id}`);
          }
        });

        // Return the document if found in related session
        if (session?.documents.has(id)) {
          return session.documents.get(id);
        }
      } else {
        console.log(`🔍 No related sessions found for client ${clientFingerprint}`);
      }
    }

    if (!session) return undefined;
    session.lastAccessed = new Date();
    return session.documents.get(id);
  }

  async getAllDocuments(sessionId: string): Promise<Document[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    session.lastAccessed = new Date();
    return Array.from(session.documents.values());
  }

  async updateDocumentAnalysis(sessionId: string, id: number, analysis: any, clientFingerprint?: string): Promise<Document | undefined> {
    let session = this.sessions.get(sessionId);
    let actualSessionId = sessionId;

    // If document not found in current session, try related sessions from same client
    if (!session?.documents.has(id) && clientFingerprint) {
      const relatedSessions = this.clientSessions.get(clientFingerprint);
      if (relatedSessions) {
        Array.from(relatedSessions).forEach(relatedSessionId => {
          const relatedSession = this.sessions.get(relatedSessionId);
          if (relatedSession?.documents.has(id)) {
            console.log(`🔄 Updating document ${id} in related session ${relatedSessionId} for client ${clientFingerprint}`);
            session = relatedSession;
            actualSessionId = relatedSessionId;
          }
        });
      }
    }

    if (!session) return undefined;

    const document = session.documents.get(id);
    if (document) {
      const updatedDocument = { ...document, analysis };
      session.documents.set(id, updatedDocument);
      session.lastAccessed = new Date();
      console.log(`✅ Document ${id} analysis updated in session ${actualSessionId}`);
      return updatedDocument;
    }
    return undefined;
  }

  async clearAllDocuments(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.documents.clear();
      session.currentDocumentId = 1;
      session.lastAccessed = new Date();
    }
  }

  async clearExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now.getTime() - session.lastAccessed.getTime() > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`Cleared expired session: ${sessionId}`);
    });
  }

  getAllSessions(): Map<string, SessionData> {
    return this.sessions;
  }
}

export const storage = new SessionStorage();

// Database storage for user and subscription management
import { DatabaseStorage } from './database-storage';
export const databaseStorage = new DatabaseStorage();

// Option to use encrypted storage for enhanced security
// Uncomment the line below to enable session encryption
// import { EncryptedSessionStorage } from './encrypted-storage';
// export const encryptedStorage = new EncryptedSessionStorage();