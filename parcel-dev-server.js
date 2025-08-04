#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting Parcel Development Server...');
console.log('📦 Building React app with Parcel zero-config bundler');

// Start Parcel dev server
const parcel = spawn('npx', [
  'parcel', 
  'client/index.html',
  '--port', '5173',
  '--host', '0.0.0.0',
  '--dist-dir', 'dist/public',
  '--no-cache'
], {
  stdio: 'inherit',
  cwd: process.cwd()
});

parcel.on('error', (error) => {
  console.error('❌ Parcel dev server failed:', error);
  process.exit(1);
});

parcel.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Parcel dev server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle termination
process.on('SIGTERM', () => {
  console.log('🛑 Stopping Parcel dev server...');
  parcel.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Stopping Parcel dev server...');
  parcel.kill('SIGINT');
});