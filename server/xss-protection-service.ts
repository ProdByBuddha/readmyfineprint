/* eslint-disable no-useless-escape */
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  threatsDetected: string[];
  context: 'html' | 'attribute' | 'javascript' | 'css' | 'url' | 'text';
}

interface XSSDetection {
  detected: boolean;
  patterns: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: string;
}

/**
 * XSS Protection Service - ASVS V5.2.1, V5.2.2, V5.2.3 Compliance
 * Implements comprehensive XSS protection through output encoding and input sanitization
 */
class XSSProtectionService {
  // Common XSS attack patterns
  private readonly xssPatterns = [
    // Script tags
    /<script[^>]*>.*?<\/script>/gi,
    /<script[^>]*\/>/gi,
    /<script[^>]*>/gi,
    
    // Event handlers
    /on\w+\s*=\s*['"]*[^'"]*['"]/gi,
    /javascript:\s*[^;'"]*[;'"]/gi,
    /vbscript:\s*[^;'"]*[;'"]/gi,
    
    // Meta refresh
    /<meta[^>]*http-equiv[^>]*refresh[^>]*>/gi,
    
    // Object and embed tags
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<applet[^>]*>.*?<\/applet>/gi,
    
    // Form actions
    /<form[^>]*action[^>]*javascript:/gi,
    
    // Image onerror
    /<img[^>]*onerror[^>]*>/gi,
    
    // Style with expression
    /style\s*=\s*['"]*[^'"]*expression\s*\([^)]*\)[^'"]*['"]/gi,
    
    // Data URLs with script
    /data:\s*text\/html[^;]*;[^,]*,.*?<script/gi,
    
    // SVG with script
    /<svg[^>]*>.*?<script[^>]*>.*?<\/script>.*?<\/svg>/gi,
  ];

  // HTML entities for encoding
  private readonly htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  // JavaScript-safe encoding
  private readonly jsEntities: Record<string, string> = {
    '"': '\\"',
    "'": "\\'",
    '\\': '\\\\',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\b': '\\b',
    '\f': '\\f',
    '\v': '\\v',
    '\0': '\\0'
  };

  /**
   * Detect XSS patterns in input
   */
  detectXSS(input: string, context: string = 'html'): XSSDetection {
    const detectedPatterns: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    
    const updateSeverity = (newSeverity: 'low' | 'medium' | 'high' | 'critical') => {
      if (severityLevels[newSeverity] > severityLevels[maxSeverity]) {
        maxSeverity = newSeverity;
      }
    };

    for (const pattern of this.xssPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        detectedPatterns.push(...matches);
        
        // Determine severity based on pattern type
        const patternStr = pattern.toString();
        if (patternStr.includes('script') || patternStr.includes('javascript:')) {
          updateSeverity('critical');
        } else if (patternStr.includes('on\\w+') || patternStr.includes('expression')) {
          updateSeverity('high');
        } else if (patternStr.includes('object') || patternStr.includes('embed')) {
          updateSeverity('medium');
        }
      }
    }

    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      severity: maxSeverity,
      context
    };
  }

  /**
   * Sanitize HTML content (ASVS V5.2.2)
   */
  sanitizeHTML(input: string, allowedTags: string[] = []): SanitizationResult {
    const originalInput = input;
    const detection = this.detectXSS(input, 'html');
    
    if (detection.detected) {
      this.logXSSAttempt(input, detection, 'html');
    }

    let sanitized = input;
    
    // Remove script tags completely
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<script[^>]*\/>/gi, '');
    sanitized = sanitized.replace(/<script[^>]*>/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*['"]*[^'"]*['"]/gi, '');
    
    // Remove javascript: and vbscript: protocols
    sanitized = sanitized.replace(/javascript:\s*[^;'"]*[;'"]/gi, 'about:blank');
    sanitized = sanitized.replace(/vbscript:\s*[^;'"]*[;'"]/gi, 'about:blank');
    
    // Remove dangerous tags if not in allowed list
    const dangerousTags = ['object', 'embed', 'applet', 'meta', 'link', 'style', 'iframe'];
    for (const tag of dangerousTags) {
      if (!allowedTags.includes(tag)) {
        const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gi');
        sanitized = sanitized.replace(regex, '');
        const selfClosingRegex = new RegExp(`<${tag}[^>]*\/>`, 'gi');
        sanitized = sanitized.replace(selfClosingRegex, '');
      }
    }
    
    // Encode remaining HTML entities
    sanitized = this.encodeHTMLEntities(sanitized);

    return {
      sanitized,
      wasModified: sanitized !== originalInput,
      threatsDetected: detection.patterns,
      context: 'html'
    };
  }

  /**
   * Encode for HTML context (ASVS V5.2.3)
   */
  encodeHTML(input: string): string {
    return this.encodeHTMLEntities(input);
  }

  /**
   * Encode for HTML attribute context
   */
  encodeHTMLAttribute(input: string): string {
    // For attributes, we need more aggressive encoding
    return input.replace(/[&<>"'`=]/g, (match) => {
      return this.htmlEntities[match] || match;
    });
  }

  /**
   * Encode for JavaScript context
   */
  encodeJavaScript(input: string): string {
    return input.replace(/[\\'"\/\r\n\t\b\f\v\0]/g, (match) => {
      return this.jsEntities[match] || match;
    });
  }

  /**
   * Encode for CSS context
   */
  encodeCSS(input: string): string {
    // CSS encoding - escape any potentially dangerous characters
    return input.replace(/[<>"'&\\]/g, (match) => {
      return '\\' + match.charCodeAt(0).toString(16).padStart(6, '0');
    });
  }

  /**
   * Encode for URL context
   */
  encodeURL(input: string): string {
    return encodeURIComponent(input);
  }

  /**
   * Context-aware encoding (ASVS V5.2.3)
   */
  encodeForContext(input: string, context: 'html' | 'attribute' | 'javascript' | 'css' | 'url' = 'html'): string {
    switch (context) {
      case 'html':
        return this.encodeHTML(input);
      case 'attribute':
        return this.encodeHTMLAttribute(input);
      case 'javascript':
        return this.encodeJavaScript(input);
      case 'css':
        return this.encodeCSS(input);
      case 'url':
        return this.encodeURL(input);
      default:
        return this.encodeHTML(input);
    }
  }

  /**
   * Validate and sanitize user input with context awareness
   */
  validateAndSanitize(input: string, context: 'html' | 'attribute' | 'javascript' | 'css' | 'url' | 'text' = 'text'): SanitizationResult {
    const detection = this.detectXSS(input, context);
    
    if (detection.detected) {
      this.logXSSAttempt(input, detection, context);
    }

    let sanitized: string;
    
    switch (context) {
      case 'html': {
        const htmlResult = this.sanitizeHTML(input);
        return htmlResult;
      }
      case 'attribute':
        sanitized = this.encodeHTMLAttribute(input);
        break;
      case 'javascript':
        sanitized = this.encodeJavaScript(input);
        break;
      case 'css':
        sanitized = this.encodeCSS(input);
        break;
      case 'url':
        sanitized = this.encodeURL(input);
        break;
      case 'text':
      default:
        sanitized = this.encodeHTML(input);
        break;
    }

    return {
      sanitized,
      wasModified: sanitized !== input,
      threatsDetected: detection.patterns,
      context
    };
  }

  /**
   * Validate Content Security Policy compliance
   */
  validateCSPCompliance(content: string): {
    compliant: boolean;
    violations: string[];
    recommendations: string[];
  } {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for inline scripts
    if (/<script[^>]*>(?!.*src=)[^<]*<\/script>/gi.test(content)) {
      violations.push('Inline scripts detected');
      recommendations.push('Move scripts to external files and use nonce or hash');
    }

    // Check for inline event handlers
    if (/on\w+\s*=/gi.test(content)) {
      violations.push('Inline event handlers detected');
      recommendations.push('Use addEventListener in external scripts');
    }

    // Check for inline styles
    if (/<style[^>]*>[^<]*<\/style>/gi.test(content) || /style\s*=/gi.test(content)) {
      violations.push('Inline styles detected');
      recommendations.push('Move styles to external CSS files');
    }

    // Check for javascript: URLs
    if (/javascript:\s*/gi.test(content)) {
      violations.push('JavaScript URLs detected');
      recommendations.push('Replace javascript: URLs with proper event handlers');
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations
    };
  }

  /**
   * Create safe HTML template
   */
  createSafeTemplate(template: string, variables: Record<string, any>, context: Record<string, string> = {}): string {
    let safeTemplate = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const contextType = context[key] || 'html';
      const safeValue = this.encodeForContext(String(value), contextType as any);
      safeTemplate = safeTemplate.replace(new RegExp(placeholder, 'g'), safeValue);
    }
    
    return safeTemplate;
  }

  /**
   * Private helper methods
   */
  private encodeHTMLEntities(input: string): string {
    return input.replace(/[&<>"'`=]/g, (match) => {
      return this.htmlEntities[match] || match;
    });
  }

  private logXSSAttempt(input: string, detection: XSSDetection, context: string): void {
    const severity = detection.severity === 'critical' ? SecuritySeverity.CRITICAL :
                    detection.severity === 'high' ? SecuritySeverity.HIGH :
                    detection.severity === 'medium' ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW;

    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.INPUT_VALIDATION,
      severity,
      message: `XSS attempt detected in ${context} context`,
      ip: 'unknown', // Will be filled by middleware
      userAgent: 'unknown', // Will be filled by middleware
      endpoint: 'xss-protection',
      details: {
        context,
        patternsDetected: detection.patterns.length,
        severity: detection.severity,
        inputLength: input.length,
        // Don't log the full input to avoid storing malicious content
        inputSample: input.substring(0, 100) + (input.length > 100 ? '...' : '')
      }
    });
  }

  /**
   * Get XSS protection statistics
   */
  getProtectionStats(): {
    totalChecks: number;
    threatsDetected: number;
    criticalThreats: number;
  } {
    // This would be implemented with proper metrics collection
    // For now, returning placeholder values
    return {
      totalChecks: 0,
      threatsDetected: 0,
      criticalThreats: 0
    };
  }
}

export const xssProtectionService = new XSSProtectionService();