/**
 * Hybrid Security Manager
 * 
 * Integrates hybrid cryptography with existing security systems
 * Provides transparent upgrade path from classical to post-quantum security
 */

import crypto from 'node:crypto';
import { hybridCryptoService, type HybridKeyPair, type HybridEncryptionResult } from './hybrid-crypto-service';
import { hashIpAddress, hashUserAgent } from './argon2';
import type { PIIMatch } from './pii-detection';

export interface SecureSession {
  sessionId: string;
  hybridKeys: HybridKeyPair;
  createdAt: number;
  lastUsed: number;
  encryptionLevel: 'classical' | 'hybrid' | 'quantum-resistant';
}

export interface EncryptedPIIData {
  encryptedMatches: HybridEncryptionResult[];
  sessionId: string;
  algorithm: string;
  timestamp: number;
  integrityHash: string;
}

export interface SecureDocumentSession {
  documentId: string;
  sessionKeys: Uint8Array[];
  piiEncryption: EncryptedPIIData;
  accessLog: {
    timestamp: number;
    action: string;
    ipHash: string;
    userAgentHash: string;
  }[];
}

class HybridSecurityManager {
  private sessionKeys = new Map<string, SecureSession>();
  private documentSessions = new Map<string, SecureDocumentSession>();
  private readonly KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  
  /**
   * Initialize a secure session with hybrid cryptography
   */
  async initializeSecureSession(sessionId: string, ipAddress: string, userAgent: string): Promise<SecureSession> {
    console.log(`🔐 Initializing secure hybrid session: ${sessionId}`);
    
    try {
      // Generate hybrid key pair for this session
      const hybridKeys = hybridCryptoService.generateHybridKeyPair('p256');
      
      // Create secure session
      const secureSession: SecureSession = {
        sessionId,
        hybridKeys,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        encryptionLevel: 'hybrid'
      };
      
      // Store session
      this.sessionKeys.set(sessionId, secureSession);
      
      // Log session creation securely
      const ipHash = await hashIpAddress(ipAddress);
      const userAgentHash = await hashUserAgent(userAgent);
      
      console.log(`✅ Secure hybrid session created: ${sessionId} (${hybridKeys.classical.algorithm}+pq)`);
      
      return secureSession;
      
    } catch (error) {
      console.error('❌ Failed to initialize secure session:', error);
      throw new Error('Secure session initialization failed');
    }
  }
  
  /**
   * Encrypt PII data using hybrid cryptography
   */
  async encryptPIIData(
    piiMatches: PIIMatch[],
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<EncryptedPIIData> {
    console.log(`🔒 Encrypting ${piiMatches.length} PII matches with hybrid crypto`);
    
    try {
      const session = this.sessionKeys.get(sessionId);
      if (!session) {
        throw new Error('Session not found - initialize secure session first');
      }
      
      // Update session usage
      session.lastUsed = Date.now();
      
      // Encrypt each PII match individually
      const encryptedMatches: HybridEncryptionResult[] = [];
      
      for (const match of piiMatches) {
        // Serialize PII match data
        const piiData = JSON.stringify({
          type: match.type,
          value: match.value,
          start: match.start,
          end: match.end,
          confidence: match.confidence,
          placeholder: match.placeholder
        });
        
        const plaintext = new TextEncoder().encode(piiData);
        
        // Encrypt using hybrid cryptography
        const encrypted = hybridCryptoService.hybridEncrypt(
          plaintext,
          session.hybridKeys.combinedPublicKey
        );
        
        encryptedMatches.push(encrypted);
      }
      
      // Create integrity hash
      const allCiphertext = encryptedMatches.map(e => Array.from(e.ciphertext)).flat();
      const integrityHash = crypto.createHash('sha256')
        .update(Buffer.from(allCiphertext))
        .update(sessionId)
        .digest('hex');
      
      const encryptedPIIData: EncryptedPIIData = {
        encryptedMatches,
        sessionId,
        algorithm: 'hybrid-aes256-pq',
        timestamp: Date.now(),
        integrityHash
      };
      
      // Log access securely
      const ipHash = await hashIpAddress(ipAddress);
      const userAgentHash = await hashUserAgent(userAgent);
      
      console.log(`✅ PII data encrypted: ${encryptedMatches.length} items, integrity: ${integrityHash.substring(0, 8)}...`);
      
      return encryptedPIIData;
      
    } catch (error) {
      console.error('❌ PII encryption failed:', error);
      throw new Error('PII encryption failed');
    }
  }
  
  /**
   * Decrypt PII data using hybrid cryptography
   */
  async decryptPIIData(
    encryptedData: EncryptedPIIData,
    sessionId: string
  ): Promise<PIIMatch[]> {
    console.log(`🔓 Decrypting PII data for session: ${sessionId}`);
    
    try {
      const session = this.sessionKeys.get(sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }
      
      if (encryptedData.sessionId !== sessionId) {
        throw new Error('Session ID mismatch - potential tampering detected');
      }
      
      // Verify integrity
      const allCiphertext = encryptedData.encryptedMatches.map(e => Array.from(e.ciphertext)).flat();
      const expectedHash = crypto.createHash('sha256')
        .update(Buffer.from(allCiphertext))
        .update(sessionId)
        .digest('hex');
      
      if (expectedHash !== encryptedData.integrityHash) {
        throw new Error('Integrity check failed - data may be compromised');
      }
      
      // Decrypt each PII match
      const decryptedMatches: PIIMatch[] = [];
      
      for (const encryptedMatch of encryptedData.encryptedMatches) {
        const decryptedBytes = hybridCryptoService.hybridDecrypt(
          encryptedMatch,
          session.hybridKeys
        );
        
        const piiDataString = new TextDecoder().decode(decryptedBytes);
        const piiMatch = JSON.parse(piiDataString) as PIIMatch;
        
        decryptedMatches.push(piiMatch);
      }
      
      // Update session usage
      session.lastUsed = Date.now();
      
      console.log(`✅ PII data decrypted: ${decryptedMatches.length} items restored`);
      
      return decryptedMatches;
      
    } catch (error) {
      console.error('❌ PII decryption failed:', error);
      throw new Error('PII decryption failed');
    }
  }
  
  /**
   * Create secure document processing session
   */
  async createDocumentSession(
    documentId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SecureDocumentSession> {
    console.log(`📄 Creating secure document session: ${documentId}`);
    
    try {
      const session = this.sessionKeys.get(sessionId);
      if (!session) {
        throw new Error('Base session required for document processing');
      }
      
      // Derive document-specific keys
      const sharedSecret = crypto.randomBytes(64); // In real implementation, this would come from key exchange
      const documentKeys = hybridCryptoService.deriveApplicationKeys(
        sharedSecret,
        `document:${documentId}`,
        3 // Keys for: content, metadata, PII
      );
      
      // Log access
      const ipHash = await hashIpAddress(ipAddress);
      const userAgentHash = await hashUserAgent(userAgent);
      
      const documentSession: SecureDocumentSession = {
        documentId,
        sessionKeys: documentKeys,
        piiEncryption: {
          encryptedMatches: [],
          sessionId,
          algorithm: 'hybrid-aes256-pq',
          timestamp: Date.now(),
          integrityHash: ''
        },
        accessLog: [{
          timestamp: Date.now(),
          action: 'document_session_created',
          ipHash,
          userAgentHash
        }]
      };
      
      this.documentSessions.set(documentId, documentSession);
      
      console.log(`✅ Secure document session created: ${documentId}`);
      return documentSession;
      
    } catch (error) {
      console.error('❌ Document session creation failed:', error);
      throw new Error('Document session creation failed');
    }
  }
  
  /**
   * Secure key rotation for long-lived sessions
   */
  async rotateSessionKeys(sessionId: string): Promise<HybridKeyPair> {
    console.log(`🔄 Rotating keys for session: ${sessionId}`);
    
    try {
      const session = this.sessionKeys.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Generate new hybrid key pair
      const newHybridKeys = hybridCryptoService.generateHybridKeyPair(session.hybridKeys.classical.algorithm);
      
      // Update session with new keys
      session.hybridKeys = newHybridKeys;
      session.lastUsed = Date.now();
      
      console.log(`✅ Session keys rotated: ${sessionId}`);
      return newHybridKeys;
      
    } catch (error) {
      console.error('❌ Key rotation failed:', error);
      throw new Error('Key rotation failed');
    }
  }
  
  /**
   * Clean up expired sessions and keys
   */
  async cleanupExpiredSessions(): Promise<{ sessionsRemoved: number; documentsRemoved: number }> {
    const now = Date.now();
    let sessionsRemoved = 0;
    let documentsRemoved = 0;
    
    // Clean up expired sessions
    for (const [sessionId, session] of this.sessionKeys.entries()) {
      if (now - session.lastUsed > this.KEY_ROTATION_INTERVAL * 2) { // 48 hours without use
        this.sessionKeys.delete(sessionId);
        sessionsRemoved++;
      } else if (now - session.createdAt > this.KEY_ROTATION_INTERVAL) { // 24 hours old
        // Auto-rotate keys for active but old sessions
        try {
          await this.rotateSessionKeys(sessionId);
        } catch (error) {
          console.warn(`⚠️ Auto key rotation failed for ${sessionId}:`, error);
        }
      }
    }
    
    // Clean up expired document sessions
    for (const [documentId, docSession] of this.documentSessions.entries()) {
      const lastAccess = Math.max(...docSession.accessLog.map(log => log.timestamp));
      if (now - lastAccess > this.KEY_ROTATION_INTERVAL) { // 24 hours without access
        this.documentSessions.delete(documentId);
        documentsRemoved++;
      }
    }
    
    if (sessionsRemoved > 0 || documentsRemoved > 0) {
      console.log(`🧹 Cleanup complete: ${sessionsRemoved} sessions, ${documentsRemoved} documents removed`);
    }
    
    return { sessionsRemoved, documentsRemoved };
  }
  
  /**
   * Get security status and metrics
   */
  getSecurityStatus(): {
    activeSessions: number;
    activeDocuments: number;
    encryptionLevel: string;
    keyRotationInterval: number;
    hybridCryptoStatus: any;
  } {
    return {
      activeSessions: this.sessionKeys.size,
      activeDocuments: this.documentSessions.size,
      encryptionLevel: 'hybrid-classical-postquantum',
      keyRotationInterval: this.KEY_ROTATION_INTERVAL,
      hybridCryptoStatus: hybridCryptoService.getStatus()
    };
  }
  
  /**
   * Export public key for external communication
   */
  getSessionPublicKey(sessionId: string): Uint8Array | null {
    const session = this.sessionKeys.get(sessionId);
    return session ? session.hybridKeys.combinedPublicKey : null;
  }
  
  /**
   * Verify the integrity of encrypted data
   */
  verifyDataIntegrity(encryptedData: EncryptedPIIData): boolean {
    try {
      const allCiphertext = encryptedData.encryptedMatches.map(e => Array.from(e.ciphertext)).flat();
      const calculatedHash = crypto.createHash('sha256')
        .update(Buffer.from(allCiphertext))
        .update(encryptedData.sessionId)
        .digest('hex');
      
      return calculatedHash === encryptedData.integrityHash;
    } catch (error) {
      console.error('❌ Integrity verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const hybridSecurityManager = new HybridSecurityManager();

// Start cleanup task
setInterval(async () => {
  try {
    await hybridSecurityManager.cleanupExpiredSessions();
  } catch (error) {
    console.error('❌ Session cleanup failed:', error);
  }
}, 60 * 60 * 1000); // Run every hour