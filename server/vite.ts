import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// Helper function to apply all security headers consistently
function applySecurityHeaders(res: express.Response) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self https://js.stripe.com https://m.stripe.com)');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Enhanced Content Security Policy
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isStaging = process.env.NODE_ENV === 'staging';
  const replitSources = (isDevelopment || isStaging) ? ' https://replit.com https://*.replit.com https://*.replit.dev https://*.kirk.replit.dev https://cdn.jsdelivr.net' : '';
  const localhostSources = isDevelopment ? ' http://localhost:5173 http://localhost:5000 http://127.0.0.1:5173 http://127.0.0.1:5000 https://*.kirk.replit.dev:5173' : '';
  const websocketSources = (isDevelopment || isStaging) ? ' ws://localhost:5173 wss://localhost:5173 wss://*.replit.dev wss://*.kirk.replit.dev' : '';

  const cspValue = "default-src 'none'; " +
    `script-src 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
    `script-src-elem 'self' https://js.stripe.com https://m.stripe.com${replitSources}; ` +
    `style-src 'self' data: https://js.stripe.com https://fonts.googleapis.com${replitSources}${(isDevelopment || isStaging) ? " 'unsafe-inline'" : ''}; ` +
    `style-src-elem 'self' data: https://fonts.googleapis.com${replitSources}; ` +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://img.shields.io https://js.stripe.com; " +
    `connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com https://m.stripe.com${replitSources}${localhostSources}${websocketSources}; ` +
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.com; " +
    "media-src 'self'; " +
    "manifest-src 'self'; " +
    "worker-src 'self'; " +
    "child-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://js.stripe.com https://api.stripe.com; " +
    "frame-ancestors 'none'; " +
    "upgrade-insecure-requests; " +
    "report-uri /api/security/csp-report; " +
    "report-to csp-endpoint;";

  res.setHeader('Content-Security-Policy', cspValue);
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  try {
    const { createServer: createViteServer, createLogger } = await import("vite");
    // @ts-ignore - vite.config.js is a JavaScript file
    const viteConfig = (await import("../vite.config.js")).default;
    const viteLogger = createLogger();
    
    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    };

    const vite = await createViteServer({
      ...(viteConfig || {}),
      configFile: false,
      customLogger: {
        ...viteLogger,
        error: (msg: string, options?: any) => {
          viteLogger.error(msg, options);
          process.exit(1);
        },
      },
      server: serverOptions,
      appType: "custom",
    });

    app.use(vite.middlewares);
    app.use("/*path", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        // always reload the index.html file from disk incase it changes
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${Date.now()}"`,
        );
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } catch (error) {
    console.error("Failed to setup Vite:", error);
    throw error;
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.log(`⚠️  Build directory not found: ${distPath}`);
    console.log(`🏗️  Creating build directory and running client build...`);
    
    // Create the directory structure
    fs.mkdirSync(distPath, { recursive: true });
    
    // Create a temporary index.html for development
    const tempIndexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(tempIndexPath)) {
      fs.writeFileSync(tempIndexPath, `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Building...</title>
    <style>
        body { 
            font-family: system-ui, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container { text-align: center; }
        .spinner { 
            border: 4px solid rgba(255,255,255,0.3); 
            border-radius: 50%; 
            border-top: 4px solid white; 
            width: 50px; 
            height: 50px; 
            animation: spin 1s linear infinite; 
            margin: 0 auto 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>ReadMyFinePrint</h1>
        <p>Application is building... Please run <code>npm run build</code> to complete the setup.</p>
        <p>This is a temporary page while the client build is being prepared.</p>
    </div>
</body>
</html>
      `.trim());
    }
    
    console.log(`✅ Temporary build directory created at: ${distPath}`);
    console.log(`🔧 Run 'npm run build' to create the production build`);
  }

  // Apply security headers to static files
  app.use(express.static(distPath, {
    setHeaders: (res, path) => {
      applySecurityHeaders(res);
    }
  }));

  // fall through to index.html for non-API routes - with security headers
  app.get("/*path", (req, res) => {
    // Don't intercept API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    applySecurityHeaders(res);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
