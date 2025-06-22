import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { consentLogger } from "./consent";
import { requireAdminAuth, optionalUserAuth, requireUserAuth } from "./auth";
import { insertDocumentSchema } from "@shared/schema";
import { analyzeDocument } from "./openai";
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
import { registerUserRoutes } from './user-routes';
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

// Enhanced PDF text extraction using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    console.log(`🔍 Starting PDF extraction (buffer size: ${buffer.length} bytes)`);
    
    // Try pdf-parse with different options for better compatibility
    const options = {
      normalizeWhitespace: true,
      disableCombineTextItems: false,
      max: 0 // Extract all pages
    };
    
    const data = await pdfParse(buffer, options);
    
    console.log(`📄 PDF extraction results:`);
    console.log(`   - Pages: ${data.numpages}`);
    console.log(`   - Text length: ${data.text.length} characters`);
    console.log(`   - First 200 chars: "${data.text.substring(0, 200).replace(/\n/g, '\\n')}"`);
    
    if (!data.text || data.text.trim().length < 50) {
      console.log(`⚠️ PDF text too short or empty, falling back to basic extraction`);
      return await extractPdfTextBasic(buffer);
    }
    
    // Clean up the extracted text
    let cleanText = data.text
      .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    console.log(`✅ PDF text extraction successful (${cleanText.length} chars after cleaning)`);
    return cleanText;
    
  } catch (error) {
    console.error('🚫 pdf-parse extraction failed:', error);
    console.log(`⚠️ Falling back to enhanced basic PDF extraction`);
    return await extractPdfTextBasic(buffer);
  }
}

// Enhanced basic PDF text extraction function (fallback)
async function extractPdfTextBasic(buffer: Buffer): Promise<string> {
  try {
    console.log(`🔧 Using enhanced basic PDF extraction (fallback method)`);
    
    let extractedText = '';

    // Convert buffer to string with different encodings to handle various PDF formats
    const encodings = ['latin1', 'utf8', 'ascii'];
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

    // Approach 1: Enhanced text object extraction
    const textPatterns = [
      // Standard text operators
      /\(((?:[^()\\]|\\.)*)?\)\s*Tj/g,
      /\[((?:[^\[\]\\]|\\.)*?)\]\s*TJ/g,
      // Text positioning with content
      /(\d+(?:\.\d+)?\s+){2}Td\s*\(((?:[^()\\]|\\.)*?)\)\s*Tj/g,
      // Text matrix with content
      /(\d+(?:\.\d+)?\s+){6}Tm\s*\(((?:[^()\\]|\\.)*?)\)\s*Tj/g,
      // Font and text combinations
      /\/\w+\s+\d+(?:\.\d+)?\s+Tf\s*\(((?:[^()\\]|\\.)*?)\)\s*Tj/g
    ];

    textPatterns.forEach((pattern, patternIndex) => {
      const matches = pdfString.match(pattern);
      if (matches) {
        console.log(`📝 Pattern ${patternIndex + 1}: Found ${matches.length} matches`);
        matches.forEach(match => {
          // Extract text content from parentheses or brackets
          const textMatch = match.match(/\(((?:[^()\\]|\\.)*?)\)/) || match.match(/\[((?:[^\[\]\\]|\\.)*?)\]/);
          if (textMatch && textMatch[1]) {
            const rawText = textMatch[1];
            
            // Decode PDF text escape sequences
            const decodedText = rawText
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\\([0-7]{1,3})/g, (match, octal) => {
                const code = parseInt(octal, 8);
                return code >= 32 && code <= 126 ? String.fromCharCode(code) : ' ';
              })
              .replace(/\\./g, ' '); // Replace any other escape sequences with space

            // Filter for readable text
            if (decodedText.length > 1 && /[a-zA-Z0-9]/.test(decodedText)) {
              extractedText += decodedText + ' ';
            }
          }
        });
      }
    });

    // Approach 2: Look for plaintext content in PDF streams
    if (extractedText.trim().length < 30) {
      console.log(`🔄 Trying stream content extraction`);
      
      // Look for content between stream markers
      const streamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
      let streamMatch;
      
      while ((streamMatch = streamPattern.exec(pdfString)) !== null) {
        const streamContent = streamMatch[1];
        
        // Look for readable text in stream content
        const readableChunks = streamContent.match(/[a-zA-Z0-9\s.,!?;:()\[\]{}'"%-]{5,}/g);
        if (readableChunks) {
          readableChunks.forEach(chunk => {
            const cleaned = chunk.trim();
            if (cleaned.length > 4 && /[a-zA-Z]/.test(cleaned)) {
              extractedText += cleaned + ' ';
            }
          });
        }
      }
    }

    // Approach 3: Direct text search in PDF content
    if (extractedText.trim().length < 30) {
      console.log(`🔄 Trying direct text pattern matching`);
      
      // Look for word-like patterns in the entire PDF
      const wordPatterns = /\b[a-zA-Z]{3,}(?:\s+[a-zA-Z]{2,})*\b/g;
      const words = pdfString.match(wordPatterns);
      
      if (words && words.length > 10) {
        // Filter and join meaningful words
        const meaningfulWords = words.filter(word => 
          word.length > 2 && 
          !/^[A-Z]{3,}$/.test(word) && // Avoid ALL CAPS sequences
          word.split(' ').length <= 5    // Avoid very long sequences
        );
        
        if (meaningfulWords.length > 0) {
          extractedText = meaningfulWords.slice(0, 200).join(' '); // Limit to first 200 words
        }
      }
    }

    // Clean and validate extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add spaces between camelCase
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // Add spaces between letters and numbers
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')  // Add spaces between numbers and letters
      .trim();

    console.log(`📊 Extraction summary:`);
    console.log(`   - Total length: ${extractedText.length} characters`);
    console.log(`   - Word count: ~${extractedText.split(/\s+/).filter(w => w.length > 0).length} words`);
    console.log(`   - Readable ratio: ${(extractedText.match(/[a-zA-Z]/g) || []).length / extractedText.length * 100}%`);

    if (extractedText.length < 50 || (extractedText.match(/[a-zA-Z]/g) || []).length / extractedText.length < 0.3) {
      console.log(`❌ Enhanced extraction: Text too short or not readable enough`);
      console.log(`📝 Extracted preview: "${extractedText.substring(0, 200)}"`);
      
      return "PDF text extraction failed - this document may contain:\n\n" +
             "• Scanned images that require OCR (Optical Character Recognition)\n" +
             "• Complex formatting or encrypted content\n" +
             "• Non-standard text encoding\n\n" +
             "Try these alternatives:\n" +
             "1. Convert to Word (.docx) format using an online converter\n" +
             "2. Copy and paste text directly from the PDF viewer\n" +
             "3. Use a PDF with selectable text rather than scanned images\n" +
             "4. Save the document as plain text (.txt) from your PDF viewer\n\n" +
             "For best results, use documents with selectable, copyable text.";
    }

    console.log(`✅ Enhanced extraction successful (${extractedText.length} chars)`);
    console.log(`📝 First 200 characters: "${extractedText.substring(0, 200)}"`);
    
    return extractedText;
    
  } catch (error) {
    console.error('🚫 Enhanced basic PDF extraction error:', error);
    return "PDF text extraction failed due to an internal error. This document may be corrupted, encrypted, or use an unsupported format. Please try converting to TXT or DOCX format, or contact support if the issue persists.";
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
  app.post("/api/documents/upload", upload.single('file'), async (req: any, res) => {
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
  app.post("/api/documents/:id/analyze", optionalUserAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);

            // Debug logging for session and document lookup
      console.log(`🔍 Analysis request: DocumentID=${documentId}, SessionID=${req.sessionId}`);

      // Generate client fingerprint for session consolidation
      const { ip: clientIp, userAgent: clientUA } = getClientInfo(req);
      const clientFingerprint = crypto.createHash('md5').update(`${clientIp}:${clientUA}`).digest('hex').substring(0, 16);

      const document = await storage.getDocument(req.sessionId, documentId, clientFingerprint);

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
      }

      if (document.analysis) {
        return res.json(document);
      }

      // Get client information for security logging
      const analysisIp = req.ip || req.socket.remoteAddress || 'unknown';
      const analysisUserAgent = req.get('User-Agent') || 'unknown';

      // Get user subscription to determine AI model and check limits
      const userId = req.user?.id || req.sessionId || "anonymous";

      // Get user's subscription data to determine AI model and check usage
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);

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

      // Process document analysis through priority queue
      const analysis = await priorityQueue.addToQueue(
        userId,
        subscriptionData.tier.id,
        async () => {
          return await analyzeDocument(
            document.content, 
            document.title, 
            analysisIp, 
            analysisUserAgent, 
            req.sessionId,
            subscriptionData.tier.model,
            userId
          );
        }
      );

      // Update document with analysis results
      const updatedDocument = await storage.updateDocumentAnalysis(req.sessionId, documentId, analysis, clientFingerprint);

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
  app.get("/api/queue/status", optionalUserAuth, async (req: any, res) => {
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
  app.delete("/api/documents", async (req: any, res) => {
    try {
      await storage.clearAllDocuments(req.sessionId);
      res.json({ message: "All documents cleared successfully" });
    } catch (error) {
      console.error("Error clearing documents:", error);
      res.status(500).json({ error: "Failed to clear documents" });
    }
  });

  // Create payment intent endpoint with enhanced security and auto-detecting test/live mode
  app.post('/api/create-payment-intent', async (req, res) => {
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
      const documents = await storage.getAllDocuments(req.sessionId);
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
              await indexNowService.submitUrl('https://readmyfineprint.com/donate');
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
  app.post("/api/create-checkout-session", async (req, res) => {
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
      const result = await indexNowService.submitUrl(testUrl);

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