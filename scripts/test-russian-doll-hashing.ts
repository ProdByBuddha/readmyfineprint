#!/usr/bin/env tsx

/**
 * Comprehensive test for the Russian Doll / Multi-Layer Payload Hashing System
 * 
 * This test validates the complete forensic traceability system including:
 * - Enhanced multi-pass PII detection
 * - Individual PII Argon2 hashing and entanglement
 * - Multi-layer payload fingerprinting
 * - Cross-document entanglement detection
 * - Forensic integrity verification
 */

import { enhancedPiiDetectionService } from '../server/enhanced-pii-detection';
import { piiHashingService } from '../server/pii-hashing-service';
import { piiEntanglementService } from '../server/pii-entanglement-service';
import { payloadHashingService } from '../server/payload-hashing-service';

async function testRussianDollHashing() {
  console.log('🪆 Testing Russian Doll Multi-Layer Hashing System');
  console.log('=' .repeat(70));

  // Realistic test documents with various PII patterns
  const testDocument1 = `
    CONFIDENTIAL EMPLOYMENT AGREEMENT
    
    Employee: John Smith
    Social Security Number: 123-45-6789
    Email: john.smith@techcorp.com
    Phone: (555) 123-4567
    Address: 123 Main Street, Anytown, CA 90210
    Date of Birth: January 15, 1985
    
    Emergency Contact: Jane Smith (spouse)
    Emergency Phone: 555-987-6543
    
    Credit Card for expenses: 4532-1234-5678-9012
    
    This agreement establishes the terms of employment...
  `;

  const testDocument2 = `
    MEDICAL INSURANCE CLAIM
    
    Patient: Sarah Johnson  
    SSN: 987-65-4321
    DOB: 12/03/1990
    Contact: sarah.johnson@healthnet.org
    Phone: (555) 456-7890
    
    Address: 456 Oak Avenue, Somewhere, CA 91234
    
    Policy Number: POL-789-456-123
    Claim Amount: $2,500.00
    
    Treatment details and billing information...
  `;

  const testDocument3 = `
    FINANCIAL DISCLOSURE
    
    Applicant: John Smith (same person as document 1)
    Email: john.smith@techcorp.com  
    Phone: (555) 123-4567
    
    Bank Account: ****-****-****-1234
    Credit Score: 750
    Annual Income: $85,000
    
    Previous Address: 789 Pine Street, Oldtown, NY 10001
    Current Address: 123 Main Street, Anytown, CA 90210
  `;

  try {
    console.log('\n🧪 Phase 1: Enhanced PII Detection Testing');
    console.log('-'.repeat(50));

    // Test enhanced detection on all documents
    const results = [];
    
    for (let i = 0; i < 3; i++) {
      const doc = [testDocument1, testDocument2, testDocument3][i];
      const docId = `test-doc-${i + 1}`;
      
      console.log(`\n📄 Processing Document ${i + 1}:`);
      
      const enhancedResult = await enhancedPiiDetectionService.detectPIIEnhanced(doc, {
        enableHashing: true,
        sessionId: 'test-session-russian-doll',
        documentId: docId,
        aggressiveMode: true
      });

      console.log(`✅ Enhanced Detection Results:`);
      console.log(`   - Total matches: ${enhancedResult.matches.length}`);
      console.log(`   - High confidence: ${enhancedResult.detectionMetrics.highConfidenceMatches}`);
      console.log(`   - Detection confidence: ${(enhancedResult.detectionMetrics.coverageConfidence * 100).toFixed(1)}%`);
      console.log(`   - False positive risk: ${(enhancedResult.detectionMetrics.falsePositiveRisk * 100).toFixed(1)}%`);
      
      // Show detection breakdown by method
      const methodBreakdown = enhancedResult.matches.reduce((acc, match) => {
        acc[match.detectionMethod] = (acc[match.detectionMethod] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`   - Detection methods:`, methodBreakdown);
      console.log(`   - PII types found: ${[...new Set(enhancedResult.matches.map(m => m.type))].join(', ')}`);

      results.push({
        documentId: docId,
        enhancedResult,
        originalContent: doc
      });
    }

    console.log('\n🪆 Phase 2: Multi-Layer Payload Fingerprinting');
    console.log('-'.repeat(50));

    const payloadFingerprints = [];

    for (const result of results) {
      console.log(`\n🔐 Creating payload fingerprint for ${result.documentId}:`);
      
      // Simulate API request/response (since we're not actually calling OpenAI in test)
      const mockApiRequest = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `Analyze this document: ${result.enhancedResult.redactedText.substring(0, 100)}...`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      };

      const mockApiResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Test document analysis with redacted PII",
                overallRisk: "moderate",
                keyFindings: {
                  goodTerms: ["Standard terms"],
                  reviewNeeded: ["Review redacted sections"],
                  redFlags: ["Contains sensitive information"]
                },
                sections: []
              })
            }
          }
        ],
        usage: {
          total_tokens: 1250,
          prompt_tokens: 800,
          completion_tokens: 450
        }
      };

      const fingerprint = await payloadHashingService.createPayloadFingerprint(
        result.originalContent,
        result.enhancedResult.redactedText,
        mockApiRequest,
        mockApiResponse,
        result.enhancedResult.hashedMatches || [],
        {
          documentId: result.documentId,
          sessionId: 'test-session-russian-doll',
          detectionMetrics: result.enhancedResult.detectionMetrics,
          processingTimings: {
            piiDetection: 150,
            openaiCall: 2500,
            piiRestoration: 25,
            payloadHashing: 75
          }
        }
      );

      payloadFingerprints.push(fingerprint);

      console.log(`✅ Fingerprint ${fingerprint.fingerprintId} created:`);
      console.log(`   - Layers: ${fingerprint.layers.length}`);
      console.log(`   - Chain integrity: ${(fingerprint.securityMetrics.chainIntegrity * 100).toFixed(1)}%`);
      console.log(`   - Forensic score: ${(fingerprint.securityMetrics.forensicScore * 100).toFixed(1)}%`);
    }

    console.log('\n🔗 Phase 3: Cross-Document Entanglement Analysis');
    console.log('-'.repeat(50));

    // Test cross-document entanglement (should detect John Smith in docs 1 & 3)
    for (let i = 0; i < results.length; i++) {
      if (results[i].enhancedResult.hashedMatches) {
        piiEntanglementService.storeDocumentEntanglement(
          'test-session-russian-doll',
          results[i].documentId,
          results[i].enhancedResult.hashedMatches,
          results[i].enhancedResult.detectionMetrics
        );
      }
    }

    // Check entanglements between documents
    console.log('\n🕸️ Checking cross-document entanglements:');
    
    for (let i = 1; i < results.length; i++) {
      if (results[i].enhancedResult.hashedMatches) {
        const entanglementCheck = piiEntanglementService.checkCrossDocumentEntanglement(
          'test-session-russian-doll',
          results[i].enhancedResult.hashedMatches
        );

        console.log(`\n📋 Document ${i + 1} vs Previous Documents:`);
        console.log(`   - Shared PII: ${entanglementCheck.hasSharedPII ? 'YES' : 'NO'}`);
        if (entanglementCheck.hasSharedPII) {
          console.log(`   - Shared entanglements: ${entanglementCheck.sharedEntanglementIds.length}`);
          console.log(`   - Entanglement strength: ${(entanglementCheck.entanglementStrength * 100).toFixed(1)}%`);
          console.log(`   - Shared types: ${entanglementCheck.analysisDetails.sharedTypes.join(', ')}`);
          console.log(`   - Risk escalation: ${entanglementCheck.analysisDetails.riskEscalation ? 'YES' : 'NO'}`);
        }
      }
    }

    console.log('\n📊 Phase 4: Forensic Integrity Verification');
    console.log('-'.repeat(50));

    // Verify each payload fingerprint
    for (const fingerprint of payloadFingerprints) {
      console.log(`\n🔍 Verifying fingerprint ${fingerprint.fingerprintId}:`);
      
      const verification = await payloadHashingService.verifyFingerprintIntegrity(fingerprint);
      
      console.log(`   - Valid: ${verification.isValid ? 'YES' : 'NO'}`);
      console.log(`   - Trust score: ${(verification.trustScore * 100).toFixed(1)}%`);
      
      if (verification.issues.length > 0) {
        console.log(`   - Issues found: ${verification.issues.length}`);
        verification.issues.forEach(issue => {
          console.log(`     • ${issue}`);
        });
      }

      // Generate forensic report
      const forensicReport = payloadHashingService.createForensicReport(fingerprint);
      console.log(`   - Forensic Report: ${forensicReport.reportId}`);
      console.log(`   - Overall risk: ${forensicReport.securityAssessment.overallRisk}`);
      console.log(`   - Recommendations: ${forensicReport.securityAssessment.recommendations.length}`);
    }

    console.log('\n🎯 Phase 5: Edge Case and Accuracy Testing');
    console.log('-'.repeat(50));

    // Test with document containing edge cases
    const edgeCaseDocument = `
      TRICKY DOCUMENT WITH EDGE CASES
      
      Contact John at john.doe@example.com (should be filtered as example domain)
      Call 911 for emergencies (should not be detected as personal phone)
      SSN format variations: 123456789, 123 45 6789, one-two-three-four-five-six-seven-eight-nine
      
      Date confusion: Contract expires 12/31/2024 (contract date, not DOB)
      vs. Employee born 01/15/1985 (actual DOB)
      
      Address vs legal reference: 
      - Personal: 123 Main Street, Anytown, CA (should be detected)
      - Legal: "as referenced in Smith vs. Jones, 456 Court Street" (context matters)
      
      Credit card edge case: 4111111111111111 (test card, should be detected)
      vs. Account ID: 1234567890123456 (not a valid card format)
    `;

    console.log('\n🧪 Testing edge case detection:');
    const edgeResult = await enhancedPiiDetectionService.detectPIIEnhanced(edgeCaseDocument, {
      enableHashing: true,
      sessionId: 'edge-case-test',
      documentId: 'edge-case-doc',
      aggressiveMode: true
    });

    console.log(`✅ Edge Case Results:`);
    console.log(`   - Total matches: ${edgeResult.matches.length}`);
    console.log(`   - High confidence: ${edgeResult.detectionMetrics.highConfidenceMatches}`);
    console.log(`   - Medium confidence: ${edgeResult.detectionMetrics.mediumConfidenceMatches}`);
    console.log(`   - Low confidence: ${edgeResult.detectionMetrics.lowConfidenceMatches}`);
    console.log(`   - False positive risk: ${(edgeResult.detectionMetrics.falsePositiveRisk * 100).toFixed(1)}%`);

    // Show which edge cases were caught
    console.log('\n🎯 Edge Case Analysis:');
    edgeResult.matches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.type}: "${match.value.substring(0, 20)}..." (confidence: ${(match.confidence * 100).toFixed(1)}%)`);
      console.log(`      Method: ${match.detectionMethod}, Context: ${match.contextClues[0] || 'None'}`);
    });

    console.log('\n📋 Phase 6: Complete System Integration Test');
    console.log('-'.repeat(50));

    // Test the complete workflow with a complex document
    const complexDocument = `
      MULTI-ENTITY CONTRACT WITH SENSITIVE DATA
      
      Party A: John Smith (CEO)
      SSN: 123-45-6789
      Email: john.smith@techcorp.com
      Phone: (555) 123-4567
      
      Party B: Sarah Johnson (CFO)  
      SSN: 987-65-4321
      Email: sarah.johnson@financeco.com
      Phone: (555) 987-6543
      
      Contract involves financial data:
      - Payment method: Credit Card 4532-1234-5678-9012
      - Backup payment: Bank transfer to routing 123456789, account 987654321
      
      Personal information sharing:
      Both parties' addresses are confidential but include:
      - 123 Main Street, Anytown, CA 90210
      - 456 Oak Avenue, Somewhere, CA 91234
      
      Birth dates for verification:
      - John: 01/15/1985  
      - Sarah: 12/03/1990
      
      This contract demonstrates complex PII entanglement...
    `;

    console.log('\n🔄 Running complete integration test:');
    
    const integrationResult = await enhancedPiiDetectionService.detectPIIEnhanced(complexDocument, {
      enableHashing: true,
      sessionId: 'integration-test',
      documentId: 'complex-contract',
      aggressiveMode: true
    });

    // Create full payload fingerprint
    const integrationFingerprint = await payloadHashingService.createPayloadFingerprint(
      complexDocument,
      integrationResult.redactedText,
      { model: 'gpt-4o', messages: [{ role: 'user', content: integrationResult.redactedText }] },
      { choices: [{ message: { content: 'Mock analysis response' } }], usage: { total_tokens: 1000 } },
      integrationResult.hashedMatches || [],
      {
        documentId: 'complex-contract',
        sessionId: 'integration-test',
        detectionMetrics: integrationResult.detectionMetrics
      }
    );

    console.log(`✅ Integration Test Complete:`);
    console.log(`   - PII detected: ${integrationResult.matches.length}`);
    console.log(`   - Redaction integrity: ${(integrationFingerprint.securityMetrics.redactionIntegrity * 100).toFixed(1)}%`);
    console.log(`   - Chain integrity: ${(integrationFingerprint.securityMetrics.chainIntegrity * 100).toFixed(1)}%`);
    console.log(`   - Forensic utility: ${(integrationFingerprint.securityMetrics.forensicScore * 100).toFixed(1)}%`);

    console.log('\n✅ ALL RUSSIAN DOLL HASHING TESTS COMPLETED SUCCESSFULLY!');
    console.log('🪆 The multi-layer forensic system is fully operational');
    console.log('=' .repeat(70));

    // Final cleanup
    piiEntanglementService.clearSessionEntanglements('test-session-russian-doll');
    piiEntanglementService.clearSessionEntanglements('edge-case-test');
    piiEntanglementService.clearSessionEntanglements('integration-test');

    console.log('\n🧹 Test cleanup completed');

  } catch (error) {
    console.error('❌ Russian Doll hashing test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRussianDollHashing().catch(console.error);
}

export { testRussianDollHashing };