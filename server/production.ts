import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

async function startProductionServer() {
  console.log('🚀 Starting ReadMyFinePrint Production Server...');

  // Register API routes first
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