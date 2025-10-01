/**
 * Feature Flags Configuration
 * 
 * Controls rollout of Team Collaboration features (Q1 Roadmap)
 * Allows dark launching and gradual rollout to different tiers
 */

export interface FeatureFlags {
  // Organization Management
  organizations: boolean;
  // Shared Workspaces
  workspaces: boolean;
  // Activity Feed & Audit Trail
  activity: boolean;
  // Realtime Collaboration (WebSocket)
  realtime: boolean;
  // Organization-scoped API Keys
  orgApiKeys: boolean;
}

/**
 * Feature flag defaults based on environment
 */
const DEFAULT_FLAGS: FeatureFlags = {
  organizations: process.env.ENABLE_ORGANIZATIONS === 'true',
  workspaces: process.env.ENABLE_WORKSPACES === 'true',
  activity: process.env.ENABLE_ACTIVITY === 'true',
  realtime: process.env.ENABLE_REALTIME === 'true',
  orgApiKeys: process.env.ENABLE_ORG_API_KEYS === 'true',
};

/**
 * Subscription tiers that have access to team collaboration features
 * Maps to tier IDs in subscription-tiers.ts
 */
export const TEAM_COLLABORATION_TIERS = ['business', 'enterprise', 'ultimate'];

/**
 * Default seat limits per tier for organizations
 */
export const DEFAULT_SEAT_LIMITS: Record<string, number> = {
  business: 10,
  enterprise: 50,
  ultimate: -1, // unlimited
};

/**
 * API rate limits per organization tier (requests per minute)
 */
export const ORG_RATE_LIMITS: Record<string, number> = {
  business: 300,
  enterprise: 1000,
  ultimate: 2000,
};

/**
 * Get current feature flags configuration
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...DEFAULT_FLAGS };
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return DEFAULT_FLAGS[feature];
}

/**
 * Check if a subscription tier has access to team collaboration features
 */
export function hasTeamCollaborationAccess(tierId: string): boolean {
  return TEAM_COLLABORATION_TIERS.includes(tierId);
}

/**
 * Get default seat limit for a tier
 */
export function getDefaultSeatLimit(tierId: string): number {
  return DEFAULT_SEAT_LIMITS[tierId] || 1;
}

/**
 * Get rate limit for an organization tier
 */
export function getOrgRateLimit(tierId: string): number {
  return ORG_RATE_LIMITS[tierId] || 60; // Default to 60 rpm
}

/**
 * Check if user's subscription tier supports organizations
 * Returns error object if not supported, null if supported
 */
export function checkOrganizationAccess(userTierId: string): { error?: string; upgradeUrl?: string } {
  if (!isFeatureEnabled('organizations')) {
    return {
      error: 'Organizations feature is not yet available. Please check back soon.',
    };
  }

  if (!hasTeamCollaborationAccess(userTierId)) {
    return {
      error: 'Organizations are available for Business, Enterprise, and Ultimate plans.',
      upgradeUrl: '/subscription',
    };
  }

  return {};
}

/**
 * Log feature flag check for observability
 */
export function logFeatureFlagCheck(
  feature: keyof FeatureFlags,
  userId: string,
  allowed: boolean
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FeatureFlag] ${feature} check for user ${userId}: ${allowed ? 'ALLOWED' : 'DENIED'}`);
  }
}
