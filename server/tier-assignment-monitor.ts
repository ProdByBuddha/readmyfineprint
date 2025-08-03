
import { subscriptionService } from './subscription-service';
import { securityLogger } from './security-logger';
import { databaseStorage } from './storage';

interface TierAssignmentIssue {
  userId: string;
  expectedTier: string;
  actualTier: string;
  issue: string;
  timestamp: Date;
}

export class TierAssignmentMonitor {
  private issues: TierAssignmentIssue[] = [];
  private lastCheck: Date = new Date();

  /**
   * Monitor a user's tier assignment for correctness
   */
  async checkUserTierAssignment(userId: string): Promise<{
    isCorrect: boolean;
    expectedTier: string;
    actualTier: string;
    issue?: string;
  }> {
    try {
      // Get current tier assignment
      const result = await subscriptionService.getUserSubscriptionWithUsage(userId);
      const actualTier = result.tier.id;

      // Determine expected tier
      let expectedTier = 'free';
      
      // Check if user is admin
      const isAdmin = await subscriptionService.isAdminByEmail(userId);
      if (isAdmin) {
        expectedTier = 'ultimate';
      } else {
        // Check subscription status
        const subscription = await databaseStorage.getUserSubscription(userId);
        if (subscription && subscription.status === 'active') {
          expectedTier = subscription.tierId;
        }
      }

      const isCorrect = actualTier === expectedTier;

      if (!isCorrect) {
        const issue: TierAssignmentIssue = {
          userId,
          expectedTier,
          actualTier,
          issue: `Tier mismatch: expected ${expectedTier}, got ${actualTier}`,
          timestamp: new Date()
        };

        this.issues.push(issue);

        // Log security event for tier mismatches
        securityLogger.logSecurityEvent({
          eventType: 'TIER_ASSIGNMENT_MISMATCH' as any,
          severity: 'HIGH' as any,
          message: `Tier assignment mismatch detected`,
          ip: 'system',
          userAgent: 'tier-assignment-monitor',
          endpoint: 'tier-monitoring',
          details: {
            userId,
            expectedTier,
            actualTier,
            isAdmin,
            issue: issue.issue
          }
        });

        console.warn(`⚠️ [Tier Monitor] ${issue.issue} for user ${userId}`);
      }

      return {
        isCorrect,
        expectedTier,
        actualTier,
        issue: isCorrect ? undefined : `Expected ${expectedTier}, got ${actualTier}`
      };

    } catch (error) {
      console.error('Error checking tier assignment:', error);
      return {
        isCorrect: false,
        expectedTier: 'unknown',
        actualTier: 'unknown',
        issue: `Error checking tier: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check all admin users have correct tier assignments
   */
  async checkAllAdminTierAssignments(): Promise<{
    totalChecked: number;
    issuesFound: number;
    adminUsers: {
      userId: string;
      expectedTier: string;
      actualTier: string;
      isCorrect: boolean;
    }[];
  }> {
    const adminUsers = [
      'c970c8a1-3a9d-43e0-b758-e5092db524ff',
      '24c3ec47-dd61-4619-9c9e-18abbd0981ea'
    ];

    const results = [];
    let issuesFound = 0;

    for (const userId of adminUsers) {
      try {
        const result = await this.checkUserTierAssignment(userId);
        results.push({
          userId,
          expectedTier: result.expectedTier,
          actualTier: result.actualTier,
          isCorrect: result.isCorrect
        });

        if (!result.isCorrect) {
          issuesFound++;
        }
      } catch (error) {
        console.error(`Error checking admin user ${userId}:`, error);
        results.push({
          userId,
          expectedTier: 'ultimate',
          actualTier: 'error',
          isCorrect: false
        });
        issuesFound++;
      }
    }

    console.log(`🔍 [Tier Monitor] Checked ${adminUsers.length} admin users, found ${issuesFound} issues`);

    return {
      totalChecked: adminUsers.length,
      issuesFound,
      adminUsers: results
    };
  }

  /**
   * Get recent tier assignment issues
   */
  getRecentIssues(hours: number = 24): TierAssignmentIssue[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.issues.filter(issue => issue.timestamp > cutoff);
  }

  /**
   * Clear old issues (keep only last 7 days)
   */
  cleanup(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.issues = this.issues.filter(issue => issue.timestamp > cutoff);
  }

  /**
   * Start periodic monitoring
   */
  startPeriodicMonitoring(intervalMinutes: number = 30): void {
    const interval = intervalMinutes * 60 * 1000;

    setInterval(async () => {
      try {
        console.log('🔍 [Tier Monitor] Running periodic admin tier check...');
        const results = await this.checkAllAdminTierAssignments();
        
        if (results.issuesFound > 0) {
          console.warn(`⚠️ [Tier Monitor] Found ${results.issuesFound} tier assignment issues`);
        } else {
          console.log('✅ [Tier Monitor] All admin tier assignments are correct');
        }

        this.cleanup();
      } catch (error) {
        console.error('Error during periodic tier monitoring:', error);
      }
    }, interval);

    console.log(`🔍 [Tier Monitor] Started periodic monitoring (every ${intervalMinutes} minutes)`);
  }
}

export const tierAssignmentMonitor = new TierAssignmentMonitor();
