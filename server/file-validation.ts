import crypto from 'crypto';
import multer from 'multer';

// File type definitions with magic numbers (file signatures)
interface FileTypeDefinition {
  mimeType: string;
  extensions: string[];
  maxSize: number;
  magicNumbers: Buffer[];
  description: string;
}

// Comprehensive file type definitions with magic number validation
const ALLOWED_FILE_TYPES: Record<string, FileTypeDefinition> = {
  'text/plain': {
    mimeType: 'text/plain',
    extensions: ['.txt'],
    maxSize: 5 * 1024 * 1024, // 5MB for text files
    magicNumbers: [], // Text files don't have specific magic numbers
    description: 'Plain text document'
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    maxSize: 25 * 1024 * 1024, // 25MB for DOCX files
    magicNumbers: [
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP signature (DOCX is ZIP-based)
      Buffer.from([0x50, 0x4B, 0x05, 0x06]), // ZIP signature (empty archive)
      Buffer.from([0x50, 0x4B, 0x07, 0x08])  // ZIP signature (spanned archive)
    ],
    description: 'Microsoft Word document'
  },
  'application/pdf': {
    mimeType: 'application/pdf',
    extensions: ['.pdf'],
    maxSize: 25 * 1024 * 1024, // 25MB for PDF files
    magicNumbers: [
      Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
    ],
    description: 'PDF document'
  }
};

// Security validation result interface
interface ValidationResult {
  isValid: boolean;
  error?: string;
  detectedMimeType?: string;
  sanitizedFilename?: string;
  fileHash?: string;
}

// Enhanced file validation class
export class FileValidator {
  private static readonly MAX_FILENAME_LENGTH = 255;
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.ps1', '.sh', '.php', '.asp', '.aspx', '.jsp', '.dll', '.sys'
  ];

  /**
   * Comprehensive file validation with MIME type, magic number, and security checks
   */
  static async validateFile(
    buffer: Buffer,
    originalFilename: string,
    reportedMimeType: string
  ): Promise<ValidationResult> {
    try {
      // Step 1: Basic validation
      const basicValidation = this.validateBasicConstraints(buffer, originalFilename);
      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Step 2: Filename security validation
      const filenameValidation = this.validateFilename(originalFilename);
      if (!filenameValidation.isValid) {
        return filenameValidation;
      }

      // Step 3: MIME type validation
      const mimeValidation = this.validateMimeType(reportedMimeType);
      if (!mimeValidation.isValid) {
        return mimeValidation;
      }

      // Step 4: Magic number validation (file signature)
      const magicValidation = this.validateFileSignature(buffer, reportedMimeType);
      if (!magicValidation.isValid) {
        return magicValidation;
      }

      // Step 5: Content analysis for additional security
      const contentValidation = this.validateFileContent(buffer, reportedMimeType);
      if (!contentValidation.isValid) {
        return contentValidation;
      }

      // Step 6: Generate file hash for integrity
      const fileHash = this.generateFileHash(buffer);

      return {
        isValid: true,
        detectedMimeType: reportedMimeType,
        sanitizedFilename: this.sanitizeFilename(originalFilename),
        fileHash
      };

    } catch (error) {
      console.error('File validation error:', error);
      return {
        isValid: false,
        error: 'File validation failed due to internal error'
      };
    }
  }

  /**
   * Validate basic file constraints
   */
  private static validateBasicConstraints(buffer: Buffer, filename: string): ValidationResult {
    if (!buffer || buffer.length === 0) {
      return { isValid: false, error: 'File is empty or corrupted' };
    }

    if (!filename || filename.trim().length === 0) {
      return { isValid: false, error: 'Filename is required' };
    }

    if (buffer.length > 50 * 1024 * 1024) { // 50MB absolute maximum
      return { isValid: false, error: 'File size exceeds maximum limit of 50MB' };
    }

    return { isValid: true };
  }

  /**
   * Validate and sanitize filename for security
   */
  private static validateFilename(filename: string): ValidationResult {
    // Check for dangerous file extensions
    const lowerFilename = filename.toLowerCase();
    for (const dangerousExt of this.DANGEROUS_EXTENSIONS) {
      if (lowerFilename.endsWith(dangerousExt)) {
        return {
          isValid: false,
          error: `File type ${dangerousExt} is not allowed for security reasons`
        };
      }
    }

    // Check filename length
    if (filename.length > this.MAX_FILENAME_LENGTH) {
      return {
        isValid: false,
        error: `Filename too long (maximum ${this.MAX_FILENAME_LENGTH} characters)`
      };
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return {
        isValid: false,
        error: 'Filename contains invalid characters'
      };
    }

    // Check for directory traversal attempts
    if (filename.includes('..') || filename.includes('./') || filename.includes('.\\')) {
      return {
        isValid: false,
        error: 'Filename contains directory traversal patterns'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate MIME type against allowed types
   */
  private static validateMimeType(mimeType: string): ValidationResult {
    if (!mimeType) {
      return { isValid: false, error: 'MIME type is required' };
    }

    if (!ALLOWED_FILE_TYPES[mimeType]) {
      const allowedTypes = Object.keys(ALLOWED_FILE_TYPES).join(', ');
      return {
        isValid: false,
        error: `File type '${mimeType}' is not supported. Allowed types: ${allowedTypes}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file signature (magic numbers) to prevent MIME type spoofing
   */
  private static validateFileSignature(buffer: Buffer, mimeType: string): ValidationResult {
    const fileType = ALLOWED_FILE_TYPES[mimeType];

    // Skip magic number validation for text files
    if (mimeType === 'text/plain') {
      return this.validateTextFile(buffer);
    }

    if (fileType.magicNumbers.length === 0) {
      return { isValid: true }; // No magic numbers to check
    }

    // Check if file starts with any of the valid magic numbers
    const fileHeader = buffer.slice(0, 8); // Check first 8 bytes
    const hasValidSignature = fileType.magicNumbers.some(magic =>
      fileHeader.slice(0, magic.length).equals(magic)
    );

    if (!hasValidSignature) {
      return {
        isValid: false,
        error: `File signature doesn't match declared type '${mimeType}'. Possible file type spoofing.`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate text file content for security
   */
  private static validateTextFile(buffer: Buffer): ValidationResult {
    try {
      // Check if it's valid UTF-8 text
      const text = buffer.toString('utf-8');

      // Check for extremely long lines that might indicate binary content
      const lines = text.split('\n');
      const maxLineLength = 10000; // 10KB per line should be enough for text

      for (const line of lines) {
        if (line.length > maxLineLength) {
          return {
            isValid: false,
            error: 'Text file contains unusually long lines, might be binary content'
          };
        }
      }

      // Check for suspicious binary patterns
      const binaryIndicators = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07',
        '\x08', '\x0E', '\x0F', '\x10', '\x11', '\x12', '\x13', '\x14'
      ];

      for (const indicator of binaryIndicators) {
        if (text.includes(indicator)) {
          return {
            isValid: false,
            error: 'Text file contains binary data patterns'
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'File is not valid UTF-8 text'
      };
    }
  }

  /**
   * Additional content validation for specific file types
   */
  private static validateFileContent(buffer: Buffer, mimeType: string): ValidationResult {
    const fileType = ALLOWED_FILE_TYPES[mimeType];

    // Check file size against type-specific limits
    if (buffer.length > fileType.maxSize) {
      return {
        isValid: false,
        error: `File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum for ${fileType.description} (${Math.round(fileType.maxSize / 1024 / 1024)}MB)`
      };
    }

    // Additional validation for specific types
    switch (mimeType) {
      case 'application/pdf':
        return this.validatePdfContent(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.validateDocxContent(buffer);
      default:
        return { isValid: true };
    }
  }

  /**
   * Validate PDF content structure
   */
  private static validatePdfContent(buffer: Buffer): ValidationResult {
    const pdfString = buffer.toString('ascii', 0, Math.min(1024, buffer.length));

    // Check for PDF version header
    if (!pdfString.startsWith('%PDF-')) {
      return {
        isValid: false,
        error: 'Invalid PDF file - missing PDF header'
      };
    }

    // Check for PDF end marker (in last 1KB)
    const endBuffer = buffer.slice(Math.max(0, buffer.length - 1024));
    const endString = endBuffer.toString('ascii');
    if (!endString.includes('%%EOF')) {
      return {
        isValid: false,
        error: 'Invalid PDF file - missing end marker'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate DOCX content structure (ZIP-based)
   */
  private static validateDocxContent(buffer: Buffer): ValidationResult {
    try {
      // DOCX files are ZIP archives, so check for ZIP structure
      // Look for central directory structure
      const centralDirSignature = Buffer.from([0x50, 0x4B, 0x01, 0x02]);
      let hasCentralDir = false;

      for (let i = 0; i <= buffer.length - 4; i++) {
        if (buffer.slice(i, i + 4).equals(centralDirSignature)) {
          hasCentralDir = true;
          break;
        }
      }

      if (!hasCentralDir) {
        return {
          isValid: false,
          error: 'Invalid DOCX file - missing ZIP central directory'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid DOCX file structure'
      };
    }
  }

  /**
   * Generate SHA-256 hash of file for integrity checking
   */
  static generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Sanitize filename by removing dangerous characters
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace dangerous chars with underscore
      .replace(/\.+/g, '.') // Replace multiple dots with single dot
      .replace(/^\./, '_') // Don't allow filenames starting with dot
      .slice(0, this.MAX_FILENAME_LENGTH); // Truncate if too long
  }

  /**
   * Get allowed file types for client-side validation
   */
  static getAllowedFileTypes(): Record<string, Omit<FileTypeDefinition, 'magicNumbers'>> {
    const result: Record<string, Omit<FileTypeDefinition, 'magicNumbers'>> = {};

    for (const [mimeType, definition] of Object.entries(ALLOWED_FILE_TYPES)) {
      result[mimeType] = {
        mimeType: definition.mimeType,
        extensions: definition.extensions,
        maxSize: definition.maxSize,
        description: definition.description
      };
    }

    return result;
  }

  /**
   * Check if a MIME type is allowed
   */
  static isAllowedMimeType(mimeType: string): boolean {
    return mimeType in ALLOWED_FILE_TYPES;
  }
}

// Multer file filter function using the enhanced validator
export function createSecureFileFilter() {
  return (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Basic MIME type check (preliminary)
    if (!FileValidator.isAllowedMimeType(file.mimetype)) {
      const allowedTypes = Object.keys(ALLOWED_FILE_TYPES).join(', ');
      return cb(new Error(`File type '${file.mimetype}' is not supported. Allowed types: ${allowedTypes}`));
    }

    // Additional filename validation
    const filenameValidation = FileValidator['validateFilename'](file.originalname);
    if (!filenameValidation.isValid) {
      return cb(new Error(filenameValidation.error || 'Invalid filename'));
    }

    cb(null, true);
  };
}
