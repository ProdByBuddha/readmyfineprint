#!/usr/bin/env node

/**
 * Manual IndexNow submission script
 * Usage: node scripts/submit-to-indexnow.js [url1] [url2] ...
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://readmyfineprint.com' 
  : 'http://localhost:5000';

async function submitUrls(urls = []) {
  try {
    console.log('🔄 Submitting URLs to IndexNow...');
    
    const response = await fetch(`${BASE_URL}/api/indexnow/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls: urls.length > 0 ? urls : undefined })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅', result.message);
    } else {
      console.error('❌ Submission failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function getStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/indexnow/status`);
    if (response.ok) {
      const status = await response.json();
      console.log('📊 IndexNow Status:');
      console.log(`   Key Location: ${status.keyLocation}`);
      console.log(`   Supported Engines: ${status.supportedEngines}`);
      console.log(`   Monitored URLs: ${status.monitoredUrls}`);
      console.log(`   Last Submission: ${status.lastSubmission}`);
    } else {
      console.error('Failed to get status:', response.status);
    }
  } catch (error) {
    console.error('Error getting status:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'all') {
  console.log('📡 Submitting all URLs to search engines...');
  submitUrls();
} else if (args[0] === 'status') {
  getStatus();
} else if (args[0] === 'help') {
  console.log(`
🚀 IndexNow Submission Tool

Usage:
  node scripts/submit-to-indexnow.js [command|urls...]

Commands:
  all                    Submit all site URLs (default)
  status                 Show IndexNow service status
  help                   Show this help message

Examples:
  node scripts/submit-to-indexnow.js
  node scripts/submit-to-indexnow.js all
  node scripts/submit-to-indexnow.js status
  node scripts/submit-to-indexnow.js https://readmyfineprint.com/privacy
  node scripts/submit-to-indexnow.js https://readmyfineprint.com/donate https://readmyfineprint.com/roadmap
`);
} else {
  console.log(`📡 Submitting ${args.length} specific URLs...`);
  submitUrls(args);
}
