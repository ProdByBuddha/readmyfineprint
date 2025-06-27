#!/usr/bin/env node

import { NFTStorage, File } from 'nft.storage';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configure NFT.Storage client
console.log('🔑 API Key loaded:', process.env.NFT_STORAGE_API_KEY ? `${process.env.NFT_STORAGE_API_KEY.substring(0, 8)}...` : 'NOT FOUND');

if (!process.env.NFT_STORAGE_API_KEY) {
  console.error('❌ NFT_STORAGE_API_KEY environment variable is required');
  console.error('Get your API key from: https://nft.storage/manage/');
  process.exit(1);
}

const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

async function collectFiles(dirPath, baseDir = '') {
  const files = [];
  
  async function addFiles(currentPath, relativePath = '') {
    const items = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);
      const itemPath = relativePath ? path.join(relativePath, item.name) : item.name;
      
      if (item.isDirectory()) {
        await addFiles(fullPath, itemPath);
      } else {
        const content = await fs.readFile(fullPath);
        files.push(new File([content], itemPath));
        console.log(`📄 Added: ${itemPath}`);
      }
    }
  }
  
  await addFiles(dirPath);
  return files;
}

async function deployFrontend() {
  try {
    console.log('🚀 Starting NFT.Storage deployment...\n');
    
    // Build only the frontend (not server to avoid port conflicts)
    console.log('📦 Building frontend...');
    const { execSync } = await import('child_process');
    execSync('npm run client:build', { stdio: 'inherit' });
    
    // Collect all files from dist/public directory (client build output)
    console.log('\n📁 Collecting files...');
    const distPath = path.join(__dirname, '../dist/public');
    const files = await collectFiles(distPath);
    
    console.log(`\n📊 Found ${files.length} files to upload`);
    
    // Upload to NFT.Storage
    console.log('⬆️  Uploading to NFT.Storage...');
    const cid = await client.storeDirectory(files);
    
    // Save deployment info
    const deploymentInfo = {
      cid: cid.toString(),
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      urls: {
        nftStorage: `https://nftstorage.link/ipfs/${cid}`,
        ipfsIo: `https://ipfs.io/ipfs/${cid}`,
        subdomain: `https://${cid}.ipfs.nftstorage.link`
      }
    };
    
    await fs.writeFile(
      path.join(__dirname, '../.ipfs-deployment.json'),
      JSON.stringify(deploymentInfo, null, 2),
      'utf8'
    );
    
    // Output results
    console.log('\n✅ Deployment successful!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 IPFS CID: ${cid}`);
    console.log(`📁 Files uploaded: ${files.length}`);
    console.log('\n🌐 Access your site via:');
    console.log(`   • NFT.Storage: ${deploymentInfo.urls.nftStorage}`);
    console.log(`   • IPFS.io: ${deploymentInfo.urls.ipfsIo}`);
    console.log(`   • Subdomain: ${deploymentInfo.urls.subdomain}`);
    console.log('\n💾 Deployment info saved to .ipfs-deployment.json');
    
    return cid.toString();
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.message.includes('API key')) {
      console.error('💡 Make sure to set NFT_STORAGE_API_KEY environment variable');
      console.error('   Get your key from: https://nft.storage/manage/');
    }
    process.exit(1);
  }
}

// Check deployment status
async function checkStatus() {
  try {
    const deploymentPath = path.join(__dirname, '../.ipfs-deployment.json');
    const deployment = JSON.parse(await fs.readFile(deploymentPath, 'utf8'));
    
    console.log('📊 Latest deployment status:');
    console.log(`   CID: ${deployment.cid}`);
    console.log(`   Date: ${new Date(deployment.timestamp).toLocaleString()}`);
    console.log(`   Files: ${deployment.fileCount}`);
    console.log(`   URL: ${deployment.urls.nftStorage}`);
    
  } catch (error) {
    console.log('❌ No deployment found or error reading deployment info');
  }
}

// CLI interface
const command = process.argv[2];

if (import.meta.url === `file://${process.argv[1]}`) {
  switch (command) {
    case 'status':
      checkStatus();
      break;
    case 'deploy':
    default:
      deployFrontend();
      break;
  }
}

export { deployFrontend, checkStatus };