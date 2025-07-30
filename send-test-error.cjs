/**
 * Send a test error email immediately
 */

const path = require('path');

// Set up environment for TypeScript execution
require('ts-node').register({
  project: path.join(__dirname, 'tsconfig.json'),
  transpileOnly: true
});

async function sendTestError() {
  console.log('🧪 Sending test error email...');
  
  try {
    // Import the error reporting service
    const { errorReportingService } = require('./server/error-reporting-service.ts');
    
    // Create a critical test error that will trigger immediate email
    const testError = {
      errorId: 'test-' + Date.now(),
      timestamp: new Date(),
      errorType: 'frontend',
      severity: 'critical',
      message: '🧪 TEST ERROR: Error reporting system verification',
      stack: `Error: Test critical error for email verification
    at sendTestError (/test/send-test-error.js:25:5)
    at Object.<anonymous> (/test/send-test-error.js:45:1)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)`,
      url: 'https://readmyfineprint.com/test-error-reporting',
      userAgent: 'Mozilla/5.0 (Test Browser) ReadMyFinePrint/Test',
      ip: '127.0.0.1',
      sessionId: 'test-session-' + Date.now(),
      additionalContext: {
        testError: true,
        purpose: 'Email functionality verification',
        timestamp: new Date().toISOString(),
        requestedBy: 'Admin',
        errorReportingSystemVersion: '1.0.0'
      },
      reproductionSteps: [
        'Admin requested test error email',
        'System generated critical test error',
        'Error reporting service processed the error',
        'Email notification should be sent immediately'
      ]
    };
    
    // Report the error (this should trigger immediate email for critical errors)
    await errorReportingService.reportError(testError);
    
    console.log('✅ Test error reported successfully!');
    console.log('📧 Critical error email should be sent immediately to admin@readmyfineprint.com');
    console.log('🔍 Check your email inbox for the error report');
    console.log('');
    console.log('📋 Test Error Details:');
    console.log(`   Error ID: ${testError.errorId}`);
    console.log(`   Severity: ${testError.severity}`);
    console.log(`   Type: ${testError.errorType}`);
    console.log(`   Message: ${testError.message}`);
    console.log(`   Time: ${testError.timestamp.toISOString()}`);
    
  } catch (error) {
    console.error('❌ Failed to send test error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
sendTestError().then(() => {
  console.log('🎉 Test error email process completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});