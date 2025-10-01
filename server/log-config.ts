/**
 * Logging configuration for development and production
 */

export const LOG_CONFIG = {
  // Enable/disable different log types in development
  development: {
    securityHeaders: false,        // Don't log every security header set
    ipHashing: false,              // Don't log every IP hash
    userAgentHashing: false,       // Don't log every UA hash
    sessionLogging: false,         // Don't log every session
    viteRequests: false,           // Don't log Vite HMR requests
    staticFileRequests: false,     // Don't log static file requests
    authTokenValidation: true,     // Keep auth logs
    apiRequests: true,             // Keep API request logs
    errors: true,                  // Always log errors
    security: true,                // Keep security event logs
  },
  production: {
    securityHeaders: false,
    ipHashing: false,
    userAgentHashing: false,
    sessionLogging: true,
    viteRequests: false,
    staticFileRequests: false,
    authTokenValidation: true,
    apiRequests: true,
    errors: true,
    security: true,
  }
};

export function shouldLog(category: keyof typeof LOG_CONFIG.development): boolean {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  return LOG_CONFIG[env][category];
}

export function isViteRequest(path: string): boolean {
  return path.startsWith('/@vite/') ||
         path.startsWith('/@fs/') ||
         path.startsWith('/node_modules/') ||
         path.startsWith('/src/') ||
         path.includes('.vite/deps/') ||
         path.endsWith('.js') ||
         path.endsWith('.ts') ||
         path.endsWith('.tsx') ||
         path.endsWith('.jsx') ||
         path.endsWith('.css') ||
         path.endsWith('.map');
}

export function isStaticFile(path: string): boolean {
  return path.endsWith('.png') ||
         path.endsWith('.jpg') ||
         path.endsWith('.jpeg') ||
         path.endsWith('.gif') ||
         path.endsWith('.svg') ||
         path.endsWith('.ico') ||
         path.endsWith('.woff') ||
         path.endsWith('.woff2') ||
         path.endsWith('.ttf') ||
         path.endsWith('.eot');
}

export function isApiRequest(path: string): boolean {
  return path.startsWith('/api/');
}
