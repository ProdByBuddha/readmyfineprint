#!/usr/bin/env tsx

/**
 * Simple PII Correlation Test
 * Tests the PostgreSQL-based PII correlation system
 */

import { piiDetectionService } from '../server/pii-detection';
import { piiCorrelationService } from '../server/pii-entanglement-service';

async function testPIICorrelation() {
  console.log('🧪 Testing PII Correlation System with PostgreSQL');
  console.log('=' .repeat(60));

  try {
    // Test 1: Basic System Check
    console.log('\n📋 Test 1: System Health Check');
    console.log('-'.repeat(40));
    
    const analytics = await piiCorrelationService.getCorrelationAnalytics();
    console.log('✅ Database connection successful');
    console.log(`📊 Current system stats: ${analytics.totalSessions} sessions, ${analytics.totalDocuments} documents`);

    // Test 2: PII Detection and Hashing
    console.log('\n📋 Test 2: PII Detection and Hashing');
    console.log('-'.repeat(40));
    
    const testDocument = `
      John Smith works at Example Corp.
      Email: john.smith@example.com
      Phone: (555) 123-4567
    `;

    const result = await piiDetectionService.detectPIIWithHashing(testDocument, {
      enableHashing: true,
      sessionId: 'test-session-1',
      documentId: 'document-1'
    });

    console.log(`✅ Found ${result.matches.length} PII matches`);
    console.log(`🔐 Created ${result.hashedMatches.length} hashed correlations`);

    // Test 3: Store Document Correlation
    console.log('\n📋 Test 3: Store Document Correlation');
    console.log('-'.repeat(40));
    
    await piiCorrelationService.storeDocumentCorrelation(
      'test-session-1',
      'document-1',
      result.hashedMatches
    );
    console.log('✅ Document correlation stored successfully');

    // Test 4: Cross-Document Correlation
    console.log('\n📋 Test 4: Cross-Document Correlation');
    console.log('-'.repeat(40));
    
    const testDocument2 = `
      Jane Doe contacted John Smith at john.smith@example.com
      Meeting scheduled for next week.
    `;

    const result2 = await piiDetectionService.detectPIIWithHashing(testDocument2, {
      enableHashing: true,
      sessionId: 'test-session-1',
      documentId: 'document-2'
    });

    const correlation = await piiCorrelationService.checkCrossDocumentCorrelation(
      'test-session-1',
      result2.hashedMatches
    );

    console.log(`✅ Cross-document analysis completed`);
    console.log(`🔗 Shared PII detected: ${correlation.hasSharedPII ? 'YES' : 'NO'}`);
    if (correlation.hasSharedPII) {
      console.log(`   - Shared correlations: ${correlation.sharedCorrelationIds.length}`);
      console.log(`   - Correlation strength: ${(correlation.correlationStrength * 100).toFixed(1)}%`);
    }

    // Test 5: Final Analytics
    console.log('\n📋 Test 5: Final System Analytics');
    console.log('-'.repeat(40));
    
    const finalAnalytics = await piiCorrelationService.getCorrelationAnalytics();
    console.log('📊 Final system stats:');
    console.log(`   - Sessions: ${finalAnalytics.totalSessions}`);
    console.log(`   - Documents: ${finalAnalytics.totalDocuments}`);
    console.log(`   - Risk distribution:`, finalAnalytics.riskDistribution);

    // Cleanup
    console.log('\n🧹 Cleanup');
    console.log('-'.repeat(40));
    await piiCorrelationService.clearSessionCorrelations('test-session-1');
    console.log('✅ Test session cleaned up');

    console.log('\n🎉 All PII correlation tests completed successfully!');
    console.log('✅ PostgreSQL backend is working properly');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPIICorrelation().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export { testPIICorrelation };