import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { addSecurityHeaders } from "./auth";
import { validateEnvironmentOrExit, logEnvironmentStatus } from "./env-validation";
import { securityLogger, getClientInfo } from "./security-logger";
import crypto from "crypto";

// Validate environment variables before starting the server
console.log('🚀 Starting ReadMyFinePrint Server...');
const envConfig = validateEnvironmentOrExit();
logEnvironmentStatus();

const app = express();

// Enable trust proxy to get real IP addresses (for consent logging)
app.set('trust proxy', true);

// Add security headers
app.use(addSecurityHeaders);

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
// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use a more secure key generator that combines IP with user agent hash
  keyGenerator: (req) => {
    // Use real IP when behind proxy, fallback to connection IP
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Add user agent hash to prevent trivial bypassing while maintaining privacy
    const userAgent = req.get('User-Agent') || 'unknown';
    const agentHash = crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8);
    return `${ip}:${agentHash}`;
  },
  // Log rate limit violations
  handler: (req, res) => {
    const { ip, userAgent } = getClientInfo(req);
    securityLogger.logRateLimit(ip, userAgent, req.path, 100);
    res.status(429).json({
      error: "Too many requests from this IP, please try again later."
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

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/api/documents/*/analyze', processLimiter);
app.use('/api/documents/upload', processLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session management middleware with deduplication
const recentSessions = new Map<string, number>();
const SESSION_LOG_COOLDOWN = 5000; // 5 seconds

app.use((req: any, res, next) => {
  let sessionId = req.headers['x-session-id'] as string;
  const isNewSession = !sessionId;

    if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.setHeader('x-session-id', sessionId);

    // Log new session creation with client-based deduplication
    const now = Date.now();
    const { ip, userAgent } = getClientInfo(req);
    const clientKey = `${ip}:${userAgent}`;
    const lastClientSession = recentSessions.get(clientKey);

    if (!lastClientSession || (now - lastClientSession) > SESSION_LOG_COOLDOWN) {
      securityLogger.logSessionCreated(ip, userAgent, sessionId);
      recentSessions.set(clientKey, now);
      console.log(`📝 New session logged for client: ${sessionId}`);

      // Clean up old entries periodically
      if (recentSessions.size > 1000) {
        const cutoff = now - SESSION_LOG_COOLDOWN;
        Array.from(recentSessions.entries()).forEach(([key, timestamp]) => {
          if (timestamp < cutoff) {
            recentSessions.delete(key);
          }
        });
      }
    } else {
      console.log(`🔇 Session logging suppressed for client (cooldown: ${now - lastClientSession}ms)`);
    }
  }

  req.sessionId = sessionId;

  // Debug logging for API requests to track session usage
  if (req.path.startsWith('/api/documents')) {
    console.log(`🔑 ${req.method} ${req.path} | Session: ${sessionId} ${isNewSession ? '(NEW)' : '(EXISTING)'}`);
  }

  next();
});

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

(async () => {
  const server = await registerRoutes(app);

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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
