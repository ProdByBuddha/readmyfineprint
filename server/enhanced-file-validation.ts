import crypto from 'crypto';
import { FileValidator } from './file-validation';

// Enhanced MIME type detection with magic number analysis
interface MimeDetectionResult {
  detectedMimeType: string;
  confidence: number;
  fileSignature: string;
  isValid: boolean;
  warning?: string;
}

// Comprehensive file signature database
const FILE_SIGNATURES: { [key: string]: { signature: number[]; mimeType: string; extension: string; offset: number } } = {
  // PDF signatures
  'pdf_standard': { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', extension: '.pdf', offset: 0 },
  
  // Microsoft Office (modern)
  'docx_zip': { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx', offset: 0 },
  'xlsx_zip': { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx', offset: 0 },
  'pptx_zip': { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: '.pptx', offset: 0 },
  
  // Microsoft Office (legacy)
  'doc_ole': { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], mimeType: 'application/msword', extension: '.doc', offset: 0 },
  
  // Text files (UTF-8 BOM)
  'txt_utf8_bom': { signature: [0xEF, 0xBB, 0xBF], mimeType: 'text/plain', extension: '.txt', offset: 0 },
  
  // Archive formats (potential security risk)
  'zip': { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip', extension: '.zip', offset: 0 },
  'rar': { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], mimeType: 'application/vnd.rar', extension: '.rar', offset: 0 },
  '7z': { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], mimeType: 'application/x-7z-compressed', extension: '.7z', offset: 0 },
  
  // Executable formats (security risk)
  'exe_mz': { signature: [0x4D, 0x5A], mimeType: 'application/x-msdownload', extension: '.exe', offset: 0 },
  'elf': { signature: [0x7F, 0x45, 0x4C, 0x46], mimeType: 'application/x-executable', extension: '', offset: 0 },
  
  // Script files (security risk)
  'html': { signature: [0x3C, 0x68, 0x74, 0x6D, 0x6C], mimeType: 'text/html', extension: '.html', offset: 0 },
  'xml': { signature: [0x3C, 0x3F, 0x78, 0x6D, 0x6C], mimeType: 'text/xml', extension: '.xml', offset: 0 }
};

// Suspicious patterns that might indicate malicious content
const SUSPICIOUS_PATTERNS = [
  // JavaScript patterns
  { pattern: /<script\s*>/i, description: 'Embedded JavaScript', risk: 'HIGH' },
  { pattern: /eval\s*\(/i, description: 'JavaScript eval() function', risk: 'HIGH' },
  { pattern: /document\.write\s*\(/i, description: 'JavaScript document.write', risk: 'MEDIUM' },
  
  // Command injection patterns
  { pattern: /\$\(.*\)/g, description: 'Shell command substitution', risk: 'HIGH' },
  { pattern: /`.*`/g, description: 'Backtick command execution', risk: 'HIGH' },
  
  // SQL injection patterns
  { pattern: /union\s+select/i, description: 'SQL UNION SELECT', risk: 'HIGH' },
  { pattern: /drop\s+table/i, description: 'SQL DROP TABLE', risk: 'HIGH' },
  
  // File inclusion patterns
  { pattern: /\.\.\/.*\.\.\//, description: 'Directory traversal', risk: 'HIGH' },
  { pattern: /\/etc\/passwd/, description: 'System file access', risk: 'HIGH' },
  
  // Macro patterns (for Office documents)
  { pattern: /Sub\s+\w+\s*\(/i, description: 'VBA macro subroutine', risk: 'MEDIUM' },
  { pattern: /Private\s+Sub\s+/i, description: 'VBA private subroutine', risk: 'MEDIUM' },
  { pattern: /WScript\.Shell/i, description: 'Windows Script Host access', risk: 'HIGH' }
];

// Simple enhanced file validation with MIME type checking
export class EnhancedFileValidator {
  
  // MIME type magic number signatures
  private static readonly SIGNATURES = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // ZIP-based
    'application/msword': [0xD0, 0xCF, 0x11, 0xE0], // MS Office
    'text/plain': null // No specific signature
  };

  /**
   * Enhanced MIME type validation with magic number checking
   */
  static validateMimeType(buffer: Buffer, reportedMimeType: string): {
    isValid: boolean;
    detectedType?: string;
    warning?: string;
  } {
    const signature = this.SIGNATURES[reportedMimeType as keyof typeof this.SIGNATURES];
    
    if (!signature) {
      // For text files or unknown types, just accept
      return { isValid: true, detectedType: reportedMimeType };
    }

    // Check if buffer starts with expected signature
    if (buffer.length < signature.length) {
      return { 
        isValid: false, 
        warning: 'File too small to validate signature' 
      };
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return { 
          isValid: false, 
          warning: `MIME type mismatch: file signature doesn't match ${reportedMimeType}`,
          detectedType: 'unknown'
        };
      }
    }

    return { isValid: true, detectedType: reportedMimeType };
  }

  /**
   * Check for suspicious content patterns
   */
  static scanForThreats(buffer: Buffer): {
    threats: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 32768)).toLowerCase();
    const threats: string[] = [];

    // Check for common threat patterns
    const patterns = [
      { pattern: /<script/i, threat: 'JavaScript code detected' },
      { pattern: /eval\s*\(/i, threat: 'Eval function detected' },
      { pattern: /\$\(.*\)/g, threat: 'Shell command pattern' },
      { pattern: /union\s+select/i, threat: 'SQL injection pattern' }
    ];

    for (const { pattern, threat } of patterns) {
      if (pattern.test(content)) {
        threats.push(threat);
      }
    }

    const riskLevel = threats.length > 2 ? 'HIGH' : threats.length > 0 ? 'MEDIUM' : 'LOW';
    return { threats, riskLevel };
  }

  /**
   * Enhanced file validation combining MIME and threat detection
   */
  static async validateFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{
    isValid: boolean;
    warnings: string[];
    threats: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const warnings: string[] = [];
    
    // MIME type validation
    const mimeValidation = this.validateMimeType(buffer, mimeType);
    if (!mimeValidation.isValid) {
      warnings.push(mimeValidation.warning || 'MIME type validation failed');
    }

    // Threat scanning
    const threatScan = this.scanForThreats(buffer);
    
    // Overall validation
    const isValid = mimeValidation.isValid && threatScan.riskLevel !== 'HIGH';
    
    return {
      isValid,
      warnings,
      threats: threatScan.threats,
      riskLevel: threatScan.riskLevel
    };
  }
}

export const enhancedFileValidator = EnhancedFileValidator; 