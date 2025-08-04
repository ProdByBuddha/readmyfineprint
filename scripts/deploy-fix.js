#!/usr/bin/env node

/**
 * Deployment Fix Script for TailwindCSS Issues
 * Ensures all dependencies are installed before building
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🚀 Starting deployment fix process...\n');

// Step 1: Ensure we're in the right directory
process.chdir(projectRoot);
console.log('📂 Working directory:', process.cwd());

// Step 2: Install dependencies to ensure arg and tailwindcss are available
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Step 3: Verify TailwindCSS is available
console.log('🔍 Verifying TailwindCSS installation...');
try {
  execSync('./node_modules/.bin/tailwindcss --help', { stdio: 'pipe' });
  console.log('✅ Local TailwindCSS is available');
} catch (error) {
  console.log('⚠️ Local TailwindCSS not found, checking global...');
  try {
    execSync('npx tailwindcss --help', { stdio: 'pipe' });
    console.log('✅ Global TailwindCSS is available');
  } catch (globalError) {
    console.error('❌ TailwindCSS not available locally or globally');
    console.log('💡 Installing TailwindCSS locally...');
    try {
      execSync('npm install tailwindcss arg', { stdio: 'inherit' });
      console.log('✅ TailwindCSS installed successfully');
    } catch (installError) {
      console.error('❌ Failed to install TailwindCSS:', installError.message);
      process.exit(1);
    }
  }
}

// Step 4: Run the build process
console.log('\n🏗️ Running build process...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\n✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.log('\n🔧 Attempting alternative build approach...');
  
  // Alternative build approach
  try {
    execSync('npm run client:build', { stdio: 'inherit' });
    execSync('npm run server:build', { stdio: 'inherit' });
    console.log('✅ Alternative build completed successfully!');
  } catch (altError) {
    console.error('❌ Alternative build also failed:', altError.message);
    process.exit(1);
  }
}

console.log('\n🎉 Deployment fix completed successfully!');
console.log('📋 Summary:');
console.log('   • Dependencies installed');
console.log('   • TailwindCSS verified and available');
console.log('   • Build process completed');
console.log('   • Project ready for deployment');