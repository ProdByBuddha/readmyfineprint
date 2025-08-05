#!/usr/bin/env tsx

/**
 * Simple test for PII Correlation System
 */

console.log('🧪 Simple PII Correlation Test');

try {
  const { piiCorrelationService } = await import('./server/pii-entanglement-service');
  console.log('✅ PII Correlation Service imported successfully');
  
  // Test basic functionality
  console.log('📊 Getting analytics...');
  const analytics = await piiCorrelationService.getCorrelationAnalytics();
  console.log('✅ Analytics retrieved:', analytics);
  
  console.log('🎉 Test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}