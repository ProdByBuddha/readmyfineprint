#!/usr/bin/env node

/**
 * Deployment build script that works around vite configuration issues
 * This script creates a clean build configuration without problematic references
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Create a clean vite config without problematic references
const cleanViteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-accordion'],
        },
      },
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: true,
    minify: 'esbuild',
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
  css: {
    devSourcemap: true,
  },
});`;

try {
  console.log('🔧 Creating clean build configuration...');
  
  // Backup original config
  const originalConfig = readFileSync(join(rootDir, 'vite.config.ts'), 'utf8');
  writeFileSync(join(rootDir, 'vite.config.backup.ts'), originalConfig);
  
  // Write clean config
  writeFileSync(join(rootDir, 'vite.config.clean.ts'), cleanViteConfig);
  
  console.log('🏗️  Building with clean configuration...');
  
  // Run build with clean config
  execSync('vite build --config vite.config.clean.ts', { 
    cwd: rootDir, 
    stdio: 'inherit' 
  });
  
  console.log('📦 Building server...');
  
  // Build server
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    cwd: rootDir, 
    stdio: 'inherit' 
  });
  
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Cleanup
  try {
    unlinkSync(join(rootDir, 'vite.config.clean.ts'));
  } catch (e) {
    // Ignore cleanup errors
  }
}