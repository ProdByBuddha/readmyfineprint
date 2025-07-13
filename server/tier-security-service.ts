/**
 * Tier-based Security Requirements Service
 * Manages security requirements based on subscription tier
 */

import { databaseStorage } from "./storage";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";
import { securityQuestionsService } from "./security-questions-service";
import { twoFactorService } from "./two-factor-service";

export interface TierSecurityRequirements {
  tier: string;
  tierName: string;
  minSecurityQuestions: number;
  maxSecurityQuestions: number;
  requireTwoFactor: boolean;
  requireBackupEmail: boolean;
  allowCustomQuestions: boolean;
  requireAdminApproval: boolean;
  accountRecoveryMethods: string[];
  description: string;
}

export interface UserSecurityStatus {
  userId: string;
  tier: string;
  requirements: TierSecurityRequirements;
  compliance: {
    hasMinSecurityQuestions: boolean;
    hasTwoFactorEnabled: boolean;
    hasBackupEmail: boolean;
    isCompliant: boolean;
    missingRequirements: string[];
  };
  securityQuestionCount: number;
  twoFactorEnabled: boolean;
  backupEmailSet: boolean;
}

/**
 * Tier-based security requirements configuration
 */
const TIER_SECURITY_REQUIREMENTS: Record<string, TierSecurityRequirements> = {
  free: {
    tier: 'free',
    tierName: 'Free',
    minSecurityQuestions: 0,
    maxSecurityQuestions: 2,
    requireTwoFactor: false,
    requireBackupEmail: false,
    allowCustomQuestions: false,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email'],
    description: 'Basic security with optional recovery questions'
  },
  starter: {
    tier: 'starter',
    tierName: 'Starter',
    minSecurityQuestions: 2,
    maxSecurityQuestions: 4,
    requireTwoFactor: false,
    requireBackupEmail: false,
    allowCustomQuestions: false,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email', 'security_questions'],
    description: 'Enhanced security with recommended security questions'
  },
  professional: {
    tier: 'professional',
    tierName: 'Professional',
    minSecurityQuestions: 3,
    maxSecurityQuestions: 6,
    requireTwoFactor: false, // Disabled for now - needs full 2FA implementation
    requireBackupEmail: false,
    allowCustomQuestions: false,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email', 'security_questions'],
    description: 'Professional security with enhanced security questions'
  },
  business: {
    tier: 'business',
    tierName: 'Business',
    minSecurityQuestions: 0, // No requirements - tier not public yet
    maxSecurityQuestions: 8,
    requireTwoFactor: false,
    requireBackupEmail: false,
    allowCustomQuestions: true,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email', 'security_questions'],
    description: 'Business security with optional advanced features (Preview tier)'
  },
  enterprise: {
    tier: 'enterprise',
    tierName: 'Enterprise',
    minSecurityQuestions: 0, // No requirements - tier not public yet
    maxSecurityQuestions: 10,
    requireTwoFactor: false,
    requireBackupEmail: false,
    allowCustomQuestions: true,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email', 'security_questions'],
    description: 'Enterprise security with optional advanced features (Preview tier)'
  },
  ultimate: {
    tier: 'ultimate',
    tierName: 'Ultimate',
    minSecurityQuestions: 0, // No requirements - tier not public yet
    maxSecurityQuestions: 12,
    requireTwoFactor: false,
    requireBackupEmail: false,
    allowCustomQuestions: true,
    requireAdminApproval: false,
    accountRecoveryMethods: ['email', 'security_questions'],
    description: 'Ultimate security with optional advanced features (Preview tier)'
  }
};

/**
 * Get security requirements for a specific tier
 */
export function getTierSecurityRequirements(tier: string): TierSecurityRequirements {
  return TIER_SECURITY_REQUIREMENTS[tier] || TIER_SECURITY_REQUIREMENTS.free;
}

/**
 * Get all tier security requirements
 */
export function getAllTierSecurityRequirements(): Record<string, TierSecurityRequirements> {
  return TIER_SECURITY_REQUIREMENTS;
}

/**
 * Check user's security compliance based on their tier
 */
export async function getUserSecurityStatus(userId: string): Promise<UserSecurityStatus> {
  try {
    // Get user's subscription tier
    const subscription = await databaseStorage.getUserSubscription(userId);
    const userTier = subscription?.tierId || 'free';
    const requirements = getTierSecurityRequirements(userTier);

    // Get user's current security setup
    const securityQuestions = await securityQuestionsService.getUserSecurityQuestions(userId);
    const twoFactorEnabled = await twoFactorService.isEnabled(userId);
    
    // Check if user has backup email (implement if needed)
    const user = await databaseStorage.getUser(userId);
    const backupEmailSet = false; // TODO: Implement backup email check

    // Calculate compliance
    const hasMinSecurityQuestions = securityQuestions.length >= requirements.minSecurityQuestions;
    const hasTwoFactorEnabled = !requirements.requireTwoFactor || twoFactorEnabled;
    const hasBackupEmail = !requirements.requireBackupEmail || backupEmailSet;

    const missingRequirements: string[] = [];
    if (!hasMinSecurityQuestions) {
      missingRequirements.push(`At least ${requirements.minSecurityQuestions} security questions required`);
    }
    if (requirements.requireTwoFactor && !twoFactorEnabled) {
      missingRequirements.push('Two-factor authentication required');
    }
    if (requirements.requireBackupEmail && !backupEmailSet) {
      missingRequirements.push('Backup email address required');
    }

    const isCompliant = hasMinSecurityQuestions && hasTwoFactorEnabled && hasBackupEmail;

    return {
      userId,
      tier: userTier,
      requirements,
      compliance: {
        hasMinSecurityQuestions,
        hasTwoFactorEnabled,
        hasBackupEmail,
        isCompliant,
        missingRequirements
      },
      securityQuestionCount: securityQuestions.length,
      twoFactorEnabled,
      backupEmailSet
    };

  } catch (error) {
    console.error('Error getting user security status:', error);
    throw new Error('Failed to get user security status');
  }
}

/**
 * Validate if user can perform a security action based on their tier
 */
export async function validateSecurityAction(
  userId: string, 
  action: 'account_recovery' | 'email_change'
): Promise<{
  allowed: boolean;
  method: string;
  requiresCompliance: boolean;
  message?: string;
}> {
  try {
    const status = await getUserSecurityStatus(userId);
    const { requirements, compliance } = status;

    // Check if user meets minimum security requirements
    if (!compliance.isCompliant) {
      return {
        allowed: false,
        method: 'none',
        requiresCompliance: true,
        message: `You must complete security setup to perform this action. Missing: ${compliance.missingRequirements.join(', ')}`
      };
    }

    // Determine available methods based on tier and action
    let availableMethods: string[] = [];
    
    switch (action) {
      case 'account_recovery':
        availableMethods = requirements.accountRecoveryMethods;
        break;
      case 'email_change':
        // Email change methods based on tier requirements
        availableMethods = requirements.requireAdminApproval 
          ? ['security_questions', 'admin_approval'] 
          : ['security_questions'];
        break;
      default:
        return {
          allowed: false,
          method: 'none',
          requiresCompliance: false,
          message: 'Unknown security action'
        };
    }

    return {
      allowed: true,
      method: availableMethods[0] || 'email',
      requiresCompliance: false,
      message: `Action allowed via: ${availableMethods.join(', ')}`
    };

  } catch (error) {
    console.error('Error validating security action:', error);
    return {
      allowed: false,
      method: 'none',
      requiresCompliance: false,
      message: 'Error validating security action'
    };
  }
}

/**
 * Generate security setup recommendations for user
 */
export async function getSecurityRecommendations(userId: string): Promise<{
  tier: string;
  recommendations: {
    priority: 'required' | 'recommended' | 'optional';
    action: string;
    description: string;
    completed: boolean;
  }[];
}> {
  try {
    const status = await getUserSecurityStatus(userId);
    const { requirements, compliance } = status;

    const recommendations = [];

    // Required security questions
    if (!compliance.hasMinSecurityQuestions) {
      recommendations.push({
        priority: 'required' as const,
        action: 'setup_security_questions',
        description: `Set up ${requirements.minSecurityQuestions} security questions for account recovery`,
        completed: false
      });
    } else {
      recommendations.push({
        priority: 'required' as const,
        action: 'setup_security_questions',
        description: `Security questions configured (${status.securityQuestionCount}/${requirements.minSecurityQuestions})`,
        completed: true
      });
    }

    // Two-factor authentication
    if (requirements.requireTwoFactor) {
      recommendations.push({
        priority: 'required' as const,
        action: 'setup_two_factor',
        description: 'Enable two-factor authentication for enhanced security',
        completed: compliance.hasTwoFactorEnabled
      });
    } else {
      recommendations.push({
        priority: 'recommended' as const,
        action: 'setup_two_factor',
        description: 'Enable two-factor authentication (recommended)',
        completed: compliance.hasTwoFactorEnabled
      });
    }

    // Backup email
    if (requirements.requireBackupEmail) {
      recommendations.push({
        priority: 'required' as const,
        action: 'setup_backup_email',
        description: 'Add backup email address for account recovery',
        completed: compliance.hasBackupEmail
      });
    } else if (status.tier !== 'free') {
      recommendations.push({
        priority: 'recommended' as const,
        action: 'setup_backup_email',
        description: 'Add backup email address (recommended)',
        completed: compliance.hasBackupEmail
      });
    }

    // Additional questions for higher tiers
    if (status.securityQuestionCount < requirements.maxSecurityQuestions) {
      recommendations.push({
        priority: 'optional' as const,
        action: 'add_more_questions',
        description: `Add more security questions (${status.securityQuestionCount}/${requirements.maxSecurityQuestions} configured)`,
        completed: false
      });
    }

    return {
      tier: status.tier,
      recommendations
    };

  } catch (error) {
    console.error('Error getting security recommendations:', error);
    throw new Error('Failed to get security recommendations');
  }
}

/**
 * Check if user tier allows specific security features
 */
export function getTierFeatureAvailability(tier: string): {
  customQuestions: boolean;
  backupEmail: boolean;
  adminApproval: boolean;
  advancedRecovery: boolean;
  securityAudit: boolean;
} {
  const requirements = getTierSecurityRequirements(tier);
  
  return {
    customQuestions: requirements.allowCustomQuestions,
    backupEmail: requirements.requireBackupEmail || ['business', 'enterprise', 'ultimate'].includes(tier),
    adminApproval: requirements.requireAdminApproval,
    advancedRecovery: ['professional', 'business', 'enterprise', 'ultimate'].includes(tier),
    securityAudit: ['business', 'enterprise', 'ultimate'].includes(tier)
  };
}