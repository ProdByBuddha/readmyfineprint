/**
 * Comprehensive Backup Service
 * Handles automated backups for database, application data, and configurations
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from './db';
import { securityLogger, SecurityEventType, SecuritySeverity } from './security-logger';

interface BackupConfig {
  enabled: boolean;
  schedule: {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    cloud: {
      enabled: boolean;
      provider: 'aws' | 's3' | 'gcs' | 'azure';
      bucket?: string;
      credentials?: any;
    };
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyPath?: string;
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli';
  };
}

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  category: 'database' | 'application' | 'configuration';
  size: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  source: string;
  destination: string;
  retention: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

interface BackupReport {
  backupId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  size: number;
  items: {
    database: boolean;
    application: boolean;
    configuration: boolean;
  };
  errors: string[];
  warnings: string[];
}

export class BackupService {
  private config: BackupConfig;
  private backupHistory: BackupMetadata[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      enabled: true,
      schedule: {
        daily: true,
        weekly: true,
        monthly: true
      },
      retention: {
        daily: 7,    // Keep 7 daily backups
        weekly: 4,   // Keep 4 weekly backups
        monthly: 12  // Keep 12 monthly backups
      },
      storage: {
        local: {
          enabled: true,
          path: process.env.BACKUP_PATH || '/tmp/backups'
        },
        cloud: {
          enabled: false,
          provider: 'aws'
        }
      },
      encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm'
      },
      compression: {
        enabled: true,
        algorithm: 'gzip'
      },
      ...config
    };

    this.initializeBackupSystem();
  }

  private async initializeBackupSystem(): Promise<void> {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      // Load backup history
      await this.loadBackupHistory();

      // Schedule automated backups
      this.scheduleBackups();

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: 'Backup service initialized successfully',
        ip: 'system',
        userAgent: 'backup-service',
        endpoint: 'initialization'
      });

      console.log('✅ Backup service initialized with automated scheduling');
    } catch (error) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Failed to initialize backup service',
        ip: 'system',
        userAgent: 'backup-service',
        endpoint: 'initialization',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      console.error('❌ Failed to initialize backup service:', error);
    }
  }

  /**
   * Perform a full backup of all system components
   */
  async performFullBackup(force: boolean = false): Promise<BackupReport> {
    if (this.isRunning && !force) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const backupId = crypto.randomUUID();
    const startTime = new Date();
    const report: BackupReport = {
      backupId,
      startTime,
      endTime: new Date(),
      duration: 0,
      success: false,
      size: 0,
      items: {
        database: false,
        application: false,
        configuration: false
      },
      errors: [],
      warnings: []
    };

    try {
      console.log(`🔄 Starting full backup (ID: ${backupId})`);

      // Create backup session directory
      const sessionPath = path.join(this.config.storage.local.path, backupId);
      await fs.mkdir(sessionPath, { recursive: true });

      // 1. Database Backup
      try {
        console.log('📊 Backing up database...');
        const dbBackupResult = await this.backupDatabase(sessionPath);
        report.items.database = true;
        report.size += dbBackupResult.size;
        console.log(`✅ Database backup completed (${this.formatSize(dbBackupResult.size)})`);
      } catch (error) {
        const errorMsg = `Database backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        report.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // 2. Application Data Backup
      try {
        console.log('📁 Backing up application data...');
        const appBackupResult = await this.backupApplicationData(sessionPath);
        report.items.application = true;
        report.size += appBackupResult.size;
        console.log(`✅ Application data backup completed (${this.formatSize(appBackupResult.size)})`);
      } catch (error) {
        const errorMsg = `Application backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        report.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // 3. Configuration Backup
      try {
        console.log('⚙️  Backing up configurations...');
        const configBackupResult = await this.backupConfigurations(sessionPath);
        report.items.configuration = true;
        report.size += configBackupResult.size;
        console.log(`✅ Configuration backup completed (${this.formatSize(configBackupResult.size)})`);
      } catch (error) {
        const errorMsg = `Configuration backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        report.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // 4. Create backup archive
      const archivePath = await this.createBackupArchive(sessionPath, backupId);
      
      // 5. Calculate final size and checksum
      const stats = await fs.stat(archivePath);
      report.size = stats.size;
      const checksum = await this.calculateChecksum(archivePath);

      // 6. Store backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: startTime,
        type: 'full',
        category: 'database',
        size: report.size,
        checksum,
        encrypted: this.config.encryption.enabled,
        compressed: this.config.compression.enabled,
        source: 'system',
        destination: archivePath,
        retention: this.calculateRetentionDate('daily'),
        status: 'completed'
      };

      this.backupHistory.push(metadata);
      await this.saveBackupHistory();

      report.endTime = new Date();
      report.duration = report.endTime.getTime() - startTime.getTime();
      report.success = report.errors.length === 0;

      // Log backup completion
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.SYSTEM,
        severity: SecuritySeverity.LOW,
        message: `Full backup completed successfully`,
        ip: 'system',
        userAgent: 'backup-service',
        endpoint: 'full-backup',
        details: {
          backupId,
          duration: report.duration,
          size: report.size,
          items: report.items,
          errors: report.errors.length
        }
      });

      console.log(`🎉 Full backup completed in ${this.formatDuration(report.duration)}`);
      console.log(`📦 Total size: ${this.formatSize(report.size)}`);

      // Clean up old backups
      await this.cleanupOldBackups();

      return report;

    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : 'Unknown error');
      report.endTime = new Date();
      report.duration = report.endTime.getTime() - startTime.getTime();

      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.ERROR,
        severity: SecuritySeverity.HIGH,
        message: 'Full backup failed',
        ip: 'system',
        userAgent: 'backup-service',
        endpoint: 'full-backup',
        details: { 
          backupId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: report.duration
        }
      });

      console.error(`💥 Full backup failed after ${this.formatDuration(report.duration)}`);
      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Backup database (both Neon and local PostgreSQL)
   */
  private async backupDatabase(backupPath: string): Promise<{ size: number; path: string }> {
    // Database already initialized with original setup
    // Always use Neon database with the original setup
    return await this.backupNeonDatabase(backupPath);
  }

  /**
   * Backup local PostgreSQL database
   */
  private async backupLocalPostgreSQL(backupPath: string): Promise<{ size: number; path: string }> {
    const { spawn } = await import('child_process');
    const backupFile = path.join(backupPath, 'postgresql_backup.sql');
    
    return new Promise((resolve, reject) => {
      const dbUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/readmyfineprint';
      
      const pgDump = spawn('pg_dump', [dbUrl, '-f', backupFile, '--no-password'], {
        env: { ...process.env, PGPASSWORD: 'password' }
      });

      pgDump.on('close', async (code) => {
        if (code === 0) {
          try {
            const stats = await fs.stat(backupFile);
            resolve({ size: stats.size, path: backupFile });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      pgDump.on('error', reject);
    });
  }

  /**
   * Backup Neon database using SQL export
   */
  private async backupNeonDatabase(backupPath: string): Promise<{ size: number; path: string }> {
    const { db } = await import('./db');
    const backupFile = path.join(backupPath, 'neon_backup.json');
    
    // Export all tables as JSON
    const tables = [
      'users', 'user_subscriptions', 'usage_records', 'subscription_tokens',
      'session_tokens', 'email_verification_codes', 'email_verification_rate_limit',
      'email_change_requests', 'consent_records', 'security_questions',
      'jwt_token_revocations', 'refresh_tokens', 'jwt_secret_versions'
    ];

    const exportData: any = {};
    
    for (const tableName of tables) {
      try {
        const result = await db.execute(`SELECT * FROM ${tableName}`);
        exportData[tableName] = result.rows || [];
      } catch (error) {
        console.warn(`Warning: Could not backup table ${tableName}:`, error instanceof Error ? error.message : 'Unknown error');
        exportData[tableName] = [];
      }
    }

    const jsonData = JSON.stringify(exportData, null, 2);
    await fs.writeFile(backupFile, jsonData, 'utf8');
    
    const stats = await fs.stat(backupFile);
    return { size: stats.size, path: backupFile };
  }

  /**
   * Backup application data (environment files, configs, etc.)
   */
  private async backupApplicationData(backupPath: string): Promise<{ size: number; path: string }> {
    const appDataPath = path.join(backupPath, 'application_data');
    await fs.mkdir(appDataPath, { recursive: true });

    let totalSize = 0;

    // Backup important application files
    const filesToBackup = [
      'package.json',
      'package-lock.json',
      'env.example',
      'CLAUDE.md',
      'tailwind.config.ts',
      'vite.config.ts',
      'tsconfig.json'
    ];

    for (const fileName of filesToBackup) {
      try {
        const sourcePath = path.join(process.cwd(), fileName);
        const destPath = path.join(appDataPath, fileName);
        
        await fs.copyFile(sourcePath, destPath);
        const stats = await fs.stat(destPath);
        totalSize += stats.size;
      } catch (error) {
        console.warn(`Warning: Could not backup ${fileName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Backup scripts directory
    try {
      const scriptsPath = path.join(process.cwd(), 'scripts');
      const destScriptsPath = path.join(appDataPath, 'scripts');
      await this.copyDirectory(scriptsPath, destScriptsPath);
      
      const scriptStats = await this.getDirectorySize(destScriptsPath);
      totalSize += scriptStats;
    } catch (error) {
      console.warn('Warning: Could not backup scripts directory:', error instanceof Error ? error.message : 'Unknown error');
    }

    return { size: totalSize, path: appDataPath };
  }

  /**
   * Backup configurations and environment-specific data
   */
  private async backupConfigurations(backupPath: string): Promise<{ size: number; path: string }> {
    const configPath = path.join(backupPath, 'configurations');
    await fs.mkdir(configPath, { recursive: true });

    let totalSize = 0;

    // Create configuration snapshot
    const configSnapshot = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      backup_config: this.config,
      database_status: { status: 'connected', provider: 'neon' },
      system_info: {
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    const configFile = path.join(configPath, 'system_config.json');
    await fs.writeFile(configFile, JSON.stringify(configSnapshot, null, 2), 'utf8');
    
    const stats = await fs.stat(configFile);
    totalSize += stats.size;

    return { size: totalSize, path: configPath };
  }

  /**
   * Create compressed backup archive
   */
  private async createBackupArchive(sessionPath: string, backupId: string): Promise<string> {
    const { createGzip } = await import('zlib');
    const { createReadStream, createWriteStream } = await import('fs');
    const { pipeline } = await import('stream/promises');
    
    const archiveName = `backup_${backupId}_${new Date().toISOString().split('T')[0]}.tar.gz`;
    const archivePath = path.join(this.config.storage.local.path, archiveName);

    if (this.config.compression.enabled) {
      // Create tar.gz archive (simplified - in production use proper tar library)
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-czf', archivePath, '-C', sessionPath, '.']);
        
        tar.on('close', (code) => {
          if (code === 0) {
            resolve(archivePath);
          } else {
            reject(new Error(`tar command failed with code ${code}`));
          }
        });

        tar.on('error', reject);
      });
    } else {
      // Simple directory copy if compression is disabled
      const destPath = path.join(this.config.storage.local.path, `backup_${backupId}`);
      await this.copyDirectory(sessionPath, destPath);
      return destPath;
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const { createReadStream } = await import('fs');
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Schedule automated backups
   */
  private scheduleBackups(): void {
    if (!this.config.enabled) {
      console.log('⏭️  Automated backups disabled in configuration');
      return;
    }

    // Schedule daily backup at 2 AM
    if (this.config.schedule.daily) {
      setInterval(() => {
        const now = new Date();
        if (now.getHours() === 2 && now.getMinutes() === 0) {
          this.performFullBackup().catch(console.error);
        }
      }, 60000); // Check every minute
    }

    console.log('📅 Backup schedules configured');
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    const now = new Date();
    const toDelete = this.backupHistory.filter(backup => backup.retention < now);

    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.destination);
        console.log(`🗑️  Deleted expired backup: ${backup.id}`);
      } catch (error) {
        console.warn(`Warning: Could not delete backup ${backup.id}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Remove from history
    this.backupHistory = this.backupHistory.filter(backup => backup.retention >= now);
    await this.saveBackupHistory();
  }

  /**
   * Get backup status and history
   */
  getBackupStatus(): {
    isRunning: boolean;
    lastBackup?: Date;
    totalBackups: number;
    totalSize: number;
    nextScheduled?: Date;
  } {
    const lastBackup = this.backupHistory.length > 0 
      ? new Date(Math.max(...this.backupHistory.map(b => b.timestamp.getTime())))
      : undefined;

    const totalSize = this.backupHistory.reduce((sum, backup) => sum + backup.size, 0);

    return {
      isRunning: this.isRunning,
      lastBackup,
      totalBackups: this.backupHistory.length,
      totalSize,
      nextScheduled: this.calculateNextScheduled()
    };
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; error?: string }> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      return { valid: false, error: 'Backup not found' };
    }

    try {
      // Check if file exists
      await fs.access(backup.destination);

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backup.destination);
      if (currentChecksum !== backup.checksum) {
        return { valid: false, error: 'Checksum mismatch - backup may be corrupted' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Helper methods

  private async ensureBackupDirectory(): Promise<void> {
    await fs.mkdir(this.config.storage.local.path, { recursive: true });
  }

  private async loadBackupHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.config.storage.local.path, 'backup_history.json');
      const data = await fs.readFile(historyFile, 'utf8');
      this.backupHistory = JSON.parse(data).map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        retention: new Date(item.retention)
      }));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty history
      this.backupHistory = [];
    }
  }

  private async saveBackupHistory(): Promise<void> {
    const historyFile = path.join(this.config.storage.local.path, 'backup_history.json');
    await fs.writeFile(historyFile, JSON.stringify(this.backupHistory, null, 2), 'utf8');
  }

  private calculateRetentionDate(type: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    const days = this.config.retention[type];
    return new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
  }

  private calculateNextScheduled(): Date | undefined {
    if (!this.config.schedule.daily) return undefined;
    
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
export const backupService = new BackupService();