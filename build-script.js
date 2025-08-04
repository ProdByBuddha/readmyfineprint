#!/usr/bin/env node

/**
 * Production Build Script using Webpack
 * This replaces the broken Vite/esbuild setup with a reliable webpack-based build system
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Webpack Production Build...');
console.log('📦 Building React app with TailwindCSS and optimizations');

// Set production environment
process.env.NODE_ENV = 'production';

// Clean dist directory
const distDir = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
  console.log('🧹 Cleaned previous build directory');
}
fs.mkdirSync(distDir, { recursive: true });

// Build with webpack
try {
  console.log('📦 Running webpack production build...');
  execSync('npx webpack --config webpack.config.js --mode production', {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });

  console.log('✅ Webpack build completed successfully');

  // Copy additional static assets that webpack might miss
  const publicDir = path.join(__dirname, 'client', 'public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    files.forEach(file => {
      const srcFile = path.join(publicDir, file);
      const destFile = path.join(distDir, file);

      // Only copy if it doesn't already exist (webpack might have processed it)
      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`📄 Copied ${file} to build directory`);
      }
    });
  }

} catch (error) {
  console.error('❌ Webpack build failed:', error.message);
  console.log('🔄 Falling back to esbuild approach...');

  // Build React app with esbuild
  try {
    // Fallback to npx esbuild command
    console.log('📦 Using npx esbuild fallback...');
    const esbuildCmd = `npx esbuild client/src/main.tsx --bundle --minify --sourcemap --target=es2020 --format=esm --outdir=${distDir} --loader:.tsx=tsx --loader:.jsx=jsx --loader:.js=js --loader:.css=css --loader:.png=file --loader:.jpg=file --loader:.jpeg=file --loader:.gif=file --loader:.svg=file --loader:.woff=file --loader:.woff2=file --loader:.ttf=file --loader:.eot=file --define:process.env.NODE_ENV='"production"' --define:global=globalThis --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true --define:import.meta.env.MODE='"production"' --define:import.meta.env.BASE_URL='"/"' --define:import.meta.env.VITE_STRIPE_PUBLIC_KEY='"${process.env.VITE_STRIPE_PUBLIC_KEY || ''}"' --splitting --metafile`;

    execSync(esbuildCmd, { stdio: 'inherit' });

    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Privacy-First AI Contract Analysis</title>
    <meta name="description" content="Privacy-first AI-powered contract analysis platform. Upload and analyze contracts securely with advanced PII protection and legal compliance.">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="manifest" href="/manifest.json">
    <meta property="og:title" content="ReadMyFinePrint - AI Contract Analysis">
    <meta property="og:description" content="Privacy-first AI-powered contract analysis platform">
    <meta property="og:image" content="/og-image.png">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
</body>
</html>`;

    fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);

    console.log('✅ Build completed successfully with esbuild fallback');

  } catch (error) {
    console.error('❌ All build methods failed:', error);
    process.exit(1);
  }
}

console.log('🎉 Production build completed successfully!');
console.log(`📂 Build output: ${distDir}`);
console.log('🚀 Ready for production deployment');