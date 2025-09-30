# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**ReadMyFinePrint** is a privacy-first AI-powered contract analysis platform. Built with Next.js (client) and Express (server), it uses GPT-4o to transform complex legal documents into accessible summaries while maintaining enterprise-grade security and privacy protection.

- **Stack**: TypeScript, React, Express, PostgreSQL (via Drizzle ORM), Vite
- **Architecture**: Monorepo with separate client and server
- **Authentication**: JOSE-based JWT with refresh tokens, subscription-based access control
- **Payment**: Stripe integration for subscription management  
- **Security**: SOC 2 Type II controls, GDPR/CCPA/PIPEDA compliant

## Directory Structure

```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route components
│   ├── lib/             # API client, utilities
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts
│   └── utils/           # Helper functions
├── server/              # Express backend application
│   ├── routes.ts        # Main API route definitions
│   ├── auth.ts          # Authentication middleware
│   ├── consent.ts       # Consent logging system
│   ├── subscription-service.ts    # Subscription & usage tracking
│   ├── jose-auth-service.ts       # JOSE JWT authentication
│   ├── jose-token-service.ts      # JOSE subscription tokens
│   └── db.ts            # Database connection setup
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle database schemas
├── scripts/             # Utility scripts (DB setup, testing, monitoring)
├── tests/               # Test files
│   ├── unit/            # Unit tests
│   └── e2e/             # End-to-end tests
└── docs/                # Additional documentation

```

## Common Development Commands

### Development

```powershell
# Start development server (client + server)
npm run dev

# Start with local LLM server
npm run dev:with-llm

# Start staging environment
npm run dev:staging
```

### Building

```powershell
# Build client and server
npm run build

# Build for staging
npm run build:staging

# TypeScript type checking
npm run check
```

### Testing

```powershell
# Run all tests
npm test

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Tests with coverage
npm run test:coverage

# CI test suite
npm run test:ci
```

### Database

```powershell
# Setup local database
npm run db:setup-local

# Check database status
npm run db:status

# Run migrations
npm run db:migrate
```

### Security & Validation

```powershell
# Security validation
npm run validate-security

# Complete validation (lint + check + test + security)
npm run validate:all

# Lint code
npm run lint

# Security audit
npm run security:audit

# Run security scan
npm run security:scan
```

### Monitoring

```powershell
# Single health check
npm run monitor

# Continuous monitoring
npm run monitor:continuous

# Production monitoring
npm run monitor:production:continuous
```

### Subscription Management

```powershell
# Check user subscription
npm run subscription:check

# Audit subscription tiers
npm run subscription:audit

# Initialize subscriptions
npm run subscription:init
```

## Architecture Overview

### Authentication & Authorization

**Multi-tier authentication system**:

1. **JOSE JWT Authentication** (`jose-auth-service.ts`)
   - Access tokens (15min expiry) and refresh tokens (7 days)
   - Secure JWE encryption with versioned secrets
   - Automatic token rotation and revocation tracking

2. **Subscription Tokens** (`jose-token-service.ts`)
   - Long-lived tokens for subscription access
   - Device fingerprint binding
   - Multi-device session management

3. **Consent System** (`consent.ts`)
   - Session-based consent tracking
   - Pseudonymized user identification (GDPR-compliant)
   - Required for document analysis operations

**Key Authentication Middleware**:
- `requireAdminAuth` - Admin-only endpoints
- `requireUserAuth` - Authenticated user endpoints
- `optionalUserAuth` - Identify user if authenticated, continue if not
- `requireConsent` - Verify user has accepted terms (needed for document analysis)
- `requireSecurityQuestions` - Enforce tier-based security requirements

### Subscription & Tier System

**Subscription Tiers** (defined in `subscription-tiers.ts`):
- **Free**: 10 docs/month, GPT-4o-mini
- **Starter**: 50 docs/month, GPT-4o
- **Professional**: 200 docs/month, GPT-4o, priority support
- **Business**: 1000 docs/month, GPT-4o, custom features
- **Enterprise**: Unlimited, GPT-4o, dedicated support
- **Ultimate**: Admin/internal tier

**Usage Tracking**:
- Per-user/per-device document analysis counting
- Monthly reset cycle
- Rate limiting based on tier
- Anonymous user tracking via device fingerprint + IP hash

### Session Management

**Dual Session System**:

1. **Client Session** (`sessionManager.ts`)
   - Client-side session ID generation
   - Stored in sessionStorage
   - Sent via `x-session-id` header

2. **Server Session** (`index.ts` middleware)
   - Server-generated session for unauthenticated users
   - Distributed session storage (PostgreSQL-backed)
   - Automatic session extension on activity

### Consent Flow

**CRITICAL**: Consent must be logged with the same session ID used for document analysis.

1. User accepts terms → `POST /api/consent`
2. Consent logged with: IP, User Agent, User ID (if auth'd), **Session ID**
3. Document analysis → consent verified with: IP, User Agent, User ID, **Session ID**

**Bug Fix (2025-09-30)**: Ensured `req.sessionId` is passed to `consentLogger.verifyUserConsent()` in document analysis route (`routes.ts:1534`).

### Document Analysis Pipeline

1. **Upload**: `POST /api/documents` or `POST /api/upload`
2. **Consent Check**: Verify user has accepted terms (except sample contracts)
3. **Tier Check**: Verify user hasn't exceeded monthly document limit
4. **PII Detection**: Scan for sensitive information (SSN, credit cards, etc.)
5. **AI Analysis**: Send to GPT-4o/GPT-4o-mini based on tier
6. **Usage Tracking**: Increment document counter for user/device
7. **Response**: Return analysis with updated usage stats

### Database Schema

**Key Tables** (`shared/schema.ts`):
- `users` - User accounts with hashed passwords
- `userSubscriptions` - Active subscription records
- `usageRecords` - Monthly usage tracking
- `consentRecords` - Privacy consent logs
- `jwtTokenRevocations` - Revoked token blacklist
- `refreshTokens` - Active refresh tokens
- `securityQuestions` - Account recovery questions
- `documents` - (Session-based, not in DB)

## Key Development Patterns

### API Client Pattern

All client→server requests use `sessionFetch()` from `sessionManager.ts`:
```typescript
import { sessionFetch } from '@/lib/sessionManager';

const response = await sessionFetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

This automatically:
- Includes session ID header
- Handles CSRF tokens for state-changing operations
- Includes JWT authorization if available
- Auto-refreshes expired tokens

### Error Handling

**Server-side**:
- Security events logged via `securityLogger`
- HTTP status codes: 400 (validation), 401 (auth), 403 (forbidden), 429 (rate limit), 500 (server error)
- Always return `{ error: string, code?: string }` for errors

**Client-side**:
- Catch and display user-friendly messages
- Redirect to login on 401
- Show consent modal on 403 + `requiresConsent: true`

### Testing Conventions

- Unit tests in `tests/unit/` use Vitest
- E2E tests in `tests/e2e/` use Vitest
- Config: `vitest.config.unit.ts` and `vitest.config.e2e.ts`
- Test files: `*.test.ts`

## Security Best Practices

### Implemented Security Controls

1. **CSRF Protection**: Mandatory for POST/PUT/DELETE endpoints
2. **Rate Limiting**: Tier-based API throttling
3. **Content Security Policy**: Strict CSP headers
4. **HSTS**: Enforced HTTPS with preload
5. **PII Detection**: Automatic redaction of sensitive data
6. **Token Revocation**: Blacklist for invalidated JWT/refresh tokens
7. **Audit Logging**: All security events tracked

### When Adding New Endpoints

1. Choose appropriate auth middleware:
   - Admin: `requireAdminAuth`
   - User-only: `requireUserAuth`
   - Optional user context: `optionalUserAuth`
2. Add consent check if endpoint processes user documents: `requireConsent`
3. Implement rate limiting if endpoint is resource-intensive
4. Log security events for sensitive operations
5. Validate all inputs with Zod schemas

## Environment Variables

Key environment variables (see `docs/PRODUCTION_ENVIRONMENT_VARIABLES.md` for complete list):

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for document analysis
- `STRIPE_SECRET_KEY` - Stripe payment processing
- `JWT_SECRET` - JWT signing secret (auto-rotated)
- `CONSENT_MASTER_KEY` - Consent pseudonymization key
- `NODE_ENV` - `development`, `staging`, or `production`

## Common Issues & Solutions

### Issue: Consent verification fails after accepting terms

**Cause**: Session ID not passed to `verifyUserConsent()`

**Solution**: Always include `req.sessionId` when calling consent verification:
```typescript
const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId, req.sessionId);
```

### Issue: TypeScript errors in tests

**Cause**: Path aliases not resolved

**Solution**: Use `vitest.config.*.ts` with proper `resolve.alias` configuration

### Issue: Database connection errors

**Solution**: 
```powershell
npm run db:status  # Check connection
npm run db:setup-local  # Reinitialize local DB
```

## Production Deployment

```powershell
# Pre-deployment validation
npm run predeploy

# Build for production
npm run build

# Deploy (see scripts/production-deploy.sh)
npm run deploy:production
```

**Production Checklist**:
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Security headers validated
- [ ] Rate limits configured
- [ ] Monitoring enabled
- [ ] Backup system active

## Additional Resources

- `README.md` - Project overview and setup
- `CHANGELOG.md` - Version history
- `docs/PRODUCTION_MONITORING.md` - Monitoring setup
- `docs/PRODUCTION_ENVIRONMENT_VARIABLES.md` - Environment configuration
- `FINAL_PRODUCTION_STATUS.md` - Latest production readiness report