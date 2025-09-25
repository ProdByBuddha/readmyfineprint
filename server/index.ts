import dotenv from "dotenv";
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";

import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { addSecurityHeaders } from "./auth";
import { validateEnvironmentOrExit, logEnvironmentStatus } from "./env-validation";
import { securityLogger, getClientInfo } from "./security-logger";
import { provideCsrfToken, verifyCsrfToken } from "./csrf-protection";
import { enhancedCorsProtection, requestSizeProtection, developmentServerProtection } from "./security-middleware";
import { hashIpAddress, hashUserAgent } from "./argon2";
import crypto from "crypto";

// Validate environment variables before starting the server
console.log('🚀 Starting ReadMyFinePrint Server...');
const envConfig = validateEnvironmentOrExit();
logEnvironmentStatus();

// Import subscription service for collective user initialization
import { subscriptionService } from './subscription-service';
import { initializeDatabase } from './db-init';
import { blogScheduler } from './blog-scheduler.js';
import { viewDripService } from './view-drip-service.js';

const app = express();

// Configure trust proxy securely - only trust the first proxy
app.set('trust proxy', 1);

// Add security headers
app.use(addSecurityHeaders);

// Add enhanced security middleware for esbuild vulnerability protection
app.use(enhancedCorsProtection);
app.use(requestSizeProtection);
app.use(developmentServerProtection);

// Manual cookie parsing middleware (more reliable than cookie-parser in Replit)
app.use((req, res, next) => {
  req.cookies = {};

  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        try {
          req.cookies[key] = decodeURIComponent(value);
        } catch (error) {
          // If decoding fails, use raw value
          req.cookies[key] = value;
        }
      }
    });
  }

  next();
});

// Enhanced security middleware - block only critical sensitive files
app.use((req, res, next) => {
  const path = req.path.toLowerCase();

  // Block only the most critical sensitive files - be very specific
  const criticalBlockedPaths = [
    '/.env', '/.env.local', '/.env.production', '/.env.development', '/.env.test',
    '/package.json', '/package-lock.json', '/yarn.lock', '/pnpm-lock.yaml',
    '/server/index.ts', '/server/routes.ts', '/server/auth.ts', '/server/openai.ts',
    '/server/db.ts', '/server/env-validation.ts', '/drizzle.config.ts',
    '/node_modules/', '/.git/', '/database.db', '/db.sqlite'
  ];

  // Check for exact matches or directory traversal attempts
  const isBlocked = criticalBlockedPaths.some(blocked => {
    if (blocked.endsWith('/')) {
      return path.startsWith(blocked);
    }
    return path === blocked;
  });

  if (isBlocked) {
    // Log security attempt
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logSecurityEvent({
      eventType: "ACCESS_ATTEMPT" as any,
      severity: "HIGH" as any,
      message: `Blocked access attempt to sensitive path: ${req.path}`,
      ip,
      userAgent,
      endpoint: req.path,
      details: { blockedPath: req.path }
    });

    res.status(404).json({ error: 'Not Found' });
    return;
  }

  next();
});

// CORS configuration
const corsOptions = {
  origin: (envConfig.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000,http://localhost:5000,https://readmyfineprint.com')
    .split(',')
    .map(origin => origin.trim()),
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Enhanced rate limiting for API endpoints with IP-based throttling
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const agentHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `api:${ip}:${agentHash}`;
  },
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 100);
    res.status(429).json({
      error: "Too many requests from this IP, please try again later.",
      retryAfter: Math.ceil(15 * 60) // 15 minutes in seconds
    });
  },
});

// Stricter rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Increased limit for admin endpoints (was 10)
  message: {
    error: "Too many admin requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `admin:${ip}`;
  },
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 50);
    res.status(429).json({
      error: "Too many admin requests from this IP, please try again later.",
      retryAfter: Math.ceil(5 * 60)
    });
  },
});

// Separate rate limiter for admin dashboard endpoints that refresh frequently
const adminDashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Higher limit for dashboard endpoints
  message: {
    error: "Too many dashboard requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `admin_dashboard:${ip}`;
  },
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 30);
    res.status(429).json({
      error: "Too many dashboard requests from this IP, please try again later.",
      retryAfter: Math.ceil(1 * 60)
    });
  },
});

// Stricter rate limiting for document processing
const processLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 document processes per minute
  message: {
    error: "Too many document processing requests. Please wait before submitting more documents."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable all validations since we handle proxy configuration securely
  // Use the same secure key generator
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const agentHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `${ip}:${agentHash}`;
  },
  // Log document processing rate limit violations
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 10);
    res.status(429).json({
      error: "Too many document processing requests. Please wait before submitting more documents."
    });
  },
});

// Special rate limiter for consent endpoints (higher limits for user experience)
const consentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // Allow more requests for consent verification
  message: {
    error: "Too many consent requests. Please wait a moment before trying again."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const agentHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `consent:${ip}:${agentHash}`;
  },
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 200);
    res.status(429).json({
      error: "Too many consent requests. Please wait a moment before trying again."
    });
  },
});

// Apply rate limiting to different endpoint types
app.use('/api/consent/', consentLimiter); // Special higher limits for consent endpoints
app.use('/api/', apiLimiter);
// More specific admin rate limiting - dashboard endpoints get higher limits
app.use('/api/admin/metrics-subscription', adminDashboardLimiter);
app.use('/api/admin/system-health-subscription', adminDashboardLimiter);
app.use('/api/admin/activity-subscription', adminDashboardLimiter);
app.use('/api/admin/security-events-subscription', adminDashboardLimiter);
app.use('/api/admin/', adminLimiter);
app.use('/api/documents/:id/analyze', processLimiter);
app.use('/api/documents/upload', processLimiter);
app.use('/api/create-payment-intent', processLimiter);
app.use('/api/create-checkout-session', processLimiter);

// Special middleware for Stripe webhooks (needs raw body)
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Distributed session management
let sessionStorage: any = null;

// Initialize distributed session storage after database is ready
async function initializeSessionStorage() {
  try {
    const { initializeDatabase } = await import('./db-init');
    await initializeDatabase();
    const { db } = await import('./db');
    const { DistributedSessionStorage } = await import('./distributed-session-storage');

    sessionStorage = await DistributedSessionStorage.initialize(db, {
      defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
      cleanupInterval: 15 * 60 * 1000, // 15 minutes
      maxSessionsPerUser: 5,
      enableCleanup: true
    });

    console.log('✅ Distributed session storage initialized');
  } catch (error) {
    console.error('⚠️ Failed to initialize distributed session storage:', error);
    // Fall back to in-memory session handling
  }
}

// Legacy in-memory session tracking for fallback
const recentSessions = new Map<string, number>();
const SESSION_LOG_COOLDOWN = 5000; // 5 seconds

app.use(async (req: any, res, next) => {
  let sessionId = req.headers['x-session-id'] as string;
  const isNewSession = !sessionId;
  const { ip, userAgent } = getClientInfo(req);

  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.setHeader('x-session-id', sessionId);

    // Create session in distributed storage if available
    if (sessionStorage) {
      try {
        const ipHash = await hashIpAddress(ip);
        const userAgentHash = await hashUserAgent(userAgent);

        await sessionStorage.createSession(
          sessionId,
          { created: new Date(), lastActivity: new Date() },
          undefined, // userId will be set after authentication
          ipHash,
          userAgentHash
        );
      } catch (error) {
        console.error('Failed to create distributed session:', error);
      }
    }

    // Log new session creation with client-based deduplication
    const now = Date.now();
    const clientKey = `${ip}:${userAgent}`;
    const lastClientSession = recentSessions.get(clientKey);

    if (!lastClientSession || (now - lastClientSession) > SESSION_LOG_COOLDOWN) {
      securityLogger.logSessionCreated(ip, userAgent, sessionId);
      recentSessions.set(clientKey, now);
      // Only log session creation in development mode to reduce noise
      if (process.env.NODE_ENV === 'development' || process.env.SESSION_DEBUG === 'true') {
        console.log(`📝 New session logged for client: ${sessionId}`);
      }

      // Clean up old entries periodically
      if (recentSessions.size > 1000) {
        const cutoff = now - SESSION_LOG_COOLDOWN;
        Array.from(recentSessions.entries()).forEach(([key, timestamp]) => {
          if (timestamp < cutoff) {
            recentSessions.delete(key);
          }
        });
      }
    }
  } else if (sessionStorage) {
    // Touch existing session to extend TTL
    try {
      await sessionStorage.touchSession(sessionId);
    } catch (error) {
      // Session might not exist in distributed storage, that's okay
    }
  }

  req.sessionId = sessionId;

  // Debug logging for API requests to track session usage
  if (req.path.startsWith('/api/documents')) {
    console.log(`🔑 ${req.method} ${req.path} | Session: ${sessionId} ${isNewSession ? '(NEW)' : '(EXISTING)'}`);
  }

  next();
});

// Explicit CSRF token endpoint to ensure it's handled before other routes
app.get('/api/csrf-token', (req: any, res) => {
  const sessionId = req.sessionId || req.headers['x-session-id'];
  console.log(`🔍 Direct CSRF token request - sessionId: ${sessionId}, path: ${req.path}, method: ${req.method}`);
  console.log(`🔍 Headers:`, req.headers);

  if (process.env.NODE_ENV === 'staging') {
    // In staging, return a proper token
    if (sessionId) {
      const { csrfProtection } = require('./csrf-protection');
      const token = csrfProtection.getToken(sessionId);
      console.log(`🔍 Generated CSRF token for session ${sessionId}`);
      return res.json({ csrfToken: token });
    }
  }

  // Fallback for development or when no session
  console.log(`🔍 Returning dev-disabled token`);
  const csrfToken = 'dev-disabled';
  return res.json({ 
    csrfToken,
    token: csrfToken, // Alternative field for compatibility
    csrf: csrfToken   // Another alternative for different clients
  });
});

// Add CSRF protection middleware
app.use(provideCsrfToken);
app.use(verifyCsrfToken);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const start = Date.now();
  const path = _req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${_req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  _next();
});

(async () => {
  // Initialize database connection
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️ Continuing in development mode despite database issues');
    }
  }

  // Initialize Enhanced PII Detection with Local LLM
  console.log('🔧 Initializing Enhanced PII Detection with Local LLM...');
  try {
    const { enhancedPiiDetectionService } = await import('./enhanced-pii-detection');
    await enhancedPiiDetectionService.initialize();
    console.log('✅ Enhanced PII Detection with Local LLM initialized');
  } catch (error) {
    console.warn('⚠️ Warning: Failed to initialize Enhanced PII Detection:', error);
    // Don't fail server startup for this
  }

  // Ensure collective free tier user exists for anonymous traffic routing
  console.log('🔧 Initializing collective free tier user routing...');
  try {
    await subscriptionService.ensureCollectiveFreeUserExists();
    console.log('✅ Collective free tier user routing initialized');
  } catch (error) {
    console.warn('⚠️ Warning: Failed to initialize collective free tier user:', error);
    // Don't fail server startup for this
  }

  // Initialize sample documents for demo purposes in development mode
  if (process.env.NODE_ENV === 'development') {
    // Note: Sample documents initialization removed (not needed for production)
  }

  // Add health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      // Database health check with original setup
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

  const server = await registerRoutes(app);

  // Note: Root route handling is now delegated to serveStatic() function
  // which properly serves the built frontend files including index.html

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Skip vite setup due to module resolution issues, use static serving
    console.log("🔧 Development mode: Using static serving (vite module unavailable)");
    serveStatic(app);
  } else {
    serveStatic(app);
  }

  // Use Replit's assigned PORT or fallback to development defaults
  const assignedPort = Number(process.env.PORT);
  // Prioritize 5173 for Replit workflow compatibility
  const tryPorts = assignedPort ? [assignedPort] : [5173, 5000, 3000, 0];

  let serverStarted = false;
  for (const port of tryPorts) {
    try {
      await new Promise<void>((resolve, reject) => {
        const serverInstance = server.listen({
          port,
          host: "0.0.0.0",
        }, async () => {
          const actualPort = (serverInstance.address() as any)?.port || port;
          log(`serving on port ${actualPort}${assignedPort ? ' (Replit assigned)' : ' (development fallback)'}`);

          // Initialize distributed session storage after server starts
          await initializeSessionStorage();

          // Start blog scheduler if enabled
          try {
            blogScheduler.start();
            console.log('✅ Blog scheduler initialized');
          } catch (error) {
            console.warn('⚠️ Blog scheduler failed to start:', error);
          }

          // Start view drip service
          try {
            viewDripService.start();
            console.log('✅ View drip service initialized');
          } catch (error) {
            console.warn('⚠️ View drip service failed to start:', error);
          }

          // Auto-login as admin in development mode
          if (process.env.NODE_ENV === 'development') {
            try {
              const adminEmail = 'admin@readmyfineprint.com';

              console.log('\n🔐 Development Mode: Auto-Admin Login Enabled');
              console.log('📧 Admin Email:', adminEmail);
              console.log('🌐 Admin URL: http://localhost:' + actualPort + '/admin');
              console.log('⚡ No authentication required - just visit the admin page!');
              console.log('\n✨ You are automatically logged in as admin in development mode!');
              console.log('⚠️  This is for development only - never use in production!\n');

              // Create admin user if doesn't exist (no password needed)
              const { databaseStorage } = await import('./storage');
              const existingAdmin = await databaseStorage.getUserByEmail(adminEmail);

              if (!existingAdmin) {
                // Create admin user WITHOUT password
                await databaseStorage.createUser({
                  email: adminEmail,
                  isAdmin: true, // Mark as admin
                  emailVerified: true // Auto-verify in dev
                });
                console.log('✅ Admin user created successfully (no password required in dev)');
              } else {
                console.log('✅ Admin user already exists');
              }

            } catch (error) {
              console.warn('⚠️ Auto-admin setup note:', error instanceof Error ? error.message : 'Unknown error');
              console.log('💡 This is normal in mock database mode - admin access still works!');
            }
          }

          serverStarted = true;
          resolve();
        });

        serverInstance.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            reject(err);
          } else {
            reject(err);
          }
        });
      });
      break; // Successfully started, exit the loop
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && port !== 0) {
        console.log(`Port ${port} is in use, trying next port...`);
        continue;
      } else {
        throw err; // Re-throw non-port-conflict errors
      }
    }
  }

  if (!serverStarted) {
    throw new Error('Unable to start server on any available port');
  }
})();