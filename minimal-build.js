import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Creating minimal production build...');

// Clean and prepare directories
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist/public', { recursive: true });

// Copy essential files to dist/public
const clientFiles = [
  { src: 'client/index.html', dest: 'dist/public/index.html' },
  { src: 'client/public/favicon.ico', dest: 'dist/public/favicon.ico' },
  { src: 'client/public/favicon-16x16.png', dest: 'dist/public/favicon-16x16.png' },
  { src: 'client/public/favicon-32x32.png', dest: 'dist/public/favicon-32x32.png' },
  { src: 'client/public/favicon-48x48.png', dest: 'dist/public/favicon-48x48.png' },
  { src: 'client/public/manifest.json', dest: 'dist/public/manifest.json' },
  { src: 'client/public/robots.txt', dest: 'dist/public/robots.txt' },
  { src: 'client/public/sitemap.xml', dest: 'dist/public/sitemap.xml' }
];

console.log('Copying essential files...');
clientFiles.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Copied:', path.basename(dest));
  }
});

// Create a simple fallback HTML that redirects to dev server
const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Loading...</title>
    <style>
        body { 
            font-family: system-ui; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .container { text-align: center; }
        .loading { 
            font-size: 1.2em; 
            color: #333; 
            margin-bottom: 20px;
        }
        .redirect-btn {
            background: #1E90A0;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
        }
        .redirect-btn:hover {
            background: #176b79;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="loading">ReadMyFinePrint is loading...</div>
        <a href="https://edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev/" class="redirect-btn">
            Access Application
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
            If you're not redirected automatically, click the button above.
        </p>
    </div>
    <script>
        // Auto-redirect after 3 seconds
        setTimeout(() => {
            window.location.href = 'https://edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev/';
        }, 3000);
    </script>
</body>
</html>`;

fs.writeFileSync('dist/public/index.html', fallbackHtml);

// Build the backend
console.log('Building backend...');
execSync('npx esbuild server/production.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
  stdio: 'inherit' 
});

console.log('✅ Minimal build complete!');
console.log('Files in dist/public:', fs.readdirSync('dist/public').length);
console.log('Backend: dist/production.js created');
console.log('');
console.log('This minimal build includes:');
console.log('- Fallback HTML page with redirect to dev server');
console.log('- All favicon files');
console.log('- Essential meta files (manifest, robots, sitemap)');
console.log('- Production backend server');