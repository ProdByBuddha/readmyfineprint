
#!/usr/bin/env node

import { NFTStorage, File } from 'nft.storage';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure NFT.Storage client
if (!process.env.NFT_STORAGE_API_KEY) {
  console.error('❌ NFT_STORAGE_API_KEY environment variable is required');
  process.exit(1);
}

const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY });

async function addDirectoryToNFTStorage(dirPath) {
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
        // Create File objects for NFT.Storage
        files.push(new File([content], relativePath));
      }
    }
  }
  
  await addFiles(dirPath);
  return files;
}

async function deployToNFTStorage() {
  try {
    console.log('📦 Building static site...');
    
    // Build the static site
    const { execSync } = await import('child_process');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('📌 Uploading files to NFT.Storage...');
    
    // Add the dist directory to NFT.Storage
    const distPath = path.join(__dirname, '../dist');
    const files = await addDirectoryToNFTStorage(distPath);
    
    console.log(`📁 Found ${files.length} files to upload`);
    
    // Upload all files to NFT.Storage
    const cid = await client.storeDirectory(files);
    
    console.log(`🌐 Site deployed to IPFS via NFT.Storage!`);
    console.log(`📍 IPFS CID: ${cid}`);
    console.log(`🔗 Access via: https://nftstorage.link/ipfs/${cid}`);
    console.log(`🔗 Access via: https://ipfs.io/ipfs/${cid}`);
    console.log(`🔗 Access via: https://${cid}.ipfs.nftstorage.link`);
    
    // Save CID to file for later use
    await fs.writeFile(
      path.join(__dirname, '../.ipfs-cid'),
      cid,
      'utf8'
    );
    
    console.log(`💾 CID saved to .ipfs-cid file`);
    
    return cid;
    
  } catch (error) {
    console.error('❌ NFT.Storage deployment failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployToNFTStorage();
}

export { deployToNFTStorage };
