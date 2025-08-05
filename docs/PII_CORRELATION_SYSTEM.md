# PII Cross-Document Correlation System

## Overview

The **PII Cross-Document Correlation System** (formerly called "entanglement") is a privacy-preserving framework that enables secure tracking and analysis of Personally Identifiable Information (PII) across multiple documents and sessions without exposing actual sensitive data.

## System Architecture

### 1. **PII Detection & Hashing Layer**
- **Local LLM Analysis**: Documents are analyzed locally using privacy-preserving AI models
- **Argon2id Hashing**: Each detected PII item is hashed using type-specific Argon2id functions
- **Correlation IDs**: Short identifiers derived from hashes enable cross-system correlation
- **Russian Doll Protection**: Multi-layer obfuscation with type-specific, salted, and context-aware hashing

### 2. **Persistent Storage Layer**
- **PostgreSQL Primary**: Relational database for complex queries and long-term storage (default for Replit)
- **Redis Option**: Fast, in-memory storage for real-time correlation analysis
- **Configurable**: Environment-based configuration for different deployment scenarios
- **Scalable**: Designed for high-throughput document processing

### 3. **Cross-Document Correlation Engine**
- **Session Tracking**: Groups documents by user sessions for correlation analysis
- **Cross-Session Analysis**: Identifies shared PII patterns across different sessions
- **Risk Assessment**: Calculates correlation strength and escalation patterns
- **Forensic Reporting**: Generates audit trails without exposing actual PII

### 4. **Transmission Security Envelope**
- **Hybrid Cryptography**: Combines classical (ECDH, AES) with post-quantum resistant algorithms
- **Integrity Protection**: SHA-256 hashing and BLAKE3 fingerprinting
- **Secure Transport**: Encrypted payloads for API transmission
- **Audit Trail**: Cryptographic proof of data integrity throughout processing

## Key Components

### PIICorrelationService
The main service class that manages PII correlation across document sessions.

```typescript
// Store document correlation data
await piiCorrelationService.storeDocumentCorrelation(
  sessionId, 
  documentId, 
  hashedMatches, 
  detectionMetrics
);

// Check for cross-document correlations
const correlation = await piiCorrelationService.checkCrossDocumentCorrelation(
  sessionId, 
  newDocumentMatches
);

// Generate forensic analysis report
const report = await piiCorrelationService.createForensicAnalysisReport(sessionIds);
```

### Storage Interface
Pluggable storage backend supporting multiple database types:

```typescript
interface PIIStorageInterface {
  storeDocumentCorrelation(sessionId, documentId, correlationData): Promise<void>;
  getSessionCorrelation(sessionId): Promise<DocumentCorrelationData | null>;
  findCrossSessionCorrelations(correlationIds): Promise<CrossSessionCorrelation[]>;
  clearSession(sessionId): Promise<void>;
  getCorrelationAnalytics(timeRange?): Promise<Analytics>;
}
```

## Configuration

### Environment Variables

#### PostgreSQL Configuration (Default for Replit)
```bash
# Uses DATABASE_URL automatically in Replit
DATABASE_URL=postgresql://user:pass@host:port/db

# Or configure individually:
PII_DB_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=true
POSTGRES_MAX_CONNECTIONS=10
```

#### Redis Configuration (Alternative)
```bash
PII_DB_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY_MS=100
```

## Security Features

### 1. **Zero Knowledge Architecture**
- Original PII is never stored in correlation database
- Only cryptographic hashes and metadata are persisted
- Correlation analysis works entirely on hash fingerprints

### 2. **Multi-Layer Protection**
- **Layer 1**: Type-specific hashing algorithms per PII category
- **Layer 2**: Salted hashes prevent rainbow table attacks  
- **Layer 3**: Context-aware obfuscation considers surrounding text
- **Layer 4**: Transmission encryption with hybrid cryptography

### 3. **Audit & Compliance**
- Complete forensic trail of document processing
- Cross-session correlation reporting for compliance teams
- Risk scoring and escalation detection
- Data retention controls with configurable TTL

## Setup Instructions

### For Replit Projects

1. **Initialize Database Tables**:
   ```bash
   npm run pii:setup-db
   ```

2. **Test the System**:
   ```bash
   npm run pii:test
   ```

3. **Verify Configuration**:
   The system automatically uses your `DATABASE_URL` environment variable in Replit.

### For Other Deployments

1. **Set Environment Variables**:
   ```bash
   export PII_DB_TYPE=postgresql
   export DATABASE_URL=your_postgresql_connection_string
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Initialize Database**:
   ```bash
   npm run pii:setup-db
   ```

## Usage Examples

### Basic Document Processing
```typescript
import { piiCorrelationService } from './server/pii-entanglement-service';

// Process a document and store correlations
const hashedMatches = await piiHashingService.hashPIIMatches(detectedPII);
await piiCorrelationService.storeDocumentCorrelation(
  'session_123',
  'document_456', 
  hashedMatches,
  detectionMetrics
);
```

### Cross-Document Analysis
```typescript
// Check if new document shares PII with previous documents
const correlation = await piiCorrelationService.checkCrossDocumentCorrelation(
  'session_123',
  newDocumentMatches
);

if (correlation.hasSharedPII) {
  console.log(`Found ${correlation.sharedCorrelationIds.length} shared PII items`);
  console.log(`Correlation strength: ${correlation.correlationStrength}`);
}
```

### Forensic Reporting
```typescript
// Generate cross-session analysis report
const report = await piiCorrelationService.createForensicAnalysisReport([
  'session_123',
  'session_456', 
  'session_789'
]);

console.log(`Cross-session correlations: ${report.crossSessionCorrelations.length}`);
console.log(`Average risk score: ${report.aggregateRiskProfile.averageRiskScore}`);
```

## Performance Considerations

### Redis Optimization
- **Pipeline Operations**: Batch writes for better throughput
- **Key Expiration**: 30-day TTL prevents unbounded growth
- **Index Strategy**: Correlation ID sets for fast lookups
- **Memory Management**: Configurable maxmemory policies

### Scaling Guidelines
- **Session Partitioning**: Distribute sessions across multiple Redis instances
- **Read Replicas**: Use Redis replicas for read-heavy forensic queries
- **Connection Pooling**: Configure appropriate connection limits
- **Monitoring**: Track key metrics (memory usage, query latency, correlation rates)

## Migration from Legacy System

The system maintains backward compatibility with the previous "entanglement" terminology:

```typescript
// Legacy alias (deprecated)
import { piiEntanglementService } from './server/pii-entanglement-service';

// New recommended usage
import { piiCorrelationService } from './server/pii-entanglement-service';
```

Method name mappings:
- `storeDocumentEntanglement` → `storeDocumentCorrelation`
- `checkCrossDocumentEntanglement` → `checkCrossDocumentCorrelation`  
- `clearSessionEntanglements` → `clearSessionCorrelations`
- `getSessionEntanglementSummary` → `getSessionCorrelationSummary`

## Troubleshooting

### Common Issues

#### Redis Connection Errors
```bash
# Check Redis connectivity
redis-cli -h localhost -p 6379 ping

# Verify authentication
redis-cli -h localhost -p 6379 -a your_password ping
```

#### Performance Issues
- Monitor Redis memory usage: `INFO memory`
- Check slow queries: `SLOWLOG GET 10`
- Verify key expiration: `TTL session:*`

#### Data Consistency
- Validate correlation integrity: `SCARD correlation:*`
- Check session completeness: `SMEMBERS session:*:docs`

## Future Enhancements

1. **PostgreSQL Backend**: Full implementation of relational storage
2. **Distributed Correlation**: Multi-node correlation analysis
3. **ML-Based Risk Scoring**: Advanced risk assessment algorithms
4. **Real-time Alerting**: Immediate notification of high-risk correlations
5. **Data Visualization**: Dashboard for correlation patterns and trends