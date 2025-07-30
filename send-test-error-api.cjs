/**
 * Send a test error email by making an API call to the running server
 */

const http = require('http');

async function sendTestErrorViaAPI() {
  console.log('🧪 Sending test error via API...');
  
  const testErrorData = {
    errorType: 'frontend',
    severity: 'critical',
    message: '🧪 TEST ERROR: Error reporting system verification via API',
    stack: `Error: Test critical error for email verification
    at sendTestErrorViaAPI (/test/send-test-error-api.cjs:15:5)
    at Object.<anonymous> (/test/send-test-error-api.cjs:35:1)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)`,
    url: 'https://readmyfineprint.com/test-error-reporting',
    userId: 'test-user-123',
    userEmail: 'test@example.com',
    additionalContext: {
      testError: true,
      purpose: 'Email functionality verification via API',
      timestamp: new Date().toISOString(),
      requestedBy: 'Admin',
      errorReportingSystemVersion: '1.0.0'
    },
    reproductionSteps: [
      'Admin requested test error email',
      'System generated critical test error via API',
      'Error reporting service should process the error',
      'Email notification should be sent immediately'
    ]
  };

  const postData = JSON.stringify(testErrorData);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/errors/report',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`📡 API Response Status: ${res.statusCode}`);
        console.log(`📋 API Response: ${responseData}`);
        
        if (res.statusCode === 200) {
          console.log('✅ Test error reported successfully via API!');
          console.log('📧 Critical error email should be sent immediately to admin@readmyfineprint.com');
          console.log('🔍 Check your email inbox for the error report');
          resolve(responseData);
        } else {
          console.error('❌ API call failed');
          reject(new Error(`API call failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      if (error.code === 'ECONNREFUSED') {
        console.log('💡 Make sure the server is running on port 3000');
        console.log('   Try: npm run dev');
      }
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

sendTestErrorViaAPI()
  .then(() => {
    console.log('🎉 Test error email API call completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });