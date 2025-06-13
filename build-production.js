#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🏗️ Building ReadMyFinePrint for production...');

try {
  // Build the frontend
  console.log('📦 Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });

  // Build the backend
  console.log('🔧 Building backend...');
  execSync('npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });

  console.log('✅ Production build complete!');
  console.log('🚀 Run with: NODE_ENV=production node dist/production.js');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}