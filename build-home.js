#!/usr/bin/env node
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildHome() {
  try {
    console.log('Building home page with latest changes...');
    
    // Ensure dist/public exists
    const distPath = path.join(__dirname, 'dist', 'public');
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }

    // Build the home module
    await esbuild.build({
      entryPoints: ['client/src/pages/home.tsx'],
      bundle: true,
      outfile: 'dist/public/home-latest.js',
      format: 'esm',
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js'
      },
      define: {
        'process.env.NODE_ENV': '"development"'
      },
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
        '@shared': path.resolve(__dirname, 'shared')
      },
      external: ['react', 'react-dom', 'react-router-dom', 'wouter']
    });

    // Update the index.html to use the new home module
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Replace old home module reference with new one
      html = html.replace(/home-[A-Z0-9]+\.js/g, 'home-latest.js');
      fs.writeFileSync(indexPath, html);
      console.log('✅ Updated index.html to use new home module');
    }

    console.log('✅ Home page rebuilt successfully!');
    console.log('🔄 Please refresh your browser to see the changes.');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildHome();