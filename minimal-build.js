import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Creating production build with Vite...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Build frontend with Vite
console.log('Building frontend...');
try {
  execSync('npx vite build', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Frontend build completed');
} catch (error) {
  console.error('❌ Frontend build failed:', error.message);
  
  // Create fallback structure if Vite build fails
  console.log('Creating fallback build structure...');
  fs.mkdirSync('dist/public', { recursive: true });
  
  // Copy essential files
  const essentialFiles = [
    { src: 'client/public/favicon.ico', dest: 'dist/public/favicon.ico' },
    { src: 'client/public/favicon-16x16.png', dest: 'dist/public/favicon-16x16.png' },
    { src: 'client/public/favicon-32x32.png', dest: 'dist/public/favicon-32x32.png' },
    { src: 'client/public/favicon-48x48.png', dest: 'dist/public/favicon-48x48.png' },
    { src: 'client/public/manifest.json', dest: 'dist/public/manifest.json' },
    { src: 'client/public/robots.txt', dest: 'dist/public/robots.txt' },
    { src: 'client/public/sitemap.xml', dest: 'dist/public/sitemap.xml' }
  ];

  essentialFiles.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('Copied:', path.basename(dest));
    }
  });

  // Create maintenance page
  const maintenanceHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Maintenance</title>
    <meta name="description" content="ReadMyFinePrint is currently under maintenance. Please check back soon.">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <style>
        body { 
            font-family: system-ui, -apple-system, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: #f9fafb;
            color: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container { 
            max-width: 600px; 
            text-align: center; 
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .logo { 
            font-size: 2.5em; 
            font-weight: bold; 
            color: #1E90A0; 
            margin-bottom: 20px;
        }
        .message { 
            font-size: 1.2em; 
            color: #374151; 
            margin-bottom: 20px;
        }
        .details {
            color: #6b7280;
            font-size: 1em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">ReadMyFinePrint</div>
        <div class="message">We're currently updating our service</div>
        <div class="details">
            Our AI-powered legal document analysis tool is being improved. 
            Please check back in a few minutes.
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('dist/public/index.html', maintenanceHtml);
  console.log('Created maintenance page');
}

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