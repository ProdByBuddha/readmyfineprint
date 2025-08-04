import express from 'express';
import { createServer } from 'http';
import { setupWebpackDevServer } from './webpack-server.js';
import { registerRoutes } from './routes.js';
// Import logging from main server
const loggerMiddleware = (req: any, res: any, next: any) => {
  console.log(`${req.method} ${req.path}`);
  next();
};
import cors from 'cors';

const app = express();
const server = createServer(app);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS for development
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID']
}));

// Logging middleware
app.use(loggerMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    server: 'webpack-development',
    mode: 'development'
  });
});

async function startDevelopmentServer() {
  try {
    console.log('🚀 Starting ReadMyFinePrint Development Server with Webpack...');
    
    // Register API routes first
    await registerRoutes(app);
    console.log('✅ API routes registered');
    
    // Setup webpack development server
    const webpackSetup = await setupWebpackDevServer(app);
    if (!webpackSetup) {
      console.error('❌ Failed to setup webpack development server');
      process.exit(1);
    }
    
    const PORT = process.env.PORT || 5000;
    
    server.listen(parseInt(PORT as string), '0.0.0.0', () => {
      console.log(`✅ Development server running on http://localhost:${PORT}`);
      console.log(`🔗 Frontend: http://localhost:${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
      console.log(`🔧 Webpack HMR enabled`);
    });

  } catch (error) {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down development server...');
  server.close(() => {
    console.log('✅ Development server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down development server...');
  server.close(() => {
    console.log('✅ Development server closed');
    process.exit(0);
  });
});

// Start the server
startDevelopmentServer();