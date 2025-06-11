#!/usr/bin/env node

// Direct startup script that bypasses package.json script issues
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Starting Express Checkout donation server...');

// Start the server with proper environment
const server = spawn('node', ['start-server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: process.env.PORT || '5000'
  }
});

server.on('error', (error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Terminating server...');
  server.kill('SIGTERM');
});