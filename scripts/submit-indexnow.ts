

import { indexNowService } from '../server/indexnow-service.js';

async function submitToIndexNow() {
  console.log('🚀 ReadMyFinePrint IndexNow Submission Tool\n');
  
  try {
    // Get stats first
    const stats = indexNowService.getSubmissionStats();
    console.log('📊 Configuration:');
    console.log(`   Host: ${stats.baseHost}`);
    console.log(`   Verification Key: ${stats.verificationKey}`);
    console.log(`   Public URLs: ${stats.totalPublicUrls}`);
    console.log(`   Supported Engines: ${stats.supportedEngines.join(', ')}`);
    console.log(`   Key File: ${stats.keyFileLocation}\n`);

    // Submit all URLs
    console.log('🔄 Starting submission...\n');
    const results = await indexNowService.submitAllUrls();
    
    console.log('\n📋 Detailed Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const details = result.success 
        ? `${result.submittedUrls} URLs submitted` 
        : result.error;
      
      console.log(`   ${status} ${result.searchEngine}: ${details}`);
    });

    const successCount = results.filter(r => r.success).length;
    const totalEngines = results.length;
    
    console.log(`\n🎉 Summary: Successfully notified ${successCount}/${totalEngines} search engines`);
    
    if (successCount === 0) {
      console.log('⚠️  No search engines were successfully notified. Check your network connection and verification key.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ IndexNow submission failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`
🚀 ReadMyFinePrint IndexNow Submission Tool

Usage:
  npm run indexnow:submit          Submit all public URLs
  npm run indexnow:submit help     Show this help message

This tool submits all your public URLs to supported search engines:
- Bing (api.indexnow.org)
- Yandex
- Naver
- Seznam

Your URLs will be submitted automatically to notify search engines
of new or updated content for faster indexing.
`);
  process.exit(0);
}

// Run the submission
submitToIndexNow();

