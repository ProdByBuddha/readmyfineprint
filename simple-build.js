import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building with optimized settings...');

// Set memory and timeout options
const buildEnv = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=4096',
  VITE_BUILD_TIMEOUT: '300000'
};

try {
  // Clean previous build
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // Build with simplified Vite command
  console.log('Building frontend...');
  execSync('npx vite build --mode production --logLevel error', { 
    stdio: 'inherit',
    env: buildEnv,
    timeout: 300000 // 5 minutes
  });

  // Verify frontend build
  const indexPath = 'dist/public/index.html';
  if (!fs.existsSync(indexPath)) {
    throw new Error('Frontend build failed - index.html not found');
  }

  // Build backend
  console.log('Building backend...');
  execSync('npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    stdio: 'inherit' 
  });

  // Verify backend build
  if (!fs.existsSync('dist/production.js')) {
    throw new Error('Backend build failed');
  }

  console.log('✅ Build successful!');
  console.log('Frontend files:', fs.readdirSync('dist/public').length, 'files');
  console.log('Backend: dist/production.js created');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}