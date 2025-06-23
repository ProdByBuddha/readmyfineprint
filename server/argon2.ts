
import argon2 from 'argon2';

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
    
    console.log('🔐 Password hashed with Argon2id');
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
