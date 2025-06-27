#!/usr/bin/env tsx

/**
 * Simplified Database Privacy Scan Script
 * 
 * This script scans the database to identify unhashed sensitive data
 * WITHOUT making any changes. Use this to audit what needs to be hashed.
 * 
 * Usage:
 * npx tsx scripts/scan-unhashed-data-simple.ts
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, sql, like, and, isNull, isNotNull } from 'drizzle-orm';
import { users } from '../shared/schema';

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
 * Check what tables exist in the database
 */
async function checkTablesExist() {
  console.log('🔍 Checking database structure...\n');
  
  try {
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:');
    const tableNames = tablesResult.rows.map((row: any) => row.table_name);
    tableNames.forEach((name: string) => {
      console.log(`   📊 ${name}`);
    });
    console.log('');
    
    return tableNames;
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    return [];
  }
}

/**
 * Main scan function
 */
async function scanUnhashedData() {
  console.log('🔍 Starting Database Privacy Audit (Read-Only)...\n');
  
  let totalIssuesFound = 0;
  const issues: string[] = [];
  
  try {
    // Check what tables exist
    const existingTables = await checkTablesExist();
    
    // 1. Check for unhashed passwords (users table should always exist)
    console.log('1️⃣ Scanning user passwords...');
    try {
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
    } catch (error: any) {
      console.log(`   ❌ Error scanning users table: ${error.message}\n`);
    }
    
    // 2. Generic table scan for potential sensitive data
    console.log('2️⃣ Scanning for potential sensitive columns...');
    
    const sensitiveColumns = await db.execute(
      sql`SELECT table_name, column_name, data_type
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND (
            column_name LIKE '%password%' 
            OR column_name LIKE '%hash%'
            OR column_name LIKE '%ip%'
            OR column_name LIKE '%agent%'
            OR column_name LIKE '%answer%'
            OR column_name LIKE '%client_ip%'
            OR column_name LIKE '%user_agent%'
          )
          ORDER BY table_name, column_name`
    );
    
    console.log('   📊 Sensitive columns found:');
    for (const col of sensitiveColumns.rows as any[]) {
      console.log(`   📋 ${col.table_name}.${col.column_name} (${col.data_type})`);
    }
    console.log('');
    
    // 3. Sample data check for known patterns
    console.log('3️⃣ Sample data analysis...');
    
    // Check if there are any obvious IP addresses or emails in text fields
    for (const table of existingTables) {
      if (table === 'users') continue; // Already checked
      
      try {
        // Get first few rows to check for patterns
        const sampleResult = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT 3`));
        
        if (sampleResult.rows.length > 0) {
          console.log(`   📊 Sample data from ${table}: ${sampleResult.rows.length} rows`);
          
          // Check for potential IP addresses or sensitive data patterns
          for (const row of sampleResult.rows as any[]) {
            for (const [key, value] of Object.entries(row)) {
              if (typeof value === 'string') {
                if (isUnhashedIP(value)) {
                  console.log(`   ⚠️ POTENTIAL UNHASHED IP in ${table}.${key}: ${maskSensitiveData(value)}`);
                  issues.push(`Potential unhashed IP in ${table}.${key}`);
                  totalIssuesFound++;
                } else if (value.includes('@') && value.includes('.') && !value.startsWith('$')) {
                  console.log(`   ⚠️ POTENTIAL UNHASHED EMAIL in ${table}.${key}: ${maskSensitiveData(value)}`);
                  issues.push(`Potential unhashed email in ${table}.${key}`);
                  totalIssuesFound++;
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.log(`   ⚠️ Could not scan ${table}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 PRIVACY AUDIT SUMMARY:');
    console.log('=========================');
    console.log(`⚠️ Total privacy issues found: ${totalIssuesFound}`);
    console.log(`📋 Sensitive columns in schema: ${sensitiveColumns.rows.length}`);
    console.log(`📊 Tables scanned: ${existingTables.length}`);
    
    if (totalIssuesFound > 0) {
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      console.log('======================');
      console.log('Review and hash the following data:');
      console.log('\n⚠️ PRIVACY ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    } else {
      console.log('🎉 No obvious privacy issues found in the basic scan!');
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