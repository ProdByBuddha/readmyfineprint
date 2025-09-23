import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import process from 'node:process';
import { fileURLToPath } from 'url';

const formatLogPart = part => {
  if (part instanceof Error) {
    return part.stack ?? part.message;
  }

  if (typeof part === 'object') {
    try {
      return JSON.stringify(part);
    } catch {
      return String(part);
    }
  }

  return String(part);
};

const writeLine = (stream, ...parts) => {
  stream.write(`${parts.map(formatLogPart).join(' ')}\n`);
};

const logInfo = (...parts) => writeLine(process.stdout, ...parts);
const logWarn = (...parts) => writeLine(process.stdout, ...parts);
const logError = (...parts) => writeLine(process.stderr, ...parts);

// Import esbuild with fallback handling
let build;
try {
  // Try direct import first
  const esbuildModule = await import('esbuild');
  build = esbuildModule.build;
  logInfo('✅ esbuild imported successfully');
} catch (error) {
  logError('❌ Failed to import esbuild:', error);

  // Try to reinstall esbuild with specific version
  logInfo('📦 Reinstalling esbuild...');
  try {
    execSync('npm uninstall esbuild', { stdio: 'inherit' });
    execSync('npm install esbuild@^0.25.8', { stdio: 'inherit' });

    // Try import again after reinstall
    const esbuildModule = await import('esbuild');
    build = esbuildModule.build;
    logInfo('✅ esbuild imported after reinstall');
  } catch (reinstallError) {
    logError('❌ Failed to reinstall and import esbuild:', reinstallError);

    // Final fallback: try using require syntax for CJS compatibility
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const esbuild = require('esbuild');
      build = esbuild.build;
      logInfo('✅ esbuild imported using require fallback');
    } catch (requireError) {
      logError('❌ All import methods failed:', requireError);
      logWarn('🔄 Falling back to npx esbuild command...');
      build = null; // Will use npx fallback below
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
logInfo('🎨 Processing CSS...');
try {
  // First try local tailwindcss installation
  try {
    execSync(`./node_modules/.bin/tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify`, {
      stdio: 'inherit'
    });
    logInfo('✅ CSS processing completed with local TailwindCSS');
  } catch (localError) {
    logWarn('⚠️ Local TailwindCSS failed, trying npx...', localError);
    try {
      // Fallback to npx
      execSync(`npx tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify`, {
        stdio: 'inherit'
      });
      logInfo('✅ CSS processing completed with npx TailwindCSS');
    } catch (npxError) {
      logWarn('⚠️ TailwindCSS unavailable, using fallback CSS processor...', npxError);
      // Final fallback - basic CSS processing
      execSync(`node process-css.js`, {
        stdio: 'inherit'
      });
      logInfo('✅ CSS processing completed with fallback processor');
    }
  }
} catch (error) {
  logError('❌ All CSS processing methods failed:', error);
  logWarn('💡 Using minimal CSS fallback...');

  // Emergency fallback - just copy the CSS file
  try {
    const cssSource = path.join(__dirname, 'client', 'src', 'index.css');
    const cssDestination = path.join(distDir, 'styles.css');

    if (fs.existsSync(cssSource)) {
      fs.copyFileSync(cssSource, cssDestination);
      logInfo('✅ CSS copied as emergency fallback');
    } else {
      // Create minimal CSS if source doesn't exist
      fs.writeFileSync(cssDestination, '/* Fallback CSS */\nbody { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }');
      logInfo('✅ Minimal CSS created as emergency fallback');
    }
  } catch (fallbackError) {
    logError('❌ Even emergency CSS fallback failed:', fallbackError);
    // Don't exit - continue without CSS
    logWarn('⚠️ Continuing build without CSS...');
  }
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
      'global': 'globalThis',
      'React': 'window.React',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      'import.meta.env.BASE_URL': '"/"',
      'import.meta.env.VITE_STRIPE_PUBLIC_KEY': `"${process.env.VITE_STRIPE_PUBLIC_KEY || ''}"`
    },
    external: [],
    splitting: true,
    metafile: true,
    write: true
    });
  } else {
    // Fallback to npx esbuild command
    logWarn('📦 Using npx esbuild fallback...');
    const esbuildCmd = `npx esbuild client/src/main.tsx --bundle --minify --sourcemap --target=es2020 --format=esm --outdir=${distDir} --loader:.tsx=tsx --loader:.jsx=jsx --loader:.js=js --loader:.css=css --loader:.png=file --loader:.jpg=file --loader:.jpeg=file --loader:.gif=file --loader:.svg=file --loader:.woff=file --loader:.woff2=file --loader:.ttf=file --loader:.eot=file --define:process.env.NODE_ENV='"production"' --define:global=globalThis --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true --define:import.meta.env.MODE='"production"' --define:import.meta.env.BASE_URL='"/"' --define:import.meta.env.VITE_STRIPE_PUBLIC_KEY='"${process.env.VITE_STRIPE_PUBLIC_KEY || ''}"' --splitting --metafile`;

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

  logInfo('✅ Build completed successfully with esbuild');

} catch (error) {
  logError('❌ Build failed:', error);
  process.exit(1);
}