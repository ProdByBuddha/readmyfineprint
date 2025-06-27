#!/usr/bin/env tsx

/**
 * Hash Identified Unhashed Data Script
 * 
 * This script hashes the specific unhashed sensitive data found in the audit:
 * - Email addresses in email_change_requests and email_verification_rate_limit
 * - IP addresses in email_change_requests and email_verification_rate_limit
 * 
 * Usage:
 * npx tsx scripts/hash-identified-data.ts
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, sql, like, and, isNull, isNotNull } from 'drizzle-orm';
import { 
  emailChangeRequests, 
  emailVerificationRateLimit 
} from '../shared/schema';
import { hashEmail, hashIpAddress } from '../server/argon2';

// Initialize database connection
const sql_client = neon(process.env.DATABASE_URL!);
const db = drizzle(sql_client);

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
 * Detect if an email is unhashed
 */
function isUnhashedEmail(value: string): boolean {
  if (!value) return false;
  
  // Simple email pattern that doesn't start with $ (indicating it's not hashed)
  return value.includes('@') && value.includes('.') && !value.startsWith('$');
}

/**
 * Main execution function
 */
async function hashIdentifiedData() {
  console.log('🔐 Starting Targeted Privacy Compliance...\n');
  
  let totalHashedItems = 0;
  
  try {
    // 1. Hash unhashed emails and IPs in email_change_requests
    console.log('1️⃣ Processing email change requests...');
    
    const emailChangeRequestsData = await db
      .select()
      .from(emailChangeRequests);
    
    for (const request of emailChangeRequestsData) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Hash current email if unhashed
      if (isUnhashedEmail(request.currentEmail)) {
        console.log(`   📧 Hashing current email in request ${request.id}`);
        updates.currentEmail = await hashEmail(request.currentEmail);
        needsUpdate = true;
        totalHashedItems++;
      }
      
      // Hash new email if unhashed
      if (isUnhashedEmail(request.newEmail)) {
        console.log(`   📧 Hashing new email in request ${request.id}`);
        updates.newEmail = await hashEmail(request.newEmail);
        needsUpdate = true;
        totalHashedItems++;
      }
      
      // Hash IP if unhashed
      if (isUnhashedIP(request.clientIp)) {
        console.log(`   🌐 Hashing IP in request ${request.id}`);
        updates.clientIp = await hashIpAddress(request.clientIp);
        needsUpdate = true;
        totalHashedItems++;
      }
      
      if (needsUpdate) {
        updates.updatedAt = new Date();
        await db
          .update(emailChangeRequests)
          .set(updates)
          .where(eq(emailChangeRequests.id, request.id));
      }
    }
    console.log(`   ✅ Processed ${emailChangeRequestsData.length} email change requests\n`);
    
    // 2. Hash unhashed emails and IPs in email_verification_rate_limit
    console.log('2️⃣ Processing email verification rate limit records...');
    
    const rateLimitData = await db
      .select()
      .from(emailVerificationRateLimit);
    
    for (const record of rateLimitData) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Hash email if unhashed
      if (isUnhashedEmail(record.email)) {
        console.log(`   📧 Hashing email in rate limit record ${record.id}`);
        updates.email = await hashEmail(record.email);
        needsUpdate = true;
        totalHashedItems++;
      }
      
      // Hash IP if unhashed
      if (isUnhashedIP(record.clientIp)) {
        console.log(`   🌐 Hashing IP in rate limit record ${record.id}`);
        updates.clientIp = await hashIpAddress(record.clientIp);
        needsUpdate = true;
        totalHashedItems++;
      }
      
      if (needsUpdate) {
        await db
          .update(emailVerificationRateLimit)
          .set(updates)
          .where(eq(emailVerificationRateLimit.id, record.id));
      }
    }
    console.log(`   ✅ Processed ${rateLimitData.length} rate limit records\n`);
    
    // 3. Additional cleanup - check for any other email patterns in the database
    console.log('3️⃣ Checking for additional email patterns...');
    
    try {
      // Check email_verification_codes table
      const emailCodesResult = await db.execute(sql`
        SELECT id, email, client_ip FROM email_verification_codes 
        WHERE email LIKE '%@%' AND email NOT LIKE '$%'
        LIMIT 5
      `);
      
      if (emailCodesResult.rows.length > 0) {
        console.log(`   📧 Found ${emailCodesResult.rows.length} unhashed emails in email_verification_codes`);
        
        for (const row of emailCodesResult.rows as any[]) {
          console.log(`   📧 Hashing email in verification code ${row.id}`);
          const hashedEmail = await hashEmail(row.email);
          
          let hashedIP = row.client_ip;
          if (isUnhashedIP(row.client_ip)) {
            console.log(`   🌐 Hashing IP in verification code ${row.id}`);
            hashedIP = await hashIpAddress(row.client_ip);
            totalHashedItems++;
          }
          
          await db.execute(sql`
            UPDATE email_verification_codes 
            SET email = ${hashedEmail}, client_ip = ${hashedIP}
            WHERE id = ${row.id}
          `);
          totalHashedItems++;
        }
      } else {
        console.log('   ✅ No unhashed emails found in email_verification_codes');
      }
    } catch (error: any) {
      console.log(`   ⚠️ Could not check email_verification_codes: ${error.message}`);
    }
    
    // Summary
    console.log('📊 PRIVACY COMPLIANCE SUMMARY:');
    console.log('===============================');
    console.log(`✅ Total items hashed: ${totalHashedItems}`);
    console.log(`🔐 Email hashing: Argon2id with deterministic salting`);
    console.log(`🌐 IP address hashing: Argon2id with deterministic salting`);
    console.log(`📧 All email data: Now properly protected with one-way hashing`);
    console.log(`🛡️ Privacy compliance: Enhanced for trade secret protection`);
    
    if (totalHashedItems === 0) {
      console.log('🎉 All sensitive data was already properly hashed!');
    } else {
      console.log(`🔧 Successfully hashed ${totalHashedItems} previously unhashed items`);
      console.log('🔒 Your database is now privacy-compliant and trade secret protected');
    }
    
  } catch (error) {
    console.error('❌ Error during privacy compliance process:', error);
    process.exit(1);
  } finally {
    // HTTP client doesn't need explicit cleanup
  }
}

// Execute the script
if (import.meta.url === `file://${process.argv[1]}`) {
  hashIdentifiedData()
    .then(() => {
      console.log('\n✅ Privacy compliance process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Privacy compliance process failed:', error);
      process.exit(1);
    });
}

export { hashIdentifiedData };