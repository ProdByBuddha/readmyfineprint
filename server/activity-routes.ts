/**
 * Activity Events API Routes
 * Provides read-only access to organization and workspace activity feeds.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { requireOrgRole } from './auth/permissions';
import { isFeatureEnabled } from './feature-flags';
import * as orgService from './organization-service';
import * as activityService from './activity-service';

const router = Router();

const requireActivityFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('activity')) {
    return res.status(503).json({
      error: 'Activity feed is not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

const loadOrgContext = async (req: Request, res: Response, next: Function) => {
  const orgId = req.params.orgId;
  const userId = req.user?.id;

  if (!orgId) {
    return res.status(400).json({
      error: 'Organization ID required',
      code: 'ORG_ID_MISSING',
    });
  }

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

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

  req.orgId = orgId;
  req.orgRole = membership.role;

  await orgService.updateUserLastSeen(userId, orgId);

  next();
};

const listActivityQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  actions: z.string().optional(),
});

router.get(
  '/orgs/:orgId/activity-events',
  requireUserAuth,
  requireActivityFeature,
  loadOrgContext,
  requireOrgRole(['admin', 'member', 'viewer']),
  async (req: Request, res: Response) => {
    const parseResult = listActivityQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
    }

    const { workspaceId, limit, cursor, actions } = parseResult.data;

    try {
      const response = await activityService.getOrgActivityEvents({
        orgId: req.orgId!,
        workspaceId,
        limit,
        cursor,
        actions: actions
          ? actions.split(',').map((action) => action.trim()).filter(Boolean)
          : undefined,
      });

      res.json(response);
    } catch (error: any) {
      console.error('Error fetching activity events:', error);
      res.status(500).json({ error: 'Failed to load activity events' });
    }
  }
);

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
});

router.get(
  '/orgs/:orgId/activity-events/summary',
  requireUserAuth,
  requireActivityFeature,
  loadOrgContext,
  requireOrgRole(['admin', 'member']),
  async (req: Request, res: Response) => {
    const parseResult = summaryQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
    }

    const { days } = parseResult.data;

    try {
      const summary = await activityService.getOrgActivitySummary(req.orgId!, days);
      res.json(summary);
    } catch (error: any) {
      console.error('Error fetching activity summary:', error);
      res.status(500).json({ error: 'Failed to load activity summary' });
    }
  }
);

export default router;
