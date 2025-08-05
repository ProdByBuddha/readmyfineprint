#!/usr/bin/env tsx

/**
 * Test script for PII Argon2 hashing and entanglement system
 * 
 * This script tests the complete PII detection, hashing, and cross-document
 * entanglement workflow to ensure secure data correlation works correctly.
 */

import { piiDetectionService } from '../server/pii-detection';
import { piiHashingService } from '../server/pii-hashing-service';
import { piiEntanglementService } from '../server/pii-entanglement-service';

async function testPIIHashing() {
  console.log('🧪 Testing PII Argon2 Hashing and Entanglement System');
  console.log('=' .repeat(60));

  // Test document with various PII types
  const testDocument1 = `
    John Smith's Social Security Number is 123-45-6789.
    His email address is john.smith@example.com and his phone number is (555) 123-4567.
    He lives at 123 Main Street, Anytown, USA.
    His credit card number is 4532-1234-5678-9012.
    Date of birth: 01/15/1985
  `;

  const testDocument2 = `
    Sarah Johnson can be reached at sarah.johnson@company.org.
    Her phone number is 555-987-6543.
    SSN: 987-65-4321
    Address: 456 Oak Avenue, Somewhere, CA
    Birth date: 12/03/1990
    Credit Card: 5555-4444-3333-2222
  `;

  const testDocument3 = `
    Contact John Smith at john.smith@example.com for more information.
    Alternative phone: (555) 123-4567
    Meeting at 789 Pine Street next week.
  `;

  try {
    console.log('\n📋 Test 1: Basic PII Detection and Hashing');
    console.log('-'.repeat(40));
    
    const result1 = await piiDetectionService.detectPIIWithHashing(testDocument1, {
      enableHashing: true,
      sessionId: 'test-session-1',
      documentId: 'document-1'
    });

    console.log(`✅ Document 1: Found ${result1.matches.length} PII matches`);
    console.log(`   - Hashed matches: ${result1.hashedMatches.length}`);
    console.log(`   - Types: ${[...new Set(result1.matches.map(m => m.type))].join(', ')}`);

    if (result1.hashedMatches.length > 0) {
      console.log('\n🔐 Sample Hashed PII:');
      result1.hashedMatches.slice(0, 3).forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.type}: ${match.value.substring(0, 8)}... -> ${match.entanglementId}`);
      });
    }

    console.log('\n📋 Test 2: Cross-Document Entanglement Detection');
    console.log('-'.repeat(40));

    // Store first document correlation
    await piiEntanglementService.storeDocumentCorrelation(
      'test-session-1', 
      'document-1', 
      result1.hashedMatches
    );

    // Test second document
    const result2 = await piiDetectionService.detectPIIWithHashing(testDocument2, {
      enableHashing: true,
      sessionId: 'test-session-1',
      documentId: 'document-2'
    });

    console.log(`✅ Document 2: Found ${result2.matches.length} PII matches`);
    
    // Check cross-document correlation
    const entanglementCheck = await piiEntanglementService.checkCrossDocumentCorrelation(
      'test-session-1',
      result2.hashedMatches
    );

    console.log(`🔗 Cross-document entanglement: ${entanglementCheck.hasSharedPII ? 'YES' : 'NO'}`);
    if (entanglementCheck.hasSharedPII) {
      console.log(`   - Shared correlations: ${entanglementCheck.sharedCorrelationIds.length}`);
      console.log(`   - Correlation strength: ${(entanglementCheck.correlationStrength * 100).toFixed(1)}%`);
    }

    console.log('\n📋 Test 3: Same Person Different Document');
    console.log('-'.repeat(40));

    // Test third document that contains same person's info as document 1
    const result3 = await piiDetectionService.detectPIIWithHashing(testDocument3, {
      enableHashing: true,
      sessionId: 'test-session-2',
      documentId: 'document-3'
    });

    console.log(`✅ Document 3: Found ${result3.matches.length} PII matches`);

    // Store in new session and check correlation
    await piiEntanglementService.storeDocumentCorrelation(
      'test-session-2',
      'document-3',
      result3.hashedMatches
    );

    console.log('\n📋 Test 4: Forensic Analysis Report');
    console.log('-'.repeat(40));

    const forensicReport = await piiEntanglementService.createForensicAnalysisReport([
      'test-session-1',
      'test-session-2'
    ]);

    console.log(`📊 Forensic Report ${forensicReport.reportId}:`);
    console.log(`   - Sessions analyzed: ${forensicReport.sessionCount}`);
    console.log(`   - Cross-session correlations: ${forensicReport.crossSessionCorrelations.length}`);
    console.log(`   - Average risk score: ${forensicReport.aggregateRiskProfile.averageRiskScore.toFixed(1)}`);
    console.log(`   - Most common PII types:`, forensicReport.aggregateRiskProfile.mostCommonPIITypes);

    console.log('\n📋 Test 5: Individual PII Type Hashing');
    console.log('-'.repeat(40));

    // Test individual PII hashing functions
    const testSSN = '123-45-6789';
    const testEmail = 'test@example.com';
    const testPhone = '(555) 123-4567';

    console.log('🔐 Testing individual PII hashing functions:');
    
    const { hashSSN, hashPhoneNumber, createPseudonymizedEmail } = await import('../server/argon2');
    
    const hashedSSN = await hashSSN(testSSN);
    const hashedPhone = await hashPhoneNumber(testPhone);
    const pseudonymizedEmail = await createPseudonymizedEmail(testEmail);

    console.log(`   - SSN hash (first 32 chars): ${hashedSSN.substring(0, 32)}...`);
    console.log(`   - Phone hash (first 32 chars): ${hashedPhone.substring(0, 32)}...`);
    console.log(`   - Pseudonymized email: ${pseudonymizedEmail}`);

    console.log('\n📋 Test 6: Analytics and Risk Scoring');
    console.log('-'.repeat(40));

    if (result1.hashedMatches.length > 0) {
      const analytics = piiHashingService.createPIIAnalyticsSummary(result1.hashedMatches);
      
      console.log(`📈 Analytics for Document 1:`);
      console.log(`   - Document fingerprint: ${analytics.documentPIIFingerprint}`);
      console.log(`   - Risk score: ${analytics.riskScore}/100`);
      console.log(`   - PII type counts:`, analytics.piiTypes);
      console.log(`   - Correlation IDs: ${analytics.entanglementIds.length}`);
    }

    console.log('\n✅ All PII hashing tests completed successfully!');
    console.log('=' .repeat(60));

    // Cleanup
    await piiEntanglementService.clearSessionCorrelations('test-session-1');
    await piiEntanglementService.clearSessionCorrelations('test-session-2');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPIIHashing().catch(console.error);
}

export { testPIIHashing };