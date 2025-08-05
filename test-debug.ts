#!/usr/bin/env tsx

/**
 * Debug test for PII System
 */

console.log('🔍 Debug PII System');

try {
  console.log('1. Importing piiDetectionService...');
  const { piiDetectionService } = await import('./server/pii-detection');
  console.log('✅ piiDetectionService imported');
  
  console.log('2. Importing piiHashingService...');
  const { piiHashingService } = await import('./server/pii-hashing-service');
  console.log('✅ piiHashingService imported');
  
  console.log('3. Importing piiCorrelationService...');
  const { piiCorrelationService } = await import('./server/pii-entanglement-service');
  console.log('✅ piiCorrelationService imported');
  
  console.log('4. Testing basic PII detection...');
  const testText = "John Smith's email is john@example.com";
  const result = piiDetectionService.detectPII(testText);
  console.log('✅ Basic PII detection works:', result.matches.length, 'matches');
  
  console.log('5. Testing PII detection with hashing...');
  const resultWithHashing = await piiDetectionService.detectPIIWithHashing(testText, {
    enableHashing: true,
    sessionId: 'test-session',
    documentId: 'test-doc'
  });
  console.log('✅ PII detection with hashing works:', resultWithHashing.hashedMatches.length, 'hashed matches');
  
  console.log('🎉 All imports and basic functionality work!');
  
} catch (error) {
  console.error('❌ Debug test failed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}