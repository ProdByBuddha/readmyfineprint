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
  zapScanResults?: {
    alertsCount: number;
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
    informationalAlerts: number;
    scanUrl?: string;
    reportPath?: string;
  };
}

async function runSecurityAudit(): Promise<AuditResult> {
  console.log('🔒 Running Comprehensive Security Audit...\n');

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

  // 6. Run Semgrep static analysis
  console.log('\n🔍 Running Semgrep static analysis...');
  try {
    const semgrepResults = await runSemgrepScan();
    if (semgrepResults.findings > 0) {
      result.securityIssues.push(`${semgrepResults.findings} potential code vulnerabilities found by Semgrep`);
      if (semgrepResults.highSeverity > 0) {
        result.recommendations.push(`Address ${semgrepResults.highSeverity} high-severity code vulnerabilities`);
      }
      console.log(`   Found ${semgrepResults.findings} potential vulnerabilities`);
      console.log(`   - High severity: ${semgrepResults.highSeverity}`);
      console.log(`   - Medium severity: ${semgrepResults.mediumSeverity}`);
    } else {
      console.log('   ✅ No code vulnerabilities detected');
    }
  } catch (error) {
    console.log(`   ⚠️ Semgrep scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.recommendations.push('Install Semgrep for static code analysis: npm install -g @semgrep/cli');
  }

  // 7. Run OWASP ZAP scan (if available and dev server is running)
  console.log('\n🕷️ Running OWASP ZAP security scan...');
  try {
    const zapResults = await runZapScan();
    if (zapResults) {
      result.zapScanResults = zapResults;
      console.log(`   Found ${zapResults.alertsCount} security alerts:`);
      console.log(`   - High: ${zapResults.highAlerts}`);
      console.log(`   - Medium: ${zapResults.mediumAlerts}`);
      console.log(`   - Low: ${zapResults.lowAlerts}`);
      console.log(`   - Informational: ${zapResults.informationalAlerts}`);
      
      if (zapResults.highAlerts > 0) {
        result.securityIssues.push(`${zapResults.highAlerts} high-severity web application vulnerabilities found`);
        result.recommendations.push('Address high-severity web application vulnerabilities immediately');
      }
      
      if (zapResults.mediumAlerts > 0) {
        result.securityIssues.push(`${zapResults.mediumAlerts} medium-severity web application vulnerabilities found`);
        result.recommendations.push('Review and fix medium-severity web application vulnerabilities');
      }
    }
  } catch (error) {
    console.log(`   ⚠️ ZAP scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.recommendations.push('Install and configure OWASP ZAP for web application security testing');
  }

  // 8. Run Nuclei infrastructure scan
  console.log('\n🎯 Running Nuclei infrastructure scan...');
  try {
    const nucleiResults = await runNucleiScan();
    if (nucleiResults.findings > 0) {
      result.securityIssues.push(`${nucleiResults.findings} infrastructure vulnerabilities found by Nuclei`);
      if (nucleiResults.critical > 0) {
        result.recommendations.push(`Address ${nucleiResults.critical} critical infrastructure vulnerabilities immediately`);
      }
      console.log(`   Found ${nucleiResults.findings} infrastructure vulnerabilities`);
      console.log(`   - Critical: ${nucleiResults.critical}`);
      console.log(`   - High: ${nucleiResults.high}`);
      console.log(`   - Medium: ${nucleiResults.medium}`);
    } else {
      console.log('   ✅ No infrastructure vulnerabilities detected');
    }
  } catch (error) {
    console.log(`   ⚠️ Nuclei scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.recommendations.push('Install Nuclei for infrastructure scanning: go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest');
  }

  // 9. Run Snyk dependency vulnerability scan
  console.log('\n🛡️ Running Snyk dependency scan...');
  try {
    const snykResults = await runSnykScan();
    if (snykResults.vulnerabilities > 0) {
      result.securityIssues.push(`${snykResults.vulnerabilities} dependency vulnerabilities found by Snyk`);
      if (snykResults.high > 0 || snykResults.critical > 0) {
        result.recommendations.push(`Address ${snykResults.high + snykResults.critical} high/critical dependency vulnerabilities`);
      }
      console.log(`   Found ${snykResults.vulnerabilities} dependency vulnerabilities`);
      console.log(`   - Critical: ${snykResults.critical}`);
      console.log(`   - High: ${snykResults.high}`);
      console.log(`   - Medium: ${snykResults.medium}`);
      console.log(`   - Low: ${snykResults.low}`);
    } else {
      console.log('   ✅ No dependency vulnerabilities detected');
    }
  } catch (error) {
    console.log(`   ⚠️ Snyk scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.recommendations.push('Install Snyk for dependency monitoring: npm install -g snyk');
  }

  // 10. Generate dependency update schedule
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
  const webAppHighAlerts = result.zapScanResults?.highAlerts || 0;
  
  if (totalIssues === 0 && criticalVulns === 0 && webAppHighAlerts === 0) {
    console.log('🟢 SECURITY STATUS: GOOD');
  } else if (criticalVulns > 0 || webAppHighAlerts > 0 || totalIssues > 3) {
    console.log('🔴 SECURITY STATUS: NEEDS ATTENTION');
  } else {
    console.log('🟡 SECURITY STATUS: MINOR ISSUES');
  }

  console.log(`\n📈 METRICS:`);
  console.log(`   Total vulnerabilities: ${result.vulnerabilities.total}`);
  console.log(`   Critical/High vulnerabilities: ${criticalVulns}`);
  console.log(`   Outdated packages: ${result.outdatedPackages}`);
  console.log(`   Security issues identified: ${totalIssues}`);
  
  if (result.zapScanResults) {
    console.log(`   Web application alerts: ${result.zapScanResults.alertsCount}`);
    console.log(`   High-severity web alerts: ${result.zapScanResults.highAlerts}`);
  }

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

/**
 * Run OWASP ZAP security scan against the development server
 */
async function runZapScan(): Promise<AuditResult['zapScanResults'] | null> {
  const DEV_URL = process.env.ZAP_TARGET_URL || 'http://localhost:5173';
  const ZAP_PORT = process.env.ZAP_PORT || '8080';
  const ZAP_API_KEY = process.env.ZAP_API_KEY || '';
  
  console.log(`   Scanning ${DEV_URL} via ZAP proxy on port ${ZAP_PORT}...`);
  
  try {
    // Check if ZAP is running
    const zapStatus = execSync(`curl -s "http://localhost:${ZAP_PORT}/JSON/core/view/version/" || echo "failed"`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    if (zapStatus.includes('failed') || !zapStatus.includes('version')) {
      throw new Error('OWASP ZAP is not running or not accessible');
    }
    
    console.log('   ✅ ZAP proxy detected');
    
    // Start spider scan
    console.log('   🕷️ Starting spider scan...');
    const spiderScanId = execSync(
      `curl -s "http://localhost:${ZAP_PORT}/JSON/spider/action/scan/?apikey=${ZAP_API_KEY}&url=${encodeURIComponent(DEV_URL)}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const spiderData = JSON.parse(spiderScanId);
    if (spiderData.scan) {
      // Wait for spider to complete (simplified - in production you'd poll status)
      console.log('   ⏳ Waiting for spider scan to complete...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    
    // Start active scan
    console.log('   🔍 Starting active security scan...');
    const activeScanId = execSync(
      `curl -s "http://localhost:${ZAP_PORT}/JSON/ascan/action/scan/?apikey=${ZAP_API_KEY}&url=${encodeURIComponent(DEV_URL)}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const activeScanData = JSON.parse(activeScanId);
    if (activeScanData.scan) {
      // Wait for active scan to complete (simplified)
      console.log('   ⏳ Waiting for active scan to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    // Get alerts
    const alertsResponse = execSync(
      `curl -s "http://localhost:${ZAP_PORT}/JSON/core/view/alerts/?apikey=${ZAP_API_KEY}&baseurl=${encodeURIComponent(DEV_URL)}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const alertsData = JSON.parse(alertsResponse);
    const alerts = alertsData.alerts || [];
    
    // Categorize alerts by risk level
    const riskCounts = {
      High: 0,
      Medium: 0,
      Low: 0,
      Informational: 0
    };
    
    alerts.forEach((alert: any) => {
      const risk = alert.risk || 'Informational';
      if (risk in riskCounts) {
        riskCounts[risk as keyof typeof riskCounts]++;
      }
    });
    
    // Export detailed alerts to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `./zap-security-report-${timestamp}.json`;
    
    const detailedReport = {
      scanInfo: {
        timestamp: new Date().toISOString(),
        targetUrl: DEV_URL,
        zapPort: ZAP_PORT,
        totalAlerts: alerts.length
      },
      summary: {
        high: riskCounts.High,
        medium: riskCounts.Medium,
        low: riskCounts.Low,
        informational: riskCounts.Informational
      },
      alerts: alerts.map((alert: any) => ({
        alert: alert.alert || 'Unknown',
        risk: alert.risk || 'Informational',
        confidence: alert.confidence || 'Unknown',
        description: alert.description || '',
        solution: alert.solution || '',
        reference: alert.reference || '',
        url: alert.url || '',
        param: alert.param || '',
        evidence: alert.evidence || ''
      }))
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`   📄 Detailed report exported to: ${reportPath}`);
    
    return {
      alertsCount: alerts.length,
      highAlerts: riskCounts.High,
      mediumAlerts: riskCounts.Medium,
      lowAlerts: riskCounts.Low,
      informationalAlerts: riskCounts.Informational,
      scanUrl: DEV_URL,
      reportPath
    };
    
  } catch (error) {
    console.log(`   ⚠️ ZAP scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Run Semgrep static analysis security scan
 */
async function runSemgrepScan(): Promise<{findings: number, highSeverity: number, mediumSeverity: number}> {
  try {
    // Check if semgrep is installed
    execSync('semgrep --version', { encoding: 'utf8', timeout: 5000 });
    console.log('   ✅ Semgrep detected');
    
    // Run semgrep with security rules
    const semgrepOutput = execSync(
      'semgrep --config=auto --json --quiet --no-git-ignore .',
      { encoding: 'utf8', timeout: 60000 }
    );
    
    const semgrepData = JSON.parse(semgrepOutput);
    const results = semgrepData.results || [];
    
    // Categorize by severity
    let highSeverity = 0;
    let mediumSeverity = 0;
    
    results.forEach((result: any) => {
      const severity = result.extra?.severity || 'INFO';
      if (severity === 'ERROR' || severity === 'HIGH') {
        highSeverity++;
      } else if (severity === 'WARNING' || severity === 'MEDIUM') {
        mediumSeverity++;
      }
    });
    
    // Export detailed results
    if (results.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = `./semgrep-security-report-${timestamp}.json`;
      
      const detailedReport = {
        scanInfo: {
          timestamp: new Date().toISOString(),
          tool: 'Semgrep',
          totalFindings: results.length
        },
        summary: {
          high: highSeverity,
          medium: mediumSeverity,
          low: results.length - highSeverity - mediumSeverity
        },
        findings: results.map((result: any) => ({
          ruleId: result.check_id,
          severity: result.extra?.severity || 'INFO',
          message: result.extra?.message || result.message,
          file: result.path,
          line: result.start?.line,
          code: result.extra?.lines
        }))
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
      console.log(`   📄 Detailed report exported to: ${reportPath}`);
    }
    
    return {
      findings: results.length,
      highSeverity,
      mediumSeverity
    };
    
  } catch (error) {
    throw new Error(`Semgrep not installed or scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Run Nuclei infrastructure vulnerability scan
 */
async function runNucleiScan(): Promise<{findings: number, critical: number, high: number, medium: number}> {
  const TARGET_URL = process.env.NUCLEI_TARGET_URL || 'http://localhost:5000';
  
  try {
    // Check if nuclei is installed
    const nucleiPath = './nuclei';
    execSync(`${nucleiPath} -version`, { encoding: 'utf8', timeout: 5000 });
    console.log('   ✅ Nuclei detected');
    
    // Run nuclei with infrastructure templates
    const nucleiOutput = execSync(
      `${nucleiPath} -u ${TARGET_URL} -severity critical,high,medium -json -silent -rate-limit 10`,
      { encoding: 'utf8', timeout: 120000 }
    );
    
    const results = nucleiOutput.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(result => result !== null);
    
    // Categorize by severity
    let critical = 0;
    let high = 0;
    let medium = 0;
    
    results.forEach((result: any) => {
      const severity = result.info?.severity?.toLowerCase() || 'info';
      if (severity === 'critical') {
        critical++;
      } else if (severity === 'high') {
        high++;
      } else if (severity === 'medium') {
        medium++;
      }
    });
    
    // Export detailed results
    if (results.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = `./nuclei-security-report-${timestamp}.json`;
      
      const detailedReport = {
        scanInfo: {
          timestamp: new Date().toISOString(),
          tool: 'Nuclei',
          target: TARGET_URL,
          totalFindings: results.length
        },
        summary: {
          critical,
          high,
          medium,
          low: results.length - critical - high - medium
        },
        findings: results.map((result: any) => ({
          templateId: result.templateID,
          name: result.info?.name,
          severity: result.info?.severity,
          description: result.info?.description,
          reference: result.info?.reference,
          matchedAt: result.matched_at,
          extractedResults: result.extracted_results,
          request: result.request,
          response: result.response
        }))
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
      console.log(`   📄 Detailed report exported to: ${reportPath}`);
    }
    
    return {
      findings: results.length,
      critical,
      high,
      medium
    };
    
  } catch (error) {
    throw new Error(`Nuclei not installed or scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Run Snyk dependency vulnerability scan
 */
async function runSnykScan(): Promise<{vulnerabilities: number, critical: number, high: number, medium: number, low: number}> {
  try {
    // Check if snyk is available (locally installed)
    const snykOutput = execSync('npx snyk test --json', { 
      encoding: 'utf8', 
      timeout: 60000 
    });
    
    const snykData = JSON.parse(snykOutput);
    const vulnerabilities = snykData.vulnerabilities || [];
    
    // Categorize by severity
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    
    vulnerabilities.forEach((vuln: any) => {
      const severity = vuln.severity?.toLowerCase() || 'low';
      if (severity === 'critical') {
        critical++;
      } else if (severity === 'high') {
        high++;
      } else if (severity === 'medium') {
        medium++;
      } else {
        low++;
      }
    });
    
    // Export detailed results
    if (vulnerabilities.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = `./snyk-security-report-${timestamp}.json`;
      
      const detailedReport = {
        scanInfo: {
          timestamp: new Date().toISOString(),
          tool: 'Snyk',
          totalVulnerabilities: vulnerabilities.length
        },
        summary: {
          critical,
          high,
          medium,
          low
        },
        vulnerabilities: vulnerabilities.map((vuln: any) => ({
          id: vuln.id,
          title: vuln.title,
          severity: vuln.severity,
          packageName: vuln.packageName,
          version: vuln.version,
          fixedIn: vuln.fixedIn,
          description: vuln.description,
          references: vuln.references,
          cvssScore: vuln.cvssScore,
          cve: vuln.identifiers?.CVE,
          cwe: vuln.identifiers?.CWE
        }))
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
      console.log(`   📄 Detailed report exported to: ${reportPath}`);
    }
    
    return {
      vulnerabilities: vulnerabilities.length,
      critical,
      high,
      medium,
      low
    };
    
  } catch (error) {
    // If snyk test fails due to vulnerabilities, parse the output anyway
    if (error instanceof Error && error.message.includes('found issues')) {
      try {
        // Extract JSON from error output
        const errorOutput = (error as any).stdout || '';
        const snykData = JSON.parse(errorOutput);
        const vulnerabilities = snykData.vulnerabilities || [];
        
        let critical = 0, high = 0, medium = 0, low = 0;
        vulnerabilities.forEach((vuln: any) => {
          const severity = vuln.severity?.toLowerCase() || 'low';
          if (severity === 'critical') critical++;
          else if (severity === 'high') high++;
          else if (severity === 'medium') medium++;
          else low++;
        });
        
        return { vulnerabilities: vulnerabilities.length, critical, high, medium, low };
      } catch (parseError) {
        // Fall through to throw error
      }
    }
    
    throw new Error(`Snyk not available or scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export { runSecurityAudit, generateSecurityReport, runZapScan, runSemgrepScan, runNucleiScan, runSnykScan };