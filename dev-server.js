import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startDevServer() {
  try {
    // Import the Vite config
    const viteConfig = await import('./vite.config.js');
    
    // Create Vite development server with the existing config
    const server = await createServer(viteConfig.default);
    
    await server.listen();
    
    const info = server.config.logger.info;
    info('🚀 Frontend development server started successfully!');
    info('📱 Using proper Vite + React + TypeScript setup');
    info('🎨 Tailwind CSS configured with PostCSS');
    info('🔗 API proxy to backend at http://localhost:3001');
    info('✨ No more CDN dependencies - production ready!');
    
  } catch (error) {
    console.error('❌ Failed to start Vite dev server:', error);
    console.log('🔧 Falling back to simple Express server...');
    
    // Fallback to basic Express server if Vite fails
    const express = await import('express');
    const app = express.default();
    
    // Serve static files
    app.use(express.static(path.join(__dirname, 'client', 'public')));
    
    // Basic fallback HTML for any route
    app.get('*', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ReadMyFinePrint - Development Server</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; text-align: center; }
            .error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
            .info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ReadMyFinePrint Development Server</h1>
            <div class="error">
              <h3>⚠️ Vite Development Server Failed</h3>
              <p>The proper development server couldn't start. This is a fallback.</p>
            </div>
            <div class="info">
              <h3>🔧 To Fix This:</h3>
              <ol style="text-align: left;">
                <li>Make sure Node.js dependencies are installed: <code>npm install</code></li>
                <li>Check that the Vite configuration is valid</li>
                <li>Restart the development server</li>
              </ol>
            </div>
            <p>Backend API should be running at: <a href="http://localhost:3001">http://localhost:3001</a></p>
            <p><small>Error details: ${error.message}</small></p>
          </div>
        </body>
        </html>
      `);
    });
    
    const PORT = 5173;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚠️ Fallback server running on http://0.0.0.0:${PORT}`);
      console.log('🔧 Please check Vite configuration and restart');
    });
  }
}

startDevServer();