#!/usr/bin/env node

import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting esbuild Development Server...');
console.log('📦 Building React app with esbuild (the working system)');

// Create dev server with esbuild
const startServer = async () => {
  try {
    const ctx = await esbuild.context({
      entryPoints: ['client/src/main.tsx'],
      bundle: true,
      outdir: 'dist/public',
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      sourcemap: true,
      minify: false,
      splitting: true,
      loader: {
        '.png': 'file',
        '.jpg': 'file',
        '.jpeg': 'file',
        '.gif': 'file',
        '.svg': 'file',
        '.woff': 'file',
        '.woff2': 'file',
        '.ttf': 'file',
        '.eot': 'file',
      },
      define: {
        'import.meta.env.DEV': 'true',
        'import.meta.env.MODE': '"development"',
        'import.meta.env.VITE_STRIPE_PUBLIC_KEY': `"${process.env.VITE_STRIPE_PUBLIC_KEY || ''}"`,
        'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': `"${process.env.VITE_STRIPE_PUBLISHABLE_KEY || ''}"`,
        'import.meta.env.VITE_ADMIN_API_KEY': `"${process.env.VITE_ADMIN_API_KEY || ''}"`,
      },
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
        '@shared': path.resolve(__dirname, 'shared'),
        '@assets': path.resolve(__dirname, 'attached_assets'),
      },
      plugins: [
        {
          name: 'css-plugin',
          setup(build) {
            // Handle CSS imports
            build.onLoad({ filter: /\.css$/ }, async (args) => {
              const css = await fs.promises.readFile(args.path, 'utf8');
              return {
                contents: css,
                loader: 'css',
              };
            });
          },
        },
      ],
    });

    // Serve files
    const { host, port } = await ctx.serve({
      servedir: 'dist/public',
      host: '0.0.0.0',
      port: 5173,
      fallback: 'client/index.html',
    });

    console.log(`✅ esbuild dev server running at http://${host}:${port}`);
    console.log('🎨 Your beautiful modern styling should now render correctly!');

    // Watch for changes
    await ctx.watch();

  } catch (error) {
    console.error('❌ esbuild server failed:', error);
    process.exit(1);
  }
};

startServer();

// Handle termination
process.on('SIGTERM', () => {
  console.log('🛑 Stopping esbuild server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Stopping esbuild server...');
  process.exit(0);
});