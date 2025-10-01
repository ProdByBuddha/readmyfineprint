/**
 * Organization API Routes
 * Implements /api/orgs endpoints for organization management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as orgService from './organization-service';
import { requireUserAuth } from './auth';
import { requireOrgRole, requirePermission } from './auth/permissions';
import { checkOrganizationAccess, isFeatureEnabled } from './feature-flags';

const router = Router();

// Zod validation schemas
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  seatLimit: z.number().int().positive().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

// Middleware to check feature flag
const requireOrgsFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('organizations')) {
    return res.status(503).json({
      error: 'Organizations feature is not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

// Middleware to load organization context
const loadOrgContext = async (req: Request, res: Response, next: Function) => {
  const orgId = req.params.orgId || req.headers['x-org-id'] as string;
  
  if (!orgId) {
    return res.status(400).json({
      error: 'Organization ID required',
      code: 'ORG_ID_MISSING',
    });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  // Load organization and membership
  const org = await orgService.getOrganization(orgId);
  if (!org) {
    return res.status(404).json({
      error: 'Organization not found',
      code: 'ORG_NOT_FOUND',
    });
  }

  const membership = await orgService.getUserOrgMembership(userId, orgId);
  if (!membership || membership.status !== 'active') {
    return res.status(403).json({
      error: 'Not a member of this organization',
      code: 'NOT_ORG_MEMBER',
    });
  }

  // Attach to request
  req.orgId = orgId;
  req.orgRole = membership.role;

  // Update last seen
  await orgService.updateUserLastSeen(userId, orgId);

  next();
};

/**
 * GET /api/me/orgs
 * List organizations current user belongs to
 */
router.get('/me/orgs', requireUserAuth, requireOrgsFeature, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const orgs = await orgService.getUserOrganizations(userId);
    
    res.json({ organizations: orgs });
  } catch (error: any) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * POST /api/orgs
 * Create a new organization
 */
router.post('/orgs', requireUserAuth, requireOrgsFeature, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Validate input
    const input = createOrgSchema.parse(req.body);
    
    // Check if user's subscription tier allows organizations
    const userTier = req.user?.tier || 'free';
    const accessCheck = checkOrganizationAccess(userTier);
    
    if (accessCheck.error) {
      return res.status(402).json({
        error: accessCheck.error,
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: accessCheck.upgradeUrl,
      });
    }

    // Create organization
    const org = await orgService.createOrganization({
      ...input,
      createdByUserId: userId,
      billingTier: userTier,
    });

    res.status(201).json({ organization: org });
  } catch (error: any) {
    console.error('Error creating organization:', error);
    
    if (error.message?.includes('slug already taken')) {
      return res.status(409).json({ error: error.message, code: 'SLUG_TAKEN' });
    }
    
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

/**
 * GET /api/orgs/:orgId
 * Get organization details
 */
router.get('/orgs/:orgId', requireUserAuth, requireOrgsFeature, loadOrgContext, async (req: Request, res: Response) => {
  try {
    const org = await orgService.getOrganization(req.params.orgId);
    res.json({ organization: org });
  } catch (error: any) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

/**
 * PATCH /api/orgs/:orgId
 * Update organization (admin only)
 */
router.patch('/orgs/:orgId', requireUserAuth, requireOrgsFeature, loadOrgContext, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const updates = updateOrgSchema.parse(req.body);
    const org = await orgService.updateOrganization(req.params.orgId, updates);
    
    res.json({ organization: org });
  } catch (error: any) {
    console.error('Error updating organization:', error);
    
    if (error.message?.includes('slug already taken')) {
      return res.status(409).json({ error: error.message, code: 'SLUG_TAKEN' });
    }
    
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

/**
 * DELETE /api/orgs/:orgId
 * Soft delete organization (admin only)
 */
router.delete('/orgs/:orgId', requireUserAuth, requireOrgsFeature, loadOrgContext, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    await orgService.deleteOrganization(req.params.orgId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

/**
 * GET /api/orgs/:orgId/members
 * List organization members
 */
router.get('/orgs/:orgId/members', requireUserAuth, requireOrgsFeature, loadOrgContext, async (req: Request, res: Response) => {
  try {
    const members = await orgService.getOrganizationMembers(req.params.orgId);
    res.json({ members });
  } catch (error: any) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * POST /api/orgs/:orgId/members
 * Add member to organization (admin only)
 */
router.post('/orgs/:orgId/members', requireUserAuth, requireOrgsFeature, loadOrgContext, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const input = addMemberSchema.parse(req.body);
    
    await orgService.addOrganizationMember({
      orgId: req.params.orgId,
      userId: input.userId,
      role: input.role,
      invitedByUserId: req.user!.id,
    });

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('Error adding member:', error);
    
    if (error.message?.includes('already a member')) {
      return res.status(409).json({ error: error.message, code: 'ALREADY_MEMBER' });
    }
    
    if (error.message?.includes('seat limit')) {
      return res.status(402).json({ error: error.message, code: 'SEAT_LIMIT_REACHED' });
    }
    
    res.status(500).json({ error: 'Failed to add member' });
  }
});

/**
 * PATCH /api/orgs/:orgId/members/:userId
 * Update member role or status (admin only)
 */
router.patch('/orgs/:orgId/members/:userId', requireUserAuth, requireOrgsFeature, loadOrgContext, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const updates = updateMemberSchema.parse(req.body);
    const { orgId, userId } = req.params;

    if (updates.role) {
      await orgService.updateOrganizationMemberRole(orgId, userId, updates.role);
    }

    if (updates.status) {
      await orgService.updateOrganizationMemberStatus(orgId, userId, updates.status);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/**
 * DELETE /api/orgs/:orgId/members/:userId
 * Remove member from organization (admin only)
 */
router.delete('/orgs/:orgId/members/:userId', requireUserAuth, requireOrgsFeature, loadOrgContext, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    await orgService.removeOrganizationMember(req.params.orgId, req.params.userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing member:', error);
    
    if (error.message?.includes('last admin')) {
      return res.status(400).json({ error: error.message, code: 'CANNOT_REMOVE_LAST_ADMIN' });
    }
    
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * PATCH /api/me/default-org
 * Set user's default organization
 */
router.patch('/me/default-org', requireUserAuth, requireOrgsFeature, async (req: Request, res: Response) => {
  try {
    const { orgId } = z.object({ orgId: z.string().uuid() }).parse(req.body);
    const userId = req.user!.id;

    // Verify user is a member of this org
    const membership = await orgService.getUserOrgMembership(userId, orgId);
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({
        error: 'Not a member of this organization',
        code: 'NOT_ORG_MEMBER',
      });
    }

    await orgService.setUserDefaultOrganization(userId, orgId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error setting default org:', error);
    res.status(500).json({ error: 'Failed to set default organization' });
  }
});

export default router;
