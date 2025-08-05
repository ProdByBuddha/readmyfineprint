import postgres from 'postgres';
import type { 
  PIIStorageInterface, 
  DocumentCorrelationData, 
  CrossSessionCorrelation 
} from './pii-storage-interface';

/**
 * PostgreSQL implementation of PII storage interface
 * Uses postgres-js client for Replit compatibility
 * Provides persistent, relational storage for PII correlation data
 */
export class PostgreSQLPIIStorage implements PIIStorageInterface {
  private sql: postgres.Sql;
  
  private initialized = false;

  constructor(config?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    maxConnections?: number;
  }) {
    // Use DATABASE_URL if available (Replit style), otherwise construct from config
    if (process.env.DATABASE_URL) {
      this.sql = postgres(process.env.DATABASE_URL, {
        max: config?.maxConnections || parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'),
        idle_timeout: 30,
        connect_timeout: 2,
      });
    } else {
      this.sql = postgres({
        host: config?.host || process.env.POSTGRES_HOST || 'localhost',
        port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
        database: config?.database || process.env.POSTGRES_DB || 'postgres',
        username: config?.username || process.env.POSTGRES_USER || 'postgres',
        password: config?.password || process.env.POSTGRES_PASSWORD || '',
        ssl: config?.ssl !== undefined ? config.ssl : process.env.POSTGRES_SSL === 'true',
        max: config?.maxConnections || parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'),
        idle_timeout: 30,
        connect_timeout: 2,
      });
    }
  }

  /**
   * Ensure database tables are initialized before any operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.initializeTables();
    this.initialized = true;
  }

  /**
   * Initialize database tables for PII correlation storage
   */
  private async initializeTables(): Promise<void> {
    try {
      // Check if we need to migrate the risk_score column
      try {
        const tableInfo = await this.sql`
          SELECT column_name, data_type, numeric_precision, numeric_scale 
          FROM information_schema.columns 
          WHERE table_name = 'pii_document_correlations' 
          AND column_name = 'risk_score'
        `;
        
        if (tableInfo.length > 0 && tableInfo[0].numeric_precision === 5) {
          console.log('🔄 Migrating risk_score column to support larger values...');
          await this.sql`ALTER TABLE pii_document_correlations ALTER COLUMN risk_score TYPE DECIMAL(6,4)`;
          console.log('✅ Risk score column migration completed');
        }
      } catch (error) {
        // Table doesn't exist yet, will be created below
      }

      // Create main document correlation table
      await this.sql`
        CREATE TABLE IF NOT EXISTS pii_document_correlations (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          document_id VARCHAR(255) NOT NULL,
          correlation_ids JSONB NOT NULL,
          document_fingerprint VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          pii_types JSONB NOT NULL,
          risk_score DECIMAL(6,4) NOT NULL,
          detection_quality JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
          UNIQUE(session_id, document_id)
        );
      `;

      // Create correlation ID index table for fast lookups
      await this.sql`
        CREATE TABLE IF NOT EXISTS pii_correlation_index (
          id SERIAL PRIMARY KEY,
          correlation_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          document_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(correlation_id, session_id, document_id)
        );
      `;

      // Create indexes for performance
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_pii_correlations_session 
        ON pii_document_correlations(session_id);
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_pii_correlations_timestamp 
        ON pii_document_correlations(timestamp);
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_pii_correlations_expires 
        ON pii_document_correlations(expires_at);
      `;
      
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_pii_correlation_id 
        ON pii_correlation_index(correlation_id);
      `;

      // Create cleanup function for expired records
      await this.sql`
        CREATE OR REPLACE FUNCTION cleanup_expired_correlations()
        RETURNS INTEGER AS $$
        DECLARE
          deleted_count INTEGER;
        BEGIN
          -- Delete expired document correlations
          DELETE FROM pii_document_correlations 
          WHERE expires_at < NOW();
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          
          -- Clean up orphaned correlation index entries
          DELETE FROM pii_correlation_index 
          WHERE (session_id, document_id) NOT IN (
            SELECT session_id, document_id 
            FROM pii_document_correlations
          );
          
          RETURN deleted_count;
        END;
        $$ LANGUAGE plpgsql;
      `;

      console.log('✅ PostgreSQL PII correlation tables initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL tables:', error);
      throw error;
    }
  }

  /**
   * Store document correlation data with automatic indexing
   */
  async storeDocumentCorrelation(
    sessionId: string,
    documentId: string,
    correlationData: Omit<DocumentCorrelationData, 'sessionId' | 'documentId'>
  ): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.sql.begin(async sql => {
        // Insert or update main document correlation record
        // Ensure risk score is within valid range (0-99.9999)
        const validRiskScore = Math.min(Math.max(correlationData.riskScore, 0), 99.9999);
        
        await sql`
          INSERT INTO pii_document_correlations (
            session_id, document_id, correlation_ids, document_fingerprint,
            timestamp, pii_types, risk_score, detection_quality
          ) VALUES (
            ${sessionId}, ${documentId}, ${JSON.stringify(correlationData.correlationIds)}, 
            ${correlationData.documentFingerprint}, ${correlationData.timestamp}, 
            ${JSON.stringify(correlationData.piiTypes)}, ${validRiskScore}, 
            ${JSON.stringify(correlationData.detectionQuality)}
          )
          ON CONFLICT (session_id, document_id) 
          DO UPDATE SET
            correlation_ids = EXCLUDED.correlation_ids,
            document_fingerprint = EXCLUDED.document_fingerprint,
            timestamp = EXCLUDED.timestamp,
            pii_types = EXCLUDED.pii_types,
            risk_score = EXCLUDED.risk_score,
            detection_quality = EXCLUDED.detection_quality,
            expires_at = NOW() + INTERVAL '30 days'
        `;

        // Delete existing correlation index entries for this document
        await sql`
          DELETE FROM pii_correlation_index 
          WHERE session_id = ${sessionId} AND document_id = ${documentId}
        `;

        // Insert new correlation index entries
        if (correlationData.correlationIds.length > 0) {
          const indexValues = correlationData.correlationIds.map(correlationId => [
            correlationId, sessionId, documentId
          ]);
          
          await sql`
            INSERT INTO pii_correlation_index (correlation_id, session_id, document_id)
            VALUES ${sql(indexValues)}
          `;
        }
      });
      
      console.log(`📦 Stored document correlation: ${sessionId}:${documentId} with ${correlationData.correlationIds.length} correlation IDs`);
      
    } catch (error) {
      console.error('❌ Failed to store document correlation:', error);
      throw error;
    }
  }

  /**
   * Get the most recent document correlation data for a session
   */
  async getSessionCorrelation(sessionId: string): Promise<DocumentCorrelationData | null> {
    await this.ensureInitialized();
    
    try {
      const result = await this.sql`
        SELECT 
          session_id, document_id, correlation_ids, document_fingerprint,
          timestamp, pii_types, risk_score, detection_quality
        FROM pii_document_correlations
        WHERE session_id = ${sessionId} AND expires_at > NOW()
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        sessionId: row.session_id,
        documentId: row.document_id,
        correlationIds: JSON.parse(row.correlation_ids),
        documentFingerprint: row.document_fingerprint,
        timestamp: row.timestamp,
        piiTypes: JSON.parse(row.pii_types),
        riskScore: parseFloat(row.risk_score),
        detectionQuality: JSON.parse(row.detection_quality)
      };
      
    } catch (error) {
      console.error('❌ Failed to get session correlation:', error);
      throw error;
    }
  }

  /**
   * Get all documents in a session
   */
  async getSessionDocuments(sessionId: string): Promise<DocumentCorrelationData[]> {
    await this.ensureInitialized();
    
    try {
      const result = await this.sql`
        SELECT 
          session_id, document_id, correlation_ids, document_fingerprint,
          timestamp, pii_types, risk_score, detection_quality
        FROM pii_document_correlations
        WHERE session_id = ${sessionId} AND expires_at > NOW()
        ORDER BY timestamp ASC
      `;

      return result.map(row => ({
        sessionId: row.session_id,
        documentId: row.document_id,
        correlationIds: JSON.parse(row.correlation_ids),
        documentFingerprint: row.document_fingerprint,
        timestamp: row.timestamp,
        piiTypes: JSON.parse(row.pii_types),
        riskScore: parseFloat(row.risk_score),
        detectionQuality: JSON.parse(row.detection_quality)
      }));
      
    } catch (error) {
      console.error('❌ Failed to get session documents:', error);
      throw error;
    }
  }

  /**
   * Find documents with shared correlation IDs across different sessions
   */
  async findCrossSessionCorrelations(
    correlationIds: string[],
    excludeSessionId?: string
  ): Promise<CrossSessionCorrelation[]> {
    await this.ensureInitialized();
    
    try {
      const excludeClause = excludeSessionId ? this.sql`AND ci.session_id != ${excludeSessionId}` : this.sql``;
      
      const result = await this.sql`
        SELECT 
          ci.session_id,
          ci.document_id,
          array_agg(ci.correlation_id) as shared_correlation_ids,
          COUNT(ci.correlation_id) as correlation_count
        FROM pii_correlation_index ci
        JOIN pii_document_correlations dc ON ci.session_id = dc.session_id 
          AND ci.document_id = dc.document_id
        WHERE ci.correlation_id = ANY(${correlationIds}) 
          AND dc.expires_at > NOW()
          ${excludeClause}
        GROUP BY ci.session_id, ci.document_id
        ORDER BY correlation_count DESC
      `;

      return result.map(row => ({
        sessionId: row.session_id,
        documentId: row.document_id,
        sharedCorrelationIds: row.shared_correlation_ids,
        correlationStrength: row.correlation_count / correlationIds.length,
        analysisTimestamp: new Date()
      }));
      
    } catch (error) {
      console.error('❌ Failed to find cross-session correlations:', error);
      throw error;
    }
  }

  /**
   * Clear all data for a session
   */
  async clearSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.sql.begin(async sql => {
        // Delete correlation index entries
        await sql`
          DELETE FROM pii_correlation_index 
          WHERE session_id = ${sessionId}
        `;

        // Delete document correlations
        const result = await sql`
          DELETE FROM pii_document_correlations 
          WHERE session_id = ${sessionId}
        `;

        console.log(`🗑️ Cleared session: ${sessionId} (${result.count} documents removed)`);
      });
      
    } catch (error) {
      console.error('❌ Failed to clear session:', error);
      throw error;
    }
  }

  /**
   * Get correlation analytics for forensic reporting
   */
  async getCorrelationAnalytics(
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalSessions: number;
    totalDocuments: number;
    crossSessionCorrelations: number;
    riskDistribution: Record<string, number>;
  }> {
    await this.ensureInitialized();
    
    try {
      const timeFilter = timeRange 
        ? this.sql`AND timestamp >= ${timeRange.start} AND timestamp <= ${timeRange.end}`
        : this.sql``;

      // Get basic statistics
      const [stats] = await this.sql`
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_documents
        FROM pii_document_correlations
        WHERE expires_at > NOW() ${timeFilter}
      `;

      // Get risk distribution
      const riskResult = await this.sql`
        SELECT 
          CASE 
            WHEN risk_score < 0.3 THEN 'low'
            WHEN risk_score < 0.7 THEN 'medium'
            ELSE 'high'
          END as risk_category,
          COUNT(*) as count
        FROM pii_document_correlations
        WHERE expires_at > NOW() ${timeFilter}
        GROUP BY risk_category
      `;

      const riskDistribution: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0
      };

      riskResult.forEach((row: any) => {
        riskDistribution[row.risk_category] = parseInt(row.count);
      });

      return {
        totalSessions: parseInt(stats.total_sessions) || 0,
        totalDocuments: parseInt(stats.total_documents) || 0,
        crossSessionCorrelations: 0, // Simplified for now
        riskDistribution
      };
      
    } catch (error) {
      console.error('❌ Failed to get correlation analytics:', error);
      throw error;
    }
  }

  /**
   * Run maintenance cleanup of expired records
   */
  async runMaintenance(): Promise<number> {
    await this.ensureInitialized();
    
    try {
      const [result] = await this.sql`SELECT cleanup_expired_correlations() as count`;
      const deletedCount = result.count || 0;
      
      if (deletedCount > 0) {
        console.log(`🧹 Maintenance: Cleaned up ${deletedCount} expired correlation records`);
      }
      
      return deletedCount;
      
    } catch (error) {
      console.error('❌ Failed to run maintenance cleanup:', error);
      throw error;
    }
  }

  /**
   * Manually initialize database (useful for setup scripts)
   */
  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.sql.end();
    console.log('📴 PostgreSQL connection closed');
  }
}