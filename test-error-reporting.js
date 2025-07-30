/**
 * Test script to verify error reporting email functionality
 */

const { errorReportingService } = require('./server/error-reporting-service.ts');

async function testErrorReporting() {
  console.log('🧪 Testing error reporting system...');
  
  try {
    // Test reporting a critical error
    await errorReportingService.reportError({
      errorType: 'frontend',
      severity: 'critical',
      message: 'Test critical error for email verification',
      stack: 'Error: Test critical error\n    at testErrorReporting (/test/test.js:10:5)',
      url: 'https://readmyfineprint.com/test',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ip: '127.0.0.1',
      sessionId: 'test-session-123',
      additionalContext: {
        testError: true,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Critical error reported successfully');
    
    // Test reporting a medium severity error
    await errorReportingService.reportError({
      errorType: 'api',
      severity: 'medium',
      message: 'Test API error for batch reporting',
      url: 'https://readmyfineprint.com/api/test',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ip: '127.0.0.1',
      additionalContext: {
        testError: true,
        endpoint: '/api/test',
        method: 'POST'
      }
    });
    
    console.log('✅ Medium severity error reported successfully');
    console.log('📧 Check your email for critical error alert');
    console.log('⏰ Periodic report will be sent in 15 minutes');
    
  } catch (error) {
    console.error('❌ Error reporting test failed:', error);
  }
}

// Run the test
testErrorReporting();