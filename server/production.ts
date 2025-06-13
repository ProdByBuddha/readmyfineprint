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
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables before starting the server
console.log('🚀 Starting ReadMyFinePrint Production Server...');
const envConfig = validateEnvironmentOrExit();
logEnvironmentStatus();

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

async function startProductionServer() {
  // Enable trust proxy to get real IP addresses
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

  // Rate limiting with proper configuration
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
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

  // Register API routes
  await registerRoutes(app);

  // Serve static files from the dist/public directory (where Vite builds to)
  const staticPath = path.join(__dirname, '../dist/public');
  app.use(express.static(staticPath));

  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (req, res) => {
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