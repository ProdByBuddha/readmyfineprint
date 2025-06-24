import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, databaseStorage } from "./storage";
import { consentLogger } from "./consent";
import { requireAdminAuth, optionalUserAuth, requireUserAuth, requireConsent } from "./auth";
import { insertDocumentSchema } from "@shared/schema";
import { analyzeDocument } from "./openai";
import { analyzeDocumentWithPII } from "./openai-with-pii";
import { FileValidator, createSecureFileFilter } from "./file-validation";
import { securityLogger, getClientInfo } from "./security-logger";
import multer from "multer";
import { z } from "zod";
import mammoth from "mammoth";
import pdfParse from 'pdf-parse';
import { fromPath } from "pdf2pic";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import Stripe from "stripe";
import { securityAlertManager } from './security-alert';
import { emailService } from './email-service';
import { emailVerificationService } from './email-verification';
import { registerUserRoutes } from './user-routes';
import { registerAdminRoutes } from './admin-routes';
import { registerEmailRecoveryRoutes } from './email-recovery-routes';
import { indexNowService } from './indexnow-service';
import { subscriptionService } from './subscription-service';
import { getTierById, SUBSCRIPTION_TIERS } from './subscription-tiers';
import { priorityQueue } from './priority-queue';

// Initialize Stripe instances for both test and live modes
const getStripeInstance = (useTestMode: boolean = false) => {
  const secretKey = useTestMode 
    ? process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(`Missing required Stripe secret key for ${useTestMode ? 'test' : 'live'} mode`);
  }

  return new Stripe(secretKey);
};

// Default stripe instance (live mode)
const stripe = getStripeInstance(false);

// Customer Portal configuration cache to avoid repeated API calls
const portalConfigCache = new Map<string, { config: any; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Ensure Customer Portal configuration exists
async function ensureCustomerPortalConfiguration(stripeInstance: Stripe): Promise<void> {
  // Determine environment based on NODE_ENV instead of API host
  const cacheKey = process.env.NODE_ENV === 'development' ? 'test' : 'live';
  const cached = portalConfigCache.get(cacheKey);
  
  // Return cached config if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return;
  }

  try {
    // Check if any configurations exist
    const configurations = await stripeInstance.billingPortal.configurations.list({ limit: 1 });
    
    if (configurations.data.length === 0) {
      console.log(`Creating default Customer Portal configuration for ${cacheKey} mode`);
      
      // Create default configuration
      const config = await stripeInstance.billingPortal.configurations.create({
        business_profile: {
          headline: 'ReadMyFinePrint - Subscription Management',
          privacy_policy_url: 'https://readmyfineprint.com/privacy',
          terms_of_service_url: 'https://readmyfineprint.com/terms',
        },
        features: {
          customer_update: {
            enabled: true,
            allowed_updates: ['email', 'address', 'shipping', 'phone', 'tax_id'],
          },
          invoice_history: {
            enabled: true,
          },
          payment_method_update: {
            enabled: true,
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            proration_behavior: 'none',
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features', 
                'switched_service',
                'unused',
                'other'
              ],
            },
          },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ['price', 'quantity', 'promotion_code'],
            proration_behavior: 'create_prorations',
          },
        },
        default_return_url: 'https://readmyfineprint.com/subscription',
      });

      portalConfigCache.set(cacheKey, { config, timestamp: Date.now() });
      console.log(`Customer Portal configuration created: ${config.id}`);
    } else {
      // Cache existing configuration
      portalConfigCache.set(cacheKey, { 
        config: configurations.data[0], 
        timestamp: Date.now() 
      });
    }
  } catch (error: any) {
    console.error(`Error ensuring Customer Portal configuration:`, error);
    // Don't throw - let the portal session creation handle the error
  }
}

// Configure multer for file uploads with enhanced security
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (will be validated per file type)
    files: 1, // Only one file at a time
    fieldSize: 1024 * 1024, // 1MB field size limit
    fieldNameSize: 100, // Field name size limit
  },
  fileFilter: createSecureFileFilter()
});

// Enhanced PDF text extraction using pdf-parse with smart configuration selection
async function extractPdfText(buffer: Buffer): Promise<string> {
  console.log(`🔍 Starting PDF extraction (buffer size: ${buffer.length} bytes)`);
  
  // Check if PDF is problematic by doing a quick parse test
  const isProblematicPdf = await checkIfProblematicPdf(buffer);
  
  let configsToTry: any[];
  
  if (isProblematicPdf) {
    console.log(`⚠️ Detected problematic PDF, using tolerant configurations`);
    // For problematic PDFs: normalize text config first, then minimal config
    configsToTry = [
      {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: 0
      },
      {
        // Minimal config fallback
        max: 0
      }
    ];
  } else {
    console.log(`✅ PDF appears well-formed, using optimal configurations`);
    // For well-formed PDFs: preserve structure first, then normalize text fallback
    configsToTry = [
      {
        normalizeWhitespace: false,
        disableCombineTextItems: true,
        max: 0
      },
      {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: 0
      }
    ];
  }

  for (let i = 0; i < configsToTry.length; i++) {
    try {
      const configType = isProblematicPdf 
        ? (i === 0 ? 'normalize text' : 'minimal') 
        : (i === 0 ? 'preserve structure' : 'normalize text');
      
      console.log(`📄 Trying ${configType} configuration (${i + 1}/${configsToTry.length})`);
      const data = await pdfParse(buffer, configsToTry[i]);
      
      console.log(`📄 PDF-parse results (${configType}):`);
      console.log(`   - Pages: ${data.numpages}`);
      console.log(`   - Text length: ${data.text.length} characters`);
      
      if (data.text && data.text.trim().length >= 50) {
        // Check if the text contains readable content (not just PDF structures)
        const readableContent = data.text.replace(/[^\w\s]/g, '').trim();
        const readableRatio = readableContent.length / data.text.length;
        
        if (readableRatio > 0.3) { // At least 30% readable characters
          console.log(`✅ PDF text extraction successful with ${configType} config (${data.text.length} chars, ${Math.round(readableRatio * 100)}% readable)`);
          
          // Clean up the extracted text
          let cleanText = data.text
            .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
          
          return cleanText;
        } else {
          console.log(`⚠️ ${configType}: Text not readable enough (${Math.round(readableRatio * 100)}% readable)`);
        }
      } else {
        console.log(`⚠️ ${configType}: Text too short (${data.text?.length || 0} chars)`);
      }
      
    } catch (error) {
      const configType = isProblematicPdf 
        ? (i === 0 ? 'normalize text' : 'minimal') 
        : (i === 0 ? 'preserve structure' : 'normalize text');
      console.log(`❌ ${configType} config failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`⚠️ All pdf-parse configurations failed, falling back to enhanced extraction`);
  return await extractPdfTextBasic(buffer);
}

// Function to detect if PDF is problematic
async function checkIfProblematicPdf(buffer: Buffer): Promise<boolean> {
  try {
    // Quick test with minimal config to see if PDF has structural issues
    const testData = await pdfParse(buffer, { max: 1 }); // Only parse first page for test
    
    // Check for common signs of problematic PDFs
    const pdfString = buffer.toString('latin1');
    const hasWarningIndicators = 
      pdfString.includes('Lexer_getName') ||
      pdfString.includes('Unterminated string') ||
      pdfString.includes('End of file') ||
      buffer.length < 5000; // Very small PDFs are often problematic
    
    return hasWarningIndicators;
  } catch (error) {
    // If quick test fails, definitely problematic
    console.log(`🔍 Quick PDF test failed, treating as problematic:`, error instanceof Error ? error.message : String(error));
    return true;
  }
}

// Enhanced basic PDF text extraction function (fallback)
async function extractPdfTextBasic(buffer: Buffer): Promise<string> {
  try {
    console.log(`🔧 Using enhanced basic PDF extraction (fallback method)`);
    
    let extractedText = '';

    // Convert buffer to string with different encodings to handle various PDF formats
    const encodings = ['latin1', 'utf8', 'ascii', 'binary'];
    let pdfString = '';
    
    for (const encoding of encodings) {
      try {
        pdfString = buffer.toString(encoding as BufferEncoding);
        if (pdfString.includes('%PDF-') && pdfString.length > 100) {
          console.log(`📄 Using ${encoding} encoding for PDF parsing`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Approach 1: Enhanced text object extraction with better patterns
    const textPatterns = [
      // Standard text operators with improved regex
      /\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*?)\)\s*Tj/gi,
      /\[((?:[^\[\]\\]|\\[\\()nrtbf\[\]]|\\[0-7]{1,3})*?)\]\s*TJ/gi,
      // Text positioning with content
      /(?:\d+(?:\.\d+)?\s+){2}Td\s*\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*?)\)\s*Tj/gi,
      // Text matrix with content
      /(?:\d+(?:\.\d+)?\s+){6}Tm\s*\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*?)\)\s*Tj/gi,
      // Font and text combinations
      /\/\w+\s+\d+(?:\.\d+)?\s+Tf\s*\(((?:[^()\\]|\\[\\()nrtbf]|\\[0-7]{1,3})*?)\)\s*Tj/gi,
      // Simple text in quotes (common in some PDFs)
      /"([^"]{2,50})"/g,
      /'([^']{2,50})'/g
    ];

    textPatterns.forEach((pattern, patternIndex) => {
      const matches = pdfString.match(pattern);
      if (matches) {
        console.log(`📝 Pattern ${patternIndex + 1}: Found ${matches.length} matches`);
        matches.forEach(match => {
          // Extract text content from parentheses, brackets, or quotes
          const textMatch = match.match(/\(((?:[^()\\]|\\.)*?)\)/) || 
                           match.match(/\[((?:[^\[\]\\]|\\.)*?)\]/) ||
                           match.match(/"([^"]+)"/) ||
                           match.match(/'([^']+)'/);
          
          if (textMatch && textMatch[1]) {
            const rawText = textMatch[1];
            
            // Enhanced PDF text escape sequence decoding
            const decodedText = rawText
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\b/g, '\b')
              .replace(/\\f/g, '\f')
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"')
              .replace(/\\\(/g, '(')
              .replace(/\\\)/g, ')')
              .replace(/\\\\/g, '\\')
              .replace(/\\([0-7]{1,3})/g, (match, octal) => {
                const code = parseInt(octal, 8);
                return code >= 32 && code <= 126 ? String.fromCharCode(code) : ' ';
              })
              .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
              })
              .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
                const code = parseInt(hex, 16);
                return code >= 32 && code <= 126 ? String.fromCharCode(code) : ' ';
              })
              .replace(/\\./g, ' '); // Replace any other escape sequences with space

            // Filter for readable text (more permissive)
            if (decodedText.length > 1 && /[a-zA-Z0-9]/.test(decodedText)) {
              extractedText += decodedText + ' ';
            }
          }
        });
      }
    });

    // Approach 2: Look for plaintext content in uncompressed PDF streams
    if (extractedText.trim().length < 50) {
      console.log(`🔄 Trying uncompressed stream content extraction`);
      
      // Look for content between stream markers (uncompressed streams)
      const streamPattern = /stream\s*([\s\S]*?)\s*endstream/gi;
      let streamMatch;
      
      while ((streamMatch = streamPattern.exec(pdfString)) !== null) {
        const streamContent = streamMatch[1];
        
        // Skip obviously compressed or binary streams
        if (streamContent.includes('\u0000') || streamContent.length < streamContent.replace(/[^\x20-\x7E]/g, '').length * 0.5) {
          continue;
        }
        
        // Look for readable text in stream content with more flexible patterns
        const readableChunks = streamContent.match(/[a-zA-Z0-9\s.,!?;:()\[\]{}'"%-]{3,}/g);
        if (readableChunks) {
          readableChunks.forEach(chunk => {
            const cleaned = chunk.trim();
            // More permissive filtering
            if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
              extractedText += cleaned + ' ';
            }
          });
        }
      }
    }

    // Approach 3: Look for text in PDF object definitions
    if (extractedText.trim().length < 50) {
      console.log(`🔄 Trying PDF object text extraction`);
      
      // Look for text in object definitions
      const objectPattern = /obj[\s\S]*?\/Contents\s*\[([\s\S]*?)\]/gi;
      let objMatch;
      
      while ((objMatch = objectPattern.exec(pdfString)) !== null) {
        const content = objMatch[1];
        // Extract readable strings from object content
        const stringMatches = content.match(/\(([^)]+)\)/g);
        if (stringMatches) {
          stringMatches.forEach(str => {
            const cleaned = str.replace(/[()]/g, '').trim();
            if (cleaned.length > 2 && /[a-zA-Z]/.test(cleaned)) {
              extractedText += cleaned + ' ';
            }
          });
        }
      }
    }

    // Approach 4: Direct text search with improved patterns
    if (extractedText.trim().length < 30) {
      console.log(`🔄 Trying enhanced direct text pattern matching`);
      
      // Look for sequences of readable characters
      const textSequences = pdfString.match(/[a-zA-Z][a-zA-Z0-9\s.,!?;:()\[\]{}'"%-]{4,50}[a-zA-Z0-9]/g);
      
      if (textSequences && textSequences.length > 5) {
        const meaningfulSequences = textSequences.filter(seq => {
          const wordCount = seq.split(/\s+/).filter(w => w.length > 1).length;
          return wordCount >= 2 && seq.length > 5;
        });
        
        if (meaningfulSequences.length > 0) {
          extractedText = meaningfulSequences.slice(0, 100).join(' ');
        }
      }
    }

    // Clean and validate extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add spaces between camelCase
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // Add spaces between letters and numbers
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')  // Add spaces between numbers and letters
      .replace(/\s*[(){}\[\]]\s*/g, ' ')     // Clean up stray brackets
      .trim();

    console.log(`📊 Enhanced extraction summary:`);
    console.log(`   - Total length: ${extractedText.length} characters`);
    console.log(`   - Word count: ~${extractedText.split(/\s+/).filter(w => w.length > 0).length} words`);
    console.log(`   - Readable ratio: ${extractedText.length > 0 ? ((extractedText.match(/[a-zA-Z]/g) || []).length / extractedText.length * 100).toFixed(1) : 0}%`);

    // More lenient validation - accept if we have some readable content
    if (extractedText.length < 20 || (extractedText.match(/[a-zA-Z]/g) || []).length / extractedText.length < 0.2) {
      console.log(`❌ Enhanced extraction: Text too short or not readable enough`);
      console.log(`📝 Extracted preview: "${extractedText.substring(0, 200)}"`);
      
      return "This PDF contains complex formatting or may be image-based. Try these alternatives:\n\n" +
             "• Copy and paste text directly from your PDF viewer\n" +
             "• Convert to Word (.docx) format using an online converter\n" +
             "• Save as plain text (.txt) from your PDF application\n" +
             "• Use a different PDF that contains selectable text\n\n" +
             "For best results, upload documents with selectable, copyable text rather than scanned images.";
    }

    console.log(`✅ Enhanced extraction successful (${extractedText.length} chars)`);
    console.log(`📝 First 200 characters: "${extractedText.substring(0, 200)}"`);
    
    return extractedText;
    
  } catch (error) {
    console.error('🚫 Enhanced basic PDF extraction error:', error);
    return "PDF processing encountered an error. Please try:\n\n" +
           "• Converting the PDF to Word (.docx) or text (.txt) format\n" +
           "• Copy-pasting the content directly\n" +
           "• Using a different PDF file\n\n" +
           "If this issue persists, the PDF may be encrypted or corrupted.";
  }
}

async function extractTextFromFile(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  try {
    // First, perform comprehensive file validation
    const validationResult = await FileValidator.validateFile(buffer, filename, mimetype);

    if (!validationResult.isValid) {
      throw new Error(`File validation failed: ${validationResult.error}`);
    }

    console.log(`✅ File validation passed for ${validationResult.sanitizedFilename} (Hash: ${validationResult.fileHash?.substring(0, 8)}...)`);

    let extractedText: string;

    switch (mimetype) {
      case 'text/plain':
        extractedText = buffer.toString('utf-8');
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        extractedText = docxResult.value;
        break;

      case 'application/pdf':
        extractedText = await extractPdfText(buffer);
        break;

      default:
        throw new Error(`File type ${mimetype} is not supported. Please use TXT or DOCX files, or paste the content directly.`);
    }

    // Debug the extracted content
    console.log(`📋 Final extracted text for ${filename}:`);
    console.log(`   - Length: ${extractedText.length} characters`);
    console.log(`   - Word count: ~${extractedText.split(/\s+/).length} words`);
    console.log(`   - First 300 chars: "${extractedText.substring(0, 300).replace(/\n/g, '\\n')}"`);
    console.log(`   - Last 200 chars: "${extractedText.substring(Math.max(0, extractedText.length - 200)).replace(/\n/g, '\\n')}"`);
    
    if (extractedText.length < 100) {
      console.log(`⚠️ WARNING: Extracted text is very short (${extractedText.length} chars) - this may affect analysis quality`);
    }

    return extractedText;
  } catch (error) {
    console.error('Error processing file:', error);
    throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

    // Log consent acceptance
  app.post("/api/consent", async (req, res) => {
    try {
      const result = await consentLogger.logConsent(req);
      res.json(result);
    } catch (error) {
      console.error("Error logging consent:", error);
      // Don't fail the request if consent logging fails
      res.json({
        success: false,
        message: "Consent logging failed, but you can continue using the service"
      });
    }
  });

  // Verify user consent (for proving specific user consent)
  app.post("/api/consent/verify", async (req, res) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const proof = await consentLogger.verifyUserConsent(ip, userAgent);
      if (proof) {
        res.json({ hasConsented: true, proof });
      } else {
        res.json({ hasConsented: false, proof: null });
      }
    } catch (error) {
      console.error("Error verifying consent:", error);
      res.status(500).json({ error: "Failed to verify consent" });
    }
  });

  // Verify consent by token (for users to verify their own consent)
  app.post("/api/consent/verify-token", async (req, res) => {
    try {
      const { consentId, verificationToken } = req.body;

      if (!consentId || !verificationToken) {
        return res.status(400).json({ error: "consentId and verificationToken are required" });
      }

      const proof = await consentLogger.verifyConsentByToken(consentId, verificationToken);
      if (proof) {
        res.json({ valid: true, proof });
      } else {
        res.json({ valid: false, proof: null });
      }
    } catch (error) {
      console.error("Error verifying consent by token:", error);
      res.status(500).json({ error: "Failed to verify consent" });
    }
  });

  // Get consent statistics (admin only)
  app.get("/api/consent/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await consentLogger.getConsentStats();
      if (stats) {
        res.json(stats);
      } else {
        res.status(503).json({ error: "Statistics unavailable" });
      }
    } catch (error) {
      console.error("Error getting consent stats:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // Get security statistics (admin only)
  app.get("/api/security/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = securityLogger.getSecurityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting security stats:", error);
      res.status(500).json({ error: "Failed to get security statistics" });
    }
  });

  // Get recent security events (admin only)
  app.get("/api/security/events", requireAdminAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000); // Max 1000 events
      const events = securityLogger.getRecentEvents(limit);
      res.json({ events, total: events.length });
    } catch (error) {
      console.error("Error getting security events:", error);
      res.status(500).json({ error: "Failed to get security events" });
    }
  });

  // Create document from text input
  app.post("/api/documents", async (req: any, res) => {
    try {
      const { title, content, fileType } = insertDocumentSchema.parse(req.body);

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Document content is required" });
      }

      const document = await storage.createDocument(req.sessionId, {
        title: title || "Untitled Document",
        content,
        fileType: fileType || "text",
        analysis: null
      });

      res.json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Upload document file
  app.post("/api/documents/upload", requireConsent, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        securityLogger.logFileUploadRejected(req, 'unknown', 'unknown', 'No file provided');
        return res.status(400).json({ error: "No file uploaded" });
      }

      const content = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);

      // Generate client fingerprint for session tracking
      const { ip: uploadIp, userAgent: uploadUA } = getClientInfo(req);
      const uploadClientFingerprint = crypto.createHash('md5').update(`${uploadIp}:${uploadUA}`).digest('hex').substring(0, 16);

      const document = await storage.createDocument(req.sessionId, {
        title: req.file.originalname || "Uploaded Document",
        content,
        fileType: req.file.mimetype,
        analysis: null
      }, uploadClientFingerprint);

      // Debug logging for document creation
      console.log(`✅ Document created: ID=${document.id}, SessionID=${req.sessionId}, Title="${document.title}"`);

      // Log successful file upload
      const fileHash = FileValidator.generateFileHash(req.file.buffer);
      securityLogger.logFileUploadSuccess(
        req,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        fileHash
      );

      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);

      // Log file validation/upload failure
      if (req.file) {
        securityLogger.logFileValidationFailed(
          req,
          req.file.originalname,
          req.file.mimetype,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      res.status(400).json({ error: error instanceof Error ? error.message : "File upload failed" });
    }
  });

  // Analyze document
  app.post("/api/documents/:id/analyze", async (req: any, res) => {
    // Check consent for analysis - this is the main functionality that requires consent
    try {
      const { ip, userAgent } = getClientInfo(req);
      
      // Skip consent check for admin users
      const adminKey = process.env.ADMIN_API_KEY;
      const providedKey = req.headers['x-admin-key'] as string;
      const adminToken = req.headers['x-admin-token'] as string;
      
      if (!(adminKey && (providedKey === adminKey || adminToken))) {
        // Check for valid consent for analysis
        const consentProof = await consentLogger.verifyUserConsent(ip, userAgent);
        
        if (!consentProof) {
          securityLogger.logSecurityEvent(
            ip, 
            userAgent, 
            'CONSENT_REQUIRED', 
            'HIGH', 
            `Analysis denied - no valid consent found for ${req.path}`,
            req.path
          );
          
          return res.status(403).json({
            error: 'Consent required for document analysis',
            message: 'You must accept our terms and conditions to analyze documents',
            code: 'CONSENT_REQUIRED',
            requiresConsent: true
          });
        }
      }
    } catch (error) {
      console.error('Error checking consent for analysis:', error);
      return res.status(500).json({
        error: 'Unable to verify consent',
        message: 'Please try again or contact support',
        code: 'CONSENT_VERIFICATION_ERROR'
      });
    }
    try {
      const documentId = parseInt(req.params.id);

      // Debug logging for session and document lookup
      console.log(`🔍 Analysis request: DocumentID=${documentId}, SessionID=${req.sessionId}`);

      // Generate client fingerprint for session consolidation
      const { ip: clientIp, userAgent: clientUA } = getClientInfo(req);
      const clientFingerprint = crypto.createHash('md5').update(`${clientIp}:${clientUA}`).digest('hex').substring(0, 16);

      let document = await storage.getDocument(req.sessionId, documentId, clientFingerprint);

      let originalSessionId = null;
      
      if (!document) {
        // For sample contracts, try to find the document in any recent session from the same client
        console.log(`🔍 Document ${documentId} not found in current session, checking for sample contract in recent sessions`);
        
        // Try to find the document across all sessions (for sample contracts that are session-independent)
        const allSessions = storage.getAllSessions();
        
        for (const [sessionId, sessionData] of allSessions) {
          const sessionDoc = await storage.getDocument(sessionId, documentId);
          if (sessionDoc && sessionDoc.title.startsWith('Sample:')) {
            console.log(`📋 Found sample contract ${documentId} in session ${sessionId}, making accessible to current session`);
            // Copy the document to the current session for analysis
            await storage.createDocument(req.sessionId, {
              title: sessionDoc.title,
              content: sessionDoc.content,
              fileType: sessionDoc.fileType || undefined,
              analysis: sessionDoc.analysis
            }, clientFingerprint, documentId);
            document = sessionDoc;
            originalSessionId = sessionId;
            break;
          }
        }

        if (!document) {
          // Enhanced error logging for debugging
          const allDocs = await storage.getAllDocuments(req.sessionId);
          console.log(`❌ Document ${documentId} not found in session ${req.sessionId}`);
          console.log(`📋 Available documents in session: ${allDocs.map(d => `ID:${d.id}`).join(', ') || 'none'}`);
          return res.status(404).json({
            error: "Document not found",
            debug: {
              requestedId: documentId,
              sessionId: req.sessionId,
              availableDocuments: allDocs.map(d => ({ id: d.id, title: d.title }))
            }
          });
        } else {
          console.log(`✅ Sample contract ${documentId} made accessible from session ${originalSessionId} to ${req.sessionId}`);
        }
      }

      if (document.analysis) {
        return res.json(document);
      }

      // Get client information for security logging
      const analysisIp = req.ip || req.socket.remoteAddress || 'unknown';
      const analysisUserAgent = req.get('User-Agent') || 'unknown';

      // Check for subscription token first (priority over session-based auth)
      let userId = req.user?.id || req.sessionId || "anonymous";
      let subscriptionData;
      
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      if (subscriptionToken) {
        console.log(`🔑 Found subscription token in analysis request: ${subscriptionToken.slice(0, 16)}...`);
        
        // Validate subscription token and get user data
        const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
        
        subscriptionData = await subscriptionService.validateSubscriptionToken(
          subscriptionToken, 
          deviceFingerprint, 
          clientIp
        );
        
        if (subscriptionData) {
          // Extract actual user ID from token validation
          const { hybridTokenService } = await import('./hybrid-token-service');
          const tokenData = await hybridTokenService.validateSubscriptionToken(subscriptionToken);
          if (tokenData) {
            userId = tokenData.userId;
            console.log(`✅ Using subscription token user: ${userId} (${subscriptionData.tier.name} tier)`);
          }
        } else {
          console.warn(`❌ Invalid subscription token provided: ${subscriptionToken.slice(0, 16)}...`);
        }
      }
      
      // If no valid subscription token, fall back to regular user/session lookup
      if (!subscriptionData) {
        console.log(`📊 No valid subscription token, using session/user-based lookup for: ${userId}`);
        subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);
      }

      // Check if user can analyze another document
      if (subscriptionData.tier.limits.documentsPerMonth !== -1) {
        if (subscriptionData.usage.documentsAnalyzed >= subscriptionData.tier.limits.documentsPerMonth) {
          return res.status(429).json({
            error: "Monthly document limit reached",
            limit: subscriptionData.tier.limits.documentsPerMonth,
            used: subscriptionData.usage.documentsAnalyzed,
            resetDate: subscriptionData.usage.resetDate,
            suggestedUpgrade: subscriptionData.suggestedUpgrade
          });
        }
      }

      // Use priority queue for subscription-based processing priority

      // Check if user already has a request in queue to prevent spam
      if (priorityQueue.hasUserRequestInQueue(userId)) {
        return res.status(429).json({
          error: "You already have a document being processed. Please wait for it to complete.",
          queueStats: priorityQueue.getQueueStats()
        });
      }

      // Add estimated wait time to response for user feedback
      const estimatedWaitTime = priorityQueue.getEstimatedWaitTime(subscriptionData.tier.id);

      // Process document analysis through priority queue with PII protection
      const analysisResult = await priorityQueue.addToQueue(
        userId,
        subscriptionData.tier.id,
        async () => {
          return await analyzeDocumentWithPII(
            document.content, 
            document.title, 
            {
              ip: analysisIp,
              userAgent: analysisUserAgent,
              sessionId: req.sessionId,
              model: subscriptionData.tier.model,
              userId: userId,
              piiDetection: {
                enabled: true, // Always enabled for maximum privacy protection
                detectNames: true,
                minConfidence: 0.7 // High confidence threshold for production
              }
            }
          );
        }
      );

      // Update document with analysis results and redaction info
      const updatedDocument = await storage.updateDocumentAnalysis(
        req.sessionId, 
        documentId, 
        analysisResult.analysis, 
        clientFingerprint,
        analysisResult.redactionInfo
      );

      // If this was a sample contract copied from another session, sync the analysis back to the original session
      if (originalSessionId && originalSessionId !== req.sessionId) {
        try {
          await storage.updateDocumentAnalysis(originalSessionId, documentId, analysisResult.analysis, clientFingerprint, analysisResult.redactionInfo);
          console.log(`🔄 Analysis synced back to original session ${originalSessionId} for sample contract ${documentId}`);
        } catch (syncError) {
          console.warn(`⚠️ Failed to sync analysis back to original session ${originalSessionId}:`, syncError instanceof Error ? syncError.message : String(syncError));
        }
      }

      console.log(`✅ Document ${documentId} analysis completed for ${subscriptionData.tier.id} tier user`);
      res.json(updatedDocument);
    } catch (error) {
      console.error("Error analyzing document:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Analysis failed" });
    }
  });

  // Audit subscription tiers (admin only)
  app.get("/api/admin/subscription-audit", requireAdminAuth, async (req, res) => {
    try {
      const auditResults = await subscriptionService.auditSubscriptionTiers();

      res.json({
        success: true,
        audit: auditResults,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error running subscription audit:", error);
      res.status(500).json({ 
        error: "Failed to run subscription audit",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user subscription with usage data
  app.get("/api/user/subscription", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      let subscriptionData;
      
      // Check for subscription token first (for persistent subscription access)
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      if (subscriptionToken) {
        // Get device fingerprint and client IP for security validation
        const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        
        subscriptionData = await subscriptionService.validateSubscriptionToken(
          subscriptionToken, 
          deviceFingerprint, 
          clientIp
        );
        
        if (subscriptionData) {
          // Add the token to response so frontend can store it
          res.setHeader('X-Subscription-Token', subscriptionToken);
          return res.json(subscriptionData);
        } else {
          // Token was invalid or expired - clear it from client
          res.setHeader('X-Subscription-Token-Invalid', 'true');
        }
      }
      
      // Fall back to user/session-based subscription
      const userId = req.user?.id || req.sessionId || "anonymous";
      subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);
      
      res.json(subscriptionData);
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ 
        error: "Failed to fetch subscription data",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Revoke subscription token (admin only)
  app.post("/api/admin/revoke-token", requireAdminAuth, async (req, res) => {
    try {
      const { token, reason } = req.body;
      if (!token || !reason) {
        return res.status(400).json({ error: 'Token and reason are required' });
      }
      
      const success = await subscriptionService.revokeSubscriptionToken(token, reason);
      if (success) {
        res.json({ success: true, message: 'Token revoked successfully' });
      } else {
        res.status(404).json({ error: 'Token not found' });
      }
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({ error: 'Failed to revoke token' });
    }
  });

  // Revoke all tokens for a user (admin only)
  app.post("/api/admin/revoke-user-tokens", requireAdminAuth, async (req, res) => {
    try {
      const { userId, reason } = req.body;
      if (!userId || !reason) {
        return res.status(400).json({ error: 'User ID and reason are required' });
      }
      
      const revokedCount = await subscriptionService.revokeAllUserTokens(userId, reason);
      res.json({ 
        success: true, 
        message: `Revoked ${revokedCount} tokens for user ${userId}`,
        revokedCount 
      });
    } catch (error) {
      console.error("Error revoking user tokens:", error);
      res.status(500).json({ error: 'Failed to revoke user tokens' });
    }
  });

  // Get user device information (admin only)
  app.get("/api/admin/user-devices/:userId", requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      // Device data is only available for legacy PostgreSQL tokens
      // JOSE tokens don't track device data
      // Simplified device data for hybrid token system
      res.json({
        userId,
        devices: [],
        totalDevices: 0,
        recentDevices: 0
      });
    } catch (error) {
      console.error("Error getting user devices:", error);
      res.status(500).json({ error: 'Failed to get user devices' });
    }
  });

  // Token cleanup and statistics (admin only)
  app.post("/api/admin/cleanup-tokens", requireAdminAuth, async (req, res) => {
    try {
      const { hybridTokenService } = await import('./hybrid-token-service');
      const results = await hybridTokenService.cleanupExpired();
      
      res.json({
        success: true,
        message: 'Token cleanup completed',
        tokensRemoved: results.tokensRemoved
      });
    } catch (error) {
      console.error("Error during token cleanup:", error);
      res.status(500).json({ error: 'Failed to cleanup tokens' });
    }
  });

  // Step 1: Request verification code for subscription login
  app.post("/api/subscription/login/request-code", requireConsent, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }

      // Find user by email
      const user = await databaseStorage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ 
          error: 'No subscription found for this email address. Please check your email or subscribe first.',
          code: 'NO_USER_FOUND'
        });
      }

      // Get user's subscription data
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);
      
      // Only allow login if user has active subscription
      if (!subscriptionData.subscription) {
        return res.status(404).json({ 
          error: 'No subscription found for this email address. Please subscribe first.',
          code: 'NO_SUBSCRIPTION'
        });
      }
      
      if (subscriptionData.subscription.status !== 'active') {
        return res.status(403).json({ 
          error: 'Your subscription is not active. Please renew your subscription or contact support.',
          code: 'SUBSCRIPTION_INACTIVE',
          status: subscriptionData.subscription.status
        });
      }

      // Generate verification code
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string || 'unknown';
      const clientIp = getClientInfo(req).ip;
      
      const codeResult = await emailVerificationService.generateCode(
        email,
        deviceFingerprint,
        clientIp
      );

      if (!codeResult.success) {
        return res.status(429).json({ error: codeResult.error });
      }

      // Send verification code via email
      try {
        await emailService.sendEmail({
          to: email,
          subject: 'Your ReadMyFinePrint Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Device Verification Required</h2>
              <p>Someone is trying to access your ReadMyFinePrint subscription from a new device.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h3 style="margin: 0; color: #2563eb;">Your verification code:</h3>
                <div style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 10px 0; letter-spacing: 4px;">${codeResult.code}</div>
                <p style="margin: 0; color: #666; font-size: 14px;">This code expires in 10 minutes</p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                ReadMyFinePrint - Secure Document Analysis
              </p>
            </div>
          `
        });
        
        console.log(`📧 Verification code sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return res.status(500).json({ error: 'Failed to send verification code' });
      }

      res.json({
        success: true,
        message: 'Verification code sent to your email',
        expiresAt: codeResult.expiresAt
      });
    } catch (error) {
      console.error("Error requesting verification code:", error);
      res.status(500).json({ 
        error: "Failed to request verification code",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Step 2: Verify code and complete login
  app.post("/api/subscription/login/verify", requireConsent, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }
      if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Valid 6-digit code required' });
      }

      const deviceFingerprint = req.headers['x-device-fingerprint'] as string || 'unknown';
      const clientIp = getClientInfo(req).ip;

      // Verify the code
      const verificationResult = await emailVerificationService.verifyCode(
        email,
        code,
        deviceFingerprint,
        clientIp
      );

      if (!verificationResult.success) {
        return res.status(400).json({ 
          error: verificationResult.error,
          attemptsRemaining: verificationResult.attemptsRemaining
        });
      }

      // Code verified! Now complete the login
      const user = await databaseStorage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);
      
      // Generate new device token for this login
      const newToken = await subscriptionService.generateSubscriptionToken(
        user.id,
        subscriptionData.subscription!.id,
        deviceFingerprint
      );

      res.json({
        success: true,
        token: newToken,
        subscription: subscriptionData
      });
    } catch (error) {
      console.error("Error verifying subscription login:", error);
      res.status(500).json({ 
        error: "Failed to verify login",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get subscription token after successful checkout
  app.get("/api/subscription/token/:sessionId", requireConsent, async (req, res) => {
    try {
      const { sessionId } = req.params;
      console.log(`🔍 Token retrieval request for session: ${sessionId}`);
      
      // Get token by checkout session ID
      const token = await subscriptionService.getTokenBySession(sessionId);
      console.log(`🔑 Token lookup result: ${token ? `${token.slice(0, 8)}...` : 'not found'}`);
      
      if (token) {
        // Validate the token exists and return subscription data
        const subscriptionData = await subscriptionService.validateSubscriptionToken(token);
        if (subscriptionData) {
          console.log(`✅ Token validation successful for session: ${sessionId}`);
          res.json({ 
            token,
            subscription: subscriptionData
          });
        } else {
          console.warn(`❌ Token validation failed for session: ${sessionId}`);
          res.status(404).json({ error: 'Invalid or expired token' });
        }
      } else {
        console.warn(`❌ No token found for session: ${sessionId}`);
        
        // For failed token retrieval, try to check if the Stripe session exists and is paid
        try {
          const useTestMode = process.env.NODE_ENV === 'development';
          const stripeInstance = getStripeInstance(useTestMode);
          const stripeSession = await stripeInstance.checkout.sessions.retrieve(sessionId);
          
          if (stripeSession.payment_status === 'paid' && stripeSession.mode === 'subscription') {
            console.log(`💳 Found paid Stripe session but no token - webhook may not have processed yet`);
            res.status(202).json({ 
              error: 'Payment processing', 
              message: 'Your payment was successful. Please wait a moment and try again.',
              retryAfter: 3000 // Suggest retry after 3 seconds
            });
          } else {
            res.status(404).json({ error: 'No token found for this session' });
          }
        } catch (stripeError) {
          console.warn(`Could not retrieve Stripe session ${sessionId}:`, stripeError instanceof Error ? stripeError.message : String(stripeError));
          res.status(404).json({ error: 'No token found for this session' });
        }
      }
    } catch (error) {
      console.error(`❌ Error retrieving subscription token for session ${req.params.sessionId}:`, error);
      res.status(500).json({ 
        error: "Failed to retrieve subscription token",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create subscription checkout session
  app.post("/api/subscription/create-checkout", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      // Input validation
      const checkoutSchema = z.object({
        tierId: z.string(),
        billingCycle: z.enum(['monthly', 'yearly'])
      });

      const { tierId, billingCycle } = checkoutSchema.parse(req.body);
      
      // Get tier information
      const tier = getTierById(tierId);
      if (!tier) {
        return res.status(400).json({ error: "Invalid tier ID" });
      }

      // Calculate price based on billing cycle
      const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
      const userId = req.user?.id || req.sessionId || "anonymous";

      // Auto-detect test mode based on development environment
      const useTestMode = process.env.NODE_ENV === 'development';
      const stripeInstance = getStripeInstance(useTestMode);

      // Create Stripe checkout session for subscription
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tier.name} Plan ${useTestMode ? '(TEST)' : ''}`,
              description: tier.description,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
            recurring: {
              interval: billingCycle === 'yearly' ? 'year' : 'month',
            },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscription`,
        client_reference_id: userId,
        metadata: {
          tierId,
          billingCycle,
          userId,
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating subscription checkout session:", error);
      res.status(500).json({ 
        error: "Failed to create checkout session",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cancel subscription
  app.post("/api/subscription/cancel", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      const cancelSchema = z.object({
        subscriptionId: z.string(),
        immediate: z.boolean().default(false)
      });

      const { subscriptionId, immediate } = cancelSchema.parse(req.body);
      let userId = req.user?.id || req.sessionId || "anonymous";
      let subscriptionData;

      // Check for subscription token authentication first
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      
      if (subscriptionToken) {
        const clientIp = getClientInfo(req).ip;
        subscriptionData = await subscriptionService.validateSubscriptionToken(subscriptionToken, deviceFingerprint, clientIp);
        
        if (subscriptionData && subscriptionData.subscription) {
          userId = subscriptionData.subscription.userId;
        } else {
          return res.status(401).json({ 
            error: "Your subscription token is invalid or expired. Please log in again." 
          });
        }
      } else {
        // Check if user is authenticated via session
        if (userId === "anonymous" || userId.startsWith('session_')) {
          return res.status(401).json({ 
            error: "You must be logged in to cancel a subscription. Please log in with your subscription account first." 
          });
        }
      }

      // Auto-detect test mode
      const useTestMode = process.env.NODE_ENV === 'development';
      const stripeInstance = getStripeInstance(useTestMode);

      // Cancel the subscription in Stripe
      const subscription = await stripeInstance.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediate,
      });

      if (immediate) {
        await stripeInstance.subscriptions.cancel(subscriptionId);
      }

      // Update local subscription status
      await subscriptionService.cancelSubscription(userId, immediate);

      res.json({ 
        success: true,
        message: immediate ? "Subscription canceled immediately" : "Subscription will cancel at period end"
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ 
        error: "Failed to cancel subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Downgrade to free tier (cancels Stripe subscription)
  app.post("/api/subscription/downgrade-to-free", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      let userId = req.user?.id || req.sessionId || "anonymous";
      let subscriptionData;
      
      console.log(`[Downgrade] Initial userId: ${userId}, sessionId: ${req.sessionId}, user: ${req.user ? 'authenticated' : 'not authenticated'}`);
      
      // Check for subscription token authentication first
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      
      console.log(`[Downgrade] Headers - subscription token: ${subscriptionToken ? 'present' : 'missing'}, device fingerprint: ${deviceFingerprint ? 'present' : 'missing'}`);
      
      if (subscriptionToken) {
        console.log(`[Downgrade] Attempting subscription token authentication`);
        const clientIp = getClientInfo(req).ip;
        subscriptionData = await subscriptionService.validateSubscriptionToken(subscriptionToken, deviceFingerprint, clientIp);
        
        if (subscriptionData && subscriptionData.subscription) {
          // Extract user ID from validated subscription
          userId = subscriptionData.subscription.userId;
          console.log(`[Downgrade] Authenticated via subscription token, userId: ${userId}`);
        } else {
          console.log(`[Downgrade] Subscription token invalid or expired`);
          return res.status(401).json({ 
            error: "Your subscription token is invalid or expired. Please log in again." 
          });
        }
      } else {
        // Check if user is authenticated via session
        if (userId === "anonymous" || userId.startsWith('session_')) {
          return res.status(401).json({ 
            error: "You must be logged in to downgrade a subscription. Please log in with your subscription account first." 
          });
        }
      }
      
      // Get user's current subscription (use already fetched data if available)
      const currentSubscription = subscriptionData || await subscriptionService.getUserSubscriptionWithUsage(userId);
      
      console.log(`[Downgrade] User ${userId} subscription status: ${currentSubscription.subscription ? 'has subscription' : 'no subscription'}, tier: ${currentSubscription.tier.id}`);
      
      if (!currentSubscription.subscription) {
        return res.status(400).json({ 
          error: "No active subscription found to downgrade. You are already on the free tier." 
        });
      }

      if (currentSubscription.tier.id === 'free') {
        return res.status(400).json({ 
          error: "You are already on the free tier." 
        });
      }

      // If user has a Stripe subscription, cancel it
      if (currentSubscription.subscription.stripeSubscriptionId) {
        const useTestMode = process.env.NODE_ENV === 'development';
        const stripeInstance = getStripeInstance(useTestMode);

        // Cancel the subscription in Stripe (at period end to preserve access)
        await stripeInstance.subscriptions.update(currentSubscription.subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        console.log(`📉 Downgraded subscription ${currentSubscription.subscription.stripeSubscriptionId} to free tier (will cancel at period end)`);
      }

      // Update local subscription status to indicate downgrade
      await subscriptionService.cancelSubscription(userId, false);

      res.json({ 
        success: true,
        message: "Successfully downgraded to free tier. Your subscription will remain active until the end of your billing period."
      });
    } catch (error) {
      console.error("Error downgrading to free tier:", error);
      res.status(500).json({ 
        error: "Failed to downgrade subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create Stripe Customer Portal session for payment method updates
  app.post("/api/subscription/customer-portal", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      let userId = req.user?.id || req.sessionId || "anonymous";
      let subscriptionData;
      
      // Check for subscription token authentication first
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      
      if (subscriptionToken) {
        const clientIp = getClientInfo(req).ip;
        subscriptionData = await subscriptionService.validateSubscriptionToken(subscriptionToken, deviceFingerprint, clientIp);
        
        if (subscriptionData && subscriptionData.subscription) {
          userId = subscriptionData.subscription.userId;
        } else {
          return res.status(401).json({ 
            error: "Your subscription token is invalid or expired. Please log in again." 
          });
        }
      } else {
        // Check if user is authenticated via session
        if (userId === "anonymous" || userId.startsWith('session_')) {
          return res.status(401).json({ 
            error: "You must be logged in to access payment settings. Please log in with your subscription account first." 
          });
        }
      }
      
      // Get user's current subscription
      const currentSubscription = subscriptionData || await subscriptionService.getUserSubscriptionWithUsage(userId);
      
      if (!currentSubscription.subscription || !currentSubscription.subscription.stripeCustomerId) {
        return res.status(400).json({ 
          error: "No active subscription found. Please subscribe to a plan first." 
        });
      }

      // Auto-detect test mode
      const useTestMode = process.env.NODE_ENV === 'development';
      const stripeInstance = getStripeInstance(useTestMode);

      // Ensure Customer Portal configuration exists
      await ensureCustomerPortalConfiguration(stripeInstance);

      // Create customer portal session
      const session = await stripeInstance.billingPortal.sessions.create({
        customer: currentSubscription.subscription.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/subscription?tab=billing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating customer portal session:", error);
      res.status(500).json({ 
        error: "Failed to create customer portal session",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reactivate cancelled subscription (remove cancelAtPeriodEnd)
  app.post("/api/subscription/reactivate", requireConsent, optionalUserAuth, async (req, res) => {
    try {
      let userId = req.user?.id || req.sessionId || "anonymous";
      let subscriptionData;
      
      // Check for subscription token authentication first
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      
      if (subscriptionToken) {
        const clientIp = getClientInfo(req).ip;
        subscriptionData = await subscriptionService.validateSubscriptionToken(subscriptionToken, deviceFingerprint, clientIp);
        
        if (subscriptionData && subscriptionData.subscription) {
          userId = subscriptionData.subscription.userId;
        } else {
          return res.status(401).json({ 
            error: "Your subscription token is invalid or expired. Please log in again." 
          });
        }
      } else {
        // Check if user is authenticated via session
        if (userId === "anonymous" || userId.startsWith('session_')) {
          return res.status(401).json({ 
            error: "You must be logged in to reactivate a subscription. Please log in with your subscription account first." 
          });
        }
      }
      
      // Get user's current subscription
      const currentSubscription = subscriptionData || await subscriptionService.getUserSubscriptionWithUsage(userId);
      
      if (!currentSubscription.subscription || !currentSubscription.subscription.stripeSubscriptionId) {
        return res.status(400).json({ 
          error: "No subscription found to reactivate." 
        });
      }

      if (!currentSubscription.subscription.cancelAtPeriodEnd) {
        return res.status(400).json({ 
          error: "Subscription is not cancelled. Nothing to reactivate." 
        });
      }

      // Auto-detect test mode
      const useTestMode = process.env.NODE_ENV === 'development';
      const stripeInstance = getStripeInstance(useTestMode);

      // Reactivate the subscription in Stripe (remove cancel_at_period_end)
      await stripeInstance.subscriptions.update(currentSubscription.subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      // Update local subscription status
      await subscriptionService.reactivateSubscription(userId);

      res.json({ 
        success: true,
        message: "Subscription reactivated successfully. Your subscription will continue as normal."
      });
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ 
        error: "Failed to reactivate subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Validate specific user tier (admin only)
  app.get("/api/admin/validate-user-tier/:userId", requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;

      const validation = await subscriptionService.validateUserTier(userId);

      res.json({
        success: true,
        userId,
        validation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error validating user tier:", error);
      res.status(500).json({ 
        error: "Failed to validate user tier",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get processing queue status
  app.get("/api/queue/status", requireConsent, optionalUserAuth, async (req: any, res) => {
    try {
      const stats = priorityQueue.getQueueStats();

      const userId = req.user?.id || req.sessionId || "anonymous";
      const hasRequestInQueue = priorityQueue.hasUserRequestInQueue(userId);

      res.json({
        ...stats,
        userHasRequestInQueue: hasRequestInQueue,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error getting queue status:", error);
      res.status(500).json({ error: "Failed to get queue status" });
    }
  });

  // Get all documents
  app.get("/api/documents", async (req: any, res) => {
    try {
      const documents = await storage.getAllDocuments(req.sessionId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get specific document
  app.get("/api/documents/:id", async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);

            // Debug logging for document retrieval
      console.log(`📖 Get document request: DocumentID=${documentId}, SessionID=${req.sessionId}`);

      // Generate client fingerprint for session consolidation
      const { ip: getIp, userAgent: getUA } = getClientInfo(req);
      const getClientFingerprint = crypto.createHash('md5').update(`${getIp}:${getUA}`).digest('hex').substring(0, 16);

      const document = await storage.getDocument(req.sessionId, documentId, getClientFingerprint);

      if (!document) {
        console.log(`❌ Document ${documentId} not found in session ${req.sessionId} (GET)`);
        return res.status(404).json({ error: "Document not found" });
      }

      console.log(`✅ Document ${documentId} found and returned (GET)`);
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Clear all documents (fresh start)
  app.delete("/api/documents", requireConsent, async (req: any, res) => {
    try {
      await storage.clearAllDocuments(req.sessionId);
      res.json({ message: "All documents cleared successfully" });
    } catch (error) {
      console.error("Error clearing documents:", error);
      res.status(500).json({ error: "Failed to clear documents" });
    }
  });

  // Create payment intent endpoint with enhanced security and auto-detecting test/live mode
  app.post('/api/create-payment-intent', requireConsent, async (req, res) => {
    try {
      // Input validation schema
      const paymentSchema = z.object({
        amount: z.number().min(1).max(10000),
        currency: z.string().optional().default('usd'),
        metadata: z.object({}).optional()
      });

      const validatedData = paymentSchema.parse(req.body);
      const { ip, userAgent } = getClientInfo(req);

      // Auto-detect test mode based on development environment
      const useTestMode = process.env.NODE_ENV === 'development';

      // Get appropriate Stripe instance
      const stripeInstance = getStripeInstance(useTestMode);

      // Log payment intent creation
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Creating payment intent for $${validatedData.amount.toFixed(2)} (${useTestMode ? 'TEST' : 'LIVE'} mode)`,
        ip,
        userAgent,
        endpoint: "/api/create-payment-intent",
        details: { 
          amount: validatedData.amount,
          testMode: useTestMode
        }
      });

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(validatedData.amount * 100),
        currency: validatedData.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: "donation",
          source: "readmyfineprint",
          mode: useTestMode ? 'test' : 'live',
          ip: ip,
          timestamp: new Date().toISOString(),
          ...validatedData.metadata
        },
        description: `Donation to ReadMyFinePrint - $${validatedData.amount.toFixed(2)} (${useTestMode ? 'TEST' : 'LIVE'})`
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        testMode: useTestMode
      });

    } catch (error: any) {
      console.error('Payment intent creation failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input data',
          details: error.errors
        });
      }

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "HIGH" as any,
        message: `Payment intent creation failed: ${error.message}`,
        ip,
        userAgent,
        endpoint: "/api/create-payment-intent",
        details: { error: error.message }
      });

      res.status(500).json({ error: 'Payment processing unavailable' });
    }
  });

  app.get('/api/documents', async (req, res) => {
    try {
      const sessionId = (req as any).sessionId as string;
      const documents = await storage.getAllDocuments(sessionId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Stripe webhook endpoint with proper validation for both test and live modes
  app.post('/api/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    let isTestMode = false;

    try {
      // Try live webhook secret first
      const liveWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const testWebhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;

      let webhookSecret = liveWebhookSecret;
      let stripeInstance = stripe;

      // Try to construct event with live webhook secret
      try {
        if (liveWebhookSecret) {
          event = stripe.webhooks.constructEvent(req.body, sig as string, liveWebhookSecret);
        }
      } catch (liveError) {
        // If live webhook fails, try test webhook
        if (testWebhookSecret) {
          try {
            stripeInstance = getStripeInstance(true);
            event = stripeInstance.webhooks.constructEvent(req.body, sig as string, testWebhookSecret);
            isTestMode = true;
            console.log('📝 Processing TEST webhook event');
          } catch (testError) {
            throw liveError; // Throw the original live error if both fail
          }
        } else {
          throw liveError;
        }
      }

      if (!event) {
        return res.status(400).json({ error: 'Webhook secret not configured' });
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { ip, userAgent } = getClientInfo(req);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;

          securityLogger.logSecurityEvent({
            eventType: "API_ACCESS" as any,
            severity: "LOW" as any,
            message: `Payment webhook received: ${paymentIntent.id} (${isTestMode ? 'TEST' : 'LIVE'} mode)`,
            ip,
            userAgent,
            endpoint: "/api/stripe-webhook",
            details: { 
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency,
              testMode: isTestMode
            }
          });

          // Only send emails and update search engines for live payments
          if (!isTestMode) {
            // Send thank you email if customer email is available
            if (paymentIntent.receipt_email) {
              await emailService.sendDonationThankYou({
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                paymentIntentId: paymentIntent.id,
                customerEmail: paymentIntent.receipt_email,
                timestamp: new Date()
              });
            }

            // Notify search engines that donation page might have updated stats
            try {
              await indexNowService.submitUrls(['https://readmyfineprint.com/donate']);
            } catch (error) {
              console.warn('IndexNow submission failed after payment:', error);
            }
          } else {
            console.log(`💳 Test payment succeeded: ${paymentIntent.id} - $${(paymentIntent.amount / 100).toFixed(2)}`);
          }
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;

          securityLogger.logSecurityEvent({
            eventType: "API_ACCESS" as any,
            severity: isTestMode ? "LOW" : "MEDIUM" as any,
            message: `Payment failed webhook: ${failedPayment.id} (${isTestMode ? 'TEST' : 'LIVE'} mode)`,
            ip,
            userAgent,
            endpoint: "/api/stripe-webhook",
            details: { 
              paymentIntentId: failedPayment.id,
              amount: failedPayment.amount / 100,
              currency: failedPayment.currency,
              lastPaymentError: failedPayment.last_payment_error?.message || 'Unknown error',
              testMode: isTestMode
            }
          });

          console.log(`💳 Payment failed${isTestMode ? ' (TEST)' : ''}: ${failedPayment.id} - ${failedPayment.last_payment_error?.message || 'Unknown error'}`);
          break;

        case 'checkout.session.completed':
          const checkoutSession = event.data.object;
          
          console.log(`📝 Webhook checkout.session.completed received${isTestMode ? ' (TEST)' : ''}:`);
          console.log(`   Session ID: ${checkoutSession.id}`);
          console.log(`   Mode: ${checkoutSession.mode}`);
          console.log(`   Payment Status: ${checkoutSession.payment_status}`);
          console.log(`   Subscription ID: ${checkoutSession.subscription}`);
          console.log(`   Customer ID: ${checkoutSession.customer}`);
          console.log(`   Metadata:`, checkoutSession.metadata);
          
          // Only handle subscription checkouts (not one-time payments)
          if (checkoutSession.mode === 'subscription' && checkoutSession.subscription) {
            console.log(`🎉 Processing subscription checkout${isTestMode ? ' (TEST)' : ''}: ${checkoutSession.id}`);
            
            // Extract metadata from the checkout session
            const { tierId, billingCycle, userId } = checkoutSession.metadata || {};
            const stripeCustomerId = checkoutSession.customer;
            const stripeSubscriptionId = checkoutSession.subscription;
            
            console.log(`📋 Extracted data: tierId=${tierId}, userId=${userId}, customerId=${stripeCustomerId}, subscriptionId=${stripeSubscriptionId}`);
            
            if (tierId && userId && stripeCustomerId && stripeSubscriptionId) {
              try {
                console.log(`🚀 Starting subscription creation process...`);
                // Create or get user for this subscription
                let actualUserId = userId;
                
                // Check if user exists in database, create if needed
                if (userId === 'anonymous' || userId.startsWith('session_')) {
                  // Anonymous/session user - create a proper user account
                  let customerEmail = `subscriber_${stripeCustomerId}@subscription.internal`;
                  
                  try {
                    // Get customer details from Stripe to capture real email
                    const useTestMode = process.env.NODE_ENV === 'development';
                    const stripeInstance = getStripeInstance(useTestMode);
                    const customer = await stripeInstance.customers.retrieve(stripeCustomerId as string);
                    
                    if (customer && !customer.deleted && customer.email) {
                      customerEmail = customer.email;
                      console.log(`📧 Captured customer email for multi-device access: ${customerEmail}`);
                    }
                  } catch (emailError) {
                    console.warn('Could not retrieve customer email from Stripe:', emailError instanceof Error ? emailError.message : String(emailError));
                  }
                  
                  actualUserId = await subscriptionService.createSubscriptionUser({
                    stripeCustomerId: stripeCustomerId as string,
                    tierId,
                    email: customerEmail, // Real email if available, sanitized otherwise
                    source: 'stripe_checkout'
                  });
                  
                  console.log(`👤 Created subscription user: ${actualUserId} for customer ${stripeCustomerId}`);
                } else {
                  // For existing authenticated users, verify they exist in database
                  const existingUser = await databaseStorage.getUser(userId);
                  
                  if (!existingUser) {
                    console.log(`👤 User ${userId} not found in database, creating subscription user`);
                    
                    // User doesn't exist, create them with customer email if available
                    let customerEmail = `subscriber_${stripeCustomerId}@subscription.internal`;
                    
                    try {
                      const useTestMode = process.env.NODE_ENV === 'development';
                      const stripeInstance = getStripeInstance(useTestMode);
                      const customer = await stripeInstance.customers.retrieve(stripeCustomerId as string);
                      
                      if (customer && !customer.deleted && customer.email) {
                        customerEmail = customer.email;
                        console.log(`📧 Using customer email for missing user: ${customerEmail}`);
                      }
                    } catch (emailError) {
                      console.warn('Could not retrieve customer email from Stripe:', emailError instanceof Error ? emailError.message : String(emailError));
                    }
                    
                    actualUserId = await subscriptionService.createSubscriptionUser({
                      stripeCustomerId: stripeCustomerId as string,
                      tierId,
                      email: customerEmail,
                      source: 'stripe_checkout_missing_user'
                    });
                    
                    console.log(`👤 Created missing user: ${actualUserId} for customer ${stripeCustomerId}`);
                  } else {
                    actualUserId = userId;
                    console.log(`👤 Using existing user: ${actualUserId} for subscription`);
                  }
                }
                
                // Create the subscription record
                const subscription = await subscriptionService.createStripeSubscription({
                  userId: actualUserId,
                  tierId,
                  stripeCustomerId: stripeCustomerId as string,
                  stripeSubscriptionId: stripeSubscriptionId as string,
                  billingCycle: billingCycle || 'monthly',
                  status: 'active'
                });

                // Generate a persistent subscription access token
                // Note: Device fingerprint not available in webhook context
                const subscriptionToken = await subscriptionService.generateSubscriptionToken(actualUserId, subscription.id);
                
                // Store mapping from checkout session to token for frontend retrieval
                console.log(`💾 Storing session token mapping...`);
                await subscriptionService.storeSessionToken(checkoutSession.id, subscriptionToken);
                
                // Verify the token was stored correctly
                console.log(`🔍 Verifying token storage...`);
                const storedToken = await subscriptionService.getTokenBySession(checkoutSession.id);
                if (storedToken) {
                  console.log(`✅ Token storage verified: ${checkoutSession.id} -> ${storedToken.slice(0, 8)}...`);
                } else {
                  console.error(`❌ Token storage failed: No token found after storage attempt`);
                }
                
                console.log(`✅ Subscription created successfully:`);
                console.log(`   User ID: ${actualUserId}`);
                console.log(`   Subscription ID: ${subscription.id}`);
                console.log(`   Token: ${subscriptionToken.slice(0, 8)}...`);
                console.log(`   Checkout Session: ${checkoutSession.id}`);
                
                // Log security event
                securityLogger.logSecurityEvent({
                  eventType: "API_ACCESS" as any,
                  severity: "LOW" as any,
                  message: `Subscription created: ${stripeSubscriptionId} (${isTestMode ? 'TEST' : 'LIVE'} mode)`,
                  ip,
                  userAgent,
                  endpoint: "/api/stripe-webhook",
                  details: { 
                    subscriptionId: stripeSubscriptionId,
                    customerId: stripeCustomerId,
                    tierId,
                    billingCycle,
                    testMode: isTestMode
                  }
                });
              } catch (error) {
                console.error('❌ Error processing subscription checkout:', error);
                console.error('   Session ID:', checkoutSession.id);
                console.error('   Error details:', error instanceof Error ? error.message : String(error));
                console.error('   Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
                // Don't throw - we don't want to retry webhook processing for business logic errors
              }
            } else {
              console.warn('❌ Missing required metadata in checkout session:');
              console.warn('   Session ID:', checkoutSession.id);
              console.warn('   Available metadata:', checkoutSession.metadata);
              console.warn('   Required: tierId, userId, stripeCustomerId, stripeSubscriptionId');
              console.warn('   Missing:', {
                tierId: !tierId,
                userId: !userId,
                stripeCustomerId: !stripeCustomerId,
                stripeSubscriptionId: !stripeSubscriptionId
              });
            }
          } else {
            console.log(`ℹ️ Skipping non-subscription checkout session: ${checkoutSession.id} (mode: ${checkoutSession.mode})`);
          }
          break;

        case 'customer.subscription.updated':
          const updatedSubscription = event.data.object as any; // Type assertion for webhook data
          const customerId = updatedSubscription.customer;
          
          try {
            await subscriptionService.syncStripeSubscription({
              stripeSubscriptionId: updatedSubscription.id,
              stripeCustomerId: customerId as string,
              status: updatedSubscription.status,
              currentPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
            });
            
            console.log(`🔄 Subscription updated${isTestMode ? ' (TEST)' : ''}: ${updatedSubscription.id}`);
          } catch (error) {
            console.error('Error syncing subscription update:', error);
          }
          break;

        case 'customer.subscription.deleted':
          const canceledSubscription = event.data.object as any; // Type assertion for webhook data
          
          try {
            await subscriptionService.syncStripeSubscription({
              stripeSubscriptionId: canceledSubscription.id,
              stripeCustomerId: canceledSubscription.customer as string,
              status: 'canceled',
              currentPeriodStart: new Date(canceledSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: true
            });
            
            console.log(`❌ Subscription canceled${isTestMode ? ' (TEST)' : ''}: ${canceledSubscription.id}`);
          } catch (error) {
            console.error('Error syncing subscription cancellation:', error);
          }
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "HIGH" as any,
        message: `Webhook processing failed: ${error.message}`,
        ip,
        userAgent,
        endpoint: "/api/stripe-webhook",
        details: { error: error.message, eventType: event?.type }
      });

      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Test email configuration (admin only)
  app.post("/api/test-email", requireAdminAuth, async (req, res) => {
    try {
      const testResult = await emailService.testEmailConfiguration();

      if (testResult) {
        // Send a test email
        const testEmailSent = await emailService.sendDonationThankYou({
          amount: 25.00,
          currency: 'usd',
          paymentIntentId: 'test_payment_intent',
          customerEmail: process.env.DEFAULT_DONATION_EMAIL || 'admin@readmyfineprint.com',
          customerName: 'Test User',
          timestamp: new Date()
        });

        res.json({
          success: true,
          configured: true,
          testEmailSent,
          message: testEmailSent ? 'Test email sent successfully' : 'Email service configured but test email failed'
        });
      } else {
        res.json({
          success: false,
          configured: false,
          message: 'Email service not configured. Please set SMTP or Gmail environment variables.'
        });
      }
    } catch (error) {
      console.error('Email test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Email test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create Stripe Checkout Session with input validation and auto-detecting test/live mode
  app.post("/api/create-checkout-session", requireConsent, async (req, res) => {
    try {
      // Input validation with Zod
      const checkoutSchema = z.object({
        amount: z.number().min(1).max(10000),
        success_url: z.string().url().optional(),
        cancel_url: z.string().url().optional()
      });

      const validatedData = checkoutSchema.parse(req.body);
      const { amount } = validatedData;

      // Auto-detect test mode based on development environment
      const useTestMode = process.env.NODE_ENV === 'development';

      // Get appropriate Stripe instance
      const stripeInstance = getStripeInstance(useTestMode);

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Creating checkout session for $${amount.toFixed(2)} (${useTestMode ? 'TEST' : 'LIVE'} mode)`,
        ip,
        userAgent,
        endpoint: "/api/create-checkout-session",
        details: { 
          amount,
          testMode: useTestMode
        }
      });

      // Create Stripe Checkout Session with secure configuration
      const session = await stripeInstance.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Donation to ReadMyFinePrint ${useTestMode ? '(TEST)' : ''}`,
              description: 'Support our mission to make legal documents accessible to everyone',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: validatedData.success_url || `${req.protocol}://${req.get('host')}/donate?success=true&amount=${amount}`,
        cancel_url: validatedData.cancel_url || `${req.protocol}://${req.get('host')}/donate?canceled=true`,
        metadata: {
          type: "donation",
          source: "readmyfineprint",
          mode: useTestMode ? 'test' : 'live',
          ip: ip,
          timestamp: new Date().toISOString()
        }
      });

      if (!session.url) {
        throw new Error('Failed to generate checkout URL');
      }

      res.json({ 
        sessionId: session.id,
        url: session.url,
        testMode: useTestMode
      });

    } catch (error: any) {
      console.error('Checkout session creation failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid donation amount',
          details: 'Please enter a valid amount between $1 and $10,000'
        });
      }

      const  { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "HIGH" as any,
        message: `Checkout session creation failed: ${error.message}`,
        ip,
        userAgent,
        endpoint: "/api/create-checkout-session",
        details: { error: error.message }
      });

      res.status(500).json({ error: 'Checkout unavailable' });
    }
  });

  // Test IndexNow submission (admin only)
  app.post("/api/admin/test-indexnow", requireAdminAuth, async (req, res) => {
    try {
      const testUrl = req.body.url || `${req.protocol}://${req.get('host')}/`;
      const result = await indexNowService.submitUrls([testUrl]);

      res.json({
        success: true,
        result,
        testUrl,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('IndexNow test failed:', error);
      res.status(500).json({
        success: false,
        error: 'IndexNow test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register user management routes
  registerUserRoutes(app);
  
  // Register admin routes
  registerAdminRoutes(app);
  
  // Register email recovery routes
  registerEmailRecoveryRoutes(app);

  // Serve uploaded files securely with proper headers
  app.use('/uploads', (req, res, next) => {
    // Security headers for file serving
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  const httpServer = createServer(app);

  return httpServer;
}