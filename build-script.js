
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Import esbuild with fallback handling
let build;
try {
  // Try direct import first
  const esbuildModule = await import('esbuild');
  build = esbuildModule.build;
  console.log('✅ esbuild imported successfully');
} catch (error) {
  console.error('❌ Failed to import esbuild:', error.message);
  
  // Try to reinstall esbuild with specific version
  console.log('📦 Reinstalling esbuild...');
  try {
    execSync('npm uninstall esbuild', { stdio: 'inherit' });
    execSync('npm install esbuild@^0.25.8', { stdio: 'inherit' });
    
    // Try import again after reinstall
    const esbuildModule = await import('esbuild');
    build = esbuildModule.build;
    console.log('✅ esbuild imported after reinstall');
  } catch (reinstallError) {
    console.error('❌ Failed to reinstall and import esbuild:', reinstallError.message);
    
    // Final fallback: try using require syntax for CJS compatibility
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const esbuild = require('esbuild');
      build = esbuild.build;
      console.log('✅ esbuild imported using require fallback');
    } catch (requireError) {
      console.error('❌ All import methods failed:', requireError.message);
      console.log('🔄 Falling back to npx esbuild command...');
      build = null; // Will use npx fallback below
    }
  }
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Clean dist directory
const distDir = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy static assets
const publicDir = path.join(__dirname, 'client', 'public');
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  files.forEach(file => {
    fs.copyFileSync(
      path.join(publicDir, file),
      path.join(distDir, file)
    );
  });
}

// Process CSS first
console.log('🎨 Processing CSS with Tailwind...');
try {
  execSync(`npx tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify`, {
    stdio: 'inherit'
  });
  console.log('✅ CSS processing completed');
} catch (error) {
  console.error('❌ CSS processing failed:', error);
  process.exit(1);
}

// Build React app with esbuild
try {
  if (build) {
    // Use imported esbuild function
    await build({
    entryPoints: ['client/src/main.tsx'],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    format: 'esm',
    outdir: distDir,
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.js': 'js',
      '.css': 'css',
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.svg': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.ttf': 'file',
      '.eot': 'file'
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis'
    },
    external: [],
    splitting: true,
    metafile: true,
    write: true
    });
  } else {
    // Fallback to npx esbuild command
    console.log('📦 Using npx esbuild fallback...');
    const esbuildCmd = `npx esbuild client/src/main.tsx --bundle --minify --sourcemap --target=es2020 --format=esm --outdir=${distDir} --loader:.tsx=tsx --loader:.ts=ts --loader:.jsx=jsx --loader:.js=js --loader:.css=css --loader:.png=file --loader:.jpg=file --loader:.jpeg=file --loader:.gif=file --loader:.svg=file --loader:.woff=file --loader:.woff2=file --loader:.ttf=file --loader:.eot=file --define:process.env.NODE_ENV='"production"' --define:global=globalThis --splitting --metafile`;
    
    execSync(esbuildCmd, { stdio: 'inherit' });
  }

  // Create index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReadMyFinePrint - Privacy-First AI Contract Analysis</title>
    <meta name="description" content="Privacy-first AI-powered contract analysis platform. Upload and analyze contracts securely with advanced PII protection and legal compliance.">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="manifest" href="/manifest.json">
    <meta property="og:title" content="ReadMyFinePrint - AI Contract Analysis">
    <meta property="og:description" content="Privacy-first AI-powered contract analysis platform">
    <meta property="og:image" content="/og-image.png">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);

  console.log('✅ Build completed successfully with esbuild');
  
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
