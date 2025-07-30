import { databaseStorage } from "./storage";
import { SUBSCRIPTION_TIERS } from "./subscription-tiers";

// Define tier hierarchy (lower number = higher tier)
const TIER_HIERARCHY = {
  'ultimate': 0,
  'enterprise': 1,
  'business': 2,
  'professional': 3,
  'starter': 4,
  'free': 5
};

export interface TierValidationResult {
  hasAccess: boolean;
  currentTier: string;
  requiredTier: string;
  message?: string;
}

/**
 * Check if user has Professional tier or higher (for PII protection)
 */
export async function validateProfessionalAccess(userId: string): Promise<TierValidationResult> {
  return validateTierAccess(userId, 'professional');
}

/**
 * Check if user has Starter tier or higher (for PDF export)
 */
export async function validateStarterAccess(userId: string): Promise<TierValidationResult> {
  return validateTierAccess(userId, 'starter');
}

/**
 * Check if user has specific tier or higher
 */
export async function validateTierAccess(userId: string, requiredTier: string): Promise<TierValidationResult> {
  try {
    // Get user's current subscription
    const subscription = await databaseStorage.getUserSubscription(userId);
    
    let currentTier = 'free'; // Default to free tier
    
    if (subscription && subscription.status === 'active') {
      currentTier = subscription.tierId;
    }

    // Check if current tier meets requirement
    const currentTierLevel = TIER_HIERARCHY[currentTier as keyof typeof TIER_HIERARCHY];
    const requiredTierLevel = TIER_HIERARCHY[requiredTier as keyof typeof TIER_HIERARCHY];
    
    if (currentTierLevel === undefined || requiredTierLevel === undefined) {
      return {
        hasAccess: false,
        currentTier,
        requiredTier,
        message: 'Invalid tier configuration'
      };
    }

    const hasAccess = currentTierLevel <= requiredTierLevel;
    
    return {
      hasAccess,
      currentTier,
      requiredTier,
      message: hasAccess 
        ? undefined 
        : `This feature requires ${requiredTier} tier or higher. Current tier: ${currentTier}`
    };
    
  } catch (error) {
    console.error('Error validating tier access:', error);
    return {
      hasAccess: false,
      currentTier: 'unknown',
      requiredTier,
      message: 'Error checking subscription status'
    };
  }
}

/**
 * Get feature list for Professional tier and above
 */
export function getProfessionalFeatures(): string[] {
  return [
    'Advanced Data Export',
    'PII Redaction & Hashing',
    'PII Detection Feedback',
    'Enhanced Privacy Protection',
    'Priority Processing',
    'Enhanced Analysis',
    'Higher Document Limits'
  ];
}

/**
 * Get feature list for Starter tier and above
 */
export function getStarterFeatures(): string[] {
  return [
    'PDF Export',
    'Priority Processing',
    'Enhanced Analysis',
    'Higher Document Limits'
  ];
}

/**
 * Get tier information for upgrade messaging
 */
export function getTierInfo(tierId: string) {
  const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
  return tier ? {
    name: tier.name,
    monthlyPrice: tier.monthlyPrice,
    yearlyPrice: tier.yearlyPrice,
    features: tier.features
  } : null;
}