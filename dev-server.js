#!/usr/bin/env node

/**
 * Development Server using Webpack Dev Server
 * This replaces the broken Vite setup with a proper webpack-based development environment
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Webpack Development Server...');
console.log('📦 Building with proper React compilation and TailwindCSS processing');

try {
  // Set development environment
  process.env.NODE_ENV = 'development';
  
  // Start webpack dev server
  execSync('npx webpack serve --config webpack.config.js', {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
} catch (error) {
  console.error('❌ Webpack dev server failed:', error.message);
  
  // Fallback to webpack build + simple server
  console.log('🔄 Falling back to build + serve approach...');
  try {
    execSync('npx webpack --config webpack.config.js --mode development', {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    // Simple static server for fallback
    import('express').then(({ default: express }) => {
      const app = express();
      const PORT = 5173;
      
      app.use(express.static(path.join(__dirname, 'dist', 'public')));
      
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
      });
      
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Fallback development server running on http://0.0.0.0:${PORT}`);
      });
    });
  } catch (fallbackError) {
    console.error('❌ All development server methods failed:', fallbackError.message);
    process.exit(1);
  }
}