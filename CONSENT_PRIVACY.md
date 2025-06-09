# Consent Logging Privacy Documentation

## Overview

ReadMyFinePrint implements a privacy-focused consent logging system that uses **pseudonymization** to track user agreement to terms while enabling legal verification of specific user consent.

## Privacy Protection Measures

### 1. Pseudonymized Identification
- **No Direct PII Storage**: User identities are pseudonymized, not stored directly
- **Stable Pseudonyms**: Consistent identifiers for same user/browser combinations
- **HMAC-Based**: Uses cryptographic HMAC with master key for security
- **Verifiable Consent**: Can prove specific user consent while protecting identity

### 2. Data Minimization
- **IP Address**: Hashed immediately, original IP never stored
- **User Agent**: Hashed for analytics, original never stored
- **Session ID**: Temporary identifier, not linked to user identity
- **Timestamp**: Only exact consent time recorded

### 3. Technical Implementation

#### Data Transformation Flow
```
Raw IP + User Agent → HMAC-SHA256(MasterKey) → User Pseudonym (usr_abc123def456789)
Raw IP → SHA256 Hash + Salt → IP Hash (ip_abc123def456)
Raw User Agent → SHA256 Hash + Salt → UA Hash (ua_xyz789abc123)
Pseudonym + Timestamp → HMAC-SHA256 → Verification Token (verify_123456789abc)
```

#### Storage Structure
```json
{
  "user_pseudonym": "usr_abc123def456789abcdef",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "ip_hash": "ip_abc123def456",
  "user_agent_hash": "ua_xyz789abc123",
  "terms_version": "1.0",
  "consent_id": "consent_789xyz456abc",
  "verification_token": "verify_123456789abc"
}
```

### 4. Data Retention
- **Replit KV Store**: Used for anonymous consent records only
- **Client Storage**: localStorage for UI convenience only
- **No Cross-Session Tracking**: Each browser session is independent
- **No User Profiling**: Data cannot be linked back to individuals

### 5. Compliance Features
- **Anonymous Analytics**: Can count consents without identifying users
- **Audit Trail**: Timestamped records for compliance reporting
- **Graceful Degradation**: Service continues if consent logging fails
- **Transparency**: Clear user communication about data handling

### 6. Security Measures
- **Salted Hashes**: Application-specific salt prevents rainbow table attacks
- **Environment Variables**: Sensitive configuration stored securely
- **No Reversibility**: Hash functions make original data unrecoverable
- **Minimal Data Exposure**: Only aggregated statistics available

## Environment Variables

```bash
REPLIT_DB_URL=         # Provided by Replit for KV store access
CONSENT_SALT=          # Optional: Custom salt for hashing (uses default if not set)
```

## API Endpoints

### POST /api/consent
Logs pseudonymized consent acceptance
- **Input**: HTTP request (IP, User-Agent extracted)
- **Output**: Success status, consent ID, verification token, and user pseudonym
- **Privacy**: No PII stored, all data pseudonymized

### POST /api/consent/verify
Verifies if the current user has consented
- **Input**: HTTP request (IP, User-Agent extracted)
- **Output**: Consent proof if user has consented
- **Use Case**: Legal verification of specific user consent

### POST /api/consent/verify-token
Allows users to verify their own consent
- **Input**: Consent ID and verification token
- **Output**: Consent proof if token is valid
- **Use Case**: User self-verification of their consent

### GET /api/consent/stats
Returns aggregated consent statistics
- **Output**: Total consents, unique users, daily counts
- **Privacy**: No individual records exposed

## Benefits

1. **Legal Compliance**: Maintains audit trail for consent
2. **User Privacy**: Zero PII exposure
3. **Analytics**: Aggregate usage statistics available
4. **Transparency**: Clear documentation of data handling
5. **Graceful Failure**: User experience not impacted if logging fails

## Data Flow Diagram

```
User Browser → Express Server → Consent Logger → Replit KV Store
     ↓              ↓               ↓              ↓
localStorage   Hash IP/UA    Create Anonymous   Store Record
(local only)   (in memory)        ID           (anonymous)
```

## Privacy by Design Principles

- **Proactive**: Privacy protection built-in from start
- **Privacy as Default**: No PII collected unless absolutely necessary
- **Respect for User Privacy**: Clear consent and transparent practices
- **Full Functionality**: Privacy protection doesn't compromise features
- **End-to-End Security**: Protection throughout entire data lifecycle
- **Visibility and Transparency**: Clear documentation and user communication

This system ensures compliance requirements are met while maintaining the highest standards of user privacy protection.
