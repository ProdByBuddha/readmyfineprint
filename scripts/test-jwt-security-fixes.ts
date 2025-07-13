/**
 * Test Script: JWT Security Fixes
 * Tests the enhanced JWT security system with both Neon and local databases
 */

import crypto from 'crypto';
import { db } from '../server/db';
import { jwtSecretManager } from '../server/jwt-secret-manager';
import { secureJWTService } from '../server/secure-jwt-service';
import { addJWTSecurityTables } from './add-jwt-security-tables';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class JWTSecurityTester {
  private results: TestResult[] = [];
  private testUserId: string = '';  // Will be set when user is created
  private testEmail: string = `test-${Date.now()}@example.com`;

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting JWT Security Fixes Test Suite...');
    console.log('================================================');

    try {
      // Setup
      await this.setupTest();
      await this.createTestUser();

      // Run tests
      await this.testSecretManagerInitialization();
      await this.testVersionedSecrets();
      await this.testTokenGeneration();
      await this.testTokenValidation();
      await this.testTokenRefresh();
      await this.testTokenRevocation();
      await this.testSecurityValidation();
      await this.testDatabaseIntegration();

      // Cleanup
      await this.cleanupTest();

      // Report results
      this.reportResults();

    } catch (error) {
      console.error('💥 Test suite failed to run:', error);
      process.exit(1);
    }
  }

  private async setupTest(): Promise<void> {
    console.log('🔧 Setting up test environment...');

    try {
      // Ensure database is initialized
      // await ensureDbInitialized(); // This line is removed as per the edit hint

      // Run database migration to add JWT security tables
      await addJWTSecurityTables();

      console.log('✅ Test environment setup complete');
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      throw error;
    }
  }

  private async createTestUser(): Promise<void> {
    try {
      // Import database and schema
      const { db } = await import('../server/db');
      const { users } = await import('@shared/schema');

      // Create a test user in the database - let the DB generate the UUID
      const result = await db.insert(users).values({
        email: this.testEmail,
        emailVerified: true,
        isActive: true
      }).returning({ id: users.id });

      if (result.length > 0) {
        this.testUserId = result[0].id;
      } else {
        throw new Error('Failed to create test user');
      }

      console.log(`👤 Created test user: ${this.testEmail}`);
    } catch (error) {
      console.error('❌ Failed to create test user:', error);
      throw error;
    }
  }

  private async testSecretManagerInitialization(): Promise<void> {
    try {
      await jwtSecretManager.initialize();
      const currentSecret = jwtSecretManager.getCurrentSecret();

      this.addResult('Secret Manager Initialization', true, {
        version: currentSecret.version,
        algorithm: currentSecret.algorithm,
        secretLength: currentSecret.secret.length
      });

    } catch (error) {
      this.addResult('Secret Manager Initialization', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testVersionedSecrets(): Promise<void> {
    try {
      const originalVersion = jwtSecretManager.getCurrentSecret().version;
      
      // Test secret rotation
      const rotationResult = await jwtSecretManager.rotateSecret();
      const newSecret = jwtSecretManager.getCurrentSecret();

      // Verify we can still get the old secret
      const oldSecret = jwtSecretManager.getSecretByVersion(originalVersion);

      const passed = 
        rotationResult.newVersion > rotationResult.oldVersion &&
        newSecret.version === rotationResult.newVersion &&
        oldSecret !== null;

      this.addResult('Versioned Secrets & Rotation', passed, {
        originalVersion,
        newVersion: rotationResult.newVersion,
        canAccessOldSecret: !!oldSecret,
        newSecretLength: newSecret.secret.length
      });

    } catch (error) {
      this.addResult('Versioned Secrets & Rotation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testTokenGeneration(): Promise<void> {
    try {
      const tokenPair = await secureJWTService.generateTokenPair(
        this.testUserId,
        this.testEmail,
        {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          deviceFingerprint: 'test-device'
        }
      );

      const passed = 
        tokenPair.accessToken.length > 0 &&
        tokenPair.refreshToken.length > 0 &&
        tokenPair.accessTokenExpiry instanceof Date &&
        tokenPair.refreshTokenExpiry instanceof Date;

      this.addResult('Token Generation', passed, {
        hasAccessToken: !!tokenPair.accessToken,
        hasRefreshToken: !!tokenPair.refreshToken,
        accessTokenLength: tokenPair.accessToken.length,
        refreshTokenLength: tokenPair.refreshToken.length,
        accessExpiry: tokenPair.accessTokenExpiry.toISOString(),
        refreshExpiry: tokenPair.refreshTokenExpiry.toISOString()
      });

      // Store for subsequent tests
      (this as any).testTokens = tokenPair;

    } catch (error) {
      this.addResult('Token Generation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testTokenValidation(): Promise<void> {
    try {
      const tokens = (this as any).testTokens;
      if (!tokens) {
        throw new Error('No tokens available from previous test');
      }

      const validation = await secureJWTService.validateAccessToken(tokens.accessToken);

      const passed = 
        validation.valid &&
        validation.payload?.userId === this.testUserId &&
        validation.payload?.email === this.testEmail;

      this.addResult('Token Validation', passed, {
        isValid: validation.valid,
        hasPayload: !!validation.payload,
        userIdMatch: validation.payload?.userId === this.testUserId,
        emailMatch: validation.payload?.email === this.testEmail,
        tokenType: validation.payload?.tokenType,
        version: validation.payload?.version
      });

    } catch (error) {
      this.addResult('Token Validation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testTokenRefresh(): Promise<void> {
    try {
      const tokens = (this as any).testTokens;
      if (!tokens) {
        throw new Error('No tokens available from previous test');
      }

      const refreshResult = await secureJWTService.refreshAccessToken(
        tokens.refreshToken,
        {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          deviceFingerprint: 'test-device'
        }
      );

      const passed = 
        refreshResult !== null &&
        refreshResult.accessToken.length > 0 &&
        refreshResult.accessToken !== tokens.accessToken; // Should be different

      this.addResult('Token Refresh', passed, {
        refreshSuccessful: !!refreshResult,
        newTokenLength: refreshResult?.accessToken.length || 0,
        tokensDifferent: refreshResult?.accessToken !== tokens.accessToken,
        newExpiry: refreshResult?.accessTokenExpiry.toISOString()
      });

      // Update tokens for subsequent tests
      if (refreshResult) {
        (this as any).testTokens.accessToken = refreshResult.accessToken;
      }

    } catch (error) {
      this.addResult('Token Refresh', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testTokenRevocation(): Promise<void> {
    try {
      const tokens = (this as any).testTokens;
      if (!tokens) {
        throw new Error('No tokens available from previous test');
      }

      // Revoke the access token
      const revocationResult = await secureJWTService.revokeToken(
        tokens.accessToken,
        'Testing revocation functionality',
        'test-system'
      );

      // Try to validate the revoked token
      const validation = await secureJWTService.validateAccessToken(tokens.accessToken);

      const passed = 
        revocationResult === true &&
        validation.valid === false &&
        validation.revoked === true;

      this.addResult('Token Revocation', passed, {
        revocationSuccessful: revocationResult,
        tokenMarkedAsRevoked: validation.revoked,
        validationResult: validation.valid
      });

    } catch (error) {
      this.addResult('Token Revocation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testSecurityValidation(): Promise<void> {
    try {
      // Test with invalid token
      const invalidValidation = await secureJWTService.validateAccessToken('invalid.token.here');

      // Test with malformed token
      const malformedValidation = await secureJWTService.validateAccessToken('not-a-token');

      const passed = 
        !invalidValidation.valid &&
        !malformedValidation.valid;

      this.addResult('Security Validation', passed, {
        invalidTokenRejected: !invalidValidation.valid,
        malformedTokenRejected: !malformedValidation.valid,
        invalidError: invalidValidation.error,
        malformedError: malformedValidation.error
      });

    } catch (error) {
      this.addResult('Security Validation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async testDatabaseIntegration(): Promise<void> {
    try {
      // Test cleanup functionality
      const cleanupResult = await secureJWTService.cleanupExpiredTokens();

      // Test bulk revocation
      const bulkRevocationCount = await secureJWTService.revokeAllUserTokens(
        this.testUserId,
        'Testing bulk revocation',
        'test-system'
      );

      const passed = 
        typeof cleanupResult.tokensRemoved === 'number' &&
        typeof cleanupResult.revocationsRemoved === 'number' &&
        typeof bulkRevocationCount === 'number';

      this.addResult('Database Integration', passed, {
        cleanupExecuted: true,
        tokensRemoved: cleanupResult.tokensRemoved,
        revocationsRemoved: cleanupResult.revocationsRemoved,
        bulkRevocationCount
      });

    } catch (error) {
      this.addResult('Database Integration', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async cleanupTest(): Promise<void> {
    try {
      console.log('🧹 Cleaning up test data...');
      
      // Import database to clean up test data
      const { db } = await import('../server/db');
      const { users, refreshTokens, jwtTokenRevocations } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      // Clean up test refresh tokens
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, this.testUserId));

      // Clean up test revocations
      await db.delete(jwtTokenRevocations).where(eq(jwtTokenRevocations.userId, this.testUserId));

      // Clean up test user (this will cascade delete related records)
      await db.delete(users).where(eq(users.id, this.testUserId));

      console.log('✅ Test cleanup complete');
    } catch (error) {
      console.warn('⚠️ Test cleanup failed (may be expected):', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private addResult(testName: string, passed: boolean, details?: any): void {
    this.results.push({
      testName,
      passed,
      error: passed ? undefined : (typeof details === 'string' ? details : undefined),
      details: passed ? details : undefined
    });

    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (details && typeof details !== 'string') {
      console.log(`   Details:`, details);
    }
  }

  private reportResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('========================');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   - ${result.testName}: ${result.error || 'Unknown error'}`);
        });
    }

    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! JWT security fixes are working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the failures above.');
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new JWTSecurityTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n✅ JWT Security Test Suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { JWTSecurityTester };