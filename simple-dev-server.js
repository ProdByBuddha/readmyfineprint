#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Simple Development Server...');
console.log('📦 Using webpack with fixed CSS processing');

// Start webpack dev server with proper configuration
const webpack = spawn('npx', [
  'webpack', 'serve',
  '--config', 'webpack.config.js',
  '--mode', 'development',
  '--port', '5173',
  '--host', '0.0.0.0'
], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'development' }
});

webpack.on('error', (error) => {
  console.error('❌ Webpack dev server failed:', error);
  process.exit(1);
});

webpack.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Webpack dev server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle termination
process.on('SIGTERM', () => {
  console.log('🛑 Stopping webpack dev server...');
  webpack.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Stopping webpack dev server...');  
  webpack.kill('SIGINT');
});