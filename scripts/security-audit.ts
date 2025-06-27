#!/usr/bin/env tsx

/**
 * Automated Security Audit Script
 * 
 * This script performs comprehensive security checks:
 * - NPM dependency vulnerabilities
 * - Outdated packages
 * - Basic security configuration checks
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface AuditResult {
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  outdatedPackages: number;
  securityIssues: string[];
  recommendations: string[];
}

async function runSecurityAudit(): Promise<AuditResult> {
  console.log('🔒 Running Security Audit...\n');

  const result: AuditResult = {
    vulnerabilities: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
    outdatedPackages: 0,
    securityIssues: [],
    recommendations: []
  };

  // 1. Check NPM vulnerabilities
  console.log('🔍 Checking NPM vulnerabilities...');
  try {
    const auditOutput = execSync('npm audit --json', { encoding: 'utf8' });
    const auditData = JSON.parse(auditOutput);
    
    if (auditData.metadata && auditData.metadata.vulnerabilities) {
      const vulns = auditData.metadata.vulnerabilities;
      result.vulnerabilities = {
        total: vulns.total || 0,
        critical: vulns.critical || 0,
        high: vulns.high || 0,
        moderate: vulns.moderate || 0,
        low: vulns.low || 0
      };
    }

    console.log(`   Found ${result.vulnerabilities.total} vulnerabilities:`);
    console.log(`   - Critical: ${result.vulnerabilities.critical}`);
    console.log(`   - High: ${result.vulnerabilities.high}`);
    console.log(`   - Moderate: ${result.vulnerabilities.moderate}`);
    console.log(`   - Low: ${result.vulnerabilities.low}`);

    if (result.vulnerabilities.total > 0) {
      result.securityIssues.push(`${result.vulnerabilities.total} NPM vulnerabilities found`);
      result.recommendations.push('Run "npm audit fix" to address vulnerabilities');
    }
  } catch (error) {
    console.log('   ⚠️ Could not parse npm audit output (may indicate vulnerabilities)');
    result.securityIssues.push('NPM audit failed to parse');
  }

  // 2. Check outdated packages
  console.log('\n📦 Checking outdated packages...');
  try {
    const outdatedOutput = execSync('npm outdated --json', { encoding: 'utf8' });
    const outdatedData = JSON.parse(outdatedOutput);
    result.outdatedPackages = Object.keys(outdatedData).length;
    
    console.log(`   Found ${result.outdatedPackages} outdated packages`);
    
    if (result.outdatedPackages > 0) {
      result.recommendations.push('Consider updating outdated packages');
      
      // Highlight security-sensitive packages
      const securityPackages = ['express', 'cors', 'helmet', 'bcrypt', 'argon2', 'jsonwebtoken'];
      const outdatedSecurityPackages = Object.keys(outdatedData).filter(pkg => 
        securityPackages.some(secPkg => pkg.includes(secPkg))
      );
      
      if (outdatedSecurityPackages.length > 0) {
        result.securityIssues.push(`Security-sensitive packages are outdated: ${outdatedSecurityPackages.join(', ')}`);
        result.recommendations.push('Update security-sensitive packages immediately');
      }
    }
  } catch (error) {
    console.log('   ✅ All packages are up to date or npm outdated failed');
  }

  // 3. Check environment configuration
  console.log('\n⚙️ Checking security configuration...');
  
  // Check for .env file
  if (fs.existsSync('.env')) {
    console.log('   ✅ .env file found');
  } else {
    console.log('   ⚠️ No .env file found');
    result.securityIssues.push('No .env file found');
    result.recommendations.push('Create .env file with proper environment variables');
  }

  // Check env.example
  if (fs.existsSync('env.example')) {
    console.log('   ✅ env.example file found');
    
    // Check if env.example has security-related variables
    const envExample = fs.readFileSync('env.example', 'utf8');
    const securityVars = ['JWT_SECRET', 'PASSWORD_PEPPER', 'ADMIN_API_KEY', 'TOKEN_ENCRYPTION_KEY'];
    const missingSecurityVars = securityVars.filter(varName => !envExample.includes(varName));
    
    if (missingSecurityVars.length > 0) {
      result.securityIssues.push(`Missing security variables in env.example: ${missingSecurityVars.join(', ')}`);
    }
  } else {
    result.recommendations.push('Create env.example file for documentation');
  }

  // 4. Check for security headers
  console.log('\n🛡️ Checking security implementations...');
  
  // Check for CSRF protection
  if (fs.existsSync('server/csrf-protection.ts')) {
    console.log('   ✅ CSRF protection implemented');
  } else {
    result.securityIssues.push('CSRF protection not found');
    result.recommendations.push('Implement CSRF protection');
  }

  // Check for 2FA
  if (fs.existsSync('server/two-factor-service.ts')) {
    console.log('   ✅ Two-factor authentication implemented');
  } else {
    result.securityIssues.push('Two-factor authentication not found');
    result.recommendations.push('Implement two-factor authentication');
  }

  // Check for rate limiting
  const serverFiles = ['server/index.ts', 'server/routes.ts'];
  let hasRateLimit = false;
  for (const file of serverFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('rateLimit') || content.includes('rate-limit')) {
        hasRateLimit = true;
        break;
      }
    }
  }
  
  if (hasRateLimit) {
    console.log('   ✅ Rate limiting implemented');
  } else {
    result.securityIssues.push('Rate limiting not found');
    result.recommendations.push('Implement rate limiting');
  }

  // 5. Check file permissions (basic check)
  console.log('\n📁 Checking file security...');
  
  const sensitiveFiles = ['.env', 'server/index.ts', 'package.json'];
  for (const file of sensitiveFiles) {
    if (fs.existsSync(file)) {
      try {
        const stats = fs.statSync(file);
        // This is a basic check - in production you'd want more sophisticated permission checks
        console.log(`   ✅ ${file} exists and is accessible`);
      } catch (error) {
        result.securityIssues.push(`Cannot access ${file}`);
      }
    }
  }

  // 6. Generate dependency update schedule
  console.log('\n📅 Security maintenance recommendations...');
  result.recommendations.push('Schedule weekly dependency updates');
  result.recommendations.push('Set up automated security alerts');
  result.recommendations.push('Perform monthly security audits');
  result.recommendations.push('Review access logs regularly');

  return result;
}

function generateSecurityReport(result: AuditResult): void {
  console.log('\n📊 SECURITY AUDIT REPORT');
  console.log('========================\n');

  // Overall status
  const totalIssues = result.securityIssues.length;
  const criticalVulns = result.vulnerabilities.critical + result.vulnerabilities.high;
  
  if (totalIssues === 0 && criticalVulns === 0) {
    console.log('🟢 SECURITY STATUS: GOOD');
  } else if (criticalVulns > 0 || totalIssues > 3) {
    console.log('🔴 SECURITY STATUS: NEEDS ATTENTION');
  } else {
    console.log('🟡 SECURITY STATUS: MINOR ISSUES');
  }

  console.log(`\n📈 METRICS:`);
  console.log(`   Total vulnerabilities: ${result.vulnerabilities.total}`);
  console.log(`   Critical/High vulnerabilities: ${criticalVulns}`);
  console.log(`   Outdated packages: ${result.outdatedPackages}`);
  console.log(`   Security issues identified: ${totalIssues}`);

  // Issues
  if (result.securityIssues.length > 0) {
    console.log(`\n⚠️ SECURITY ISSUES:`);
    result.securityIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log(`\n💡 RECOMMENDATIONS:`);
    result.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }

  console.log(`\n📅 Next audit recommended: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toDateString()}`);
}

// Main execution
runSecurityAudit()
  .then(generateSecurityReport)
  .then(() => {
    console.log('\n✅ Security audit completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Security audit failed:', error);
    process.exit(1);
  });

export { runSecurityAudit, generateSecurityReport };