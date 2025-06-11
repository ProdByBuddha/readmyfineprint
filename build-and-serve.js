import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Build the frontend
console.log('Building frontend...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('Frontend built successfully');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Start the server
console.log('Starting server...');
import('./start-server.js');