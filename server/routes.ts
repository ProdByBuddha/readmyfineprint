import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { consentLogger } from "./consent";
import { requireAdminAuth } from "./auth";
import { insertDocumentSchema } from "@shared/schema";
import { analyzeDocument } from "./openai";
import { FileValidator, createSecureFileFilter } from "./file-validation";
import { securityLogger, getClientInfo } from "./security-logger";
import multer from "multer";
import { z } from "zod";
import mammoth from "mammoth";
import crypto from "crypto";
import Stripe from "stripe";

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
  app.post("/api/documents/:id/analyze", async (req: any, res) => {
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

      const analysis = await analyzeDocument(document.content, document.title, analysisIp, analysisUserAgent, req.sessionId);
      const updatedDocument = await storage.updateDocumentAnalysis(req.sessionId, documentId, analysis, clientFingerprint);

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error analyzing document:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Analysis failed" });
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

  // Server-side payment processing endpoint
  app.post("/api/process-donation", async (req, res) => {
    try {
      const { amount, card } = req.body;

      // Validate amount
      if (!amount || typeof amount !== 'number' || amount < 1) {
        return res.status(400).json({
          error: "Invalid amount. Minimum donation is $1."
        });
      }

      if (amount > 10000) {
        return res.status(400).json({
          error: "Maximum donation amount is $10,000. Please contact us for larger donations."
        });
      }

      // Validate card data
      if (!card || !card.number || !card.exp_month || !card.exp_year || !card.cvc || !card.name) {
        return res.status(400).json({
          error: "Invalid card information. Please check all fields."
        });
      }

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Processing donation payment for $${amount.toFixed(2)}`,
        ip,
        userAgent,
        endpoint: "/api/process-donation",
        details: { amount }
      });

      // Create payment method first (cast to any to bypass TypeScript strict mode)
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: card.number,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          cvc: card.cvc,
        },
        billing_details: {
          name: card.name,
          email: req.body.billing_details?.email,
          address: {
            postal_code: req.body.billing_details?.address?.postal_code
          }
        }
      } as any);

      // Create and confirm payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        payment_method: paymentMethod.id,
        confirm: true,
        metadata: {
          type: "donation",
          source: "readmyfineprint",
          ip: ip,
          timestamp: new Date().toISOString()
        },
        description: `Donation to ReadMyFinePrint - $${amount.toFixed(2)}`
      });

      if (paymentIntent.status === 'succeeded') {
        securityLogger.logSecurityEvent({
          eventType: "API_ACCESS" as any,
          severity: "LOW" as any,
          message: `Donation payment completed: $${amount.toFixed(2)}`,
          ip,
          userAgent,
          endpoint: "/api/process-donation",
          details: {
            paymentIntentId: paymentIntent.id,
            amount: amount,
            currency: "usd"
          }
        });

        res.json({
          success: true,
          paymentIntentId: paymentIntent.id,
          amount: amount,
          message: "Payment successful! Thank you for your donation."
        });
      } else {
        throw new Error(`Payment requires additional action: ${paymentIntent.status}`);
      }

    } catch (error: any) {
      console.error("Payment processing failed:", error);

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "HIGH" as any,
        message: `Payment processing failed: ${error.message}`,
        ip,
        userAgent,
        endpoint: "/api/process-donation",
        details: { error: error.message }
      });

      // Handle specific Stripe errors
      let errorMessage = "Payment processing failed. Please try again.";
      
      if (error.type === 'StripeCardError') {
        switch (error.code) {
          case 'card_declined':
            errorMessage = "Your card was declined. Please try a different payment method.";
            break;
          case 'incorrect_number':
            errorMessage = "Invalid card number. Please check and try again.";
            break;
          case 'invalid_expiry_month':
          case 'invalid_expiry_year':
            errorMessage = "Invalid expiration date. Please check and try again.";
            break;
          case 'invalid_cvc':
            errorMessage = "Invalid CVC code. Please check and try again.";
            break;
          case 'insufficient_funds':
            errorMessage = "Insufficient funds. Please try a different payment method.";
            break;
          default:
            errorMessage = error.message || "Card payment failed. Please try again.";
        }
      }

      res.status(400).json({ error: errorMessage });
    }
  });

  // Keep original endpoint for compatibility
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount } = req.body;

      if (!amount || typeof amount !== 'number' || amount < 1) {
        return res.status(400).json({
          error: "Invalid amount. Minimum donation is $1."
        });
      }

      if (amount > 10000) {
        return res.status(400).json({
          error: "Maximum donation amount is $10,000."
        });
      }

      const { ip, userAgent } = getClientInfo(req);
      securityLogger.logSecurityEvent({
        eventType: "API_ACCESS" as any,
        severity: "LOW" as any,
        message: `Creating payment intent for $${amount.toFixed(2)}`,
        ip,
        userAgent,
        endpoint: "/api/create-payment-intent",
        details: { amount }
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: "donation",
          source: "readmyfineprint",
          ip: ip,
          timestamp: new Date().toISOString()
        },
        description: `Donation to ReadMyFinePrint - $${amount.toFixed(2)}`
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });

    } catch (error: any) {
      console.error("Payment intent creation failed:", error);
      res.status(500).json({
        error: "Failed to create payment intent. Please try again."
      });
    }
  });

  // Stripe webhook endpoint for payment confirmations
  // This endpoint needs raw body for signature verification
  app.use("/api/stripe-webhook", express.raw({ type: 'application/json' }));
  app.post("/api/stripe-webhook", async (req, res) => {
    console.log('🔔 Webhook received:', {
      headers: {
        'stripe-signature': req.headers['stripe-signature'] ? 'Present' : 'Missing',
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      },
      bodyType: typeof req.body,
      bodyLength: req.body ? req.body.length : 0
    });
    
    let event;

    try {
      // Verify webhook signature (if webhook secret is configured)
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      console.log('🔐 Webhook verification:', {
        hasSecret: !!webhookSecret,
        hasSignature: !!sig,
        secretPrefix: webhookSecret ? webhookSecret.substring(0, 8) + '...' : 'None'
      });

      if (webhookSecret && sig) {
        // For signature verification, Stripe expects the raw body as a Buffer or string
        const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
        console.log('✅ Webhook signature verified successfully');
      } else {
        // If no webhook secret is configured, parse the body directly
        // Note: This is less secure and should only be used in development
        const bodyString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
        event = JSON.parse(bodyString);
        console.log('⚠️ Webhook processed without signature verification (development mode)');
      }
      
      console.log('📋 Parsed event type:', event.type, 'Event ID:', event.id);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      console.error('Raw body preview:', req.body.toString().substring(0, 200));
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    console.log('📋 Processing webhook event:', event.type);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('✅ Payment succeeded:', {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          metadata: paymentIntent.metadata,
          created: paymentIntent.created ? new Date(paymentIntent.created * 1000).toISOString() : 'N/A'
        });

        // Log successful payment
        securityLogger.logSecurityEvent({
          eventType: "API_ACCESS" as any,
          severity: "LOW" as any,
          message: `Donation payment completed: $${(paymentIntent.amount / 100).toFixed(2)}`,
          ip: paymentIntent.metadata?.ip || 'webhook',
          userAgent: 'stripe-webhook',
          endpoint: "/api/stripe-webhook",
          details: {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            webhookEventId: event.id
          }
        });

        // Here you could add logic to send confirmation emails,
        // update database records, etc.
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('❌ Payment failed:', {
          id: failedPayment.id,
          amount: failedPayment.amount / 100,
          last_payment_error: failedPayment.last_payment_error
        });

        // Log failed payment
        securityLogger.logSecurityEvent({
          eventType: "API_ACCESS" as any,
          severity: "MEDIUM" as any,
          message: `Donation payment failed: $${(failedPayment.amount / 100).toFixed(2)}`,
          ip: failedPayment.metadata?.ip || 'unknown',
          userAgent: 'stripe-webhook',
          endpoint: "/api/stripe-webhook",
          details: {
            paymentIntentId: failedPayment.id,
            amount: failedPayment.amount / 100,
            error: failedPayment.last_payment_error?.message
          }
        });
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        console.log('Event object:', JSON.stringify(event, null, 2));
    }

    console.log('✅ Webhook processed successfully');
    res.json({ received: true });
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

  const httpServer = createServer(app);
  return httpServer;
}
