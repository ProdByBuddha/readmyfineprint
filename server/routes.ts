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
import crypto from "crypto";
import Stripe from "stripe";
import { securityAlertManager } from './security-alert';
import { emailService } from './email-service';
import { registerUserRoutes } from './user-routes';
import { indexNowService } from './indexnow-service';
import { subscriptionService } from './subscription-service';
import { getTierById, SUBSCRIPTION_TIERS } from './subscription-tiers';
import { priorityQueue } from './priority-queue';

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

async function extractTextFromFile(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  try {
    // First, perform comprehensive file validation
    const validationResult = await FileValidator.validateFile(buffer, filename, mimetype);

    if (!validationResult.isValid) {
      throw new Error(`File validation failed: ${validationResult.error}`);
    }

    console.log(`✅ File validation passed for ${validationResult.sanitizedFilename} (Hash: ${validationResult.fileHash?.substring(0, 8)}...)`);

    switch (mimetype) {
      case 'text/plain':
        return buffer.toString('utf-8');

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;

      case 'application/pdf':
        throw new Error('PDF text extraction is not yet implemented. Please convert to TXT or DOCX format.');

      case 'application/msword':
        throw new Error('Legacy DOC format is not yet supported. Please convert to DOCX format.');

      default:
        throw new Error(`File type ${mimetype} is not supported. Please use TXT or DOCX files, or paste the content directly.`);
    }
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

  // Create payment intent endpoint with enhanced security
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

      // Log payment intent creation
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Creating payment intent for $${validatedData.amount.toFixed(2)}`,
        ip,
        userAgent,
        endpoint: "/api/create-payment-intent",
        details: { amount: validatedData.amount }
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(validatedData.amount * 100),
        currency: validatedData.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: "donation",
          source: "readmyfineprint",
          ip: ip,
          timestamp: new Date().toISOString(),
          ...validatedData.metadata
        },
        description: `Donation to ReadMyFinePrint - $${validatedData.amount.toFixed(2)}`
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
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

  // Stripe webhook endpoint with proper validation
  app.post('/api/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ error: 'Webhook secret not configured' });
      }

      event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET);
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
            message: `Payment webhook received: ${paymentIntent.id}`,
            ip,
            userAgent,
            endpoint: "/api/stripe-webhook",
            details: { 
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency
            }
          });

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
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;

          securityLogger.logSecurityEvent({
            eventType: "API_ACCESS" as any,
            severity: "MEDIUM" as any,
            message: `Payment failed webhook: ${failedPayment.id}`,
            ip,
            userAgent,
            endpoint: "/api/stripe-webhook",
            details: { 
              paymentIntentId: failedPayment.id,
              amount: failedPayment.amount / 100,
              currency: failedPayment.currency,
              lastPaymentError: failedPayment.last_payment_error?.message || 'Unknown error'
            }
          });

          console.log(`💳 Payment failed: ${failedPayment.id} - ${failedPayment.last_payment_error?.message || 'Unknown error'}`);
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

  // Create Stripe Checkout Session with input validation
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

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Creating checkout session for $${amount.toFixed(2)}`,
        ip,
        userAgent,
        endpoint: "/api/create-checkout-session",
        details: { amount }
      });

      // Validate Stripe configuration
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe not configured');
      }

      // Create Stripe Checkout Session with secure configuration
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Donation to ReadMyFinePrint',
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
          ip: ip,
          timestamp: new Date().toISOString()
        }
      });

      if (!session.url) {
        throw new Error('Failed to generate checkout URL');
      }

      res.json({ 
        sessionId: session.id,
        url: session.url 
      });

    } catch (error: any) {
      console.error('Checkout session creation failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid donation amount',
          details: 'Please enter a valid amount between $1 and $10,000'
        });
      }

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "HIGH" as any,
        message: `Checkout session creation failed: ${error.message}`,
        ip,
        userAgent,
        endpoint: "/api/create-checkout-session",
        details: { error: error.message }
      });

      // Provide user-friendly error messages
      let userMessage = 'Unable to process donation at this time';
      if (error.message.includes('Stripe not configured')) {
        userMessage = 'Payment processing is temporarily unavailable';
      } else if (error.message.includes('API key')) {
        userMessage = 'Payment service configuration error';
      }

      res.status(500).json({ error: userMessage });
    }
  });

  // Register user management routes
  registerUserRoutes(app);

  // Test email configuration (admin only)
  app.post("/api/test-email", requireAdminAuth, async (req, res) => {
    try {
      const testResult = await emailService.testEmailConfiguration();

      if (testResult) {
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

  // Get allowed file types for client-side validation
  app.get("/api/file-types", (req, res) => {
    try {
      const allowedTypes = FileValidator.getAllowedFileTypes();
      res.json({
        allowedTypes,
        maxTotalSize: 50 * 1024 * 1024, // 50MB absolute maximum
        supportedFormats: Object.values(allowedTypes).map(type => ({
          mimeType: type.mimeType,
          extensions: type.extensions,
          description: type.description,
          maxSize: type.maxSize
        }))
      });
    } catch (error) {
      console.error("Error getting file types:", error);
      res.status(500).json({ error: "Failed to get file type information" });
    }
  });

  // IndexNow submission endpoint
  app.post("/api/indexnow/submit", async (req, res) => {
    try {
      const { urls } = req.body;

      if (urls && Array.isArray(urls)) {
        await indexNowService.submitUrls(urls);
        res.json({ success: true, message: `Submitted ${urls.length} URLs to search engines` });
      } else {
        await indexNowService.submitAllUrls();
        res.json({ success: true, message: 'Submitted all URLs to search engines' });
      }
    } catch (error) {
      console.error("IndexNow submission error:", error);
      res.status(500).json({ error: "Failed to submit URLs to search engines" });
    }
  });

  // IndexNow status endpoint
  app.get("/api/indexnow/status", (req, res) => {
    try {
      const status = indexNowService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("IndexNow status error:", error);
      res.status(500).json({ error: "Failed to get IndexNow status" });
    }
  });

  // Add new admin security endpoints
  app.get("/api/admin/security/alerts", requireAdminAuth, (req, res) => {
    try {
      const { limit } = req.query;
      const alerts = securityAlertManager.getRecentAlerts(limit ? parseInt(limit as string) : 50);

      const alertStats = {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.threshold.severity === 'CRITICAL').length,
        highAlerts: alerts.filter(a => a.threshold.severity === 'HIGH').length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length,
        last24Hours: alerts.filter(a =>
          new Date().getTime() - new Date(a.timestamp).getTime() < 24 * 60 * 60 * 1000
        ).length
      };

      res.json({
        alerts,
        stats: alertStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to get security alerts:", error);
      res.status(500).json({ error: "Failed to retrieve security alerts" });
    }
  });

  // Acknowledge a security alert
  app.post("/api/admin/security/alerts/:alertId/acknowledge", requireAdminAuth, (req, res) => {
    try {
      const { alertId } = req.params;
      const acknowledged = securityAlertManager.acknowledgeAlert(alertId);

      if (acknowledged) {
        res.json({ success: true, message: `Alert ${alertId} acknowledged` });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  // Enhanced security status endpoint
  app.get("/api/admin/security/status", requireAdminAuth, (req, res) => {
    try {
      const securityStats = securityLogger.getSecurityStats();
      const alerts = securityAlertManager.getRecentAlerts(10);

      // Optional: Get encryption status if encrypted storage is enabled
      // const encryptionStatus = encryptedStorage?.getEncryptionStatus();

      const enhancedStatus = {
        ...securityStats,
        alerts: {
          recentCount: alerts.length,
          criticalCount: alerts.filter(a => a.threshold.severity === 'CRITICAL').length,
          unacknowledgedCount: alerts.filter(a => !a.acknowledged).length
        },
        // encryption: encryptionStatus,
        enhancements: {
          alertingEnabled: true,
          // encryptionEnabled: !!encryptionStatus?.encryptionEnabled,
          enhancedFileValidation: true
        },
        timestamp: new Date().toISOString()
      };

      res.json(enhancedStatus);
    } catch (error) {
      console.error("Failed to get enhanced security status:", error);
      res.status(500).json({ error: "Failed to retrieve enhanced security status" });
    }
  });

  // Subscription Management Routes
  app.get("/api/subscription/tiers", (req, res) => {
    res.json({ tiers: SUBSCRIPTION_TIERS });
  });

  app.get("/api/user/subscription", optionalUserAuth, async (req, res) => {
    try {
      // Use authenticated user ID or fallback to session ID for backwards compatibility
      const userId = req.user?.id || (req as any).sessionId || "anonymous";
      if (!userId) {
        return res.status(400).json({ error: "Unable to identify user" });
      }

      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);
      res.json(subscriptionData);
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      
      // Fallback to free tier if anything goes wrong
      const fallbackData = {
        tier: { id: "free", name: "Free", description: "Free tier with basic features" },
        usage: { documentsAnalyzed: 0, tokensUsed: 0, cost: 0, resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        canUpgrade: false
      };
      
      res.json(fallbackData);
    }
  });

  // Create Stripe Checkout Session for subscription
  app.post("/api/subscription/create-checkout", async (req, res) => {
    try {
      const { tierId, billingCycle } = req.body;
      const userId = (req as any).sessionId || "anonymous";

      if (!tierId || !billingCycle) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tier = getTierById(tierId);

      if (!tier) {
        return res.status(400).json({ error: "Invalid tier ID" });
      }

      const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;

      // Find the correct price by searching Stripe prices
      const productId = `readmyfineprint_${tier.id}`;
      const stripePrices = await stripe.prices.list({
        product: productId,
        active: true,
      });

      const stripePrice = stripePrices.data.find(p => 
        p.recurring?.interval === (billingCycle === 'yearly' ? 'year' : 'month')
      );

      if (!stripePrice) {
        return res.status(400).json({ error: `Price not found for ${tier.name} ${billingCycle}` });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price: stripePrice.id,
          quantity: 1,
        }],
        success_url: `${req.protocol}://${req.get('host')}/subscription?success=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscription?canceled=true`,
        metadata: {
          userId,
          tierId,
          billingCycle,
        },
        subscription_data: {
          metadata: {
            userId,
            tierId,
            model: tier.model,
          },
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/subscription/create", async (req, res) => {
    try {
      const { tierId, email, paymentMethodId, billingCycle } = req.body;
      const userId = (req as any).sessionId || "anonymous";

      if (!tierId || !email || !paymentMethodId || !billingCycle) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await subscriptionService.createSubscription({
        userId,
        tierId,
        email,
        paymentMethodId,
        billingCycle
      });

      res.json(result);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/subscription/cancel", async (req, res) => {
    try {
      const { subscriptionId, immediate } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ error: "subscriptionId is required" });
      }

      const result = await subscriptionService.cancelSubscription(subscriptionId, immediate);
      res.json(result);
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/subscription/upgrade", async (req, res) => {
    try {
      const { subscriptionId, newTierId, billingCycle } = req.body;

      if (!subscriptionId || !newTierId || !billingCycle) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await subscriptionService.updateSubscriptionTier(subscriptionId, newTierId, billingCycle);
      res.json(result);
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Initialize Stripe products (admin endpoint - should be run once during deployment)
  app.post("/api/admin/init-stripe-products", requireAdminAuth, async (req, res) => {
    try {
      await subscriptionService.initializeStripeProducts();
      res.json({ success: true, message: "Stripe products initialized successfully" });
    } catch (error) {
      console.error("Error initializing Stripe products:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Enhanced Stripe webhook handler for subscriptions
  app.post("/api/subscription-webhook", async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (webhookSecret && sig) {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        await subscriptionService.handleStripeWebhook(event);
      } else {
        console.log('⚠️ Webhook processed without signature verification (no webhook secret configured)');
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Subscription webhook error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      payment_endpoints: {
        donation_processing: '/api/process-donation',
        stripe_configured: !!process.env.STRIPE_SECRET_KEY
      },
      subscription_endpoints: {
        tiers: '/api/subscription/tiers',
        user_subscription: '/api/user/subscription',
        create_subscription: '/api/subscription/create',
        cancel_subscription: '/api/subscription/cancel',
        upgrade_subscription: '/api/subscription/upgrade'
      }
    });
  });

  // IndexNow endpoints for automated search engine submission
  app.post("/api/indexnow/submit-all", requireAdminAuth, async (req, res) => {
    try {
      const { indexNowService } = await import("./indexnow-service");
      const results = await indexNowService.submitAllUrls();

      const successCount = results.filter(r => r.success).length;
      const totalEngines = results.length;

      res.json({
        success: successCount > 0,
        message: `Submitted to ${successCount}/${totalEngines} search engines`,
        results,
        stats: indexNowService.getSubmissionStats()
      });
    } catch (error) {
      console.error('IndexNow submission failed:', error);
      res.status(500).json({ 
        error: 'Failed to submit URLs to search engines',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/indexnow/submit-urls", requireAdminAuth, async (req, res) => {
    try {
      const { urls } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array is required and must not be empty' });
      }

      if (urls.length > 10000) {
        return res.status(400).json({ error: 'Cannot submit more than 10,000 URLs at once' });
      }

      const { indexNowService } = await import("./indexnow-service");
      const results = await indexNowService.submitSpecificUrls(urls);

      const successCount = results.filter(r => r.success).length;
      const totalEngines = results.length;

      res.json({
        success: successCount > 0,
        message: `Submitted ${urls.length} URLs to ${successCount}/${totalEngines} search engines`,
        results,
        submittedUrls: urls
      });
    } catch (error) {
      console.error('IndexNow specific URL submission failed:', error);
      res.status(500).json({ 
        error: 'Failed to submit specific URLs to search engines',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/indexnow/stats", requireAdminAuth, async (req, res) => {
    try {
      const { indexNowService } = await import("./indexnow-service");
      const stats = indexNowService.getSubmissionStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to get IndexNow stats:', error);
      res.status(500).json({ error: 'Failed to get IndexNow statistics' });
    }
  });

  // Auto-submit to IndexNow when sitemap is updated (webhook style)
  app.post("/api/indexnow/auto-submit", async (req, res) => {
    try {
      // This can be called automatically when content changes
      const { indexNowService } = await import("./indexnow-service");

      // Submit all URLs automatically
      const results = await indexNowService.submitAllUrls();
      const successCount = results.filter(r => r.success).length;

      res.json({
        success: successCount > 0,
        message: `Auto-submitted to ${successCount} search engines`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Auto IndexNow submission failed:', error);
      res.status(500).json({ error: 'Auto-submission failed' });
    }
  });

  // Register user management routes
  registerUserRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}