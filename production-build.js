import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building production application...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('Cleaned existing dist directory');
}

// Build frontend with Vite
console.log('Building React frontend...');
try {
  // Use timeout and specific Vite configuration for faster build
  execSync('timeout 300s npx vite build --config vite.config.ts', { 
    stdio: 'inherit',
    cwd: process.cwd()
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
  console.error('❌ Frontend build failed or timed out', error);
  process.exit(1);
}

// Build backend
console.log('Building backend server...');
try {
  execSync('npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    stdio: 'inherit' 
  });
  console.log('✅ Backend build completed');
} catch (error) {
  console.error('❌ Backend build failed:', error.message);
  process.exit(1);
}

// Verify build artifacts
const distFiles = fs.readdirSync('dist', { recursive: true });
console.log('✅ Production build complete!');
console.log(`📁 Created ${distFiles.length} build artifacts`);
console.log('🚀 Ready for deployment');