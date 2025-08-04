import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the source CSS file
const inputCss = fs.readFileSync(path.join(__dirname, 'client/src/index.css'), 'utf8');

// Create a basic CSS processing function without TailwindCSS
function processCSS(css) {
  // Basic CSS processing - remove comments, minify
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
    .replace(/\s*{\s*/g, '{') // Clean up braces
    .replace(/;\s*/g, ';') // Clean up semicolons
    .trim();
}

// Ensure output directory exists
const outputDir = path.join(__dirname, 'dist/public');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Process and write the CSS
const processedCSS = processCSS(inputCss);
fs.writeFileSync(path.join(outputDir, 'styles.css'), processedCSS);

console.log('✅ CSS processed successfully without TailwindCSS');
console.log(`📁 Output: ${path.join(outputDir, 'styles.css')}`);
console.log(`📊 Size: ${processedCSS.length} bytes`);