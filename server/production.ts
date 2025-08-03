import express, { type Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes.js';
import { addSecurityHeaders } from './auth.js';
import { validateEnvironmentOrExit, logEnvironmentStatus } from './env-validation.js';
import { securityLogger, getClientInfo } from './security-logger.js';
import { enhancedCorsProtection, requestSizeProtection, developmentServerProtection } from './security-middleware.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables before starting the server
console.log('🚀 Starting ReadMyFinePrint Production Server...');

// Check for DATABASE_URL specifically and provide helpful error message
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in the deployment environment.');
  console.error('   This is required for the production server to connect to the database.');
  console.error('   Please configure the DATABASE_URL environment variable in your deployment platform.');
  console.error('   For Replit deployments, make sure the PostgreSQL database is provisioned.');
  process.exit(1);
}

const envConfig = validateEnvironmentOrExit();
logEnvironmentStatus();

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

async function startProductionServer() {
  // Run database migrations check
  try {
    const { checkAndRunMigrations } = await import('../scripts/check-db-migrations.js');
    await checkAndRunMigrations();
  } catch (error) {
    console.error('⚠️  Migration check failed, continuing with server startup:', error);
  }
  
  // Configure trust proxy securely - only trust the first proxy
  app.set('trust proxy', 1);

  // Add security headers
  app.use(addSecurityHeaders);

  // Add enhanced security middleware for esbuild vulnerability protection
  app.use(enhancedCorsProtection);
  app.use(requestSizeProtection);
  app.use(developmentServerProtection);

  // CORS configuration - Production should not include localhost
  const corsOptions = {
    origin: (envConfig.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS ||
      'https://readmyfineprint.com')
      .split(',')
      .map(origin => origin.trim()),
    credentials: true,
    optionsSuccessStatus: 200
  };

  app.use(cors(corsOptions));

  // Rate limiting with proper configuration
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: false, // Disable all validations since we handle proxy configuration securely
  });

  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Session logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const clientInfo = getClientInfo(req);
    
    // Generate or retrieve session ID
    let sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) {
      sessionId = crypto.randomBytes(16).toString('hex');
    }
    
    // Add session ID to request for use in routes
    (req as any).sessionId = sessionId;
    (req as any).clientInfo = clientInfo;
    
    next();
  });

  // Add health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      // Database health check with original setup
      let dbHealthy = true;
      try {
        const { db } = await import('./db.js');
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

  // Register API routes
  await registerRoutes(app);

  // Serve static files from the dist/public directory (where Vite builds to)
  const staticPath = path.join(__dirname, '../dist/public');
  app.use(express.static(staticPath));

  // Serve index.html for all other routes (SPA fallback)
  app.get('/*path', (req, res) => {
    const indexPath = path.join(staticPath, 'index.html');
    
    // Check if index.html exists
    if (!fs.existsSync(indexPath)) {
      console.error('❌ index.html not found at:', indexPath);
      console.error('Build may have failed. Please run: npm run build');
      return res.status(500).send('Application build files not found. Please rebuild the application.');
    }
    
    res.sendFile(indexPath);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📋 Production server running on http://0.0.0.0:${PORT}`);
  });
}

startProductionServer().catch(console.error);