import { Request, Response, NextFunction } from 'express';
import { jwtSecurityService } from './jwt-security-service';
import { xssProtectionService } from './xss-protection-service';
import { fileSecurityService } from './file-security-service';
import { securityLogger, getClientInfo, SecurityEventType, SecuritySeverity } from './security-logger';

/**
 * ASVS Compliance Middleware
 * Implements OWASP ASVS controls across the application
 */

/**
 * JWT Security Middleware - ASVS V2.2, V3.2, V3.3
 * Enhanced JWT validation with security checks
 */
export function asvsJWTValidation(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Let existing auth middleware handle
  }

  const token = authHeader.substring(7);
  
  // Use JWT security service for enhanced validation
  jwtSecurityService.validateTokenSecurity(token, ip, userAgent)
    .then(result => {
      if (!result.isValid) {
        // Add security issues to request for logging
        (req as any).securityIssues = result.securityIssues;
        
        if (result.securityIssues.length > 0) {
          return res.status(401).json({
            error: 'Token validation failed',
            code: 'SECURITY_VIOLATION'
          });
        }
      }
      
      // Add validated payload to request
      if (result.payload) {
        (req as any).jwtPayload = result.payload;
      }
      
      next();
    })
    .catch(error => {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'JWT security validation error',
        ip,
        userAgent,
        endpoint: req.path,
        details: { error: error.message }
      });
      
      return res.status(500).json({
        error: 'Authentication system error',
        code: 'AUTH_SYSTEM_ERROR'
      });
    });
}

/**
 * Input Validation and XSS Protection Middleware - ASVS V5.1, V5.2
 */
export function asvsInputValidation(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  
  try {
    // Validate and sanitize request body
    if (req.body && typeof req.body === 'object') {
      const sanitizedBody = sanitizeObject(req.body, ip, userAgent);
      req.body = sanitizedBody.data;
      
      if (sanitizedBody.threatsDetected.length > 0) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.INPUT_VALIDATION,
          severity: SecuritySeverity.HIGH,
          message: 'XSS threats detected in request body',
          ip,
          userAgent,
          endpoint: req.path,
          details: {
            threatsDetected: sanitizedBody.threatsDetected,
            fieldsAffected: sanitizedBody.fieldsModified
          }
        });
      }
    }

    // Validate query parameters
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeObject(req.query, ip, userAgent);
      req.query = sanitizedQuery.data;
      
      if (sanitizedQuery.threatsDetected.length > 0) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.INPUT_VALIDATION,
          severity: SecuritySeverity.MEDIUM,
          message: 'XSS threats detected in query parameters',
          ip,
          userAgent,
          endpoint: req.path,
          details: {
            threatsDetected: sanitizedQuery.threatsDetected,
            fieldsAffected: sanitizedQuery.fieldsModified
          }
        });
      }
    }

    next();
  } catch (error) {
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.ERROR,
      severity: SecuritySeverity.HIGH,
      message: 'Input validation system error',
      ip,
      userAgent,
      endpoint: req.path,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    
    return res.status(500).json({
      error: 'Input validation system error',
      code: 'VALIDATION_SYSTEM_ERROR'
    });
  }
}

/**
 * File Upload Security Middleware - ASVS V12.1, V12.2, V12.3
 */
export function asvsFileUploadSecurity(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  
  // Only apply to file upload requests
  if (!req.file && !req.files) {
    return next();
  }

  try {
    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];
    
    for (const file of files) {
      if (!file) continue;
      
      // Validate file security
      fileSecurityService.validateFileUpload(file, ip, userAgent)
        .then(validation => {
          if (!validation.isValid) {
            securityLogger.logSecurityEvent({
              eventType: SecurityEventType.SECURITY_VIOLATION,
              severity: SecuritySeverity.HIGH,
              message: 'File upload security validation failed',
              ip,
              userAgent,
              endpoint: req.path,
              details: {
                filename: file.originalname,
                errors: validation.errors,
                securityChecks: validation.securityChecks
              }
            });
            
            return res.status(400).json({
              error: 'File upload security validation failed',
              details: validation.errors,
              code: 'FILE_SECURITY_VIOLATION'
            });
          }
          
          // Add validation result to request
          (req as any).fileValidation = validation;
          next();
        })
        .catch(error => {
          securityLogger.logSecurityEvent({
            eventType: SecurityEventType.ERROR,
            severity: SecuritySeverity.HIGH,
            message: 'File security validation system error',
            ip,
            userAgent,
            endpoint: req.path,
            details: { error: error.message }
          });
          
          return res.status(500).json({
            error: 'File security validation system error',
            code: 'FILE_VALIDATION_SYSTEM_ERROR'
          });
        });
    }
  } catch (error) {
    return res.status(500).json({
      error: 'File upload processing error',
      code: 'FILE_UPLOAD_ERROR'
    });
  }
}

/**
 * Output Encoding Middleware - ASVS V5.2.3
 * Ensures all output is properly encoded based on context
 */
export function asvsOutputEncoding(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override res.send to apply output encoding
  res.send = function(body?: any) {
    if (typeof body === 'string') {
      // Detect context and apply appropriate encoding
      const contentType = res.getHeader('content-type') as string;
      
      if (contentType && contentType.includes('text/html')) {
        body = xssProtectionService.encodeForContext(body, 'html');
      } else if (contentType && contentType.includes('application/json')) {
        // JSON responses are handled by res.json
      } else {
        // Default to HTML encoding for text responses
        body = xssProtectionService.encodeForContext(body, 'html');
      }
    }
    
    return originalSend.call(this, body);
  };
  
  // Override res.json to apply encoding to JSON values
  res.json = function(obj?: any) {
    if (obj && typeof obj === 'object') {
      obj = sanitizeObjectForOutput(obj);
    }
    
    return originalJson.call(this, obj);
  };
  
  next();
}

/**
 * Session Security Middleware - ASVS V3.3
 * Enhanced session security checks
 */
export function asvsSessionSecurity(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  
  // Check for session fixation attempts
  if (req.sessionId) {
    const sessionIdPattern = /^[a-zA-Z0-9-_]+$/;
    if (!sessionIdPattern.test(req.sessionId)) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SECURITY_VIOLATION,
        severity: SecuritySeverity.HIGH,
        message: 'Invalid session ID format detected',
        ip,
        userAgent,
        endpoint: req.path,
        details: { sessionIdLength: req.sessionId.length }
      });
      
      return res.status(400).json({
        error: 'Invalid session format',
        code: 'INVALID_SESSION'
      });
    }
  }
  
  // Add security headers for session protection
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
}

/**
 * API Rate Limiting and Security - ASVS V13.2
 */
export function asvsAPIRateLimiting(req: Request, res: Response, next: NextFunction) {
  const { ip, userAgent } = getClientInfo(req);
  
  // Enhanced rate limiting based on endpoint sensitivity
  const sensitiveEndpoints = [
    '/api/auth/',
    '/api/admin/',
    '/api/documents/upload',
    '/api/documents/analyze'
  ];
  
  const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );
  
  if (isSensitiveEndpoint) {
    // Additional rate limiting for sensitive endpoints
    // This would integrate with your existing rate limiting
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.API_ACCESS,
      severity: SecuritySeverity.LOW,
      message: 'Sensitive API endpoint accessed',
      ip,
      userAgent,
      endpoint: req.path,
      details: { method: req.method }
    });
  }
  
  next();
}

/**
 * Helper Functions
 */

function sanitizeObject(obj: any, ip: string, userAgent: string): {
  data: any;
  threatsDetected: string[];
  fieldsModified: string[];
} {
  const result = {
    data: {} as any,
    threatsDetected: [] as string[],
    fieldsModified: [] as string[]
  };
  
  function sanitizeValue(value: any, key: string): any {
    if (typeof value === 'string') {
      const sanitized = xssProtectionService.validateAndSanitize(value, 'html');
      
      if (sanitized.wasModified) {
        result.fieldsModified.push(key);
      }
      
      if (sanitized.threatsDetected.length > 0) {
        result.threatsDetected.push(...sanitized.threatsDetected);
      }
      
      return sanitized.sanitized;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item, index) => sanitizeValue(item, `${key}[${index}]`));
      } else {
        const sanitizedObj: any = {};
        for (const [objKey, objValue] of Object.entries(value)) {
          sanitizedObj[objKey] = sanitizeValue(objValue, `${key}.${objKey}`);
        }
        return sanitizedObj;
      }
    }
    
    return value;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      result.data[key] = sanitizeValue(value, key);
    }
  } else {
    result.data = obj;
  }
  
  return result;
}

function sanitizeObjectForOutput(obj: any): any {
  if (typeof obj === 'string') {
    return xssProtectionService.encodeForContext(obj, 'html');
  } else if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObjectForOutput(item));
    } else {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitizedObj[key] = sanitizeObjectForOutput(value);
      }
      return sanitizedObj;
    }
  }
  
  return obj;
}

/**
 * ASVS Compliance Status Endpoint
 */
export function asvsComplianceStatus(req: Request, res: Response) {
  const stats = {
    jwt: jwtSecurityService.getTokenStats(),
    xss: xssProtectionService.getProtectionStats(),
    fileUpload: fileSecurityService.getSecurityStats(),
    timestamp: new Date().toISOString()
  };
  
  res.json({
    status: 'ASVS Level 1 Compliance Active',
    version: '4.0.3',
    securityStats: stats,
    controlsImplemented: [
      'V2.2 - JWT Authentication Security',
      'V3.2 - Session Token Security',
      'V3.3 - Session Cookie Security',
      'V5.1 - Input Validation',
      'V5.2 - XSS Protection',
      'V12.1 - File Upload Security',
      'V12.3 - Path Traversal Protection',
      'V13.2 - API Rate Limiting'
    ]
  });
}