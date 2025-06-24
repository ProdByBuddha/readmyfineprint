
#!/usr/bin/env node

import { create } from 'ipfs-http-client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure IPFS client (you can use Infura, Pinata, or local node)
const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: `Basic ${Buffer.from(
      `${process.env.INFURA_PROJECT_ID}:${process.env.INFURA_PROJECT_SECRET}`
    ).toString('base64')}`
  }
});

async function addDirectoryToIPFS(dirPath) {
  const files = [];
  
  async function addFiles(currentPath, basePath = '') {
    const items = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      const relativePath = path.join(basePath, item.name);
      
      if (item.isDirectory()) {
        await addFiles(fullPath, relativePath);
      } else {
        const content = await fs.readFile(fullPath);
        files.push({
          path: relativePath,
          content
        });
      }
    }
  }
  
  await addFiles(dirPath);
  return files;
}

async function deployToIPFS() {
  try {
    console.log('📦 Building static site...');
    
    // Build the static site
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('📌 Adding files to IPFS...');
    
    // Add the dist/public directory to IPFS
    const distPath = path.join(__dirname, '../dist/public');
    const files = await addDirectoryToIPFS(distPath);
    
    // Add all files to IPFS
    const result = await ipfs.addAll(files, { wrapWithDirectory: true });
    
    let rootHash;
    for await (const file of result) {
      if (file.path === '') {
        rootHash = file.cid.toString();
      }
      console.log(`Added: ${file.path} -> ${file.cid}`);
    }
    
    console.log(`🌐 Site deployed to IPFS!`);
    console.log(`📍 IPFS Hash: ${rootHash}`);
    console.log(`🔗 Access via: https://ipfs.io/ipfs/${rootHash}`);
    console.log(`🔗 Access via: https://gateway.pinata.cloud/ipfs/${rootHash}`);
    
    // Pin the hash (if using Pinata)
    if (process.env.PINATA_API_KEY) {
      await pinToPinata(rootHash);
    }
    
    return rootHash;
    
  } catch (error) {
    console.error('❌ IPFS deployment failed:', error);
    process.exit(1);
  }
}

async function pinToPinata(hash) {
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
      },
      body: JSON.stringify({
        hashToPin: hash,
        pinataMetadata: {
          name: 'ReadMyFinePrint Static Site',
          keyvalues: {
            environment: process.env.NODE_ENV || 'production',
            version: process.env.npm_package_version || '1.0.0'
          }
        }
      })
    });
    
    if (response.ok) {
      console.log('📌 Successfully pinned to Pinata');
    } else {
      console.warn('⚠️ Pinata pinning failed:', await response.text());
    }
  } catch (error) {
    console.warn('⚠️ Pinata pinning error:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployToIPFS();
}

export { deployToIPFS };
