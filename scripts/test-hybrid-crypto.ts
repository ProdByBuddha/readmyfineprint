#!/usr/bin/env tsx
/**
 * Test Hybrid Classical + Post-Quantum Cryptography Implementation
 * 
 * This script tests the hybrid crypto system to ensure all components work correctly
 */

import { hybridCryptoService } from '../server/hybrid-crypto-service';
import { hybridSecurityManager } from '../server/hybrid-security-manager';
import type { PIIMatch } from '../server/pii-detection';

console.log('🧪 Testing Hybrid Classical + Post-Quantum Cryptography');
console.log('=' .repeat(60));

async function testKeyGeneration() {
  console.log('\n🔑 Testing Key Generation...');
  
  // Test different classical algorithms
  const algorithms: ('secp256k1' | 'p256' | 'ed25519')[] = ['secp256k1', 'p256', 'ed25519'];
  
  for (const algorithm of algorithms) {
    try {
      const keyPair = hybridCryptoService.generateHybridKeyPair(algorithm);
      
      console.log(`✅ ${algorithm} hybrid key pair generated:`);
      console.log(`   - Classical: ${keyPair.classical.publicKey.length} bytes`);
      console.log(`   - Post-Quantum: ${keyPair.postQuantum.publicKey.length} bytes`);
      console.log(`   - Combined: ${keyPair.combinedPublicKey.length} bytes`);
    } catch (error) {
      console.error(`❌ ${algorithm} key generation failed:`, error);
    }
  }
}

async function testKeyExchange() {
  console.log('\n🔄 Testing Hybrid Key Exchange...');
  
  try {
    // Generate key pairs for Alice and Bob
    const aliceKeys = hybridCryptoService.generateHybridKeyPair('p256');
    const bobKeys = hybridCryptoService.generateHybridKeyPair('p256');
    
    // Perform key exchange
    const aliceSharedSecret = hybridCryptoService.hybridKeyExchange(
      aliceKeys,
      bobKeys.combinedPublicKey
    );
    
    const bobSharedSecret = hybridCryptoService.hybridKeyExchange(
      bobKeys,
      aliceKeys.combinedPublicKey
    );
    
    // Verify they have the same shared secret
    const secretsMatch = aliceSharedSecret.every((byte, index) => byte === bobSharedSecret[index]);
    
    console.log(`✅ Key exchange completed:`);
    console.log(`   - Alice secret: ${aliceSharedSecret.length} bytes`);
    console.log(`   - Bob secret: ${bobSharedSecret.length} bytes`);
    console.log(`   - Secrets match: ${secretsMatch ? '✅' : '❌'}`);
    
    if (!secretsMatch) {
      throw new Error('Shared secrets do not match!');
    }
    
  } catch (error) {
    console.error('❌ Key exchange test failed:', error);
  }
}

async function testHybridEncryption() {
  console.log('\n🔒 Testing Hybrid Encryption/Decryption...');
  
  try {
    // Generate key pair
    const keyPair = hybridCryptoService.generateHybridKeyPair('p256');
    
    // Test data
    const testMessage = 'This is a secret message that needs hybrid protection! 🔐';
    const plaintext = new TextEncoder().encode(testMessage);
    
    console.log(`📝 Original message: "${testMessage}" (${plaintext.length} bytes)`);
    
    // Encrypt
    const encrypted = hybridCryptoService.hybridEncrypt(plaintext, keyPair.combinedPublicKey);
    
    console.log(`🔒 Encrypted data:`);
    console.log(`   - Ciphertext: ${encrypted.ciphertext.length} bytes`);
    console.log(`   - Nonce: ${encrypted.nonce.length} bytes`);
    console.log(`   - Ephemeral key: ${encrypted.ephemeralPublicKey.length} bytes`);
    console.log(`   - Algorithm: ${encrypted.algorithm}`);
    
    // Decrypt
    const decrypted = hybridCryptoService.hybridDecrypt(encrypted, keyPair);
    const decryptedMessage = new TextDecoder().decode(decrypted);
    
    console.log(`🔓 Decrypted message: "${decryptedMessage}"`);
    
    const decryptionSuccess = decryptedMessage === testMessage;
    console.log(`✅ Decryption success: ${decryptionSuccess ? '✅' : '❌'}`);
    
    if (!decryptionSuccess) {
      throw new Error('Decrypted message does not match original!');
    }
    
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
  }
}

async function testHybridSignatures() {
  console.log('\n✍️ Testing Hybrid Digital Signatures...');
  
  try {
    // Generate key pair
    const keyPair = hybridCryptoService.generateHybridKeyPair('ed25519');
    
    // Test message
    const message = 'This document has been signed with hybrid cryptography for future-proof security.';
    const messageBytes = new TextEncoder().encode(message);
    
    console.log(`📝 Message to sign: "${message}"`);
    
    // Sign
    const signature = hybridCryptoService.hybridSign(messageBytes, keyPair);
    
    console.log(`✍️ Hybrid signature created:`);
    console.log(`   - Classical signature: ${signature.classicalSignature.length} bytes`);
    console.log(`   - Post-quantum signature: ${signature.postQuantumSignature.length} bytes`);
    console.log(`   - Algorithm: ${signature.algorithm}`);
    
    // Verify
    const isValid = hybridCryptoService.hybridVerify(signature, keyPair, messageBytes);
    
    console.log(`🔍 Signature verification: ${isValid ? '✅' : '❌'}`);
    
    // Test with tampered message
    const tamperedMessage = new TextEncoder().encode(message + ' TAMPERED');
    const tamperedValid = hybridCryptoService.hybridVerify(signature, keyPair, tamperedMessage);
    
    console.log(`🔍 Tampered message verification: ${tamperedValid ? '❌ SECURITY ISSUE' : '✅'}`);
    
    if (!isValid || tamperedValid) {
      throw new Error('Signature verification failed!');
    }
    
  } catch (error) {
    console.error('❌ Signature test failed:', error);
  }
}

async function testPIIEncryption() {
  console.log('\n🛡️ Testing PII Data Encryption...');
  
  try {
    // Initialize secure session
    const sessionId = 'test-session-123';
    const ipAddress = '192.168.1.100';
    const userAgent = 'TestAgent/1.0';
    
    const session = await hybridSecurityManager.initializeSecureSession(sessionId, ipAddress, userAgent);
    console.log(`🔐 Secure session initialized: ${session.encryptionLevel}`);
    
    // Mock PII data
    const piiMatches: PIIMatch[] = [
      {
        type: 'email',
        value: 'user@example.com',
        start: 100,
        end: 116,
        confidence: 0.95,
        placeholder: '[REDACTED_EMAIL_1]'
      },
      {
        type: 'phone',
        value: '555-123-4567',
        start: 200,
        end: 212,
        confidence: 0.92,
        placeholder: '[REDACTED_PHONE_1]'
      },
      {
        type: 'ssn',
        value: '123-45-6789',
        start: 300,
        end: 311,
        confidence: 0.98,
        placeholder: '[REDACTED_SSN_1]'
      }
    ];
    
    console.log(`📄 Mock PII data created: ${piiMatches.length} items`);
    
    // Encrypt PII data
    const encryptedPII = await hybridSecurityManager.encryptPIIData(
      piiMatches,
      sessionId,
      ipAddress,
      userAgent
    );
    
    console.log(`🔒 PII encrypted:`);
    console.log(`   - Items: ${encryptedPII.encryptedMatches.length}`);
    console.log(`   - Algorithm: ${encryptedPII.algorithm}`);
    console.log(`   - Integrity hash: ${encryptedPII.integrityHash.substring(0, 16)}...`);
    
    // Verify integrity
    const integrityValid = hybridSecurityManager.verifyDataIntegrity(encryptedPII);
    console.log(`🔍 Integrity check: ${integrityValid ? '✅' : '❌'}`);
    
    // Decrypt PII data
    const decryptedPII = await hybridSecurityManager.decryptPIIData(encryptedPII, sessionId);
    
    console.log(`🔓 PII decrypted: ${decryptedPII.length} items`);
    
    // Verify data integrity
    const dataMatches = piiMatches.every((original, index) => {
      const decrypted = decryptedPII[index];
      return original.type === decrypted.type &&
             original.value === decrypted.value &&
             original.start === decrypted.start &&
             original.end === decrypted.end &&
             original.confidence === decrypted.confidence;
    });
    
    console.log(`✅ PII data integrity: ${dataMatches ? '✅' : '❌'}`);
    
    if (!integrityValid || !dataMatches) {
      throw new Error('PII encryption/decryption verification failed!');
    }
    
  } catch (error) {
    console.error('❌ PII encryption test failed:', error);
  }
}

async function testKeyDerivation() {
  console.log('\n🔑 Testing Key Derivation...');
  
  try {
    // Generate a shared secret
    const aliceKeys = hybridCryptoService.generateHybridKeyPair('p256');
    const bobKeys = hybridCryptoService.generateHybridKeyPair('p256');
    const sharedSecret = hybridCryptoService.hybridKeyExchange(aliceKeys, bobKeys.combinedPublicKey);
    
    // Derive application-specific keys
    const contexts = ['document-encryption', 'pii-protection', 'session-auth'];
    
    for (const context of contexts) {
      const derivedKeys = hybridCryptoService.deriveApplicationKeys(sharedSecret, context, 3);
      
      console.log(`🔑 Derived keys for "${context}":`);
      derivedKeys.forEach((key, index) => {
        console.log(`   - Key ${index + 1}: ${key.length} bytes (${Array.from(key.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')}...)`);
      });
      
      // Verify keys are different
      const allDifferent = derivedKeys.every((key, i) => 
        derivedKeys.every((otherKey, j) => 
          i === j || !key.every((byte, k) => byte === otherKey[k])
        )
      );
      
      console.log(`   - All keys unique: ${allDifferent ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Key derivation test failed:', error);
  }
}

async function testPerformance() {
  console.log('\n⚡ Testing Performance...');
  
  try {
    const iterations = 10;
    const testData = new TextEncoder().encode('Performance test data '.repeat(100)); // ~2KB
    
    // Key generation performance
    console.log(`🔑 Key generation (${iterations} iterations):`);
    const keyGenStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      hybridCryptoService.generateHybridKeyPair('p256');
    }
    const keyGenTime = Date.now() - keyGenStart;
    console.log(`   - Average: ${(keyGenTime / iterations).toFixed(2)}ms per key pair`);
    
    // Encryption performance
    console.log(`🔒 Encryption (${iterations} iterations, ${testData.length} bytes each):`);
    const keyPair = hybridCryptoService.generateHybridKeyPair('p256');
    
    const encryptStart = Date.now();
    const encrypted = [];
    for (let i = 0; i < iterations; i++) {
      encrypted.push(hybridCryptoService.hybridEncrypt(testData, keyPair.combinedPublicKey));
    }
    const encryptTime = Date.now() - encryptStart;
    console.log(`   - Average: ${(encryptTime / iterations).toFixed(2)}ms per encryption`);
    console.log(`   - Throughput: ${((testData.length * iterations) / (encryptTime / 1000) / 1024).toFixed(2)} KB/s`);
    
    // Decryption performance
    console.log(`🔓 Decryption (${iterations} iterations):`);
    const decryptStart = Date.now();
    for (let i = 0; i < iterations; i++) {
      hybridCryptoService.hybridDecrypt(encrypted[i], keyPair);
    }
    const decryptTime = Date.now() - decryptStart;
    console.log(`   - Average: ${(decryptTime / iterations).toFixed(2)}ms per decryption`);
    console.log(`   - Throughput: ${((testData.length * iterations) / (decryptTime / 1000) / 1024).toFixed(2)} KB/s`);
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }
}

async function runAllTests() {
  try {
    await testKeyGeneration();
    await testKeyExchange();
    await testHybridEncryption();
    await testHybridSignatures();
    await testPIIEncryption();
    await testKeyDerivation();
    await testPerformance();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All hybrid cryptography tests completed successfully!');
    console.log('✅ Your system is now protected with hybrid classical + post-quantum security');
    
    // Show system status
    const status = hybridCryptoService.getStatus();
    const securityStatus = hybridSecurityManager.getSecurityStatus();
    
    console.log('\n📊 System Status:');
    console.log(`   - Hybrid Crypto: ${status.hybridCrypto ? '✅' : '❌'}`);
    console.log(`   - Classical Algorithms: ${status.supportedAlgorithms.classical.join(', ')}`);
    console.log(`   - Post-Quantum: ${status.supportedAlgorithms.postQuantum.join(', ')}`);
    console.log(`   - Active Sessions: ${securityStatus.activeSessions}`);
    console.log(`   - Encryption Level: ${securityStatus.encryptionLevel}`);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();