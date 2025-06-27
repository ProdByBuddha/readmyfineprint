#!/usr/bin/env tsx

/**
 * Database Privacy Scan Script
 * 
 * This script scans the database to identify unhashed sensitive data
 * WITHOUT making any changes. Use this to audit what needs to be hashed.
 * 
 * Usage:
 * npx tsx scripts/scan-unhashed-data.ts
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, sql, like, and, isNull, isNotNull } from 'drizzle-orm';
import { 
  users, 
  consentRecords, 
  securityQuestions, 
  emailChangeRequests 
} from '../shared/schema';

// Initialize database connection
const sql_client = neon(process.env.DATABASE_URL!);
const db = drizzle(sql_client);

/**
 * Detect if a value is likely unhashed
 */
function isLikelyUnhashed(value: string): boolean {
  if (!value) return false;
  
  // Argon2 hashes start with $argon2
  if (value.startsWith('$argon2')) return false;
  
  // bcrypt hashes start with $2b$ or similar
  if (value.match(/^\$2[abxy]\$/)) return false;
  
  // Very long base64-like strings are likely hashed
  if (value.length > 60 && /^[A-Za-z0-9+/=]+$/.test(value)) return false;
  
  // If it looks like plaintext (contains spaces, readable words, etc.)
  return true;
}

/**
 * Detect if an IP address is unhashed
 */
function isUnhashedIP(value: string): boolean {
  if (!value) return false;
  
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
  
  return ipv4Pattern.test(value) || ipv6Pattern.test(value);
}

/**
 * Mask sensitive data for display
 */
function maskSensitiveData(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}

/**
 * Main scan function
 */
async function scanUnhashedData() {
  console.log('🔍 Starting Database Privacy Audit (Read-Only)...\n');
  
  let totalIssuesFound = 0;
  const issues: string[] = [];
  
  try {
    // 1. Check for unhashed passwords
    console.log('1️⃣ Scanning user passwords...');
    const usersWithPotentialPlaintextPasswords = await db
      .select({
        id: users.id,
        email: users.email,
        hashedPassword: users.hashedPassword
      })
      .from(users)
      .where(and(
        isNotNull(users.hashedPassword),
        sql`${users.hashedPassword} NOT LIKE '$argon2%' AND ${users.hashedPassword} NOT LIKE '$2b%'`
      ));
    
    for (const user of usersWithPotentialPlaintextPasswords) {
      if (user.hashedPassword && isLikelyUnhashed(user.hashedPassword)) {
        console.log(`   ⚠️ UNHASHED PASSWORD: User ${user.email} (${user.id})`);
        issues.push(`Unhashed password for user: ${user.email}`);
        totalIssuesFound++;
      }
    }
    console.log(`   📋 Scanned ${usersWithPotentialPlaintextPasswords.length} users\n`);
    
    // 2. Check security question answers
    console.log('2️⃣ Scanning security question answers...');
    try {
      const securityAnswers = await db
        .select()
        .from(securityQuestions)
        .where(sql`${securityQuestions.hashedAnswer} NOT LIKE '$argon2%'`);
      
      for (const answer of securityAnswers) {
        if (isLikelyUnhashed(answer.hashedAnswer)) {
          console.log(`   ⚠️ UNHASHED SECURITY ANSWER: User ${answer.userId} - Answer: ${maskSensitiveData(answer.hashedAnswer)}`);
          issues.push(`Unhashed security answer for user: ${answer.userId}`);
          totalIssuesFound++;
        }
      }
      console.log(`   📋 Scanned ${securityAnswers.length} security answers\n`);
    } catch (error: any) {
      if (error.cause?.code === '42P01') {
        console.log('   📋 Security questions table does not exist - skipping\n');
      } else {
        throw error;
      }
    }
    
    // 3. Check IP addresses in consent records
    console.log('3️⃣ Scanning consent record IP addresses...');
    try {
      const consentRecordsWithIPs = await db
        .select()
        .from(consentRecords)
        .where(sql`${consentRecords.ipHash} SIMILAR TO '[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}' OR ${consentRecords.ipHash} LIKE '%:%'`);
      
      for (const record of consentRecordsWithIPs) {
        if (isUnhashedIP(record.ipHash)) {
          console.log(`   ⚠️ UNHASHED IP: Consent record ${record.id} - IP: ${maskSensitiveData(record.ipHash)}`);
          issues.push(`Unhashed IP in consent record: ${record.id}`);
          totalIssuesFound++;
        }
      }
      console.log(`   📋 Scanned ${consentRecordsWithIPs.length} consent records\n`);
    } catch (error: any) {
      if (error.cause?.code === '42P01') {
        console.log('   📋 Consent records table does not exist - skipping\n');
      } else {
        throw error;
      }
    }
    
    // 4. Check user agents in consent records
    console.log('4️⃣ Scanning consent record user agents...');
    const consentRecordsWithUserAgents = await db
      .select()
      .from(consentRecords)
      .where(and(
        isNotNull(consentRecords.userAgentHash),
        sql`${consentRecords.userAgentHash} NOT LIKE '$argon2%'`
      ));
    
    for (const record of consentRecordsWithUserAgents) {
      if (record.userAgentHash && isLikelyUnhashed(record.userAgentHash)) {
        console.log(`   ⚠️ UNHASHED USER AGENT: Consent record ${record.id} - UA: ${maskSensitiveData(record.userAgentHash)}`);
        issues.push(`Unhashed user agent in consent record: ${record.id}`);
        totalIssuesFound++;
      }
    }
    console.log(`   📋 Scanned ${consentRecordsWithUserAgents.length} user agents\n`);
    
    // 5. Check email change requests
    console.log('5️⃣ Scanning email change request data...');
    const emailRequests = await db
      .select()
      .from(emailChangeRequests);
    
    for (const request of emailRequests) {
      // Check IP
      if (isUnhashedIP(request.clientIp)) {
        console.log(`   ⚠️ UNHASHED IP: Email change request ${request.id} - IP: ${maskSensitiveData(request.clientIp)}`);
        issues.push(`Unhashed IP in email change request: ${request.id}`);
        totalIssuesFound++;
      }
      
      // Check user agent
      if (request.userAgent && isLikelyUnhashed(request.userAgent)) {
        console.log(`   ⚠️ UNHASHED USER AGENT: Email change request ${request.id} - UA: ${maskSensitiveData(request.userAgent)}`);
        issues.push(`Unhashed user agent in email change request: ${request.id}`);
        totalIssuesFound++;
      }
    }
    console.log(`   📋 Scanned ${emailRequests.length} email change requests\n`);
    
    // 6. Database schema analysis
    console.log('6️⃣ Analyzing database schema for sensitive columns...');
    const sensitiveColumns = await db.execute(
      sql`SELECT table_name, column_name, data_type
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND (
            column_name LIKE '%password%' 
            OR column_name LIKE '%hash%'
            OR column_name LIKE '%ip%'
            OR column_name LIKE '%agent%'
            OR column_name LIKE '%email%'
            OR column_name LIKE '%answer%'
          )
          ORDER BY table_name, column_name`
    );
    
    console.log('   📊 Sensitive columns found:');
    for (const col of sensitiveColumns.rows as any[]) {
      console.log(`   📋 ${col.table_name}.${col.column_name} (${col.data_type})`);
    }
    
    // Summary
    console.log('\n📊 PRIVACY AUDIT SUMMARY:');
    console.log('=========================');
    console.log(`⚠️ Total privacy issues found: ${totalIssuesFound}`);
    console.log(`📋 Sensitive columns in schema: ${sensitiveColumns.rows.length}`);
    
    if (totalIssuesFound > 0) {
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      console.log('======================');
      console.log('Run the following script to hash all unhashed data:');
      console.log('npx tsx scripts/hash-unhashed-data.ts');
      console.log('\n⚠️ PRIVACY ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    } else {
      console.log('🎉 No privacy issues found! All sensitive data is properly hashed.');
    }
    
  } catch (error) {
    console.error('❌ Error during privacy audit:', error);
    process.exit(1);
  } finally {
    // HTTP client doesn't need explicit cleanup
  }
  
  return totalIssuesFound;
}

// Execute the script
if (import.meta.url === `file://${process.argv[1]}`) {
  scanUnhashedData()
    .then((issuesFound) => {
      if (issuesFound === 0) {
        console.log('\n✅ Privacy audit completed - no issues found');
        process.exit(0);
      } else {
        console.log(`\n⚠️ Privacy audit completed - ${issuesFound} issues need attention`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Privacy audit failed:', error);
      process.exit(1);
    });
}

export { scanUnhashedData };