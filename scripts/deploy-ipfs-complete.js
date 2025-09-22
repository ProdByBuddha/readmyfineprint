#!/usr/bin/env node

import { deployToIPFS } from './ipfs-deploy.js';
import { createGitHubIPFSBridge } from './github-ipfs-bridge.js';

async function completeIPFSDeployment() {
  try {
    console.log('🚀 Starting complete IPFS deployment...\n');
    
    // Step 1: Create GitHub-IPFS bridge
    await createGitHubIPFSBridge();
    
    // Step 2: Deploy to IPFS
    const ipfsHash = await deployToIPFS();
    
    console.log('\n✅ Complete IPFS deployment finished!');
    console.log('\n📋 Access your decentralized site:');
    console.log(`🌐 IPFS Gateway: https://ipfs.io/ipfs/${ipfsHash}`);
    console.log(`🌐 Pinata Gateway: https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    console.log(`🌐 Cloudflare Gateway: https://cloudflare-ipfs.com/ipfs/${ipfsHash}`);
    
    console.log('\n📡 Features enabled:');
    console.log('✅ Static site hosting on IPFS');
    console.log('✅ GitHub resource fallbacks');
    console.log('✅ API proxy to your Replit deployment');
    console.log('✅ Service worker for offline capability');
    console.log('✅ Automatic resource bridging');
    
  } catch (error) {
    console.error('❌ Complete deployment failed:', error);
    process.exit(1);
  }
}

completeIPFSDeployment();
