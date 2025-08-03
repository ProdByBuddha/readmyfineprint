
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Process CSS with Tailwind
try {
  console.log('🎨 Processing CSS with Tailwind...');
  
  // Run Tailwind CSS build
  execSync(`npx tailwindcss -i ./client/src/index.css -o ./dist/public/styles.css --minify`, {
    stdio: 'inherit'
  });
  
  console.log('✅ CSS processing completed');
} catch (error) {
  console.error('❌ CSS processing failed:', error);
  process.exit(1);
}
