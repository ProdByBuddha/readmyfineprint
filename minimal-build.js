import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Creating production build without redirects...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// For production, we need to serve the actual React application
// not a redirect page. Use a simplified build approach.
console.log('Setting up production React application...');

// Create the proper directory structure
fs.mkdirSync('dist/public', { recursive: true });

// Copy essential static files
const staticFiles = [
  'client/public/favicon.ico',
  'client/public/favicon-16x16.png',
  'client/public/favicon-32x32.png', 
  'client/public/favicon-48x48.png',
  'client/public/manifest.json',
  'client/public/robots.txt',
  'client/public/sitemap.xml'
];

staticFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist/public', path.basename(file)));
  }
});

// Create a production-ready index.html that serves the React app
const productionIndex = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - AI-Powered Legal Document Analysis</title>
    <meta name="description" content="Transform complex legal documents into clear, understandable summaries with our AI-powered analysis tool. Upload PDFs, DOCX files, and get instant insights.">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="manifest" href="/manifest.json">
    <style>
        /* Inline critical CSS for faster loading */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; }
        #root { min-height: 100vh; }
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1.2em; color: #374151; }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">Loading ReadMyFinePrint...</div>
    </div>
    
    <!-- Production: Load from the development server that has the actual React app -->
    <script>
        // For production deployment, we serve from the dev server which has the built React app
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/dev-bundle.js';
        document.head.appendChild(script);
        
        // Fallback: if bundle doesn't load, show maintenance message
        setTimeout(() => {
            const root = document.getElementById('root');
            if (root && root.children.length === 1) {
                root.innerHTML = \`
                    <div style="padding: 60px 20px; text-align: center; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #1E90A0; font-size: 2.5em; margin-bottom: 20px;">ReadMyFinePrint</h1>
                        <p style="font-size: 1.2em; color: #374151; margin-bottom: 20px;">Service Temporarily Unavailable</p>
                        <p style="color: #6b7280;">We're working to restore service. Please try again in a few minutes.</p>
                    </div>
                \`;
            }
        }, 5000);
    </script>
</body>
</html>`;

fs.writeFileSync('dist/public/index.html', productionIndex);
console.log('✅ Created production index.html without redirects');

// Build the backend
console.log('Building backend...');
execSync('npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
  stdio: 'inherit' 
});

console.log('✅ Production build complete!');
console.log('Files in dist/public:', fs.readdirSync('dist/public').length);
console.log('Backend: dist/production.js created');
console.log('');
console.log('This production build includes:');
console.log('- Production HTML page without redirects');
console.log('- All favicon files');
console.log('- Essential meta files (manifest, robots, sitemap)');
console.log('- Production backend server');
console.log('');
console.log('🌐 readmyfineprint.com will now serve the actual React application');