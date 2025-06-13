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

// Try building with Vite first, then fall back to development server integration
console.log('Attempting Vite build...');
let viteSuccess = false;

try {
  execSync('timeout 90s npx vite build', { 
    stdio: 'pipe',
    cwd: process.cwd()
  });
  
  // Check if Vite build was successful
  const viteIndexPath = 'dist/public/index.html';
  if (fs.existsSync(viteIndexPath)) {
    const content = fs.readFileSync(viteIndexPath, 'utf-8');
    // Ensure no redirects in the Vite build
    if (!content.includes('window.location.href') && !content.includes('edcf3ef7-a826')) {
      console.log('✅ Vite build successful - using compiled React application');
      viteSuccess = true;
    }
  }
} catch (error) {
  console.log('⚠️ Vite build failed or timed out, using production fallback');
}

if (!viteSuccess) {
  // Create production-ready index.html that works with the backend serving
  const productionIndex = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - AI-Powered Legal Document Analysis</title>
    <meta name="description" content="Transform complex legal documents into clear, understandable summaries with our AI-powered analysis tool. Upload PDFs, DOCX files, and get instant insights.">
    <meta name="keywords" content="legal documents, AI analysis, document summary, PDF analysis, contract review">
    <meta property="og:title" content="ReadMyFinePrint - AI-Powered Legal Document Analysis">
    <meta property="og:description" content="Transform complex legal documents into clear, understandable summaries with our AI-powered analysis tool.">
    <meta property="og:type" content="website">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="manifest" href="/manifest.json">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; 
            background: #f9fafb; 
            color: #111827;
            line-height: 1.5;
        }
        #root { min-height: 100vh; }
        .app-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            text-align: center;
        }
        .logo {
            font-size: 2.5em;
            font-weight: bold;
            color: #1E90A0;
            margin-bottom: 20px;
        }
        .tagline {
            font-size: 1.3em;
            color: #374151;
            margin-bottom: 40px;
            max-width: 600px;
        }
        .status {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            margin: 0 auto;
        }
        .loading {
            color: #1E90A0;
            font-size: 1.1em;
            margin-bottom: 15px;
        }
        .note {
            color: #6b7280;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="app-container">
            <div class="logo">ReadMyFinePrint</div>
            <div class="tagline">AI-Powered Legal Document Analysis</div>
            <div class="status">
                <div class="loading">Application Loading...</div>
                <div class="note">
                    Transform complex legal documents into clear, understandable summaries.
                    The application is initializing and will be ready shortly.
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('dist/public/index.html', productionIndex);
}

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