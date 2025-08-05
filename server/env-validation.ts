/**
 * Environment Variable Validation
 * Validates required environment variables on startup to prevent runtime failures
 */

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  defaultValue?: string;
}

const ENV_VARIABLES: EnvConfig[] = [
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key for document analysis',
    validator: (value) => value.startsWith('sk-') && value.length > 20
  },
  {
    name: 'ADMIN_API_KEY',
    required: true,
    description: 'Admin API key for protected endpoints (required for security)',
    validator: (value) => {
      if (value.length < 32) {
        console.error('SECURITY ERROR: ADMIN_API_KEY must be at least 32 characters for security');
        return false;
      }
      if (value.length > 128) {
        console.error('ADMIN_API_KEY is too long (max 128 characters)');
        return false;
      }
      // Check for common weak patterns
      const weakPatterns = ['admin', 'password', '123456', 'test', 'demo', 'default'];
      const lowerValue = value.toLowerCase();
      if (weakPatterns.some(pattern => lowerValue.includes(pattern))) {
        console.error('SECURITY ERROR: ADMIN_API_KEY contains weak patterns. Use a strong, random key.');
        return false;
      }
      return true;
    }
  },
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'JWT secret for token signing (required for authentication security)',
    validator: (value) => {
      if (value.length < 32) {
        console.error('SECURITY ERROR: JWT_SECRET must be at least 32 characters for security');
        return false;
      }
      // Check for common weak patterns
      const weakPatterns = ['secret', 'password', '123456', 'test', 'demo', 'default', 'jwt'];
      const lowerValue = value.toLowerCase();
      if (weakPatterns.some(pattern => lowerValue.includes(pattern))) {
        console.error('SECURITY ERROR: JWT_SECRET contains weak patterns. Use a strong, random secret.');
        return false;
      }
      return true;
    }
  },
  {
    name: 'TOKEN_ENCRYPTION_KEY',
    required: true,
    description: 'Encryption key for subscription tokens (required for security)',
    validator: (value) => {
      if (value.length < 32) {
        console.error('SECURITY ERROR: TOKEN_ENCRYPTION_KEY must be at least 32 characters for security');
        return false;
      }
      if (value.length > 256) {
        console.error('TOKEN_ENCRYPTION_KEY is too long (max 256 characters)');
        return false;
      }
      return true;
    }
  },
  {
    name: 'PASSWORD_PEPPER',
    required: true,
    description: 'Pepper for password hashing (required for enhanced security)',
    validator: (value) => {
      if (value.length < 32) {
        console.error('SECURITY ERROR: PASSWORD_PEPPER must be at least 32 characters for security');
        return false;
      }
      if (value.length > 256) {
        console.error('PASSWORD_PEPPER is too long (max 256 characters)');
        return false;
      }
      return true;
    }
  },
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    description: 'Comma-separated list of allowed CORS origins',
    defaultValue: 'http://localhost:5173,http://localhost:3000,http://localhost:5000'
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Node environment (development, staging, production)',
    validator: (value) => ['development', 'staging', 'production', 'test'].includes(value)
  },
  {
    name: 'SESSION_ENCRYPTION_KEY',
    required: false,
    description: 'Optional encryption key for session data at rest (enhances security)',
    validator: (value) => value.length >= 32 && value.length <= 256
  },
  {
    name: 'SECURITY_WEBHOOK_URL',
    required: false,
    description: 'Optional webhook URL for security alerts (for external monitoring)',
    validator: (value) => value.startsWith('http://') || value.startsWith('https://')
  },
  {
    name: 'REPLIT_DB_URL',
    required: false,
    description: 'Replit KV database URL for consent logging (auto-provided in development)',
    validator: (value) => value.includes('kv.replit.com') || value.includes('repldb.com')
  }
];

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string>;
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, string> = {};
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  const isStaging = !isProduction && !isDevelopment;

  if (!isProduction) {
    console.log('🔍 Validating environment variables...');
  }

  for (const envVar of ENV_VARIABLES) {
    const value = process.env[envVar.name];

    if (!value) {
      if (envVar.required) {
        errors.push(`❌ Required environment variable ${envVar.name} is not set`);
        errors.push(`   Description: ${envVar.description}`);
      } else {
        if (envVar.defaultValue) {
          config[envVar.name] = envVar.defaultValue;
          warnings.push(`⚠️  ${envVar.name} not set, using default: ${envVar.defaultValue}`);
        } else {
          warnings.push(`⚠️  Optional ${envVar.name} not set - ${envVar.description}`);
        }
      }
      continue;
    }

    // Validate the value if a validator is provided
    if (envVar.validator && !envVar.validator(value)) {
      errors.push(`❌ Invalid value for ${envVar.name}`);
      errors.push(`   Description: ${envVar.description}`);
      errors.push(`   Current value format is invalid`);
      continue;
    }

    config[envVar.name] = value;
    
    // Only log environment variables in development mode
    if (!isProduction) {
      console.log(`✅ ${envVar.name}: ${envVar.name === 'OPENAI_API_KEY' ? 'sk-***' : value.length > 50 ? value.substring(0, 50) + '...' : value}`);
    }
  }

  // Special validation for production and staging environments
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOWED_ORIGINS?.includes('localhost')) {
      warnings.push('⚠️  ALLOWED_ORIGINS includes localhost in production environment');
    }
  }
  
  if (isStaging) {
    console.log('🚧 Running in staging environment');
    if (process.env.ALLOWED_ORIGINS?.includes('localhost')) {
      warnings.push('⚠️  ALLOWED_ORIGINS includes localhost in staging environment');
    }
  }

  // Stripe (Optional - for donations)
  const stripePublicKey = process.env.VITE_STRIPE_PUBLIC_KEY;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeTestPublicKey = process.env.VITE_STRIPE_TEST_PUBLIC_KEY;
  const stripeTestSecretKey = process.env.STRIPE_TEST_SECRET_KEY;

  if (stripePublicKey && stripeSecretKey) {
    // Only log Stripe keys in development mode
    if (!isProduction) {
      console.log('✅ STRIPE_PUBLIC_KEY:', stripePublicKey.substring(0, 20) + '...');
      console.log('✅ STRIPE_SECRET_KEY:', stripeSecretKey.substring(0, 10) + '...');

      if (stripeTestPublicKey && stripeTestSecretKey) {
        console.log('✅ STRIPE_TEST_PUBLIC_KEY:', stripeTestPublicKey.substring(0, 20) + '...');
        console.log('✅ STRIPE_TEST_SECRET_KEY:', stripeTestSecretKey.substring(0, 10) + '...');
        console.log('🔄 Concurrent test/live payment processing enabled');
      } else {
        warnings.push('⚠️  Optional Stripe test keys not set - Only live payments will be processed');
      }
    } else {
      // In production, just check if concurrent processing is enabled
      if (stripeTestPublicKey && stripeTestSecretKey) {
        console.log('🔄 Concurrent test/live payment processing enabled');
      }
    }
  } else {
    if (!isProduction) {
      warnings.push('⚠️  Optional Stripe keys not set - Donation functionality will be disabled');
    }
  }

  const success = errors.length === 0;

  if (!isProduction && warnings.length > 0) {
    console.log('\n📋 Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }

  if (success) {
    if (!isProduction) {
      console.log('✅ Environment validation passed');
      if (warnings.length > 0) {
        console.log(`   (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`);
      }
    }
  } else {
    console.log('\n❌ Environment validation failed:');
    errors.forEach(error => console.log(`   ${error}`));
  }

  return {
    success,
    errors,
    warnings,
    config
  };
}

export function validateEnvironmentOrExit(): Record<string, string> {
  const result = validateEnvironment();

  if (!result.success) {
    console.log('\n🚨 Application cannot start due to environment validation errors.');
    console.log('\nTo fix these issues:');
    console.log('1. Set the required environment variables');
    console.log('2. Check your deployment configuration');
    console.log('3. Ensure all API keys are valid and accessible');
    console.log('\nFor development, you can create a .env file (not committed to git):');
    console.log('   OPENAI_API_KEY=your-openai-api-key-here');
    console.log('   ADMIN_API_KEY=your-secure-admin-key-here  # Required (16+ chars)');
    console.log('\nFor production, set these environment variables in your deployment platform.');

    process.exit(1);
  }

  return result.config;
}

/**
 * Security-focused environment variable logging
 * Logs environment status without exposing sensitive values
 */
export function logEnvironmentStatus(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAdmin = !!process.env.ADMIN_API_KEY;
  const allowedOrigins = process.env.ALLOWED_ORIGINS || 'default';

  console.log('\n🔧 Environment Configuration:');
  console.log(`   Environment: ${nodeEnv}`);
  console.log(`   OpenAI API: ${hasOpenAI ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Admin Auth: ${hasAdmin ? '✅ Configured' : '⚠️  Not configured'}`);
  console.log(`   CORS Origins: ${allowedOrigins.length > 80 ? allowedOrigins.substring(0, 80) + '...' : allowedOrigins}`);
  console.log('');
}

/**
 * Validate a single environment variable
 */
export function validateEnvVar(name: string, required: boolean = true): string | null {
  const value = process.env[name];

  if (!value && required) {
    throw new Error(`Required environment variable ${name} is not set`);
  }

  return value || null;
}

/**
 * Get sanitized environment info for logging (without sensitive values)
 */
export function getEnvironmentInfo(): Record<string, any> {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAdminKey: !!process.env.ADMIN_API_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS ?
      process.env.ALLOWED_ORIGINS.split(',').length : 0,
    port: process.env.PORT || 5000
  };
}