/**
 * Security Configuration Module
 * Centralized security settings and path blocking
 */

export const BLOCKED_PATHS = [
  // Environment files
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/.env.test',
  
  // Configuration files
  '/config/',
  '/package.json',
  '/package-lock.json',
  '/yarn.lock',
  '/pnpm-lock.yaml',
  '/tsconfig.json',
  '/vite.config.ts',
  '/tailwind.config.ts',
  '/drizzle.config.ts',
  '/postcss.config.js',
  
  // Source code directories
  '/server/',
  '/scripts/',
  '/src/',
  '/client/',
  '/shared/',
  
  // Development directories
  '/node_modules/',
  '/.git/',
  '/.github/',
  '/.vscode/',
  '/dist/',
  
  // Backup and temporary files
  '/.bak',
  '/.tmp',
  '/.temp',
  '/backup/',
  
  // Database files
  '/database.db',
  '/db.sqlite',
  '/.db',
];

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' https://js.stripe.com; img-src 'self' data: https://img.shields.io https://js.stripe.com; connect-src 'self' https://api.stripe.com https://api.openai.com; frame-src https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * Check if a path should be blocked for security reasons
 */
export function isBlockedPath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  
  return BLOCKED_PATHS.some(blocked => 
    normalizedPath.startsWith(blocked) || 
    normalizedPath === blocked.slice(0, -1)
  );
}

/**
 * Sanitize input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  API_GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },
  DOCUMENT_PROCESSING: {
    windowMs: 60 * 1000, // 1 minute
    max: 10 // requests per window
  },
  PAYMENT_PROCESSING: {
    windowMs: 60 * 1000, // 1 minute
    max: 5 // requests per window
  }
};