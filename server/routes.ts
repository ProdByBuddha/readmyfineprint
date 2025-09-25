import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, databaseStorage } from "./storage";
import { consentLogger } from "./consent";
import { requireAdminAuth, optionalUserAuth, requireUserAuth, requireConsent, requireSecurityQuestions, refreshAccessToken } from "./auth";
import { insertDocumentSchema } from "@shared/schema";
import { LLMFactory } from "./llm";
import { analyzeDocumentWithPII } from "./openai-with-pii";
import { FileValidator, createSecureFileFilter } from "./file-validation";
import { securityLogger, getClientInfo, SecurityEventType, SecuritySeverity } from "./security-logger";
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
import { emailVerificationService, sendVerificationEmail } from './email-verification';
import { registerUserRoutes } from './user-routes';
import { registerAdminRoutes } from './admin-routes';
import { registerEmailRecoveryRoutes } from './email-recovery-routes';
import { registerTwoFactorRoutes } from './two-factor-routes';
import { registerTotpRoutes } from './totp-routes';
import { registerCcpaRoutes } from './ccpa-compliance';
import { registerAgeVerificationRoutes } from './age-verification-routes';
import { registerLegalProfessionalRoutes } from './legal-professional-routes';
import { registerHybridRoutes } from './hybrid-routes';
import { registerTierSecurityRoutes } from './tier-security-routes';
import { registerUserPreferencesRoutes } from './user-preferences-routes';
import { registerSecurityQuestionsRoutes } from './security-questions-routes';
import { indexNowService } from './indexnow-service';
import blogRoutes from './blog-routes.js';
import { errorReportingService } from './error-reporting-service';
import type { UserError } from './error-reporting-service';
import { subscriptionService } from './subscription-service';
import { 
  submitPiiDetectionFeedback, 
  getFeedbackAnalytics, 
  getImprovementSuggestions, 
  getCommonFalsePositives,
  getFeedbackSummary
} from './rlhf-feedback-routes';
import { getTierById, SUBSCRIPTION_TIERS } from './subscription-tiers';
import { priorityQueue } from './priority-queue';
import { createPseudonymizedEmail, verifyEmailMatch } from './argon2';
import { mailingList, insertMailingListSchema, type InsertMailingList } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { disasterRecoveryService } from './disaster-recovery-service';

/**
 * Fallback cookie parsing function for when req.cookies is undefined
 */
function getFallbackCookies(req: any): Record<string, string> {
  if (req.cookies && typeof req.cookies === 'object') {
    return req.cookies;
  }

  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie: string) => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        try {
          cookies[key] = decodeURIComponent(value);
        } catch (error) {
          cookies[key] = value;
        }
      }
    });
  }

  return cookies;
}

/**
 * Find user by email using deterministic hash entanglement
 * This handles the bidirectional relationship between real and pseudonymized emails
 */
/**
 * Detect if we're running in staging environment
 * Staging environments typically use NODE_ENV=staging or production on Replit
 */
export function isStaging(req?: any): boolean {
  // Explicit staging environment
  if (process.env.NODE_ENV === 'staging') {
    return true;
  }

  // Production mode on Replit (legacy staging detection)
  const isReplit = process.env.REPL_ID || req?.get('host')?.includes('replit.dev') || req?.get('host')?.includes('kirk.replit.dev');
  const isProduction = process.env.NODE_ENV === 'production';

  return isProduction && isReplit;
}

/**
 * Get secure cookie settings based on environment
 * Development: secure=false (HTTP), staging: secure=false (for easier testing), production: secure=true (HTTPS)
 */
export function getCookieSettings(req?: any) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isExplicitStaging = process.env.NODE_ENV === 'staging';
  const stagingMode = isStaging(req);

  return {
    httpOnly: true,
    secure: !isDevelopment && !stagingMode, // false for dev and staging, true for production
    sameSite: 'lax' as const, // Use 'lax' for better mobile compatibility
    path: '/'
  };
}

/**
 * Get the correct client base URL based on environment
 * In development: points to Vite dev server (port 5173)
 * In production: uses the request host
 */
function getClientBaseUrl(req: any): string {
  // In production, always use the production domain
  if (process.env.NODE_ENV === 'production') {
    return 'https://readmyfineprint.com';
  }

  // Check if we're in a Replit environment
  const isReplit = process.env.REPL_ID || req.get('host')?.includes('replit.dev') || req.get('host')?.includes('kirk.replit.dev');
  const host = req.get('host');

  let baseUrl;
  if (process.env.NODE_ENV === 'development' && !isReplit) {
    // In local development only, point to the Vite dev server
    baseUrl = 'http://localhost:5173';
  } else if (isReplit) {
    // In Replit environments, extract the correct domain from ALLOWED_ORIGINS
    const allowedOrigins = process.env.ALLOWED_ORIGINS || '';
    const replitDomain = allowedOrigins
      .split(',')
      .find(origin => origin.includes('replit.dev') || origin.includes('kirk.replit.dev'))
      ?.trim();

    if (replitDomain) {
      baseUrl = replitDomain;
    } else {
      // Fallback to request protocol and host
      baseUrl = `${req.protocol}://${host}`;
    }
  } else {
    // In staging or other environments, use the same protocol and host as the request
    baseUrl = `${req.protocol}://${host}`;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔍 getClientBaseUrl() -> ${baseUrl} (isReplit: ${isReplit}, host: ${host}, NODE_ENV: ${process.env.NODE_ENV})`);
  }
  return baseUrl;
}

async function findUserByEmailWithEntanglement(email: string): Promise<any> {
  console.log(`🔍 Looking up user for email: ${email}`);

  // First try direct lookup (works for both real emails stored as-is and pseudonymized emails)
  let user = await databaseStorage.getUserByEmail(email);
  if (user) {
    console.log(`✅ Found user by direct email lookup`);
    return user;
  }

  // If not found and email doesn't look pseudonymized, create pseudonym and try lookup
  if (!email.includes('@subscription.internalusers.email')) {
    try {
      const pseudonymizedEmail = await createPseudonymizedEmail(email);
      console.log(`🔗 Generated pseudonym: ${email} -> ${pseudonymizedEmail}`);

      user = await databaseStorage.getUserByEmail(pseudonymizedEmail);
      if (user) {
        console.log(`✅ Found user by pseudonymized email lookup`);
        return user;
      }
    } catch (error) {
      console.error('❌ Failed to create pseudonymized email for lookup:', error);
    }
  } else {
    // If email looks pseudonymized, try to find a user with a real email that matches
    // This is more expensive but handles edge cases
    try {
      const allUsers = await databaseStorage.getUsers({ page: 1, limit: 1000, sortBy: 'createdAt', sortOrder: 'desc' });

      for (const potentialUser of allUsers.users) {
        if (potentialUser.email && !potentialUser.email.includes('@subscription.internalusers.email')) {
          // This user has a real email, check if it matches our pseudonym
          const matches = await verifyEmailMatch(potentialUser.email, email);
          if (matches) {
            console.log(`✅ Found user by reverse email entanglement: ${email} matches ${potentialUser.email}`);
            return potentialUser;
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed reverse email entanglement lookup:', error);
    }
  }

  console.log(`❌ No user found for email: ${email}`);
  return null;
}

// Initialize Stripe instances for both test and live modes
const getStripeInstance = (useTestMode: boolean = false) => {
  const secretKey = useTestMode 
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(`Missing required Stripe secret key for ${useTestMode ? 'test' : 'live'} mode`);
  }

  console.log(`🔑 Using Stripe key: ${secretKey.substring(0, 15)}... (test mode: ${useTestMode})`);
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil',
  });
};

// Default stripe instance (test mode in development, live mode in production)
const stripe = getStripeInstance(process.env.NODE_ENV === 'development');

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
      /* eslint-disable no-useless-escape */
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
            /* eslint-enable no-useless-escape */

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
          // eslint-disable-next-line no-useless-escape
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
        // eslint-disable-next-line no-useless-escape
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
        // eslint-disable-next-line no-useless-escape
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

  // Error tracking middleware for disaster recovery
  app.use((req, res, next) => {
    const originalSend = res.send;

    res.send = function(body: any) {
      // Track request completion
      const isError = res.statusCode >= 400;
      disasterRecoveryService.trackRequest(isError);

      return originalSend.call(this, body);
    };

    next();
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    // Track error
    disasterRecoveryService.trackRequest(true);

    console.error('Unhandled error:', err);

    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }

    next(err);
  });

  // CSP violation reporting endpoint
  app.post('/api/security/csp-report', (req, res) => {
    const { ip, userAgent } = getClientInfo(req);

    try {
      const cspReport = req.body;

      // Log CSP violation for security monitoring
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: `CSP violation detected: ${cspReport['csp-report']?.['blocked-uri'] || 'unknown'}`,
        ip,
        userAgent,
        endpoint: '/api/security/csp-report',
        details: {
          violatedDirective: cspReport['csp-report']?.['violated-directive'],
          blockedUri: cspReport['csp-report']?.['blocked-uri'],
          documentUri: cspReport['csp-report']?.['document-uri'],
          sourceFile: cspReport['csp-report']?.['source-file'],
          lineNumber: cspReport['csp-report']?.['line-number']
        }
      });

      console.log('🛡️ CSP Violation Report:', cspReport);

      // Send to external security monitoring if configured
      if (process.env.SECURITY_WEBHOOK_URL) {
        fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'csp_violation',
            timestamp: new Date().toISOString(),
            report: cspReport,
            ip,
            userAgent
          })
        }).catch(err => console.log('Security webhook failed:', err));
      }

      res.status(204).send(); // No content response for CSP reports
    } catch (error) {
      console.error('CSP report processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error reporting endpoints
  app.post('/api/errors/report', async (req, res) => {
    try {
      const { ip, userAgent } = getClientInfo(req);

      const errorData = {
        errorType: req.body.errorType || 'frontend',
        severity: req.body.severity || 'medium',
        message: req.body.message || 'Unknown error',
        stack: req.body.stack,
        url: req.body.url,
        userAgent: userAgent,
        ip: ip,
        sessionId: req.sessionId,
        userId: req.body.userId,
        userEmail: req.body.userEmail,
        additionalContext: req.body.additionalContext,
        reproductionSteps: req.body.reproductionSteps,
        errorId: '', // Will be generated by service
        timestamp: new Date() // Will be overwritten by service
      } as UserError;

      await errorReportingService.reportError(errorData);

      res.json({ success: true, message: 'Error reported successfully' });
    } catch (error) {
      console.error('Failed to report error:', error);
      res.status(500).json({ success: false, error: 'Failed to report error' });
    }
  });

  // Get error reports (admin only)
  app.get('/api/errors/stats', requireAdminAuth, async (req, res) => {
    try {
      // This would return aggregated error statistics
      res.json({ 
        success: true, 
        stats: {
          message: 'Error reporting is active',
          reportingEnabled: true
        }
      });
    } catch (error) {
      console.error('Failed to get error stats:', error);
      res.status(500).json({ success: false, error: 'Failed to get error stats' });
    }
  });

  // Development and staging auto-admin login endpoint - NO authentication required
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
    app.post("/api/dev/auto-admin-login", async (req, res) => {
      try {
        const adminEmail = 'admin@readmyfineprint.com';
        const adminId = 'dev-admin-001';

        // Find or create admin user
        let adminUser = await databaseStorage.getUserByEmail(adminEmail);

        if (!adminUser) {
          // Create admin user WITHOUT password - not needed in dev
          adminUser = await databaseStorage.createUser({
            email: adminEmail,
            isAdmin: true, // Mark as admin
            emailVerified: true // Auto-verify in dev
            // No password field - using email verification in production
          });
        }

        // Ensure we have a valid admin user
        if (!adminUser) {
          throw new Error('Admin user not found or created');
        }

        // Generate subscription token for admin session (for admin routes compatibility)
        // Use JOSE token service directly for subscription tokens
        const { joseTokenService } = await import('./jose-token-service');
        const subscriptionToken = await joseTokenService.generateSubscriptionToken({
          userId: adminUser.id,
          tierId: 'ultimate',
          deviceFingerprint: 'dev-admin'
        });
        const token = subscriptionToken;

        // Store session in database
        const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
        const sessionId = crypto.randomUUID();
        await postgresqlSessionStorage.storeSessionToken(sessionId, token, adminUser.id);

        console.log(`🔐 Development auto-login successful:`, {
          userId: adminUser.id,
          email: adminEmail,
          sessionId: `${sessionId.slice(0, 8)}...`,
          tokenPrefix: `${token.slice(0, 16)}...`,
          cookieSettings: {
            ...getCookieSettings(req),
            maxAge: 7 * 24 * 60 * 60 * 1000
          }
        });

        // Set secure httpOnly cookie with session ID
        res.cookie('sessionId', sessionId, {
          ...getCookieSettings(req),
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log('🔐 Development auto-login successful for admin@readmyfineprint.com');
        console.log('⚡ No authentication required - dev mode bypass active');

        res.json({
          message: "Auto-login successful (development mode)",
          user: {
            id: adminUser.id,
            email: adminEmail,
            tier: 'ultimate'
          }
        });
      } catch (error: any) {
        console.error('Auto-login error:', error);
        res.status(500).json({ message: "Auto-login failed", error: error.message });
      }
    });
  }

    // Health check endpoint (also available at /health)
  app.get('/api/health', async (_req, res) => {
    try {
      // Database health check
      let dbHealthy = true;
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`SELECT 1 as health_check`);
      } catch (error) {
        dbHealthy = false;
      }

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          activeConnection: 'neon',
          type: 'postgresql'
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        },
        uptime: Math.round(process.uptime())
      };

      // Overall health check
      const isHealthy = dbHealthy;

      res.status(isHealthy ? 200 : 503).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Admin metrics endpoint
  app.get('/api/admin/metrics', requireAdminAuth, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const { users, userSubscriptions } = await import('../shared/schema');

      // Get basic metrics using raw SQL for simplicity
      const [totalUsersResult] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      const [activeSubscriptionsResult] = await db.execute(sql`SELECT COUNT(*) as count FROM user_subscriptions WHERE status = 'active'`);

      const metrics = {
        totalUsers: totalUsersResult.count?.toString() || '0',
        activeSubscriptions: activeSubscriptionsResult.count?.toString() || '0',
        pendingEmailRequests: 0, // Can be implemented later
        securityEvents: 0, // Can be implemented later
        timestamp: new Date().toISOString()
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching admin metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Admin system health endpoint
  app.get('/api/admin/system/health', requireAdminAuth, async (req, res) => {
    try {
      // Database health check
      let dbHealthy = true;
      let dbLatency = 0;
      try {
        const start = Date.now();
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`SELECT 1 as health_check`);
        dbLatency = Date.now() - start;
      } catch (error) {
        dbHealthy = false;
      }

      const systemHealth = {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          latency: dbLatency
        },
        emailService: {
          status: 'healthy' // Can be enhanced with actual email service check
        },
        openaiService: {
          status: 'healthy' // Can be enhanced with actual OpenAI service check
        },
        priorityQueue: {
          queueLength: 0,
          currentlyProcessing: 0,
          concurrentLimit: 3,
          queueByTier: {}
        },
        memoryUsage: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        uptime: process.uptime()
      };

      res.json(systemHealth);
    } catch (error) {
      console.error('Error fetching system health:', error);
      res.status(500).json({ error: 'Failed to fetch system health' });
    }
  });

  // Admin activity stats endpoint
  app.get('/api/admin/activity', requireAdminAuth, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');

      // Get activity statistics using raw SQL
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const [newUsersLast24h] = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE created_at >= ${yesterday.toISOString()}`);
      const [newUsersLast7d] = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE created_at >= ${lastWeek.toISOString()}`);

      const activity = {
        newUsersLast24h: newUsersLast24h.count?.toString() || '0',
        newUsersLast7d: newUsersLast7d.count?.toString() || '0',
        activeSubscriptionsLast24h: 0, // Can be enhanced
        documentsAnalyzedLast24h: 0, // Can be enhanced when document table exists
        documentsAnalyzedLast7d: 0, // Can be enhanced when document table exists
        timestamp: new Date().toISOString()
      };

      res.json(activity);
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      res.status(500).json({ error: 'Failed to fetch activity stats' });
    }
  });

  // Document analysis endpoint (simplified version for testing with tier-based rate limiting)
  app.post('/api/document/analyze', optionalUserAuth, async (req: any, res) => {
    try {
      const { content, filename } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Get user subscription for rate limiting
      const subscriptionData = req.user?.id 
        ? await subscriptionService.getUserSubscriptionDetails(req.user.id)
        : { tier: { id: 'free', model: 'gpt-4o-mini', limits: { documentsPerMonth: 10 } } };

      // ENFORCE RATE LIMITING BASED ON TIER
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const userId = req.user?.id || req.sessionId || 'anonymous';

      // Get current month usage from database/storage
      const { collectiveUserService } = await import('./collective-user-service');

      // Check if this is a sample contract analysis
      const isSimpleSampleContract = req.body?.isSampleContract === true || req.headers['x-sample-contract'] === 'true';

      // Use proper user tracking for free tier rate limiting with consistent identifier
      const simpleDeviceFingerprint = req.headers['x-device-fingerprint'] as string;
      const simpleClientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // Create consistent user identifier for rate limiting (same approach as main endpoint)
      let simpleRateLimitUserId: string;
      if (req.user?.id && req.user.id !== "anonymous") {
        // Authenticated user - use actual user ID
        simpleRateLimitUserId = req.user.id;
      } else {
        // Anonymous user - use device fingerprint + IP hash for consistency
        const simpleAnonymousIdentifier = crypto.createHash('sha256')
          .update(`${simpleDeviceFingerprint || 'unknown'}:${simpleClientIp}`)
          .digest('hex')
          .substring(0, 16);
        simpleRateLimitUserId = `anon_${simpleAnonymousIdentifier}`;
      }

      // Only do rate limiting and usage tracking for non-sample contracts
      if (!isSimpleSampleContract) {
        // Check if user has exceeded their monthly limit
        const monthlyLimit = subscriptionData.tier.limits?.documentsPerMonth || 10;

        console.log(`📊 Simple endpoint rate limiting check for user: ${simpleRateLimitUserId} (tier: ${subscriptionData.tier.id})`);

        // Get current subscription data with usage tracking for this specific user
        const currentSubscriptionData = await subscriptionService.getUserSubscriptionWithUsage(simpleRateLimitUserId);

        // Check if user can analyze another document
        if (currentSubscriptionData.tier.limits.documentsPerMonth !== -1) {
          if (currentSubscriptionData.usage.documentsAnalyzed >= currentSubscriptionData.tier.limits.documentsPerMonth) {
            return res.status(429).json({
              error: `Monthly document limit reached (${currentSubscriptionData.tier.limits.documentsPerMonth} documents for ${currentSubscriptionData.tier.id} tier)`,
              limit: currentSubscriptionData.tier.limits.documentsPerMonth,
              used: currentSubscriptionData.usage.documentsAnalyzed,
              resetDate: currentSubscriptionData.usage.resetDate,
              upgradeRequired: currentSubscriptionData.tier.id === 'free'
            });
          }
        }

        // Track usage for rate limiting (increment document analysis count) with consistent user ID
        await subscriptionService.trackUsage(
          simpleRateLimitUserId, // Use the same identifier as rate limiting check
          1500, // Mock token usage
          currentSubscriptionData.tier.model,
          {
            sessionId: req.sessionId,
            deviceFingerprint: simpleDeviceFingerprint || 'unknown',
            ipAddress: simpleClientIp
          }
        );
      } else {
        console.log(`📋 Skipping usage tracking for sample contract analysis (simple endpoint)`);
      }

      // Get updated usage after tracking (use the same user ID as rate limiting check)
      const updatedSubscriptionData = await subscriptionService.getUserSubscriptionWithUsage(simpleRateLimitUserId);

      // Mock analysis for testing purposes
      const mockAnalysis = {
        summary: `Analysis of ${filename || 'document'}: This is a ${updatedSubscriptionData.tier.id} tier analysis. Usage: ${updatedSubscriptionData.usage.documentsAnalyzed}/${updatedSubscriptionData.tier.limits.documentsPerMonth}`,
        keyPoints: [
          "Mock analysis point 1",
          "Mock analysis point 2", 
          "Mock analysis point 3"
        ],
        risks: ["Mock risk assessment"],
        recommendations: ["Mock recommendation"],
        confidence: 0.95,
        processingTime: Math.random() * 1000 + 500,
        model: updatedSubscriptionData.tier.model,
        testMode: true,
        tierInfo: {
          name: updatedSubscriptionData.tier.id,
          documentsUsed: updatedSubscriptionData.usage.documentsAnalyzed,
          documentsLimit: updatedSubscriptionData.tier.limits.documentsPerMonth,
          remainingDocuments: updatedSubscriptionData.tier.limits.documentsPerMonth - updatedSubscriptionData.usage.documentsAnalyzed
        }
      };

      res.json({
        id: Math.floor(Math.random() * 1000),
        title: filename || 'Test Document',
        content: content,
        analysis: mockAnalysis,
        createdAt: new Date().toISOString(),
        usage: {
          documentsUsed: updatedSubscriptionData.usage.documentsAnalyzed,
          documentsLimit: updatedSubscriptionData.tier.limits.documentsPerMonth,
          resetDate: updatedSubscriptionData.usage.resetDate
        }
      });
    } catch (error) {
      console.error('Error in document analysis:', error);
      res.status(500).json({ error: 'Analysis failed' });
    }
  });

  // Stripe create checkout session endpoint
  app.post('/api/stripe/create-checkout-session', optionalUserAuth, async (req: any, res) => {
    try {
      const { priceId, tierId } = req.body;

      if (!priceId || !tierId) {
        return res.status(400).json({ error: 'priceId and tierId are required' });
      }

      // For testing purposes, return mock session data
      if (process.env.NODE_ENV === 'development') {
        res.json({
          sessionId: 'cs_test_' + Math.random().toString(36).substr(2, 9),
          url: 'https://checkout.stripe.com/pay/cs_test_mock_session',
          testMode: true
        });
      } else {
        res.status(400).json({ error: 'Stripe checkout requires production configuration' });
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // Log consent acceptance
  app.post("/api/consent", optionalUserAuth, async (req: any, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userId = req.user?.id; // Get user ID if authenticated

      console.log(`Consent logging request - IP: ${ip}, UA: ${userAgent?.substring(0, 20)}..., User: ${userId || 'none'}, Session: ${req.sessionId || 'none'}`);

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
  app.post("/api/consent/verify", optionalUserAuth, async (req: any, res) => {
    try {
      // Use consistent IP/UA extraction method as in logConsent
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userId = req.user?.id; // Get user ID if authenticated

      // Get session ID from multiple sources for consistency
      let sessionId = req.sessionId;
      if (!sessionId) {
        sessionId = req.headers['x-session-id'] as string;
      }
      if (!sessionId && req.cookies?.sessionId) {
        sessionId = req.cookies.sessionId;
      }

      console.log(`Consent verification request - IP: ${ip}, UA: ${userAgent?.substring(0, 20)}..., User: ${userId || 'none'}, Session: ${sessionId || 'none'}`);

      const proof = await consentLogger.verifyUserConsent(ip, userAgent, userId, sessionId);

      const response = {
        hasConsented: !!proof,
        proof: proof || null
      };

      console.log(`Consent verification response: ${response.hasConsented} (session: ${sessionId || 'none'})`);
      res.json(response);
    } catch (error) {
      console.error("Error verifying consent:", error);
      res.json({ hasConsented: false, proof: null, error: "Verification failed" });
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

  // Revoke consent (removes from database)
  app.post("/api/consent/revoke", optionalUserAuth, async (req: any, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const userId = req.user?.id; // Get user ID if authenticated

      console.log(`Consent revocation request - IP: ${ip}, UA: ${userAgent?.substring(0, 20)}..., User: ${userId || 'none'}, Session: ${req.sessionId || 'none'}`);

      const result = await consentLogger.revokeConsent(ip, userAgent, userId, req.sessionId);
      res.json(result);
    } catch (error) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
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
  app.post("/api/documents", requireConsent, optionalUserAuth, async (req: any, res) => {
    try {
      const { title, content, fileType } = insertDocumentSchema.parse(req.body);

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Document content is required" });
      }

      // Generate client fingerprint for session tracking (consistent with other routes)
      const { ip: createIp, userAgent: createUA } = getClientInfo(req);
      const createClientFingerprint = crypto.createHash('md5').update(`${createIp}:${createUA}`).digest('hex').substring(0, 16);

      const document = await storage.createDocument(req.sessionId, {
        title: title || "Untitled Document",
        content,
        fileType: fileType || "text",
        analysis: null
      }, createClientFingerprint);

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
  app.post("/api/documents/upload", requireConsent, optionalUserAuth, upload.single('file'), async (req: any, res) => {
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
  app.post("/api/documents/:id/analyze", requireConsent, optionalUserAuth, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);

      // Debug logging for session and document lookup
      console.log(`🔍 Analysis request: DocumentID=${documentId}, SessionID=${req.sessionId}`);

      // Generate client fingerprint for session consolidation
      const clientInfo = getClientInfo(req);
      const { ip: clientIp, userAgent: clientUA } = clientInfo;
      const clientFingerprint = crypto.createHash('md5').update(`${clientIp}:${clientUA}`).digest('hex').substring(0, 16);

      let document = await storage.getDocument(req.sessionId, documentId, clientFingerprint);

      let originalSessionId = null;
      let isSampleDocument = false;

      if (!document) {
        console.log(`🔍 Document ${documentId} not found in current session, searching across all sessions for client ${clientFingerprint}`);

        // Try to find the document across all sessions - prioritize any document match first
        const allSessions = storage.getAllSessions();
        let foundDocument = null;
        let foundSessionId = null;

        for (const [sessionId, sessionData] of allSessions) {
          const sessionDoc = await storage.getDocument(sessionId, documentId);
          if (sessionDoc) {
            // Prioritize non-sample documents
            if (!sessionDoc.title.startsWith('Sample:')) {
              foundDocument = sessionDoc;
              foundSessionId = sessionId;
              console.log(`🔍 Found regular document ${documentId} in session ${sessionId}`);
              break; // Prefer non-sample documents
            } else if (!foundDocument) {
              // Only use sample document as fallback if no regular document found
              foundDocument = sessionDoc;
              foundSessionId = sessionId;
              isSampleDocument = true;
              console.log(`🔍 Found sample document ${documentId} in session ${sessionId} (fallback)`);
            }
          }
        }

        if (foundDocument) {
          if (isSampleDocument) {
            console.log(`📋 Found sample contract ${documentId} in session ${foundSessionId}, making accessible to current session`);
            // Copy the sample document to the current session for analysis
            await storage.createDocument(req.sessionId, {
              title: foundDocument.title,
              content: foundDocument.content,
              fileType: foundDocument.fileType || undefined,
              analysis: foundDocument.analysis
            }, clientFingerprint, documentId);
          } else {
            console.log(`📋 Found regular document ${documentId} in session ${foundSessionId}, making accessible to current session`);
            // Copy the regular document to the current session for analysis
            await storage.createDocument(req.sessionId, {
              title: foundDocument.title,
              content: foundDocument.content,
              fileType: foundDocument.fileType || undefined,
              analysis: foundDocument.analysis
            }, clientFingerprint, documentId);
          }
          document = foundDocument;
          originalSessionId = foundSessionId;
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
          if (isSampleDocument) {
            console.log(`✅ Sample contract ${documentId} made accessible from session ${originalSessionId} to ${req.sessionId}`);
          } else {
            console.log(`✅ Regular document ${documentId} made accessible from session ${originalSessionId} to ${req.sessionId}`);
          }
        }
      }

      // Check consent for analysis - skip for sample contracts and admin users
      const { ip, userAgent } = getClientInfo(req);

      // Skip consent for sample contracts (now that we have the document)
      const isSampleContract = document && document.title && [
        'sample', 'example', 'demo', 'template',
        'residential lease', 'employment agreement', 'nda',
        'service agreement', 'rental agreement'
      ].some(keyword => document.title.toLowerCase().includes(keyword.toLowerCase()));


      if (!isSampleContract) {
        try {
          // Get user ID for consent verification
          const userId = req.user?.id;

          // Check for valid consent for non-sample analysis
          const consentProof = await consentLogger.verifyUserConsent(ip, userAgent, userId);

          if (!consentProof) {
            securityLogger.logSecurityEvent({
              eventType: SecurityEventType.SECURITY_VIOLATION,
              severity: SecuritySeverity.HIGH,
              message: `Analysis denied - no valid consent found for ${req.path}`,
              ip,
              userAgent,
              endpoint: req.path
            });

            return res.status(403).json({
              error: 'Consent required for document analysis',
              message: 'You must accept our terms and conditions to analyze your own documents',
              code: 'CONSENT_REQUIRED',
              requiresConsent: true
            });
          }
        } catch (consentError) {
          console.error('Error checking consent for analysis:', consentError);
          return res.status(500).json({
            error: 'Unable to verify consent',
            message: 'Please try again or contact support',
            code: 'CONSENT_VERIFICATION_ERROR'
          });
        }
      } else {
        console.log(`📋 Sample contract detected (${document.title}), skipping consent check`);
      }

      if (document.analysis) {
        return res.json(document);
      }

      // Get client information for security logging
      const analysisIp = req.ip || req.socket.remoteAddress || 'unknown';
      const analysisUserAgent = req.get('User-Agent') || 'unknown';

      // Check for subscription token first (priority over session-based auth)
      let userId = req.user?.id;
      let authenticatedUser = null;
      let subscriptionData;

      // Try to get subscription token from httpOnly cookie first (more secure)
      let subscriptionToken = req.cookies?.subscriptionToken;

      // Fallback to header for backward compatibility (will be deprecated)
      if (!subscriptionToken) {
        subscriptionToken = req.headers['x-subscription-token'] as string;
        if (subscriptionToken) {
          console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
        }
      }

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
          const { joseTokenService } = await import('./jose-token-service');
          const tokenData = await joseTokenService.validateSubscriptionToken(subscriptionToken);
          if (tokenData) {
            userId = tokenData.userId;
            console.log(`✅ Using subscription token user: ${userId} (${subscriptionData.tier.name} tier)`);
          }
        } else {
          console.warn(`❌ Invalid subscription token provided: ${subscriptionToken.slice(0, 16)}...`);
        }
      }

      // If no valid subscription token, try to resolve session to user
      if (!subscriptionData) {
        // Try to resolve session ID to user ID (same logic as /api/auth/session)
        let sessionId = req.cookies?.sessionId;
        if (!sessionId && req.headers.cookie) {
          const cookieMatch = req.headers.cookie.match(/sessionId=([^;]+)/);
          if (cookieMatch) {
            sessionId = cookieMatch[1];
          }
        }

        if (!userId && sessionId) {
          try {
            const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
            const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

            if (token) {
              const { joseTokenService } = await import('./jose-token-service');
              const tokenData = await joseTokenService.validateSubscriptionToken(token);

              if (tokenData && tokenData.userId) {
                const { databaseStorage } = await import('./storage');
                authenticatedUser = await databaseStorage.getUser(tokenData.userId);

                if (authenticatedUser) {
                  userId = authenticatedUser.id;
                  console.log(`✅ Session authenticated as: ${authenticatedUser.email}`);
                }
              }
            }
          } catch (sessionError) {
            console.log('Error resolving session to user for analysis:', sessionError);
          }
        }

        // Fall back to session ID if no user found
        const finalUserId: string = userId || req.sessionId || "anonymous";
        console.log(`📊 No valid subscription token, using session/user-based lookup for: ${finalUserId}`);
        subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(finalUserId);
        userId = finalUserId;
      }

      // CRITICAL: Check if user can analyze another document using proper user-specific tracking
      // Use device fingerprint + IP as consistent identifier for anonymous users
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
      const rateLimitClientIp = req.ip || req.socket.remoteAddress || 'unknown';

      // Create consistent user identifier for rate limiting
      let rateLimitUserId: string;
      if (userId && userId !== "anonymous" && userId.length !== 32) {
        // Authenticated user - use actual user ID
        rateLimitUserId = userId;
      } else {
        // Anonymous user - use device fingerprint + IP hash for consistency
        const anonymousIdentifier = crypto.createHash('sha256')
          .update(`${deviceFingerprint || 'unknown'}:${rateLimitClientIp}`)
          .digest('hex')
          .substring(0, 16);
        rateLimitUserId = `anon_${anonymousIdentifier}`;
      }

      console.log(`📊 Rate limiting check for user: ${rateLimitUserId} (tier: ${subscriptionData.tier.id})`);

      // Get current subscription data with usage tracking for this specific user
      const userSpecificSubscriptionData = await subscriptionService.getUserSubscriptionWithUsage(rateLimitUserId);

      if (userSpecificSubscriptionData.tier.limits.documentsPerMonth !== -1) {
        if (userSpecificSubscriptionData.usage.documentsAnalyzed >= userSpecificSubscriptionData.tier.limits.documentsPerMonth) {
          return res.status(429).json({
            error: "Monthly document limit reached",
            limit: userSpecificSubscriptionData.tier.limits.documentsPerMonth,
            used: userSpecificSubscriptionData.usage.documentsAnalyzed,
            resetDate: userSpecificSubscriptionData.usage.resetDate,
            suggestedUpgrade: userSpecificSubscriptionData.suggestedUpgrade
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

      // Check if user has Professional tier for PII redaction features
      const { validateProfessionalAccess } = await import('./tier-validation.js');
      const tierValidation = await validateProfessionalAccess(userId);

      // Check for test mode to skip OpenAI calls
      const isTestMode = req.headers['x-skip-openai'] === 'true' || req.body?.skipOpenAI === true || req.body?.testMode === true;

      if (isTestMode) {
        console.log(`🧪 Test mode enabled - skipping OpenAI analysis for document ${documentId}`);

        // Create a mock analysis result for testing rate limiting
        const mockAnalysis = {
          summary: `This is a mock analysis for testing rate limiting on the ${subscriptionData.tier.id} tier. Document: ${document.title}`,
          keyPoints: [
            "Mock analysis point 1",
            "Mock analysis point 2", 
            "Mock analysis point 3"
          ],
          risks: ["Mock risk assessment"],
          recommendations: ["Mock recommendation"],
          confidence: 0.95,
          processingTime: Math.random() * 1000 + 500, // Random processing time
          model: subscriptionData.tier.model,
          testMode: true
        };

        // Update document with mock analysis
        const updatedDocument = await storage.updateDocumentAnalysis(
          req.sessionId, 
          documentId, 
          mockAnalysis, 
          clientFingerprint
        );

        // Track usage for rate limiting testing with proper user identifier
        await subscriptionService.trackUsage(
          rateLimitUserId, // Use the same identifier as rate limiting check
          1500, // Mock token usage
          subscriptionData.tier.model,
          {
            sessionId: req.sessionId,
            deviceFingerprint: clientFingerprint,
            ipAddress: clientInfo.ip
          }
        );

        console.log(`✅ Mock analysis completed for ${subscriptionData.tier.id} tier user (test mode)`);
        return res.json(updatedDocument);
      }

      // Process document analysis through priority queue with conditional PII protection
      const analysisResult = await priorityQueue.addToQueue(
        userId,
        subscriptionData.tier.id,
        async () => {
          // Use PII protection only for Professional tier and above
          if (tierValidation.hasAccess) {
            console.log(`🔒 Using PII protection for ${tierValidation.currentTier} tier user ${userId}`);
            return await analyzeDocumentWithPII(
              document.content,
              document.title,
              {
                ip: analysisIp,
                userAgent: analysisUserAgent,
                sessionId: req.sessionId,
                model: subscriptionData.tier.model,
                userId: userId,
                includeAdvocacy: subscriptionData.tier.id !== 'free',
                piiDetection: {
                  enabled: true, // Always enabled for maximum privacy protection
                  detectNames: true,
                  minConfidence: 0.7, // High confidence threshold for production
                  useEnhancedDetection: true, // Enable multi-pass enhanced detection with local LLM
                  aggressiveMode: true // Bias toward over-detection for privacy
                }
              }
            );
          } else {
            console.log(`📝 Using standard analysis for ${tierValidation.currentTier} tier user ${userId}`);
            // Fall back to regular analysis without PII protection
            const provider = LLMFactory.getProvider();
            return await provider.analyzeDocument(
              document.content,
              document.title,
              {
                model: subscriptionData.tier.model,
                ip: analysisIp,
                userAgent: analysisUserAgent,
                sessionId: req.sessionId,
                userId: userId,
                subscriptionTierId: subscriptionData.tier.id,
                includeAdvocacy: subscriptionData.tier.id !== 'free'
              }
            );
          }
        }
      );

      // Normalize analysis result - handle both direct analysis and { analysis, redactionInfo } formats
      let analysis, redactionInfo;
      if (analysisResult && typeof analysisResult === 'object' && 'analysis' in analysisResult) {
        // Format from analyzeDocumentWithPII: { analysis, redactionInfo }
        analysis = analysisResult.analysis;
        redactionInfo = analysisResult.redactionInfo;
        console.log(`📋 Using PII-protected analysis result`);
      } else {
        // Format from analyzeDocument: analysis directly
        analysis = analysisResult;
        redactionInfo = undefined;
        console.log(`📋 Using standard analysis result`);
      }

      // Update document with analysis results and redaction info
      const updatedDocument = await storage.updateDocumentAnalysis(
        req.sessionId, 
        documentId, 
        analysis, 
        clientFingerprint,
        redactionInfo
      );

      // If this was a sample contract copied from another session, sync the analysis back to the original session
      if (originalSessionId && originalSessionId !== req.sessionId) {
        try {
          await storage.updateDocumentAnalysis(originalSessionId, documentId, analysis, clientFingerprint, redactionInfo);
          console.log(`🔄 Analysis synced back to original session ${originalSessionId} for sample contract ${documentId}`);
        } catch (syncError) {
          console.warn(`⚠️ Failed to sync analysis back to original session ${originalSessionId}:`, syncError instanceof Error ? syncError.message : String(syncError));
        }
      }

      // Track usage for rate limiting with proper user identifier (skip for sample contracts)
      if (!isSampleContract) {
        await subscriptionService.trackUsage(
          rateLimitUserId, // Use the same identifier as rate limiting check
          analysis.tokenUsage || 1500,
          subscriptionData.tier.model,
          {
            sessionId: req.sessionId,
            deviceFingerprint: clientFingerprint,
            ipAddress: clientInfo.ip
          }
        );
      } else {
        console.log(`📋 Skipping usage tracking for sample contract: ${document.title}`);
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
  app.get("/api/user/subscription", optionalUserAuth, async (req, res) => {
    try {
      let subscriptionData;

      // Manual cookie parsing fallback (same as /api/auth/session)
      const cookies = getFallbackCookies(req);
      let sessionId = cookies.sessionId;
      if (!sessionId && req.headers.cookie) {
        const cookieMatch = req.headers.cookie.match(/sessionId=([^;]+)/);
        if (cookieMatch) {
          sessionId = cookieMatch[1];
        }
      }

      // Check for subscription token first (for persistent subscription access)
      // Try httpOnly cookie first (more secure)
      let subscriptionToken = cookies.subscriptionToken;

      // Fallback to header for backward compatibility
      if (!subscriptionToken) {
        subscriptionToken = req.headers['x-subscription-token'] as string;
        if (subscriptionToken) {
          console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
        }
      }

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
          // Token is valid - ensure it's stored as httpOnly cookie
          res.cookie('subscriptionToken', subscriptionToken, {
            ...getCookieSettings(req),
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });
          return res.json(subscriptionData);
        } else {
          // Token was invalid or expired - clear the cookie
          res.clearCookie('subscriptionToken', {
            ...getCookieSettings(req)
          });
        }
      }

      // Enhanced user resolution logic (replicating /api/auth/session)
      let userId = req.user?.id;
      let authenticatedUser = null;

      // If we don't have req.user but have a sessionId, do the same lookup as /api/auth/session
      if (!userId && sessionId) {
        try {
          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

          if (token) {
            const { joseTokenService } = await import('./jose-token-service');
            const tokenData = await joseTokenService.validateSubscriptionToken(token);

            if (tokenData && tokenData.userId) {
              const { databaseStorage } = await import('./storage');
              authenticatedUser = await databaseStorage.getUser(tokenData.userId);

              if (authenticatedUser) {
                userId = authenticatedUser.id;
                console.log(`✅ Session authenticated as: ${authenticatedUser.email}`);
              }
            }
          }
        } catch (sessionError) {
          console.log('Error resolving session to user:', sessionError);
        }
      }

      // Fallback to sessionId or anonymous - ensure userId is never undefined
      if (!userId) {
        userId = sessionId || "anonymous";
      }

      // TypeScript safety: ensure userId is always a string
      const finalUserId: string = userId || "anonymous";

      subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(finalUserId);

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
      const { secureJWTService } = await import('./secure-jwt-service');
      const results = await secureJWTService.cleanupExpiredTokens();

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
  app.post("/api/subscription/login/request-code", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }

      // Find user by email using deterministic hash entanglement
      const user = await findUserByEmailWithEntanglement(email);
      if (!user) {
        return res.status(404).json({ 
          error: 'No subscription found for this email address. Please check your email or subscribe first.',
          code: 'NO_USER_FOUND'
        });
      }

      // Get user's subscription data
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);

      // Allow login if user has any subscription (active, inactive, expired) for account management
      if (!subscriptionData.subscription) {
        return res.status(404).json({ 
          error: 'No subscription found for this email address. Please subscribe first.',
          code: 'NO_SUBSCRIPTION'
        });
      }

      // Allow inactive/expired subscriptions to login for account management
      // Users with inactive subscriptions can login to renew or manage their account
      const allowedStatuses = ['active', 'inactive', 'past_due', 'canceled'];
      if (!allowedStatuses.includes(subscriptionData.subscription.status)) {
        return res.status(403).json({ 
          error: 'Your subscription status does not allow login. Please contact support.',
          code: 'SUBSCRIPTION_INVALID_STATUS',
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
        const emailSent = await sendVerificationEmail(email, codeResult.code!);

        if (!emailSent) {
          console.error('Failed to send verification email to:', email);
          return res.status(500).json({ error: 'Failed to send verification code' });
        }

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
  app.post("/api/subscription/login/verify", async (req, res) => {
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
      let user = await findUserByEmailWithEntanglement(email);

      // Check if this is an admin email
      const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
      const isAdminEmail = adminEmails.includes(email);

      if (!user) {
        // If user doesn't exist and it's an admin email, create the admin user
        if (isAdminEmail) {
          console.log(`🔐 Creating admin user for: ${email}`);
          user = await databaseStorage.createUser({
            email: email,
            isAdmin: true,
            emailVerified: true,
            hashedPassword: null // No password needed for email verification auth
          });
          console.log(`✅ Admin user created: ${email}`);
        } else {
          return res.status(404).json({ error: 'User not found' });
        }
      }

      // Mark email as verified if this is their first successful verification
      // Also ensure admin users have the isAdmin flag set
      const updateData: any = { lastLoginAt: new Date() };

      if (!user.emailVerified) {
        updateData.emailVerified = true;
        console.log(`✅ Email verified for user: ${email}`);
      }

      if (isAdminEmail && !user.isAdmin) {
        updateData.isAdmin = true;
        console.log(`🔐 Admin flag set for admin user: ${email}`);
      }

      await databaseStorage.updateUser(user.id, updateData);

      // Get user's subscription data for response
      let subscriptionData = null;
      try {
        subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(user.id);
      } catch (error) {
        console.warn('Could not retrieve subscription data:', error);
        // For admin users, provide a default response
        if (isAdminEmail) {
          subscriptionData = {
            subscription: {
              status: 'active',
              tierId: 'ultimate',
              tier: { name: 'Ultimate', description: 'Admin access' }
            },
            usage: { documentsProcessed: 0, monthlyLimit: -1 }
          };
        }
      }

      // Generate JWT tokens using JOSE auth service
      const { joseAuthService } = await import('./jose-auth-service');
      const { accessToken, refreshToken } = await joseAuthService.generateTokenPair(
        user.id,
        email,
        { ip: getClientInfo(req).ip, userAgent: req.get('User-Agent') || 'unknown' }
      );

      // Store session in PostgreSQL
      const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
      const sessionId = crypto.randomUUID();
      await postgresqlSessionStorage.storeSessionToken(sessionId, accessToken, user.id);

      console.log(`🔐 Email verification login successful:`, {
        userId: user.id,
        email: user.email,
        sessionId: `${sessionId.slice(0, 8)}...`,
        accessTokenPrefix: `${accessToken.slice(0, 16)}...`,
        cookieSettings: {
          ...getCookieSettings(req),
          maxAge: 7 * 24 * 60 * 60 * 1000
        }
      });

      // Set secure httpOnly cookie with session ID
      const cookieOptions = {
        ...getCookieSettings(req),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        // Don't set domain - let browser handle it for better compatibility
      };

      res.cookie('sessionId', sessionId, cookieOptions);

      res.json({
        success: true,
        subscription: subscriptionData,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin
        },
        // Include tokens for fallback authentication if cookies fail
        tokens: {
          access: accessToken,
          refresh: refreshToken
        }
      });
    } catch (error) {
      console.error("Error verifying subscription login:", error);
      res.status(500).json({ 
        error: "Failed to verify login",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Session validation endpoint
  app.get("/api/auth/session", optionalUserAuth, async (req, res) => {
    try {
      const cookies = getFallbackCookies(req);
      let sessionId = cookies.sessionId;
      const clientSessionId = req.headers['x-session-id'] as string;

      // Manual cookie parsing fallback for Replit proxy environment
      if (!sessionId && req.headers.cookie) {
        console.log(`🍪 Cookie-parser failed, trying manual parsing...`);
        console.log(`🍪 Raw cookie header:`, req.headers.cookie.substring(0, 100) + '...');
        console.log(`🍪 Parsed cookies:`, JSON.stringify(cookies));

        // Try manual parsing as fallback
        const cookieMatch = req.headers.cookie.match(/sessionId=([^;]+)/);
        if (cookieMatch) {
          sessionId = cookieMatch[1];
          console.log(`🍪 Manual parse found sessionId:`, sessionId.substring(0, 8) + '...');
        }
      }

      console.log(`🔍 Session validation request:`, {
        sessionId: sessionId ? `${sessionId.slice(0, 8)}...` : 'none',
        clientSessionId: clientSessionId ? `${clientSessionId.slice(0, 8)}...` : 'none',
        cookies: Object.keys(req.cookies || {}),
        headers: {
          cookie: req.headers.cookie ? 'present' : 'missing',
          authorization: req.headers.authorization ? 'present' : 'missing',
          'x-session-id': req.headers['x-session-id'] ? 'present' : 'missing'
        }
      });

      // Check for JWT authenticated user first (optionalUserAuth middleware sets req.user)
      if (req.user) {
        console.log(`✅ JWT authentication successful for user: ${req.user.email}`);

        return res.json({
          authenticated: true,
          user: {
            id: req.user.id,
            email: req.user.email
          }
        });
      }

      // Check for JWT token in authorization header as fallback
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        console.log('🔍 Attempting direct JWT validation as fallback...');
        try {
          const token = authHeader.substring(7);
          const { joseAuthService } = await import('./jose-auth-service');
          const validation = await joseAuthService.validateAccessToken(token);

          if (validation.valid && validation.payload) {
            const user = await databaseStorage.getUser(validation.payload.userId);

            if (user) {
              console.log(`✅ Direct JWT authentication successful for user: ${user.email}`);

              return res.json({
                authenticated: true,
                user: {
                  id: user.id,
                  email: user.email
                }
              });
            }
          }

          console.log('❌ Direct JWT validation failed:', validation.error);
        } catch (jwtError) {
          console.log('❌ Direct JWT validation error:', jwtError instanceof Error ? jwtError.message : 'Unknown error');
        }
      }

      // Check for authenticated user session (sessionId cookie)
      if (sessionId) {
        console.log('🔍 Checking authenticated user session...');

        // Get token from database
        const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
        const token = await postgresqlSessionStorage.getTokenBySession(sessionId);

        console.log(`🔍 Token lookup result:`, {
          found: !!token,
          tokenPrefix: token ? `${token.slice(0, 16)}...` : 'none'
        });

        if (!token) {
          console.log('❌ No token found for session');
          return res.status(401).json({ error: 'Invalid session', authenticated: false });
        }

        // Validate the subscription token (stored in session)
        // Use JOSE token service directly for subscription tokens
        const { joseTokenService } = await import('./jose-token-service');
        const tokenData = await joseTokenService.validateSubscriptionToken(token);
        const tokenValidation = { valid: !!tokenData, payload: tokenData };

        console.log(`🔍 Token validation result:`, {
          valid: tokenValidation.valid,
          userId: tokenValidation.payload?.userId || 'none',
          tierId: tokenValidation.payload?.tierId || 'none'
        });

        if (!tokenValidation.valid) {
          console.log('❌ Token validation failed');

          // Clean up invalid token from database to prevent repeated validation attempts
          try {
            await postgresqlSessionStorage.removeSessionToken(sessionId);
            console.log('🧹 Removed invalid token from database');
          } catch (cleanupError) {
            console.error('⚠️ Failed to clean up invalid token:', cleanupError);
          }

          return res.status(401).json({ error: 'Invalid token', authenticated: false });
        }

        if (!tokenValidation.payload?.userId) {
          console.error('Session token validation successful but userId is undefined:', tokenValidation);
          return res.status(401).json({ error: 'Invalid session: missing user ID', authenticated: false });
        }

        // Get user data
        const user = await databaseStorage.getUser(tokenValidation.payload.userId);

        console.log(`🔍 User lookup result:`, {
          found: !!user,
          email: user?.email || 'none',
          isAdmin: user?.isAdmin || false
        });

        if (!user) {
          console.log('❌ User not found');
          return res.status(401).json({ error: 'User not found', authenticated: false });
        }

        console.log(`✅ Session validation successful for ${user.email}`);

        return res.json({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email
          }
        });
      }

      // Check for client session (x-session-id header) - unauthenticated user
      if (clientSessionId) {
        console.log('🔍 Checking client session for unauthenticated user...');

        // For unauthenticated users, we just confirm the session exists
        // The session was created by the session middleware in index.ts
        console.log(`✅ Client session validation successful: ${clientSessionId.slice(0, 8)}...`);

        return res.json({
          authenticated: false,
          sessionId: clientSessionId,
          message: 'Valid client session (unauthenticated)'
        });
      }

      // No session found at all
      console.log('❌ No session ID found in cookies or headers');
      return res.status(401).json({ 
        error: 'No session found', 
        authenticated: false,
        message: 'No sessionId cookie or x-session-id header found'
      });

    } catch (error) {
      console.error('Session validation error:', error);
      res.status(500).json({ error: 'Session validation failed', authenticated: false });
    }
  });

  // Refresh JWT access token
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const { ip, userAgent } = getClientInfo(req);
      const result = await refreshAccessToken(refreshToken, { ip, userAgent });

      if (result) {
        res.json({
          tokens: {
            access: result.accessToken,
            refresh: refreshToken // Keep the same refresh token
          }
        });
      } else {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  // Get subscription token after successful checkout
  app.get("/api/subscription/token/:sessionId", async (req, res) => {
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

          // Set the subscription token as an httpOnly cookie for security
          res.cookie('subscriptionToken', token, {
            ...getCookieSettings(req),
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });

          res.json({ 
            success: true,
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
  app.post("/api/subscription/create-checkout", optionalUserAuth, async (req, res) => {
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

      // For subscription checkout, we should NOT use an authenticated user's ID
      // This allows creating new subscriptions for new users or switching accounts
      // The webhook will handle creating/finding the user based on the email provided in Stripe
      const userId = req.sessionId || "anonymous";

      // Auto-detect test mode
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
        success_url: `${getClientBaseUrl(req)}/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${getClientBaseUrl(req)}/subscription`,
        client_reference_id: userId,
        metadata: {
          tierId,
          billingCycle,
          userId,
        },
      });

      res.json({ 
        url: session.url,
        sessionId: session.id,
        testMode: useTestMode
      });
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
      // Try httpOnly cookie first (more secure)
      let subscriptionToken = req.cookies?.subscriptionToken;

      // Fallback to header for backward compatibility
      if (!subscriptionToken) {
        subscriptionToken = req.headers['x-subscription-token'] as string;
        if (subscriptionToken) {
          console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
        }
      }

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
      // Try httpOnly cookie first (more secure)
      let subscriptionToken = req.cookies?.subscriptionToken;

      // Fallback to header for backward compatibility
      if (!subscriptionToken) {
        subscriptionToken = req.headers['x-subscription-token'] as string;
        if (subscriptionToken) {
          console.log(`⚠️ Using deprecated header-based subscription token (migrate to cookies)`);
        }
      }

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
        return_url: `${getClientBaseUrl(req)}/subscription?tab=billing`,
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

      let document = await storage.getDocument(req.sessionId, documentId, getClientFingerprint);

      let originalSessionId = null;
      let isSampleDocument = false;

      if (!document) {
        console.log(`🔍 Document ${documentId} not found in current session, searching across all sessions for client ${getClientFingerprint}`);

        // Try to find the document across all sessions - prioritize any document match first
        const allSessions = storage.getAllSessions();
        let foundDocument = null;
        let foundSessionId = null;

        for (const [sessionId, sessionData] of allSessions) {
          const sessionDoc = await storage.getDocument(sessionId, documentId);
          if (sessionDoc) {
            // Prioritize non-sample documents
            if (!sessionDoc.title.startsWith('Sample:')) {
              foundDocument = sessionDoc;
              foundSessionId = sessionId;
              console.log(`🔍 Found regular document ${documentId} in session ${sessionId}`);
              break; // Prefer non-sample documents
            } else if (!foundDocument) {
              // Only use sample document as fallback if no regular document found
              foundDocument = sessionDoc;
              foundSessionId = sessionId;
              isSampleDocument = true;
              console.log(`🔍 Found sample document ${documentId} in session ${sessionId} (fallback)`);
            }
          }
        }

        if (foundDocument) {
          if (isSampleDocument) {
            console.log(`📋 Found sample contract ${documentId} in session ${foundSessionId}, making accessible to current session`);
            // Copy the sample document to the current session for retrieval
            await storage.createDocument(req.sessionId, {
              title: foundDocument.title,
              content: foundDocument.content,
              fileType: foundDocument.fileType || undefined,
              analysis: foundDocument.analysis
            }, getClientFingerprint, documentId);
          } else {
            console.log(`📋 Found regular document ${documentId} in session ${foundSessionId}, making accessible to current session`);
            // Copy the regular document to the current session for retrieval
            await storage.createDocument(req.sessionId, {
              title: foundDocument.title,
              content: foundDocument.content,
              fileType: foundDocument.fileType || undefined,
              analysis: foundDocument.analysis
            }, getClientFingerprint, documentId);
          }
          document = foundDocument;
          originalSessionId = foundSessionId;
        }

        if (!document) {
          // Enhanced error logging for debugging
          const allDocs = await storage.getAllDocuments(req.sessionId);
          console.log(`❌ Document ${documentId} not found in session ${req.sessionId} (GET)`);
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
      }

      console.log(`✅ Document ${documentId} found and returned (GET)`);
      console.log(`📊 Document analysis status: ${document.analysis ? 'Present' : 'Missing'}`);
      if (document.analysis) {
        console.log(`📊 Analysis type: ${typeof document.analysis}, keys: ${Object.keys(document.analysis).join(', ')}`);
      }
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

  // Logout endpoint - clears subscription token and documents
  app.post("/api/logout", optionalUserAuth, async (req: any, res) => {
    try {
      const { ip, userAgent } = getClientInfo(req);
      const subscriptionToken = req.headers['x-subscription-token'] as string;
      const userId = req.user?.id;

      console.log(`🚪 Logout request - IP: ${ip}, User: ${userId || 'anonymous'}, Session: ${req.sessionId}`);

      let tokensRevoked = 0;
      let documentsCleared = false;

      // Clear documents from current session
      try {
        await storage.clearAllDocuments(req.sessionId);
        documentsCleared = true;
        console.log(`🗑️ Cleared documents for session: ${req.sessionId}`);
      } catch (error) {
        console.error('Error clearing documents during logout:', error);
      }

      // Revoke subscription token if provided
      if (subscriptionToken) {
        try {
          const revoked = await subscriptionService.revokeSubscriptionToken(
            subscriptionToken, 
            'User logout'
          );
          if (revoked) {
            tokensRevoked++;
            console.log(`🔑 Revoked subscription token during logout`);
          }
        } catch (error) {
          console.error('Error revoking subscription token during logout:', error);
        }
      }

      // If we have a user ID, revoke all their tokens for security
      if (userId) {
        try {
          const revokedCount = await subscriptionService.revokeAllUserTokens(
            userId, 
            'User logout - security cleanup'
          );
          tokensRevoked += revokedCount;
          console.log(`🔒 Revoked ${revokedCount} additional tokens for user ${userId}`);
        } catch (error) {
          console.error('Error revoking user tokens during logout:', error);
        }
      }

      // Log security event
      securityLogger.logSecurityEvent({
        eventType: 'LOGOUT' as any,
        severity: 'LOW' as any,
        message: 'User logged out successfully',
        ip,
        userAgent,
        endpoint: '/api/logout',
        details: {
          userId: userId || 'anonymous',
          sessionId: req.sessionId,
          tokensRevoked,
          documentsCleared,
          hadSubscriptionToken: !!subscriptionToken
        }
      });

      // Clear the session cookie
      res.clearCookie('sessionId', {
        ...getCookieSettings(req)
      });

      // Clear all possible cookies
      res.clearCookie('subscriptionToken', {
        ...getCookieSettings(req)
      });
      res.clearCookie('sessionId', {
        ...getCookieSettings(req)
      });
      res.clearCookie('refreshToken', {
        ...getCookieSettings(req)
      });

      // Also clear session from PostgreSQL if present
      // Use both req.sessionId and cookie sessionId to ensure complete cleanup
      const sessionIds = [req.sessionId, req.cookies?.sessionId].filter(Boolean);
      for (const sessionId of sessionIds) {
        try {
          const { postgresqlSessionStorage } = await import('./postgresql-session-storage');
          await postgresqlSessionStorage.removeSessionToken(sessionId);
          console.log(`🔒 Removed session from PostgreSQL: ${sessionId}`);
        } catch (error) {
          console.error('Error removing session from PostgreSQL:', error);
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
        details: {
          tokensRevoked,
          documentsCleared,
          sessionCleared: true
        }
      });

    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Logout failed" });
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

          // Handle both subscription and one-time payment checkouts
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

                    if (!('deleted' in customer) && customer.email) {
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

                      if (!('deleted' in customer) && customer.email) {
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
                await subscriptionService.storeSessionToken(checkoutSession.id, subscriptionToken, actualUserId);

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
          } else if (checkoutSession.mode === 'payment' && checkoutSession.metadata?.type === 'donation') {
            console.log(`💰 Processing donation checkout${isTestMode ? ' (TEST)' : ''}: ${checkoutSession.id}`);

            // Send donation thank you email
            try {
              const amount = (checkoutSession.amount_total || 0) / 100; // Convert from cents
              const customerEmail = checkoutSession.customer_details?.email;

              if (customerEmail) {
                await emailService.sendDonationThankYou({
                  customerEmail: customerEmail,
                  amount: amount,
                  currency: 'usd', // Default to USD for donations
                  paymentIntentId: checkoutSession.id,
                  customerName: checkoutSession.customer_details?.name || 'Valued Supporter',
                  timestamp: new Date()
                });
                console.log(`📧 Donation thank you email sent to ${customerEmail} for $${amount}`);
              } else {
                console.log(`⚠️ No customer email found for donation ${checkoutSession.id}`);
              }
            } catch (emailError) {
              console.error(`❌ Failed to send donation thank you email:`, emailError);
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

  // Monitoring endpoint for health checks (simpler auth for monitoring tools)
  app.post("/api/monitoring/test-email", async (req, res) => {
    try {
      const { ip, userAgent } = getClientInfo(req);
      const adminKey = process.env.ADMIN_API_KEY;
      const providedKey = req.headers['x-admin-key'] as string;

      // Simple API key authentication for monitoring
      if (!adminKey || providedKey !== adminKey) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.MEDIUM,
          message: 'Unauthorized monitoring access attempt',
          ip,
          userAgent,
          endpoint: '/api/monitoring/test-email'
        });
        return res.status(401).json({ error: 'Invalid monitoring credentials' });
      }

      const testResult = await emailService.testEmailConfiguration();

      res.json({
        configured: testResult,
        testEmailSent: false, // Monitoring endpoint doesn't send test emails
        message: testResult ? 'Email service is configured' : 'Email service not configured'
      });
    } catch (error) {
      console.error('Monitoring email test failed:', error);
      res.status(500).json({ 
        configured: false, 
        error: 'Failed to test email configuration' 
      });
    }
  });

  // Monitoring alert email endpoint (simpler auth for monitoring tools)
  app.post("/api/monitoring/send-alert-email", async (req, res) => {
    try {
      const { ip, userAgent } = getClientInfo(req);
      const adminKey = process.env.ADMIN_API_KEY;
      const providedKey = req.headers['authorization']?.replace('Bearer ', '');

      // Simple API key authentication for monitoring
      if (!adminKey || providedKey !== adminKey) {
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.AUTHENTICATION,
          severity: SecuritySeverity.MEDIUM,
          message: 'Unauthorized monitoring alert attempt',
          ip,
          userAgent,
          endpoint: '/api/monitoring/send-alert-email'
        });
        return res.status(401).json({ error: 'Invalid monitoring credentials' });
      }

      const { to, subject, text, html } = req.body;

      // Validate required fields
      if (!to || !subject || !text) {
        return res.status(400).json({ 
          error: 'Missing required fields: to, subject, text are required' 
        });
      }

      // Send the alert email
      const sent = await emailService.sendEmail({ to, subject, text, html });

      if (sent) {
        console.log(`📧 Monitoring alert email sent to ${to}`);
        res.json({ success: true, message: 'Alert email sent successfully' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to send alert email' });
      }
    } catch (error) {
      console.error('Monitoring alert email failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send alert email',
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

      // Generate URLs for debugging
      const baseUrl = getClientBaseUrl(req);
      const successUrl = validatedData.success_url || `${baseUrl}/donate?success=true&amount=${amount}`;
      const cancelUrl = validatedData.cancel_url || `${baseUrl}/donate?canceled=true`;

      console.log(`💰 Creating donation checkout session:`);
      console.log(`   Base URL: ${baseUrl}`);
      console.log(`   Success URL: ${successUrl}`);
      console.log(`   Cancel URL: ${cancelUrl}`);

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
        success_url: successUrl,
        cancel_url: cancelUrl,
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

  // Register 2FA routes
  registerTwoFactorRoutes(app);

  // Register TOTP routes
  registerTotpRoutes(app);

  // Register tier security routes
  registerTierSecurityRoutes(app);

  // Register CCPA compliance routes
  registerCcpaRoutes(app);

  // Register age verification routes
  registerAgeVerificationRoutes(app);

  // Register legal professional routes
  registerLegalProfessionalRoutes(app);

  // Register hybrid analysis routes
  registerHybridRoutes(app);

  // Register user preferences routes
  registerUserPreferencesRoutes(app);

  // Register security questions routes
  registerSecurityQuestionsRoutes(app);

  // Register blog routes
  app.use('/api/blog', blogRoutes);

  // Contact card endpoints
  app.get('/contact.vcf', async (req, res) => {
    try {
      const { vCardService } = await import('./vcard-service.js');
      const userAgent = req.get('User-Agent');

      const { vcard, filename, version } = await vCardService.generateContactCardForClient(userAgent);

      // Set appropriate headers for vCard download
      res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('X-VCard-Version', version);

      // Optional: Add custom headers for debugging
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-User-Agent', userAgent || 'unknown');
        res.setHeader('X-VCard-Type', version);
      }

      res.send(vcard);
    } catch (error) {
      console.error('Error generating contact card:', error);
      res.status(500).json({ error: 'Failed to generate contact card' });
    }
  });

  // Alternative endpoint for API access
  app.get('/api/contact/vcard', async (req, res) => {
    try {
      const { vCardService } = await import('./vcard-service.js');
      const userAgent = req.get('User-Agent');
      const format = req.query.format as string; // 'v2', 'v3', 'v4', or 'auto'

      let result;

      if (format === 'v2') {
        const vcard = await vCardService.generateCompatibleContactCard();
        result = { vcard, filename: 'ReadMyFinePrint-v2.vcf', version: '2.1' };
      } else if (format === 'v3') {
        const vcard = await vCardService.generateContactCard();
        result = { vcard, filename: 'ReadMyFinePrint-v3.vcf', version: '3.0' };
      } else if (format === 'v4') {
        const vcard = await vCardService.generateEnhancedContactCard();
        result = { vcard, filename: 'ReadMyFinePrint-v4.vcf', version: '4.0' };
      } else {
        result = await vCardService.generateContactCardForClient(userAgent);
      }

      const { download } = req.query;

      if (download === 'true') {
        // Serve as downloadable file
        res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.vcard);
      } else {
        // Serve as JSON for API consumption
        res.json({
          vcard: result.vcard,
          filename: result.filename,
          version: result.version,
          generatedAt: new Date().toISOString(),
          userAgent: userAgent
        });
      }
    } catch (error) {
      console.error('Error generating contact card via API:', error);
      res.status(500).json({ error: 'Failed to generate contact card' });
    }
  });

  // Handle Stripe checkout redirects to /subscription
  app.get('/subscription', (req, res) => {
    // Check if we're in a Replit environment (even during development)
    const isReplit = process.env.REPL_ID || req.get('host')?.includes('replit.dev') || req.get('host')?.includes('kirk.replit.dev');

    if (process.env.NODE_ENV === 'development' && !isReplit) {
      // In local development only, redirect to the client dev server (Vite on port 5173)
      const clientUrl = `http://localhost:5173/subscription${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
      console.log(`🔀 Redirecting Stripe checkout to client dev server: ${clientUrl}`);
      res.redirect(302, clientUrl);
    } else {
      // In production, staging, or Replit environments, redirect to the same domain
      const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const clientUrl = `${req.protocol}://${req.get('host')}/subscription${queryString}`;
      console.log(`🔀 Redirecting Stripe checkout to: ${clientUrl}`);
      res.redirect(302, clientUrl);
    }
  });

  // Register RLHF feedback routes for PII detection improvement
  app.post('/api/rlhf/feedback', submitPiiDetectionFeedback);
  app.get('/api/rlhf/analytics', requireAdminAuth, getFeedbackAnalytics);
  app.get('/api/rlhf/improvements', requireAdminAuth, getImprovementSuggestions);
  app.get('/api/rlhf/false-positives/:detectionType', requireAdminAuth, getCommonFalsePositives);
  app.get('/api/rlhf/summary', getFeedbackSummary);

  // Serve uploaded files securely with proper headers
  app.use('/uploads', (req, res, next) => {
    // Security headers for file serving
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // Mailing List Signup
  app.post("/api/mailing-list/signup", requireConsent, async (req: any, res: any) => {
    try {
      const clientInfo = getClientInfo(req);

      // Validate input
      const signupData = z.object({
        email: z.string().email(),
        subscriptionType: z.string().optional().default('enterprise_features'),
        source: z.string().optional().default('subscription_plans'),
      }).parse(req.body);

      // Check if user is logged in to get their userId
      let userId: string | null = null;
      try {
        await optionalUserAuth(req, res, () => {});
        if (req.user && req.user.id) {
          userId = req.user.id;
        }
      } catch (error) {
        // User not logged in, continue without userId
      }

      // Check if email already exists in mailing list
      const existingEntry = await db
        .select()
        .from(mailingList)
        .where(and(
          eq(mailingList.email, signupData.email),
          eq(mailingList.subscriptionType, signupData.subscriptionType)
        ))
        .limit(1);

      if (existingEntry.length > 0) {
        // If already subscribed and active, return success
        if (existingEntry[0].status === 'active') {
          return res.json({ 
            success: true, 
            message: 'Already subscribed to this mailing list',
            alreadySubscribed: true 
          });
        }

        // If unsubscribed, reactivate
        if (existingEntry[0].status === 'unsubscribed') {
          await db
            .update(mailingList)
            .set({
              status: 'active',
              unsubscribedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(mailingList.id, existingEntry[0].id));

          await securityLogger.logSecurityEvent({
            eventType: SecurityEventType.MAILING_LIST_RESUBSCRIBE,
            severity: SecuritySeverity.LOW,
            message: `User resubscribed to mailing list: ${signupData.subscriptionType}`,
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            details: {
              userId: userId || undefined,
              email: signupData.email,
              subscriptionType: signupData.subscriptionType,
              source: signupData.source,
            },
          });

          return res.json({ 
            success: true, 
            message: 'Successfully resubscribed to mailing list',
            resubscribed: true 
          });
        }
      }

      // Create new mailing list entry
      const unsubscribeToken = crypto.randomBytes(32).toString('hex');

      const newEntry: InsertMailingList = {
        email: signupData.email,
        userId: userId,
        subscriptionType: signupData.subscriptionType,
        source: signupData.source,
        status: 'active',
        ipHash: crypto.createHash('sha256').update(clientInfo.ip).digest('hex'),
        userAgentHash: crypto.createHash('sha256').update(clientInfo.userAgent).digest('hex'),
        unsubscribeToken: unsubscribeToken,
      };

      await db.insert(mailingList).values(newEntry);

      // Send confirmation email
      try {
        const clientBaseUrl = getClientBaseUrl(req);
        const unsubscribeUrl = `${clientBaseUrl}/unsubscribe?token=${unsubscribeToken}`;

        await emailService.sendEmail({
          to: signupData.email,
          subject: 'ReadMyFinePrint - Mailing List Confirmation',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb; text-align: center;">Welcome to ReadMyFinePrint!</h2>

              <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">✅ Subscription Confirmed</h3>
                <p>You've successfully subscribed to receive notifications about our <strong>${signupData.subscriptionType.replace('_', ' ')}</strong> features.</p>

                <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 15px; margin: 15px 0;">
                  <p style="margin: 0; color: #1e40af;"><strong>What to expect:</strong></p>
                  <ul style="margin: 10px 0; color: #1e40af;">
                    <li>Early access notifications for new enterprise features</li>
                    <li>Product updates and announcements</li>
                    <li>Special offers and pricing information</li>
                    <li>Development progress updates</li>
                  </ul>
                </div>
              </div>

              <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0369a1;">🚀 Coming Soon</h3>
                <p>We're working hard to bring you exciting new features including:</p>
                <ul>
                  <li>Advanced team collaboration tools</li>
                  <li>API access for developers</li>
                  <li>White-label solutions</li>
                  <li>Enhanced analytics and reporting</li>
                </ul>
                <p>You'll be among the first to know when these features become available!</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${clientBaseUrl}/roadmap" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Development Roadmap
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Privacy Notice:</strong> We respect your privacy and will never share your email address with third parties. 
                  You can unsubscribe at any time using the link below.
                </p>
              </div>

              <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                <p>You're receiving this email because you signed up for ReadMyFinePrint notifications.</p>
                <p>
                  <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
                    Unsubscribe from this mailing list
                  </a>
                </p>
                <p>ReadMyFinePrint | Privacy-First AI-Powered Contract Analysis</p>
              </div>
            </div>
          `,
          text: `
Welcome to ReadMyFinePrint!

You've successfully subscribed to receive notifications about our ${signupData.subscriptionType.replace('_', ' ')} features.

What to expect:
- Early access notifications for new enterprise features
- Product updates and announcements  
- Special offers and pricing information
- Development progress updates

We're working hard to bring you exciting new features including advanced team collaboration tools, API access, white-label solutions, and enhanced analytics.

View our development roadmap: ${clientBaseUrl}/roadmap

Privacy Notice: We respect your privacy and will never share your email address with third parties.

To unsubscribe: ${unsubscribeUrl}

ReadMyFinePrint | Privacy-First AI-Powered Contract Analysis
          `
        });

        console.log(`📧 Confirmation email sent to ${signupData.email}`);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the signup if email fails
      }

      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.MAILING_LIST_SIGNUP,
        severity: SecuritySeverity.LOW,
        message: `New mailing list signup: ${signupData.subscriptionType}`,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          email: signupData.email,
          subscriptionType: signupData.subscriptionType,
          source: signupData.source,
        },
      });

      res.json({ 
        success: true, 
        message: 'Successfully subscribed to mailing list. Please check your email for confirmation.' 
      });

    } catch (error) {
      console.error('Mailing list signup error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid input', 
          details: error.errors 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to subscribe to mailing list' 
      });
    }
  });

  // Mailing List Unsubscribe
  app.get("/api/mailing-list/unsubscribe", async (req: any, res: any) => {
    try {
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).json({ 
          success: false, 
          error: 'Unsubscribe token is required' 
        });
      }

      // Find the mailing list entry by token
      const entry = await db
        .select()
        .from(mailingList)
        .where(eq(mailingList.unsubscribeToken, token))
        .limit(1);

      if (entry.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Invalid or expired unsubscribe token' 
        });
      }

      const mailingListEntry = entry[0];

      // Check if already unsubscribed
      if (mailingListEntry.status === 'unsubscribed') {
        return res.json({ 
          success: true, 
          message: 'You are already unsubscribed from this mailing list',
          alreadyUnsubscribed: true 
        });
      }

      // Update status to unsubscribed
      await db
        .update(mailingList)
        .set({
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mailingList.id, mailingListEntry.id));

      // Send confirmation email
      try {
        await emailService.sendEmail({
          to: mailingListEntry.email,
          subject: 'ReadMyFinePrint - Unsubscribe Confirmation',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #dc2626; text-align: center;">Unsubscribe Confirmed</h2>

              <div style="background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #dc2626;">✅ Successfully Unsubscribed</h3>
                <p>You have been successfully unsubscribed from our <strong>${mailingListEntry.subscriptionType.replace('_', ' ')}</strong> mailing list.</p>

                <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 15px 0;">
                  <p style="margin: 0; color: #dc2626;"><strong>What this means:</strong></p>
                  <ul style="margin: 10px 0; color: #dc2626;">
                    <li>You will no longer receive notifications about enterprise features</li>
                    <li>No more product updates or announcements</li>
                    <li>No special offers or pricing information</li>
                    <li>No development progress updates</li>
                  </ul>
                </div>
              </div>

              <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0369a1;">We're Sorry to See You Go</h3>
                <p>We respect your decision and hope you'll consider subscribing again in the future if our features become relevant to your needs.</p>

                <div style="text-align: center; margin: 20px 0;">
                  <a href="${getClientBaseUrl(req)}/roadmap" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Development Roadmap
                  </a>
                </div>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <div style="background: #f3f4f6; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #374151; font-size: 14px;">
                  <strong>Changed your mind?</strong> You can always resubscribe by visiting our subscription page and entering your email again.
                </p>
              </div>

              <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                <p>This is a confirmation that you've been unsubscribed from ReadMyFinePrint notifications.</p>
                <p>ReadMyFinePrint | Privacy-First AI-Powered Contract Analysis</p>
              </div>
            </div>
          `,
          text: `
Unsubscribe Confirmed

You have been successfully unsubscribed from our ${mailingListEntry.subscriptionType.replace('_', ' ')} mailing list.

What this means:
- You will no longer receive notifications about enterprise features
- No more product updates or announcements
- No special offers or pricing information
- No development progress updates

We're sorry to see you go. We respect your decision and hope you'll consider subscribing again in the future if our features become relevant to your needs.

View what we're building: ${getClientBaseUrl(req)}/roadmap

Changed your mind? You can always resubscribe by visiting our subscription page and entering your email again.

ReadMyFinePrint | Privacy-First AI-Powered Contract Analysis
          `
        });

        console.log(`📧 Unsubscribe confirmation email sent to ${mailingListEntry.email}`);
      } catch (emailError) {
        console.error('Failed to send unsubscribe confirmation email:', emailError);
        // Don't fail the unsubscribe if email fails
      }

      // Log security event
      const clientInfo = getClientInfo(req);
      await securityLogger.logSecurityEvent({
        eventType: SecurityEventType.MAILING_LIST_SIGNUP, // Reuse existing event type
        severity: SecuritySeverity.LOW,
        message: `Mailing list unsubscribe: ${mailingListEntry.subscriptionType}`,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: {
          userId: mailingListEntry.userId || undefined,
          email: mailingListEntry.email,
          subscriptionType: mailingListEntry.subscriptionType,
          action: 'unsubscribe',
        },
      });

      res.json({ 
        success: true, 
        message: 'Successfully unsubscribed from mailing list. You will receive a confirmation email shortly.' 
      });

    } catch (error) {
      console.error('Mailing list unsubscribe error:', error);

      res.status(500).json({ 
        success: false, 
        error: 'Failed to unsubscribe from mailing list' 
      });
    }
  });

  // Disaster recovery status endpoint
  app.get('/api/system/recovery-status', requireAdminAuth, async (req, res) => {
    try {
      const systemHealth = await disasterRecoveryService.checkSystemHealth();
      const currentErrorRate = disasterRecoveryService.getCurrentErrorRate();

      res.json({
        success: true,
        systemHealth,
        errorRate: currentErrorRate,
        status: currentErrorRate > 10 ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking recovery status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check recovery status'
      });
    }
  });

  // Security headers test endpoint
  app.get("/api/security/headers-test", (req, res) => {
    // This endpoint specifically tests that security headers are being sent
    res.json({ 
      message: "Security headers test", 
      timestamp: new Date().toISOString(),
      headers_sent: {
        "X-Frame-Options": res.getHeader('X-Frame-Options'),
        "X-Content-Type-Options": res.getHeader('X-Content-Type-Options'),
        "Strict-Transport-Security": res.getHeader('Strict-Transport-Security'),
        "Referrer-Policy": res.getHeader('Referrer-Policy'),
        "Content-Security-Policy": res.getHeader('Content-Security-Policy'),
        "Permissions-Policy": res.getHeader('Permissions-Policy')
      }
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}