import { type Document, type InsertDocument, type Consent } from "@shared/schema";

export interface IStorage {
  createDocument(sessionId: string, document: InsertDocument, clientFingerprint?: string): Promise<Document>;
  getDocument(sessionId: string, id: number, clientFingerprint?: string): Promise<Document | undefined>;
  getAllDocuments(sessionId: string): Promise<Document[]>;
  updateDocumentAnalysis(sessionId: string, id: number, analysis: any, clientFingerprint?: string): Promise<Document | undefined>;
  clearAllDocuments(sessionId: string): Promise<void>;
  clearExpiredSessions(): Promise<void>;
}

interface SessionData {
  documents: Map<number, Document>;
  currentDocumentId: number;
  lastAccessed: Date;
}

export class SessionStorage implements IStorage {
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
}

export const storage = new SessionStorage();
