#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');

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

      plugins: [
        {
          name: 'resolve-plugin',
          setup(build) {
            // Handle @ alias imports
            build.onResolve({ filter: /^@\// }, args => ({
              path: path.join(__dirname, 'client/src', args.path.slice(2)),
            }));
            
            build.onResolve({ filter: /^@shared/ }, args => ({
              path: path.join(__dirname, 'shared', args.path.slice(8)),
            }));
            
            build.onResolve({ filter: /^@assets/ }, args => ({
              path: path.join(__dirname, 'attached_assets', args.path.slice(8)),
            }));
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

    console.log(`✅ esbuild dev server running at http://localhost:${port}`);
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