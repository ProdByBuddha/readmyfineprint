#!/usr/bin/env node

/**
 * Minimal Build Script for ReadMyFinePrint
 * Optimized for Replit deployment with comprehensive error handling
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting production build for ReadMyFinePrint...');

// Build frontend with Vite
console.log('📦 Building React frontend...');
try {
  // Build with optimized settings for faster builds
  execSync('npx vite build --config vite.config.ts --mode production', { 
    stdio: 'inherit',
    cwd: process.cwd(),
    timeout: 180000 // 3 minutes timeout
  });
  console.log('✅ Frontend build completed successfully');
  
  // Verify the build output
  const indexPath = path.join('dist', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    // Check if it contains actual React application code, not a redirect
    if (indexContent.includes('window.location.href') || indexContent.includes('setTimeout')) {
      console.log('⚠️  Detected redirect in build output, fixing...');
      
      // Remove any redirect scripts from the built HTML
      const cleanedContent = indexContent
        .replace(/<script[^>]*>[\s\S]*?window\.location\.href[\s\S]*?<\/script>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?setTimeout[\s\S]*?<\/script>/gi, '');
      
      fs.writeFileSync(indexPath, cleanedContent);
      console.log('✅ Removed redirect scripts from production build');
    }
    
    console.log('✅ Production build verified and cleaned');
  } else {
    throw new Error('index.html not found in build output');
  }
  
} catch (error) {
  console.error('❌ Frontend build failed or timed out');
  console.error(error.message);
  process.exit(1);
}

// Build backend with esbuild
console.log('🔧 Building TypeScript backend...');
try {
  // Create dist directory if it doesn't exist
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Build the main production server
  execSync(`npx esbuild server/production.ts --platform=node --format=esm --outfile=dist/production.js --bundle --external:express --external:cors --external:express-rate-limit --external:multer --external:ws --external:nodemailer --external:openai --external:stripe --external:mammoth --external:qrcode --external:bufferutil --external:utf-8-validate --minify --sourcemap`, {
    stdio: 'inherit'
  });
  
  console.log('✅ Backend compiled with esbuild');
  
} catch (error) {
  console.error('❌ Backend build failed');
  console.error(error.message);
  
  // Fallback: try a simpler build approach
  console.log('🔄 Attempting fallback build...');
  try {
    // Just copy the TypeScript files and let Node.js handle them with tsx at runtime
    execSync('cp -r server dist/', { stdio: 'inherit' });
    
    // Create a simple production launcher
    const launcherCode = `
import { spawn } from 'child_process';
import path from 'path';

const serverPath = path.join(process.cwd(), 'dist', 'server', 'production.ts');
const child = spawn('npx', ['tsx', serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
`;
    
    fs.writeFileSync('dist/production.js', launcherCode);
    console.log('✅ Fallback build completed');
    
  } catch (fallbackError) {
    console.error('❌ Fallback build also failed');
    console.error(fallbackError.message);
    process.exit(1);
  }
}

// Verify production build structure
console.log('🔍 Verifying build structure...');
try {
  const requiredFiles = [
    'dist/public/index.html',
    'dist/production.js'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing required build files: ${missingFiles.join(', ')}`);
  }
  
  // Check build sizes
  const stats = fs.statSync('dist/public/index.html');
  console.log(`📊 Frontend build size: ${(stats.size / 1024).toFixed(2)} KB`);
  
  const backendStats = fs.statSync('dist/production.js');
  console.log(`📊 Backend build size: ${(backendStats.size / 1024).toFixed(2)} KB`);
  
  console.log('✅ Build verification completed successfully');
  
} catch (error) {
  console.error('❌ Build verification failed');
  console.error(error.message);
  process.exit(1);
}

console.log('🎉 Production build completed successfully!');
console.log('📋 Ready for deployment with: npm start');