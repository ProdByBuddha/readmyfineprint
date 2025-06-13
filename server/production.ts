import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

async function startProductionServer() {
  console.log('🚀 Starting ReadMyFinePrint Production Server...');

  // Serve static files from the dist/public directory (where Vite builds to)
  const staticPath = path.join(__dirname, '../dist/public');
  app.use(express.static(staticPath));

  // Register API routes
  await registerRoutes(app);

  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📋 Production server running on http://0.0.0.0:${PORT}`);
  });
}

startProductionServer().catch(console.error);