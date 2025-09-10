import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startDevServer() {
  try {
    console.log('🚀 Starting Vite development server...');
    
    // Create Vite development server with the existing config
    const server = await createServer({
      configFile: path.resolve(__dirname, 'vite.config.js'),
      // Explicitly set server options to ensure proper startup
      server: {
        host: '0.0.0.0',
        port: 5173
      }
    });
    
    await server.listen();
    
    // Print URLs like Vite CLI does
    server.printUrls();
    
    console.log('🎨 Using proper Vite + React + TypeScript + Tailwind CSS');
    console.log('🔗 API proxy to backend at http://localhost:3001');
    console.log('✨ Production-ready build system active!');
    console.log('🚫 No more CDN dependencies - Tailwind CSS properly compiled');
    
    // Keep the process alive so concurrently shows [1] logs
    process.stdin.resume();
    
    // Handle graceful shutdown
    const handleShutdown = () => {
      console.log('\n🛑 Shutting down Vite dev server...');
      server.close().then(() => {
        process.exit(0);
      });
    };
    
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start Vite dev server:', error.message);
    console.error('🔧 Error details:', error.stack);
    process.exit(1);
  }
}

startDevServer();