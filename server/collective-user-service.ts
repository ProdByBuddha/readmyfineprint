import { EventEmitter } from 'events';
import crypto from 'crypto';
import { databaseStorage } from './storage';
import { securityLogger } from './security-logger';
import { SecurityEventType, SecuritySeverity } from './security-logger';

interface FreeUserTracker {
  sessionId: string;
  deviceFingerprint: string;
  ipAddress: string;
  documentsAnalyzed: number;
  firstSeen: Date;
  lastSeen: Date;
  suspiciousActivity: boolean;
  riskScore: number;
}

interface UsageWindow {
  dailyUsage: Map<string, number>; // date -> usage count
  weeklyUsage: Map<string, number>; // week -> usage count
  monthlyUsage: Map<string, number>; // month -> usage count
}

interface CollectiveUsageLimits {
  // Collective pool limits
  dailyCollectiveLimit: number;
  weeklyCollectiveLimit: number;
  monthlyCollectiveLimit: number;
  
  // Fair distribution settings
  maxUserPercentageOfDaily: number; // max % of daily pool one user can consume
  emergencyReservePercentage: number; // % of pool reserved for new users
}

export class CollectiveUserService extends EventEmitter {
  private freeUserTrackers = new Map<string, FreeUserTracker>();
  private usageWindows: UsageWindow;
  private limits: CollectiveUsageLimits;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  
  // Individual monthly usage tracking for anonymous users
  private individualMonthlyUsage = new Map<string, Map<string, number>>(); // userId -> period -> count

  constructor() {
    super();
    
    // Initialize usage tracking windows
    this.usageWindows = {
      dailyUsage: new Map(),
      weeklyUsage: new Map(),
      monthlyUsage: new Map()
    };

    // Configure abuse-proof limits
    this.limits = {
      // Collective pool limits (scales with legitimate usage)
      dailyCollectiveLimit: 1000,      // 1000 docs/day total free tier
      weeklyCollectiveLimit: 6000,     // 6000 docs/week total
      monthlyCollectiveLimit: 20000,   // 20000 docs/month total
      
      // Fair distribution
      maxUserPercentageOfDaily: 0.15,  // No single user > 15% of daily pool
      emergencyReservePercentage: 0.20 // 20% reserved for new/emergency users
    };

    // Start maintenance routine
    this.startMaintenance();
  }

  /**
   * Get or create user tracker with abuse detection
   */
  async getOrCreateUserTracker(
    sessionId: string, 
    deviceFingerprint: string, 
    ipAddress: string
  ): Promise<FreeUserTracker> {
    // Create composite key for tracking
    const trackingKey = this.createTrackingKey(sessionId, deviceFingerprint, ipAddress);
    
    let tracker = this.freeUserTrackers.get(trackingKey);
    
    if (!tracker) {
      // Create new tracker with risk assessment
      const riskScore = await this.calculateInitialRiskScore(deviceFingerprint, ipAddress);
      
      tracker = {
        sessionId,
        deviceFingerprint,
        ipAddress,
        documentsAnalyzed: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        suspiciousActivity: false,
        riskScore
      };

      // Log new free user registration
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.USER_ACTIVITY,
        severity: SecuritySeverity.LOW,
        message: 'New free tier user registered',
        ip: ipAddress,
        userAgent: 'collective-user-service',
        endpoint: 'user-tracking',
        details: {
          sessionId: sessionId.slice(0, 8) + '...',
          deviceFingerprint: deviceFingerprint.slice(0, 16) + '...',
          riskScore,
          timestamp: tracker.firstSeen
        }
      });

      this.freeUserTrackers.set(trackingKey, tracker);
    } else {
      // Update existing tracker
      tracker.lastSeen = new Date();
      
      // Update risk score based on behavior patterns
      const updatedRiskScore = await this.recalculateRiskScore(tracker);
      if (updatedRiskScore !== tracker.riskScore) {
        tracker.riskScore = updatedRiskScore;
        
        if (updatedRiskScore > 70) {
          tracker.suspiciousActivity = true;
          securityLogger.logSecurityEvent({
            eventType: SecurityEventType.SECURITY_VIOLATION,
            severity: SecuritySeverity.MEDIUM,
            message: 'Free tier user flagged as suspicious',
            ip: ipAddress,
            userAgent: 'collective-user-service',
            endpoint: 'abuse-detection',
            details: {
              sessionId: sessionId.slice(0, 8) + '...',
              riskScore: updatedRiskScore,
              documentsAnalyzed: tracker.documentsAnalyzed,
              daysSinceFirstSeen: Math.floor((Date.now() - tracker.firstSeen.getTime()) / (24 * 60 * 60 * 1000))
            }
          });
        }
      }
    }

    return tracker;
  }

  /**
   * Check if user can analyze a document with abuse prevention
   */
  async canUserAnalyzeDocument(
    sessionId: string,
    deviceFingerprint: string,
    ipAddress: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    limit?: number;
    used?: number;
    resetTime?: Date;
    waitTime?: number;
  }> {
    try {
      const tracker = await this.getOrCreateUserTracker(sessionId, deviceFingerprint, ipAddress);
      const today = this.getDateKey(new Date());
      
      // Check collective pool limits first
      const collectiveUsage = this.usageWindows.dailyUsage.get(today) || 0;
      const emergencyReserve = Math.floor(this.limits.dailyCollectiveLimit * this.limits.emergencyReservePercentage);
      const availablePool = this.limits.dailyCollectiveLimit - emergencyReserve;
      
      if (collectiveUsage >= this.limits.dailyCollectiveLimit) {
        return {
          allowed: false,
          reason: 'Daily collective limit reached. Try again tomorrow.',
          limit: this.limits.dailyCollectiveLimit,
          used: collectiveUsage,
          resetTime: this.getNextDayReset()
        };
      }
      
      // Advanced abuse detection: rate limiting and pattern analysis
      const abuseCheck = await this.checkForAbuse(tracker, ipAddress);
      if (!abuseCheck.allowed) {
        return abuseCheck;
      }
      
      return {
        allowed: true,
        limit: this.limits.dailyCollectiveLimit,
        used: collectiveUsage
      };
      
    } catch (error) {
      console.error('Error checking user analysis permission:', error);
      // Fail safe - allow with basic limit
      return {
        allowed: true,
        limit: this.limits.dailyCollectiveLimit,
        used: 0
      };
    }
  }

  /**
   * Track document analysis usage with enhanced analytics
   */
  async trackDocumentAnalysis(
    sessionId: string,
    deviceFingerprint: string,
    ipAddress: string,
    tokensUsed: number
  ): Promise<void> {
    try {
      const tracker = await this.getOrCreateUserTracker(sessionId, deviceFingerprint, ipAddress);
      const now = new Date();
      const today = this.getDateKey(now);
      const thisWeek = this.getWeekKey(now);
      const thisMonth = this.getMonthKey(now);
      
      // Update user tracker
      tracker.documentsAnalyzed++;
      tracker.lastSeen = now;
      
      // Update usage windows
      this.usageWindows.dailyUsage.set(today, (this.usageWindows.dailyUsage.get(today) || 0) + 1);
      this.usageWindows.weeklyUsage.set(thisWeek, (this.usageWindows.weeklyUsage.get(thisWeek) || 0) + 1);
      this.usageWindows.monthlyUsage.set(thisMonth, (this.usageWindows.monthlyUsage.get(thisMonth) || 0) + 1);
      
      // Update database usage for the collective user
      const collectiveUserId = '00000000-0000-0000-0000-000000000001';
      await this.updateCollectiveUsageRecord(collectiveUserId, tokensUsed, tracker);
      
      // Emit usage event for monitoring
      this.emit('usage-tracked', {
        sessionId: sessionId.slice(0, 8) + '...',
        userType: this.getUserType(tracker),
        documentsAnalyzed: tracker.documentsAnalyzed,
        todayUsage: this.usageWindows.dailyUsage.get(today),
        riskScore: tracker.riskScore
      });
      
    } catch (error) {
      console.error('Error tracking document analysis:', error);
      // Don't throw - tracking failures shouldn't break document analysis
    }
  }

  /**
   * Advanced abuse detection with multiple signals
   */
  private async checkForAbuse(tracker: FreeUserTracker, ipAddress: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  }> {
    const now = Date.now();
    const timeSinceLastRequest = now - tracker.lastSeen.getTime();
    
    // Rate limiting: prevent rapid-fire requests
    if (timeSinceLastRequest < 10000) { // 10 seconds
      return {
        allowed: false,
        reason: 'Please wait between document analyses.',
        waitTime: Math.ceil((10000 - timeSinceLastRequest) / 1000)
      };
    }
    
    // Pattern analysis: detect automation
    const requestsInLastHour = await this.getRequestsInTimeWindow(tracker, 60 * 60 * 1000);
    if (requestsInLastHour > 20) {
      tracker.suspiciousActivity = true;
      return {
        allowed: false,
        reason: 'Suspicious activity detected. Please slow down.',
        waitTime: 3600 // 1 hour
      };
    }
    
    // IP-based checks: prevent IP rotation abuse
    const ipUsageToday = await this.getIPFingerprintCount(ipAddress);
    if (ipUsageToday > 50) {
      return {
        allowed: false,
        reason: 'IP usage limit exceeded. Try again tomorrow.',
        waitTime: 86400 // 24 hours
      };
    }
    
    return { allowed: true };
  }

  /**
   * Calculate initial risk score for new users
   */
  private async calculateInitialRiskScore(deviceFingerprint: string, ipAddress: string): Promise<number> {
    let riskScore = 10; // Base score
    
    // Check if IP has been seen with many different fingerprints (rotation)
    const ipFingerprintCount = await this.getIPFingerprintCount(ipAddress);
    if (ipFingerprintCount > 10) {
      riskScore += 30;
    }
    
    // Check if fingerprint has been seen with many different IPs
    const fingerprintIPCount = await this.getFingerprintIPCount(deviceFingerprint);
    if (fingerprintIPCount > 5) {
      riskScore += 25;
    }
    
    // Check for suspicious fingerprint patterns
    if (this.isSuspiciousFingerprint(deviceFingerprint)) {
      riskScore += 20;
    }
    
    return Math.min(riskScore, 100);
  }

  /**
   * Recalculate risk score based on behavior patterns
   */
  private async recalculateRiskScore(tracker: FreeUserTracker): Promise<number> {
    let riskScore = tracker.riskScore;
    const daysSinceFirstSeen = Math.floor((Date.now() - tracker.firstSeen.getTime()) / (24 * 60 * 60 * 1000));
    
    // Lower risk for established users with normal patterns
    if (daysSinceFirstSeen > 7 && tracker.documentsAnalyzed < 50) {
      riskScore = Math.max(riskScore - 10, 0);
    }
    
    // Increase risk for high usage in short time
    if (daysSinceFirstSeen < 3 && tracker.documentsAnalyzed > 20) {
      riskScore = Math.min(riskScore + 25, 100);
    }
    
    return riskScore;
  }

  /**
   * Create a composite tracking key for user identification
   */
  private createTrackingKey(sessionId: string, deviceFingerprint: string, ipAddress: string): string {
    // Use session ID as primary identifier, with fingerprint and IP as backup
    const composite = `${sessionId}:${deviceFingerprint}:${ipAddress}`;
    return crypto.createHash('sha256').update(composite).digest('hex').substring(0, 32);
  }

  /**
   * Helper methods for date/time handling
   */
  private getDateKey(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const weekNum = this.getWeekNumber(date);
    return `${year}-W${weekNum.toString().padStart(2, '0')}`;
  }

  private getMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7); // YYYY-MM
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Data retrieval methods
   */
  private async getRequestsInTimeWindow(tracker: FreeUserTracker, windowMs: number): Promise<number> {
    // This would need to be implemented with proper time-based tracking
    // For now, return 0 as a placeholder
    return 0;
  }

  private async getIPFingerprintCount(ipAddress: string): Promise<number> {
    const fingerprints = new Set<string>();
    for (const [_, tracker] of this.freeUserTrackers) {
      if (tracker.ipAddress === ipAddress) {
        fingerprints.add(tracker.deviceFingerprint);
      }
    }
    return fingerprints.size;
  }

  private async getFingerprintIPCount(deviceFingerprint: string): Promise<number> {
    const ips = new Set<string>();
    for (const [_, tracker] of this.freeUserTrackers) {
      if (tracker.deviceFingerprint === deviceFingerprint) {
        ips.add(tracker.ipAddress);
      }
    }
    return ips.size;
  }

  private isSuspiciousFingerprint(fingerprint: string): boolean {
    // Check for patterns that indicate bot/automation
    if (fingerprint.includes('unknown') || fingerprint.length < 10) {
      return true;
    }
    return false;
  }

  private getUserType(tracker: FreeUserTracker): string {
    if (tracker.suspiciousActivity) return 'suspicious';
    
    const daysSinceFirstSeen = Math.floor((Date.now() - tracker.firstSeen.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceFirstSeen >= 7 && tracker.riskScore < 30) return 'established';
    
    return 'new';
  }

  /**
   * Update the collective user's usage record in database
   */
  private async updateCollectiveUsageRecord(
    collectiveUserId: string, 
    tokensUsed: number, 
    tracker: FreeUserTracker
  ): Promise<void> {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const usageRecord = await databaseStorage.getUserUsage(collectiveUserId, currentPeriod);
      
      if (usageRecord) {
        await databaseStorage.updateUsageRecord(usageRecord.id, {
          documentsAnalyzed: usageRecord.documentsAnalyzed + 1,
          tokensUsed: usageRecord.tokensUsed + tokensUsed,
          cost: (parseFloat(usageRecord.cost) + 0.00425).toString(), // Free tier cost
        });
      } else {
        await databaseStorage.createUsageRecord({
          userId: collectiveUserId,
          subscriptionId: null,
          period: currentPeriod,
          documentsAnalyzed: 1,
          tokensUsed,
          cost: '0.00425',
        });
      }
    } catch (error) {
      console.error('Error updating collective usage record:', error);
    }
  }

  /**
   * Periodic cleanup and maintenance
   */
  private startMaintenance(): void {
    // Run maintenance every 6 hours
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance();
    }, 6 * 60 * 60 * 1000);
  }

  private async performMaintenance(): Promise<void> {
    const now = new Date();
    let cleanedTrackers = 0;
    let cleanedUsage = 0;
    
    // Clean up old user trackers (older than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const [key, tracker] of this.freeUserTrackers) {
      if (tracker.lastSeen < thirtyDaysAgo) {
        this.freeUserTrackers.delete(key);
        cleanedTrackers++;
      }
    }
    
    // Clean up old usage windows (keep last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oldestKey = this.getDateKey(ninetyDaysAgo);
    
    for (const [key] of this.usageWindows.dailyUsage) {
      if (key < oldestKey) {
        this.usageWindows.dailyUsage.delete(key);
        cleanedUsage++;
      }
    }
    
    console.log(`🧹 Collective user maintenance: cleaned ${cleanedTrackers} trackers, ${cleanedUsage} usage records`);
  }

  /**
   * Get service statistics for monitoring
   */
  getStatistics(): {
    activeUsers: number;
    todayUsage: number;
    weekUsage: number;
    monthUsage: number;
    suspiciousUsers: number;
    establishedUsers: number;
    limits: CollectiveUsageLimits;
  } {
    const today = this.getDateKey(new Date());
    const thisWeek = this.getWeekKey(new Date());
    const thisMonth = this.getMonthKey(new Date());
    
    let suspiciousUsers = 0;
    let establishedUsers = 0;
    
    for (const [_, tracker] of this.freeUserTrackers) {
      if (tracker.suspiciousActivity) {
        suspiciousUsers++;
      } else {
        const daysSinceFirstSeen = Math.floor((Date.now() - tracker.firstSeen.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSinceFirstSeen >= 7 && tracker.riskScore < 30) {
          establishedUsers++;
        }
      }
    }
    
    return {
      activeUsers: this.freeUserTrackers.size,
      todayUsage: this.usageWindows.dailyUsage.get(today) || 0,
      weekUsage: this.usageWindows.weeklyUsage.get(thisWeek) || 0,
      monthUsage: this.usageWindows.monthlyUsage.get(thisMonth) || 0,
      suspiciousUsers,
      establishedUsers,
      limits: this.limits
    };
  }

  /**
   * Administrative methods
   */
  async flagUserAsSuspicious(sessionId: string, reason: string): Promise<void> {
    for (const [_, tracker] of this.freeUserTrackers) {
      if (tracker.sessionId === sessionId) {
        tracker.suspiciousActivity = true;
        tracker.riskScore = Math.min(tracker.riskScore + 50, 100);
        
        securityLogger.logSecurityEvent({
          eventType: SecurityEventType.ADMIN_ACTION,
          severity: SecuritySeverity.MEDIUM,
          message: `Free tier user manually flagged as suspicious: ${reason}`,
          ip: tracker.ipAddress,
          userAgent: 'collective-user-service',
          endpoint: 'admin-flag-user',
          details: {
            sessionId: sessionId.slice(0, 8) + '...',
            reason,
            newRiskScore: tracker.riskScore
          }
        });
        
        break;
      }
    }
  }

  async updateLimits(newLimits: Partial<CollectiveUsageLimits>): Promise<void> {
    this.limits = { ...this.limits, ...newLimits };
    
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.ADMIN_ACTION,
      severity: SecuritySeverity.LOW,
      message: 'Collective user limits updated',
      ip: 'admin',
      userAgent: 'collective-user-service',
      endpoint: 'update-limits',
      details: newLimits
    });
  }

  /**
   * Track individual monthly usage for anonymous users
   */
  async trackIndividualMonthlyUsage(userId: string, documentsCount: number = 1): Promise<void> {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      // Get or create user's monthly usage map
      if (!this.individualMonthlyUsage.has(userId)) {
        this.individualMonthlyUsage.set(userId, new Map());
      }
      
      const userUsage = this.individualMonthlyUsage.get(userId)!;
      const currentUsage = userUsage.get(currentPeriod) || 0;
      userUsage.set(currentPeriod, currentUsage + documentsCount);
      
      console.log(`📊 Individual usage tracked for ${userId}: ${currentUsage + documentsCount} documents in ${currentPeriod}`);
    } catch (error) {
      console.error('Error tracking individual monthly usage:', error);
      // Don't throw - tracking failures shouldn't break document analysis
    }
  }

  /**
   * Get individual monthly usage for an anonymous user
   */
  async getIndividualMonthlyUsage(userId: string, period: string): Promise<number> {
    try {
      const userUsage = this.individualMonthlyUsage.get(userId);
      if (!userUsage) {
        return 0;
      }
      
      return userUsage.get(period) || 0;
    } catch (error) {
      console.error('Error getting individual monthly usage:', error);
      return 0;
    }
  }

  /**
   * Check if individual user has reached monthly limit
   */
  async checkIndividualMonthlyLimit(userId: string, limit: number = 10): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    resetDate: Date;
  }> {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const used = await this.getIndividualMonthlyUsage(userId, currentPeriod);
      
      // Calculate reset date (first day of next month)
      const now = new Date();
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      return {
        allowed: used < limit,
        used,
        limit,
        resetDate
      };
    } catch (error) {
      console.error('Error checking individual monthly limit:', error);
      // Fail safe - allow with basic info
      return {
        allowed: true,
        used: 0,
        limit,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Cleanup on service shutdown
   */
  shutdown(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const collectiveUserService = new CollectiveUserService(); 