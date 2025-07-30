# OWASP ASVS Implementation Guide - ReadMyFinePrint

## Overview
This guide provides step-by-step instructions for implementing OWASP ASVS (Application Security Verification Standard) controls in the ReadMyFinePrint application.

**Status**: Phase 1 Complete - Level 1 Core Controls Implemented  
**Target**: ASVS Level 2 Compliance  
**Implementation Date**: July 30, 2025

## Implemented Security Services

### 1. JWT Security Service (`jwt-security-service.ts`)
**ASVS Controls**: V2.2, V3.2, V3.3 - Authentication and Session Management

**Features**:
- Enhanced JWT token validation with security checks
- Token blacklisting for session invalidation
- Rate limiting for token validation attempts
- Detection of suspicious token usage patterns
- Protection against token flooding attacks
- Comprehensive security logging

**Integration**:
```typescript
// Add to your authentication middleware
import { jwtSecurityService } from './jwt-security-service';

const result = await jwtSecurityService.validateTokenSecurity(token, ip, userAgent);
if (!result.isValid) {
  // Handle security violation
}
```

### 2. XSS Protection Service (`xss-protection-service.ts`)
**ASVS Controls**: V5.2.1, V5.2.2, V5.2.3 - Output Encoding and XSS Prevention

**Features**:
- Context-aware output encoding (HTML, JavaScript, CSS, URL)
- XSS pattern detection and prevention
- HTML sanitization with allowlist approach
- Content Security Policy compliance validation
- Safe template creation
- Comprehensive threat logging

**Usage Examples**:
```typescript
// HTML context
const safeHtml = xssProtectionService.encodeHTML(userInput);

// JavaScript context
const safeJs = xssProtectionService.encodeJavaScript(userInput);

// Context-aware encoding
const safe = xssProtectionService.encodeForContext(userInput, 'html');

// Full sanitization
const result = xssProtectionService.sanitizeHTML(userContent);
```

### 3. File Security Service (`file-security-service.ts`)
**ASVS Controls**: V12.1, V12.2, V12.3 - File Upload and Path Security

**Features**:
- Comprehensive file upload validation
- Path traversal attack prevention
- File type and MIME validation
- Content security scanning
- Secure filename generation
- File integrity checking (SHA-256 hashing)
- Malicious content detection

**Implementation**:
```typescript
// Validate file upload
const validation = await fileSecurityService.validateFileUpload(file, ip, userAgent);
if (!validation.isValid) {
  return res.status(400).json({ errors: validation.errors });
}

// Create secure storage path
const securePath = fileSecurityService.createSecureStoragePath(filename, userId);
```

### 4. ASVS Compliance Middleware (`asvs-compliance-middleware.ts`)
**Comprehensive middleware suite implementing multiple ASVS controls**

**Middleware Components**:
- `asvsJWTValidation` - Enhanced JWT security
- `asvsInputValidation` - XSS protection and input sanitization
- `asvsFileUploadSecurity` - File upload security
- `asvsOutputEncoding` - Response encoding
- `asvsSessionSecurity` - Session protection
- `asvsAPIRateLimiting` - API security

## Integration Instructions

### Step 1: Add Middleware to Express App

```typescript
// server/index.ts
import {
  asvsJWTValidation,
  asvsInputValidation,
  asvsFileUploadSecurity,
  asvsOutputEncoding,
  asvsSessionSecurity,
  asvsAPIRateLimiting,
  asvsComplianceStatus
} from './asvs-compliance-middleware';

// Apply ASVS middleware
app.use(asvsOutputEncoding);           // Output encoding for all responses
app.use(asvsSessionSecurity);          // Session security
app.use(asvsInputValidation);          // Input validation and XSS protection
app.use(asvsAPIRateLimiting);          // API rate limiting
app.use(asvsJWTValidation);            // Enhanced JWT validation
app.use(asvsFileUploadSecurity);       // File upload security

// ASVS compliance status endpoint
app.get('/api/security/asvs-status', asvsComplianceStatus);
```

### Step 2: Update File Upload Routes

```typescript
// In your file upload route
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  // File validation is automatically handled by asvsFileUploadSecurity middleware
  const validation = (req as any).fileValidation;
  
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }
  
  // Use secure storage path
  const securePath = fileSecurityService.createSecureStoragePath(
    req.file.originalname, 
    req.user.id
  );
  
  // Continue with secure file processing...
});
```

### Step 3: Apply XSS Protection to Templates

```typescript
// For any dynamic content rendering
import { xssProtectionService } from './xss-protection-service';

// In your response handlers
const safeContent = xssProtectionService.encodeForContext(userContent, 'html');
res.json({ content: safeContent });

// For email templates or HTML generation
const safeTemplate = xssProtectionService.createSafeTemplate(
  template, 
  variables, 
  { username: 'html', email: 'attribute' }
);
```

### Step 4: Enhance Authentication

```typescript
// In your JWT validation middleware
import { jwtSecurityService } from './jwt-security-service';

export async function enhancedJWTAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  
  const { ip, userAgent } = getClientInfo(req);
  const validation = await jwtSecurityService.validateTokenSecurity(token, ip, userAgent);
  
  if (!validation.isValid) {
    if (validation.securityIssues.length > 0) {
      return res.status(401).json({ 
        error: 'Security violation detected',
        code: 'SECURITY_VIOLATION'
      });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = validation.payload;
  next();
}
```

## Security Headers Enhancement

Update your existing security headers to be ASVS compliant:

```typescript
// server/auth.ts - Update addSecurityHeaders function
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // ... existing headers ...
  
  // ASVS V14.5.1 - Enhanced CSP
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://img.shields.io",
    "connect-src 'self' https://api.openai.com https://api.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // ASVS V14.4.1 - Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}
```

## Validation and Testing

### 1. ASVS Compliance Testing

Create automated tests for ASVS controls:

```typescript
// tests/security/asvs-compliance.test.ts
describe('ASVS Compliance Tests', () => {
  test('V5.2.1 - XSS Protection', async () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const result = xssProtectionService.sanitizeHTML(maliciousInput);
    expect(result.sanitized).not.toContain('<script>');
    expect(result.threatsDetected.length).toBeGreaterThan(0);
  });
  
  test('V12.3.1 - Path Traversal Protection', () => {
    const maliciousPath = '../../../etc/passwd';
    const result = fileSecurityService.validatePath(maliciousPath);
    expect(result.isValid).toBe(false);
    expect(result.detectedAttacks).toContain('path-traversal');
  });
  
  test('V2.2.1 - JWT Security Validation', async () => {
    const invalidToken = 'malicious.token.here';
    const result = await jwtSecurityService.validateTokenSecurity(
      invalidToken, '127.0.0.1', 'test-agent'
    );
    expect(result.isValid).toBe(false);
  });
});
```

### 2. Security Monitoring

Monitor ASVS compliance through the status endpoint:

```bash
curl https://your-domain.com/api/security/asvs-status
```

Expected response:
```json
{
  "status": "ASVS Level 1 Compliance Active",
  "version": "4.0.3",
  "securityStats": {
    "jwt": { "totalAttempts": 0, "blacklistedTokens": 0 },
    "xss": { "totalChecks": 0, "threatsDetected": 0 },
    "fileUpload": { "totalValidations": 0, "blockedUploads": 0 }
  },
  "controlsImplemented": [
    "V2.2 - JWT Authentication Security",
    "V3.2 - Session Token Security",
    "V5.1 - Input Validation",
    "V5.2 - XSS Protection",
    "V12.1 - File Upload Security",
    "V12.3 - Path Traversal Protection"
  ]
}
```

## Configuration

### Environment Variables

Add these security configuration options:

```bash
# .env
SECURITY_JWT_MAX_ATTEMPTS=10
SECURITY_FILE_MAX_SIZE=52428800  # 50MB
SECURITY_XSS_LOGGING=true
SECURITY_STRICT_MODE=true
```

### Application Settings

```typescript
// server/config/security.ts
export const securityConfig = {
  jwt: {
    maxAttemptsPerIP: parseInt(process.env.SECURITY_JWT_MAX_ATTEMPTS || '10'),
    tokenBlacklistEnabled: true,
    suspiciousActivityLogging: true
  },
  fileUpload: {
    maxFileSize: parseInt(process.env.SECURITY_FILE_MAX_SIZE || '52428800'),
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    virusScanning: false, // Enable when antivirus service is available
    contentValidation: true
  },
  xss: {
    strictEncoding: process.env.SECURITY_STRICT_MODE === 'true',
    logAllAttempts: process.env.SECURITY_XSS_LOGGING === 'true',
    cspReporting: true
  }
};
```

## Next Steps - Phase 2 Implementation

### High Priority (Level 2 Controls)
1. **Multi-Factor Authentication** (V2.2.1)
2. **Session Fingerprinting** (V3.3.3)
3. **Advanced Input Validation** (V5.1.4)
4. **Cryptographic Key Management** (V6.4.1)
5. **Security Logging Enhancement** (V7.2.1)

### Medium Priority
1. **API Security Controls** (V13.1-13.4)
2. **Error Handling Improvements** (V7.1.3)
3. **Data Protection Controls** (V8.2-8.3)
4. **Configuration Security** (V14.2-14.3)

### Implementation Timeline
- **Week 1**: MFA implementation
- **Week 2**: Session security enhancements
- **Week 3**: Advanced validation and logging
- **Week 4**: API security controls
- **Week 5**: Final Level 2 compliance testing

## Compliance Verification

### Internal Verification Checklist
- [ ] All middleware integrated and tested
- [ ] Security services functioning correctly
- [ ] Threat detection and logging operational
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] Team training completed

### External Verification
- Schedule penetration testing
- Conduct security code review
- Perform ASVS Level 1 assessment
- Document compliance evidence
- Plan Level 2 certification

---

**Document Version**: 1.0  
**Implementation Status**: Phase 1 Complete  
**Next Review**: August 15, 2025  
**Compliance Target**: ASVS Level 2 by September 30, 2025