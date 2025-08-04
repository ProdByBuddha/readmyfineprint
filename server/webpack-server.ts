import express, { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupWebpackDevServer(app: Express): Promise<boolean> {
  try {
    // Import webpack configuration
    const webpackConfigPath = path.resolve(__dirname, '../webpack.config.js');
    
    if (!fs.existsSync(webpackConfigPath)) {
      console.error('❌ Webpack config not found at:', webpackConfigPath);
      return false;
    }

    // Dynamic import of webpack config
    const { default: webpackConfig } = await import(webpackConfigPath);
    
    if (!webpackConfig) {
      console.error('❌ Invalid webpack configuration');
      return false;
    }

    const compiler = webpack({
      ...webpackConfig,
      mode: 'development',
      devtool: 'eval-source-map',
      // Add HMR entry point
      entry: {
        ...webpackConfig.entry,
        main: [
          'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000',
          webpackConfig.entry.main
        ]
      },
      plugins: [
        ...webpackConfig.plugins,
        new webpack.HotModuleReplacementPlugin(),
      ]
    });

    if (!compiler) {
      console.error('❌ Failed to create webpack compiler');
      return false;
    }

    // Add webpack dev middleware
    const devMiddleware = webpackDevMiddleware(compiler, {
      publicPath: '/',
      writeToDisk: false,
      stats: {
        colors: true,
        chunks: false,
        modules: false,
        assets: false,
        hash: false,
        version: false,
        timings: true,
        builtAt: false,
      },
    });

    // Add webpack hot middleware
    const hotMiddleware = webpackHotMiddleware(compiler, {
      path: '/__webpack_hmr',
      heartbeat: 10 * 1000,
      log: console.log,
    });

      app.use(devMiddleware);
      app.use(hotMiddleware);

      // Serve static assets
      app.use(express.static(path.resolve(__dirname, '../client/public')));

      // SPA fallback for client-side routing
      app.get('*', (req: Request, res: Response) => {
        // Skip API routes
        if (req.path.startsWith('/api/') || 
            req.path.startsWith('/health') || 
            req.path.startsWith('/admin/api/') ||
            req.path.startsWith('/__webpack_hmr')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }

        try {
          // Get the index.html from webpack's in-memory filesystem
          const indexHtml = devMiddleware.context.outputFileSystem.readFileSync(
            path.join(compiler.outputPath || '/dist/public', 'index.html'),
            'utf-8'
          );
          res.send(indexHtml);
        } catch (error) {
          console.error('❌ Failed to read index.html from webpack:', error);
          res.status(500).send('Failed to load application');
        }
      });

    console.log('✅ Webpack development server configured');
    return true;

  } catch (error) {
    console.error('❌ Failed to setup webpack dev server:', error);
    return false;
  }
}

export function serveStaticFiles(app: Express) {
  // Serve built static files in production
  const staticPath = path.resolve(__dirname, '../dist/public');
  
  if (!fs.existsSync(staticPath)) {
    console.error('❌ Build directory not found at:', staticPath);
    console.error('Build may have failed. Please run: npm run build');
    return false;
  }

  app.use(express.static(staticPath, {
    setHeaders: (res) => {
      // Add security headers to static files
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }));

  // SPA fallback for production
  app.get('*', (req: Request, res: Response) => {
    // Skip API routes
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/health') || 
        req.path.startsWith('/admin/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const indexPath = path.resolve(staticPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.error('❌ index.html not found at:', indexPath);
      return res.status(500).send('Application build files not found. Please rebuild the application.');
    }

    res.sendFile(indexPath);
  });

  console.log('✅ Static file serving configured');
  return true;
}