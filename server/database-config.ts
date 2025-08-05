/**
 * Database Configuration for PII Correlation Service
 * Supports Redis and PostgreSQL backends
 */

export interface DatabaseConfig {
  type: 'redis' | 'postgresql';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  postgresql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };
}

/**
 * Get database configuration from environment variables
 * Defaults to PostgreSQL for Replit projects
 */
export function getDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.PII_DB_TYPE || 'postgresql') as 'redis' | 'postgresql';
  
  if (dbType === 'redis') {
    return {
      type: 'redis',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.REDIS_RETRY_DELAY_MS || '100')
      }
    };
  } else {
    return {
      type: 'postgresql',
      postgresql: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'pii_correlation',
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: process.env.POSTGRES_SSL === 'true',
        maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10')
      }
    };
  }
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): string[] {
  const errors: string[] = [];
  
  if (config.type === 'redis' && config.redis) {
    if (!config.redis.host) errors.push('Redis host is required');
    if (config.redis.port < 1 || config.redis.port > 65535) errors.push('Redis port must be between 1-65535');
  } else if (config.type === 'postgresql' && config.postgresql) {
    if (!config.postgresql.host) errors.push('PostgreSQL host is required');
    if (!config.postgresql.database) errors.push('PostgreSQL database name is required');
    if (!config.postgresql.username) errors.push('PostgreSQL username is required');
    if (config.postgresql.port < 1 || config.postgresql.port > 65535) errors.push('PostgreSQL port must be between 1-65535');
  } else {
    errors.push('Invalid database configuration');
  }
  
  return errors;
}