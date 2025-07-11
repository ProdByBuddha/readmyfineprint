import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { addSecurityHeaders } from "./auth";
import { validateEnvironmentOrExit, logEnvironmentStatus } from "./env-validation";
import { securityLogger, getClientInfo } from "./security-logger";
import { provideCsrfToken, verifyCsrfToken } from "./csrf-protection";
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

const app = express();

// Configure trust proxy securely - only trust the first proxy
app.set('trust proxy', 1);

// Add security headers
app.use(addSecurityHeaders);

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
  max: 10, // Very limited for admin endpoints
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
    securityLogger.logRateLimit(ip, userAgent, req.path, 10);
    res.status(429).json({
      error: "Too many admin requests from this IP, please try again later.",
      retryAfter: Math.ceil(5 * 60)
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
app.use('/api/admin/', adminLimiter);
app.use('/api/documents/*/analyze', processLimiter);
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
    const database = await initializeDatabase();
    const { DistributedSessionStorage } = await import('./distributed-session-storage');
    
    sessionStorage = await DistributedSessionStorage.initialize(database, {
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

// Add CSRF protection middleware
app.use(provideCsrfToken);
app.use(verifyCsrfToken);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// CSRF Protection - provide tokens to clients and verify on state-changing requests
app.use(provideCsrfToken);
app.use(verifyCsrfToken);

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
    console.log('🔧 Initializing sample documents for demo...');
    try {
      const { databaseStorage } = await import('./storage');
      databaseStorage.initializeSampleDocuments();
      console.log('✅ Sample documents initialized');
    } catch (error) {
      console.warn('⚠️ Warning: Failed to initialize sample documents:', error);
      // Don't fail server startup for this
    }
  }

  // Add health check endpoint
  app.get('/health', async (req, res) => {
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
      const isHealthy = dbStatus.circuitBreakers.neon.isHealthy || dbStatus.circuitBreakers.local.isHealthy;
      
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

  // Development-only landing page for Replit webview
  if (process.env.NODE_ENV === 'development') {
    app.get('/', (req, res) => {
      // Get the correct Replit dev URL
      const replitHost = req.get('host');
      const baseUrl = replitHost ? `https://${replitHost}` : 'http://localhost:5000';
      const frontendUrl = replitHost 
        ? baseUrl.replace('.replit.dev', '.replit.dev:5173').replace(':80', ':5173')
        : 'http://localhost:5173';
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ReadMyFinePrint - Dev Mode</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #0f0f0f;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: #1a1a1a;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
            .logo {
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              margin: 0.5rem 0;
              font-size: 2rem;
            }
            .status {
              color: #22c55e;
              margin: 1rem 0;
            }
            .links {
              margin-top: 2rem;
            }
            a {
              display: inline-block;
              padding: 0.75rem 2rem;
              margin: 0.5rem;
              background: #3b82f6;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              transition: background 0.2s;
            }
            a:hover {
              background: #2563eb;
            }
            .admin {
              background: #8b5cf6;
            }
            .admin:hover {
              background: #7c3aed;
            }
            .info {
              margin-top: 2rem;
              font-size: 0.875rem;
              color: #999;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">📄</div>
            <h1>ReadMyFinePrint</h1>
            <p class="status">✅ Development Server Running</p>
            <p>Auto-Admin Login Enabled</p>
            <div class="links">
              <a href="${frontendUrl}" target="_blank">Open Frontend →</a>
              <a href="${frontendUrl}/admin" target="_blank" class="admin">Admin Dashboard →</a>
            </div>
            <div class="info">
              <p>Frontend: ${frontendUrl}</p>
              <p>Backend API: /api</p>
              <p>You are automatically logged in as admin@readmyfineprint.com</p>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  }

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
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Try to use port 5000 first, but fall back to available ports if needed
  const preferredPort = 5000;
  const tryPorts = [preferredPort, 3000, 3001, 8000, 8080, 0]; // 0 means any available port

  let serverStarted = false;
  for (const port of tryPorts) {
    try {
      await new Promise<void>((resolve, reject) => {
        const serverInstance = server.listen({
          port,
          host: "0.0.0.0",
        }, async () => {
          const actualPort = (serverInstance.address() as any)?.port || port;
          log(`serving on port ${actualPort}`);
          
          // Initialize distributed session storage after server starts
          await initializeSessionStorage();
          
          // Start blog scheduler if enabled
          try {
            blogScheduler.start();
            console.log('✅ Blog scheduler initialized');
          } catch (error) {
            console.warn('⚠️ Blog scheduler failed to start:', error);
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
