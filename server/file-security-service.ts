import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    name: string;
    size: number;
    mimeType: string;
    extension: string;
    hash: string;
  };
  securityChecks: {
    pathTraversalSafe: boolean;
    allowedFileType: boolean;
    fileSizeValid: boolean;
    filenameValid: boolean;
    contentTypeValid: boolean;
  };
}

interface PathValidationResult {
  isValid: boolean;
  sanitizedPath: string;
  errors: string[];
  detectedAttacks: string[];
}

/**
 * File Security Service - ASVS V12.1, V12.2, V12.3 Compliance
 * Implements comprehensive file security including path traversal protection,
 * file type validation, and secure file handling
 */
class FileSecurityService {
  // Allowed file types for document analysis
  private readonly allowedMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/rtf'
  ]);

  private readonly allowedExtensions = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.rtf'
  ]);

  // File size limits (ASVS V12.1.2)
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly maxFilenameLength = 255;

  // Dangerous file patterns
  private readonly dangerousPatterns = [
    /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.com$/i, /\.scr$/i,
    /\.pif$/i, /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.class$/i,
    /\.sh$/i, /\.php$/i, /\.asp$/i, /\.jsp$/i, /\.html$/i,
    /\.htm$/i, /\.svg$/i
  ];

  // Path traversal patterns
  private readonly pathTraversalPatterns = [
    /\.\./g,           // Standard dot-dot-slash
    /%2e%2e/gi,        // URL encoded ..
    /%252e%252e/gi,    // Double URL encoded ..
    /\.\.\\/g,         // Windows path separators
    /\.\.\//g,         // Unix path separators
    /%5c/gi,           // URL encoded backslash
    /%2f/gi,           // URL encoded forward slash
      /\0/g,             // Null bytes
      // eslint-disable-next-line no-control-regex
      /\x00/g,           // Hex null bytes
  ];

  /**
   * Validate file upload security (ASVS V12.1.1, V12.1.2)
   */
  async validateFileUpload(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
  }, ip: string, userAgent: string): Promise<FileValidationResult> {
    
    const result: FileValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      fileInfo: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase(),
        hash: ''
      },
      securityChecks: {
        pathTraversalSafe: false,
        allowedFileType: false,
        fileSizeValid: false,
        filenameValid: false,
        contentTypeValid: false
      }
    };

    try {
      // Generate file hash for integrity checking
      if (file.buffer) {
        result.fileInfo.hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      }

      // 1. Filename validation and path traversal check
      const pathValidation = this.validatePath(file.originalname);
      result.securityChecks.pathTraversalSafe = pathValidation.isValid;
      
      if (!pathValidation.isValid) {
        result.errors.push(...pathValidation.errors);
        this.logSecurityViolation('path-traversal', file.originalname, pathValidation.detectedAttacks, ip, userAgent);
      }

      // 2. Filename length and character validation
      result.securityChecks.filenameValid = this.validateFilename(file.originalname);
      if (!result.securityChecks.filenameValid) {
        result.errors.push('Invalid filename: contains illegal characters or exceeds length limit');
      }

      // 3. File size validation
      result.securityChecks.fileSizeValid = file.size <= this.maxFileSize && file.size > 0;
      if (!result.securityChecks.fileSizeValid) {
        result.errors.push(`File size must be between 1 byte and ${this.maxFileSize / (1024 * 1024)}MB`);
      }

      // 4. MIME type validation
      result.securityChecks.allowedFileType = this.allowedMimeTypes.has(file.mimetype);
      if (!result.securityChecks.allowedFileType) {
        result.errors.push(`File type '${file.mimetype}' is not allowed`);
      }

      // 5. File extension validation
      const extensionValid = this.allowedExtensions.has(result.fileInfo.extension);
      if (!extensionValid) {
        result.errors.push(`File extension '${result.fileInfo.extension}' is not allowed`);
      }

      // 6. Content type consistency check
      result.securityChecks.contentTypeValid = this.validateContentTypeConsistency(
        file.mimetype, 
        result.fileInfo.extension
      );
      if (!result.securityChecks.contentTypeValid) {
        result.warnings.push('MIME type and file extension mismatch detected');
      }

      // 7. Dangerous file pattern check
      const hasDangerousPattern = this.dangerousPatterns.some(pattern => 
        pattern.test(file.originalname)
      );
      if (hasDangerousPattern) {
        result.errors.push('File contains dangerous patterns or extensions');
        this.logSecurityViolation('dangerous-file', file.originalname, ['dangerous-extension'], ip, userAgent);
      }

      // 8. File content validation (if buffer available)
      if (file.buffer) {
        const contentValidation = await this.validateFileContent(file.buffer, file.mimetype);
        if (!contentValidation.isValid) {
          result.errors.push(...contentValidation.errors);
        }
        if (contentValidation.warnings.length > 0) {
          result.warnings.push(...contentValidation.warnings);
        }
      }

      // Overall validation result
      result.isValid = result.errors.length === 0 && 
                      Object.values(result.securityChecks).every(check => check);

      // Log successful validation
      if (result.isValid) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.FILE_UPLOAD,
          severity: SecuritySeverity.LOW,
          message: `Secure file upload validated: ${file.originalname}`,
          ip,
          userAgent,
          endpoint: 'file-upload',
          details: {
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            hash: result.fileInfo.hash
          }
        });
      } else {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.SECURITY_VIOLATION,
          severity: SecuritySeverity.HIGH,
          message: `File upload validation failed: ${file.originalname}`,
          ip,
          userAgent,
          endpoint: 'file-upload',
          details: {
            filename: file.originalname,
            errors: result.errors,
            securityChecks: result.securityChecks
          }
        });
      }

    } catch (error) {
      result.errors.push('File validation system error');
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'File validation system error',
        ip,
        userAgent,
        endpoint: 'file-validation',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          filename: file.originalname
        }
      });
    }

    return result;
  }

  /**
   * Validate and sanitize file paths (ASVS V12.3.1)
   */
  validatePath(inputPath: string): PathValidationResult {
    const result: PathValidationResult = {
      isValid: true,
      sanitizedPath: inputPath,
      errors: [],
      detectedAttacks: []
    };

    // Check for path traversal attempts
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(inputPath)) {
        result.isValid = false;
        result.errors.push('Path traversal attempt detected');
        result.detectedAttacks.push('path-traversal');
        break;
      }
    }

    // Check for absolute paths (should be relative)
    if (path.isAbsolute(inputPath)) {
      result.isValid = false;
      result.errors.push('Absolute paths are not allowed');
      result.detectedAttacks.push('absolute-path');
    }

    // Check for null bytes
    if (inputPath.includes('\0') || inputPath.includes('\x00')) {
      result.isValid = false;
      result.errors.push('Null bytes detected in path');
      result.detectedAttacks.push('null-byte-injection');
    }

    // Sanitize path
    result.sanitizedPath = path.normalize(inputPath);
    
    // Ensure sanitized path doesn't go outside allowed directory
    if (result.sanitizedPath.startsWith('../') || result.sanitizedPath.includes('/../')) {
      result.isValid = false;
      result.errors.push('Path attempts to access parent directories');
      result.detectedAttacks.push('directory-traversal');
    }

    return result;
  }

  /**
   * Validate filename characters and length
   */
  private validateFilename(filename: string): boolean {
    // Check length
    if (filename.length > this.maxFilenameLength || filename.length === 0) {
      return false;
    }

      // Check for illegal characters
      // eslint-disable-next-line no-control-regex
      const illegalChars = /[<>:"|?*\x00-\x1f]/;
    if (illegalChars.test(filename)) {
      return false;
    }

    // Check for reserved Windows names
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(filename)) {
      return false;
    }

    // Check for leading/trailing dots or spaces
    if (filename.startsWith('.') || filename.endsWith('.') || 
        filename.startsWith(' ') || filename.endsWith(' ')) {
      return false;
    }

    return true;
  }

  /**
   * Validate content type consistency
   */
  private validateContentTypeConsistency(mimeType: string, extension: string): boolean {
    const mimeToExt: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/rtf': ['.rtf'],
      'application/rtf': ['.rtf']
    };

    const expectedExtensions = mimeToExt[mimeType];
    return expectedExtensions ? expectedExtensions.includes(extension) : false;
  }

  /**
   * Validate file content (basic checks)
   */
  private async validateFileContent(buffer: Buffer, mimeType: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // Check for embedded executables or scripts
      if (this.containsExecutableContent(buffer)) {
        result.isValid = false;
        result.errors.push('File contains executable content');
      }

      // Check file signature matches MIME type
      if (!this.validateFileSignature(buffer, mimeType)) {
        result.warnings.push('File signature does not match declared MIME type');
      }

      // Check for excessive metadata or hidden content
      if (this.hasExcessiveMetadata(buffer)) {
        result.warnings.push('File contains excessive metadata');
      }

    } catch (error) {
      result.warnings.push('Unable to fully validate file content');
    }

    return result;
  }

  /**
   * Check for executable content in file
   */
  private containsExecutableContent(buffer: Buffer): boolean {
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // MZ (Windows PE)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (could contain executables)
    ];

    for (const signature of executableSignatures) {
      if (buffer.indexOf(signature) === 0) {
        return true;
      }
    }

    // Check for script content in text files
    const textContent = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /#!\s*\/bin/i,
      /cmd\.exe/i,
      /powershell/i
    ];

    return scriptPatterns.some(pattern => pattern.test(textContent));
  }

  /**
   * Validate file signature matches MIME type
   */
  private validateFileSignature(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 4) return false;

    const signatures: Record<string, Buffer[]> = {
      'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
      'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])], // OLE compound
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 
        [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP
    };

    const expectedSignatures = signatures[mimeType];
    if (!expectedSignatures) return true; // No signature check for unknown types

    return expectedSignatures.some(signature => 
      buffer.indexOf(signature) === 0
    );
  }

  /**
   * Check for excessive metadata
   */
  private hasExcessiveMetadata(buffer: Buffer): boolean {
    // Simple heuristic: if file is mostly metadata vs content
    const metadataIndicators = [
      /creator/gi,
      /producer/gi,
      /metadata/gi,
      /exif/gi
    ];

    const textContent = buffer.toString('utf8');
    const metadataMatches = metadataIndicators.reduce((count, pattern) => {
      return count + (textContent.match(pattern) || []).length;
    }, 0);

    // If more than 10% of 1KB sample is metadata indicators
    return metadataMatches > textContent.length * 0.1;
  }

  /**
   * Create secure file path for storage
   */
  createSecureStoragePath(originalFilename: string, userId: string): string {
    // Generate secure filename
    const extension = path.extname(originalFilename);
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    
    const secureFilename = `${userHash}-${timestamp}-${randomSuffix}${extension}`;
    
    // Create safe directory structure
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    return path.join('uploads', 'documents', String(year), month, secureFilename);
  }

  /**
   * Log security violations
   */
  private logSecurityViolation(
    violationType: string, 
    filename: string, 
    attacks: string[], 
    ip: string, 
    userAgent: string
  ): void {
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.SECURITY_VIOLATION,
      severity: SecuritySeverity.HIGH,
      message: `File security violation: ${violationType}`,
      ip,
      userAgent,
      endpoint: 'file-security',
      details: {
        violationType,
        filename,
        detectedAttacks: attacks
      }
    });
  }

  /**
   * Get file security statistics
   */
  getSecurityStats(): {
    totalValidations: number;
    blockedUploads: number;
    pathTraversalAttempts: number;
    dangerousFileAttempts: number;
  } {
    // This would be implemented with proper metrics collection
    // For now, returning placeholder values
    return {
      totalValidations: 0,
      blockedUploads: 0,
      pathTraversalAttempts: 0,
      dangerousFileAttempts: 0
    };
  }
}

export const fileSecurityService = new FileSecurityService();