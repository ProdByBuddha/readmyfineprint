
/**
 * ReadMyFinePrint Proprietary Cryptographic Hashing System
 * 
 * Copyright (c) 2025. All Rights Reserved.
 * 
 * CONFIDENTIAL AND PROPRIETARY
 * This file contains proprietary cryptographic algorithms and methodologies.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 * 
 * Commercial licensing available. Contact for terms.
 */

import argon2 from 'argon2';

/**
 * Debug logging control for Argon2 hashing operations
 * Set ARGON2_DEBUG=true in environment to enable verbose hashing logs
 */
const ARGON2_DEBUG = process.env.ARGON2_DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string): void {
  if (ARGON2_DEBUG) {
    console.log(message);
  }
}

/**
 * Argon2id Password Hashing Configuration
 * 
 * Argon2id is the recommended variant as it provides both:
 * - Side-channel resistance (from Argon2i)
 * - Time-memory trade-off resistance (from Argon2d)
 */
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 1,      // 1 thread
  saltLength: 32,      // 32 bytes salt
};

/**
 * Hash a password using Argon2id with salt and pepper
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Add pepper from environment variable for additional security
    const pepper = process.env.PASSWORD_PEPPER || '';
    const passwordWithPepper = password + pepper;

    // Hash with Argon2id
    const hash = await argon2.hash(passwordWithPepper, ARGON2_CONFIG);
    
    debugLog('🔐 Password hashed with Argon2id');
    return hash;
  } catch (error) {
    console.error('❌ Password hashing failed:', error);
    throw new Error('Password hashing failed');
  }
}

/**
 * Verify a password against an Argon2id hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Add pepper from environment variable
    const pepper = process.env.PASSWORD_PEPPER || '';
    const passwordWithPepper = password + pepper;

    // Verify with Argon2
    const isValid = await argon2.verify(hash, passwordWithPepper);
    
    if (isValid) {
      console.log('✅ Password verification successful');
    } else {
      console.log('❌ Password verification failed');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Password verification error:', error);
    return false;
  }
}

/**
 * Check if a hash needs rehashing (for security upgrades)
 */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, ARGON2_CONFIG);
  } catch (error) {
    console.error('❌ Error checking if hash needs rehash:', error);
    return false;
  }
}

/**
 * Verify legacy bcrypt password (for migration purposes)
 */
export async function verifyLegacyPassword(password: string, hash: string): Promise<boolean> {
  // Check if it's a bcrypt hash
  if (hash.startsWith('$2b$') || hash.startsWith('$2a$') || hash.startsWith('$2y$')) {
    try {
      const bcrypt = await import('bcrypt');
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Legacy bcrypt verification failed:', error);
      return false;
    }
  }
  
  // Not a bcrypt hash
  return false;
}

/**
 * Hash an email address using Argon2id for secure pseudonymization
 * This creates a one-way hash of the email that cannot be reversed
 * Uses a deterministic salt based on the email for consistent hashing
 */
export async function hashEmail(email: string): Promise<string> {
  try {
    // Normalize email to lowercase to ensure consistent hashing
    const normalizedEmail = email.toLowerCase().trim();
    
    // Add email-specific pepper from environment variable for additional security
    const emailPepper = process.env.EMAIL_PEPPER || process.env.PASSWORD_PEPPER || '';
    const emailWithPepper = normalizedEmail + emailPepper;

    // Create a deterministic salt from the email itself for consistency
    // Use SHA-256 to create a 32-byte salt from the email
    const crypto = await import('crypto');
    const emailSalt = crypto.createHash('sha256').update(normalizedEmail + 'email_salt_pepper').digest();

    // Use lighter settings for email hashing since it's for pseudonymization, not authentication
    const emailHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 12, // 4 MB (lighter than password hashing)
      timeCost: 2,         // 2 iterations
      parallelism: 1,      // 1 thread
      salt: emailSalt,     // Use deterministic salt for consistent results
    };

    // Hash with Argon2id
    const hash = await argon2.hash(emailWithPepper, emailHashConfig);
    
    debugLog('🔐 Email hashed with Argon2id for pseudonymization');
    return hash;
  } catch (error) {
    console.error('❌ Email hashing failed:', error);
    throw new Error('Email hashing failed');
  }
}

/**
 * Create a pseudonymized email using Argon2 hash
 * Format: hash@subscription.internalusers.email
 */
export async function createPseudonymizedEmail(originalEmail: string): Promise<string> {
  try {
    const hash = await hashEmail(originalEmail);
    
    // Extract just the hash part (remove the Argon2 metadata)
    // Argon2 format: $argon2id$v=19$m=4096,t=2,p=1$salt$hash
    const hashParts = hash.split('$');
    const actualHash = hashParts[hashParts.length - 1]; // Get the last part which is the actual hash
    
    // Create a clean, shorter identifier from the hash
    const cleanHash = actualHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    
    // Create pseudonymized email
    const pseudonymizedEmail = `${cleanHash}@subscription.internalusers.email`;
    
    debugLog(`📧 Created pseudonymized email: ${pseudonymizedEmail}`);
    return pseudonymizedEmail;
  } catch (error) {
    console.error('❌ Failed to create pseudonymized email:', error);
    throw new Error('Failed to create pseudonymized email');
  }
}

/**
 * Verify if an original email matches a pseudonymized email
 * Used for login verification with hashed emails
 */
export async function verifyEmailMatch(originalEmail: string, pseudonymizedEmail: string): Promise<boolean> {
  try {
    // Extract the hash from the pseudonymized email
    const hashFromEmail = pseudonymizedEmail.split('@')[0];
    
    // Generate hash from original email
    const originalHash = await hashEmail(originalEmail);
    const hashParts = originalHash.split('$');
    const actualHash = hashParts[hashParts.length - 1];
    const cleanHash = actualHash.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    
    // Compare the hashes
    const matches = hashFromEmail === cleanHash;
    
    if (matches) {
      console.log('✅ Email hash verification successful');
    } else {
      console.log('❌ Email hash verification failed');
    }
    
    return matches;
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return false;
  }
}

/**
 * Hash IP address using Argon2id for privacy protection
 * Uses deterministic salting for consistency while maintaining privacy
 */
export async function hashIpAddress(ip: string): Promise<string> {
  try {
    // Normalize IP address (remove extra spaces, convert to lowercase)
    const normalizedIp = ip.toLowerCase().trim();
    
    // Add IP-specific pepper from environment variable for additional security
    const ipPepper = process.env.IP_PEPPER || process.env.PASSWORD_PEPPER || '';
    const ipWithPepper = normalizedIp + ipPepper;

    // Create a deterministic salt from the IP itself for consistency
    const crypto = await import('crypto');
    const ipSalt = crypto.createHash('sha256').update(normalizedIp + 'ip_salt_pepper').digest();

    // Use lighter settings for IP hashing since it's for privacy protection, not authentication
    const ipHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 11, // 2 MB (lighter than email hashing)
      timeCost: 2,         // 2 iterations
      parallelism: 1,      // 1 thread
      salt: ipSalt,        // Use deterministic salt for consistent results
    };

    // Hash with Argon2id
    const hash = await argon2.hash(ipWithPepper, ipHashConfig);
    
    debugLog('🔐 IP address hashed with Argon2id for privacy protection');
    return hash;
  } catch (error) {
    console.error('❌ IP address hashing failed:', error);
    throw new Error('IP address hashing failed');
  }
}

/**
 * Hash user agent using Argon2id for privacy protection
 * Uses deterministic salting for consistency while maintaining privacy
 */
export async function hashUserAgent(userAgent: string): Promise<string> {
  try {
    // Normalize user agent (trim and limit length to prevent DoS)
    const normalizedUserAgent = userAgent.trim().substring(0, 1000);
    
    // Add user agent-specific pepper from environment variable for additional security
    const uaPepper = process.env.UA_PEPPER || process.env.PASSWORD_PEPPER || '';
    const uaWithPepper = normalizedUserAgent + uaPepper;

    // Create a deterministic salt from the user agent itself for consistency
    const crypto = await import('crypto');
    const uaSalt = crypto.createHash('sha256').update(normalizedUserAgent + 'ua_salt_pepper').digest();

    // Use lighter settings for user agent hashing since it's for privacy protection, not authentication
    const uaHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 11, // 2 MB (lighter than email hashing)
      timeCost: 2,         // 2 iterations
      parallelism: 1,      // 1 thread
      salt: uaSalt,        // Use deterministic salt for consistent results
    };

    // Hash with Argon2id
    const hash = await argon2.hash(uaWithPepper, uaHashConfig);
    
    debugLog('🔐 User agent hashed with Argon2id for privacy protection');
    return hash;
  } catch (error) {
    console.error('❌ User agent hashing failed:', error);
    throw new Error('User agent hashing failed');
  }
}

/**
 * Hash device fingerprint using Argon2id for privacy protection
 * Uses deterministic salting for consistency while maintaining privacy
 */
export async function hashDeviceFingerprint(fingerprint: string): Promise<string> {
  try {
    // Normalize device fingerprint (trim and limit length)
    const normalizedFingerprint = fingerprint.trim().substring(0, 500);
    
    // Add fingerprint-specific pepper from environment variable for additional security
    const fpPepper = process.env.FP_PEPPER || process.env.PASSWORD_PEPPER || '';
    const fpWithPepper = normalizedFingerprint + fpPepper;

    // Create a deterministic salt from the fingerprint itself for consistency
    const crypto = await import('crypto');
    const fpSalt = crypto.createHash('sha256').update(normalizedFingerprint + 'fp_salt_pepper').digest();

    // Use lighter settings for fingerprint hashing since it's for privacy protection, not authentication
    const fpHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 11, // 2 MB (lighter than email hashing)
      timeCost: 2,         // 2 iterations
      parallelism: 1,      // 1 thread
      salt: fpSalt,        // Use deterministic salt for consistent results
    };

    // Hash with Argon2id
    const hash = await argon2.hash(fpWithPepper, fpHashConfig);
    
    debugLog('🔐 Device fingerprint hashed with Argon2id for privacy protection');
    return hash;
  } catch (error) {
    console.error('❌ Device fingerprint hashing failed:', error);
    throw new Error('Device fingerprint hashing failed');
  }
}


/**
 * Verify if an original value matches a hashed value
 * Generic function for verifying any Argon2 hash
 */
export async function verifyHashedValue(originalValue: string, hashedValue: string): Promise<boolean> {
  try {
    // Normalize the original value the same way it would be normalized during hashing
    const normalizedValue = originalValue.toLowerCase().trim();
    
    // Add appropriate pepper (this is a simplified approach - in practice you'd need to know which pepper was used)
    const pepper = process.env.PASSWORD_PEPPER || '';
    const valueWithPepper = normalizedValue + pepper;
    
    // Verify with Argon2
    const isValid = await argon2.verify(hashedValue, valueWithPepper);
    
    if (isValid) {
      console.log('✅ Hash verification successful');
    } else {
      console.log('❌ Hash verification failed');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Hash verification error:', error);
    return false;
  }
}

/**
 * PII-Specific Argon2 Hashing Functions for Document Analysis
 * These functions create deterministic hashes for different types of PII
 * to enable secure entanglement across document sessions and systems
 */

/**
 * Hash Social Security Numbers using Argon2id for secure entanglement
 */
export async function hashSSN(ssn: string): Promise<string> {
  try {
    // Normalize SSN (remove dashes, spaces, ensure 9 digits)
    const normalizedSSN = ssn.replace(/[-\s]/g, '').trim();
    
    // Validate SSN format
    if (!/^\d{9}$/.test(normalizedSSN)) {
      throw new Error('Invalid SSN format');
    }
    
    const ssnPepper = process.env.SSN_PEPPER || process.env.PASSWORD_PEPPER || '';
    const ssnWithPepper = normalizedSSN + ssnPepper;

    // Create deterministic salt for consistent hashing across sessions
    const crypto = await import('crypto');
    const ssnSalt = crypto.createHash('sha256').update(normalizedSSN + 'ssn_entanglement_salt').digest();

    const ssnHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 13, // 8 MB (stronger for sensitive PII)
      timeCost: 3,         // 3 iterations (stronger for sensitive PII)
      parallelism: 1,
      salt: ssnSalt,
    };

    const hash = await argon2.hash(ssnWithPepper, ssnHashConfig);
    debugLog('🔐 SSN hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ SSN hashing failed:', error);
    throw new Error('SSN hashing failed');
  }
}

/**
 * Hash phone numbers using Argon2id for secure entanglement
 */
export async function hashPhoneNumber(phone: string): Promise<string> {
  try {
    // Normalize phone number (remove all non-digits, then format)
    const digits = phone.replace(/\D/g, '');
    
    // Handle different phone number formats and normalize to 10 digits for US numbers
    let normalizedPhone = digits;
    if (digits.length === 11 && digits.startsWith('1')) {
      normalizedPhone = digits.substring(1); // Remove country code for US numbers
    } else if (digits.length === 10) {
      normalizedPhone = digits;
    }
    
    const phonePepper = process.env.PHONE_PEPPER || process.env.PASSWORD_PEPPER || '';
    const phoneWithPepper = normalizedPhone + phonePepper;

    const crypto = await import('crypto');
    const phoneSalt = crypto.createHash('sha256').update(normalizedPhone + 'phone_entanglement_salt').digest();

    const phoneHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 12, // 4 MB
      timeCost: 2,
      parallelism: 1,
      salt: phoneSalt,
    };

    const hash = await argon2.hash(phoneWithPepper, phoneHashConfig);
    debugLog('🔐 Phone number hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ Phone number hashing failed:', error);
    throw new Error('Phone number hashing failed');
  }
}

/**
 * Hash credit card numbers using Argon2id for secure entanglement
 */
export async function hashCreditCard(cardNumber: string): Promise<string> {
  try {
    // Normalize credit card (remove spaces, dashes)
    const normalizedCard = cardNumber.replace(/[\s-]/g, '').trim();
    
    // Basic validation (should be 13-19 digits)
    if (!/^\d{13,19}$/.test(normalizedCard)) {
      throw new Error('Invalid credit card format');
    }
    
    const cardPepper = process.env.CARD_PEPPER || process.env.PASSWORD_PEPPER || '';
    const cardWithPepper = normalizedCard + cardPepper;

    const crypto = await import('crypto');
    const cardSalt = crypto.createHash('sha256').update(normalizedCard + 'card_entanglement_salt').digest();

    const cardHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 14, // 16 MB (highest security for financial data)
      timeCost: 4,         // 4 iterations (highest security for financial data)
      parallelism: 1,
      salt: cardSalt,
    };

    const hash = await argon2.hash(cardWithPepper, cardHashConfig);
    debugLog('🔐 Credit card hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ Credit card hashing failed:', error);
    throw new Error('Credit card hashing failed');
  }
}

/**
 * Hash personal names using Argon2id for secure entanglement
 */
export async function hashPersonalName(name: string): Promise<string> {
  try {
    // Normalize name (trim, convert to lowercase, remove extra spaces)
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    
    const namePepper = process.env.NAME_PEPPER || process.env.PASSWORD_PEPPER || '';
    const nameWithPepper = normalizedName + namePepper;

    const crypto = await import('crypto');
    const nameSalt = crypto.createHash('sha256').update(normalizedName + 'name_entanglement_salt').digest();

    const nameHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 11, // 2 MB (lighter for names)
      timeCost: 2,
      parallelism: 1,
      salt: nameSalt,
    };

    const hash = await argon2.hash(nameWithPepper, nameHashConfig);
    debugLog('🔐 Personal name hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ Personal name hashing failed:', error);
    throw new Error('Personal name hashing failed');
  }
}

/**
 * Hash addresses using Argon2id for secure entanglement
 */
export async function hashAddress(address: string): Promise<string> {
  try {
    // Normalize address (trim, lowercase, standardize spacing)
    const normalizedAddress = address.trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'ave')
      .replace(/\broad\b/g, 'rd')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\bdrive\b/g, 'dr')
      .replace(/\blane\b/g, 'ln')
      .replace(/\bcourt\b/g, 'ct');
    
    const addressPepper = process.env.ADDRESS_PEPPER || process.env.PASSWORD_PEPPER || '';
    const addressWithPepper = normalizedAddress + addressPepper;

    const crypto = await import('crypto');
    const addressSalt = crypto.createHash('sha256').update(normalizedAddress + 'address_entanglement_salt').digest();

    const addressHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 12, // 4 MB
      timeCost: 2,
      parallelism: 1,
      salt: addressSalt,
    };

    const hash = await argon2.hash(addressWithPepper, addressHashConfig);
    debugLog('🔐 Address hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ Address hashing failed:', error);
    throw new Error('Address hashing failed');
  }
}

/**
 * Hash dates of birth using Argon2id for secure entanglement
 */
export async function hashDateOfBirth(dob: string): Promise<string> {
  try {
    // Normalize date formats to YYYY-MM-DD
    let normalizedDOB = dob.trim();
    
    // Handle various date formats
    const dateFormats = [
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/, // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/, // YYYY/MM/DD or YYYY-MM-DD
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/   // MM/DD/YY or MM-DD-YY
    ];
    
    for (const format of dateFormats) {
      const match = normalizedDOB.match(format);
      if (match) {
        if (format === dateFormats[0]) { // MM/DD/YYYY
          const [, month, day, year] = match;
          normalizedDOB = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (format === dateFormats[1]) { // YYYY/MM/DD
          const [, year, month, day] = match;
          normalizedDOB = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (format === dateFormats[2]) { // MM/DD/YY
          const [, month, day, year] = match;
          const fullYear = parseInt(year) + (parseInt(year) > 50 ? 1900 : 2000);
          normalizedDOB = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        break;
      }
    }
    
    const dobPepper = process.env.DOB_PEPPER || process.env.PASSWORD_PEPPER || '';
    const dobWithPepper = normalizedDOB + dobPepper;

    const crypto = await import('crypto');
    const dobSalt = crypto.createHash('sha256').update(normalizedDOB + 'dob_entanglement_salt').digest();

    const dobHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 13, // 8 MB (stronger for sensitive PII)
      timeCost: 3,         // 3 iterations (stronger for sensitive PII)
      parallelism: 1,
      salt: dobSalt,
    };

    const hash = await argon2.hash(dobWithPepper, dobHashConfig);
    debugLog('🔐 Date of birth hashed with Argon2id for secure entanglement');
    return hash;
  } catch (error) {
    console.error('❌ Date of birth hashing failed:', error);
    throw new Error('Date of birth hashing failed');
  }
}

/**
 * Hash custom PII using Argon2id for secure entanglement
 */
export async function hashCustomPII(data: string, dataType: string): Promise<string> {
  try {
    // Normalize data
    const normalizedData = data.trim().toLowerCase();
    
    const customPepper = process.env.CUSTOM_PII_PEPPER || process.env.PASSWORD_PEPPER || '';
    const dataWithPepper = normalizedData + customPepper + dataType;

    const crypto = await import('crypto');
    const customSalt = crypto.createHash('sha256').update(normalizedData + dataType + 'custom_entanglement_salt').digest();

    const customHashConfig = {
      type: argon2.argon2id,
      memoryCost: 2 ** 12, // 4 MB
      timeCost: 2,
      parallelism: 1,
      salt: customSalt,
    };

    const hash = await argon2.hash(dataWithPepper, customHashConfig);
    debugLog(`🔐 Custom PII (${dataType}) hashed with Argon2id for secure entanglement`);
    return hash;
  } catch (error) {
    console.error(`❌ Custom PII (${dataType}) hashing failed:`, error);
    throw new Error(`Custom PII (${dataType}) hashing failed`);
  }
}
