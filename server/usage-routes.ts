/**
 * Usage Analytics API Routes
 * Provides organization admins with visibility into daily collaboration usage.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { requireOrgRole } from './auth/permissions';
import { isFeatureEnabled } from './feature-flags';
import * as orgService from './organization-service';
import * as usageService from './usage-service';

const router = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requireUsageFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('usage')) {
    return res.status(503).json({
      error: 'Usage analytics are not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }

  return next();
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

  return next();
};

const usageQuerySchema = z
  .object({
    from: z
      .string()
      .regex(DATE_PATTERN, 'Invalid date format, expected YYYY-MM-DD')
      .optional(),
    to: z
      .string()
      .regex(DATE_PATTERN, 'Invalid date format, expected YYYY-MM-DD')
      .optional(),
    days: z.coerce.number().int().min(1).max(180).optional(),
  })
  .refine((value) => !(value.from && value.days), {
    message: 'Provide either a `from` date or a `days` lookback, not both',
    path: ['days'],
  });

router.get(
  '/orgs/:orgId/usage',
  requireUserAuth,
  requireUsageFeature,
  loadOrgContext,
  requireOrgRole(['admin', 'member']),
  async (req: Request, res: Response) => {
    const parsed = usageQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.issues,
      });
    }

    const { from, to, days } = parsed.data;

    try {
      const usage = await usageService.getOrgUsage(req.orgId!, { from, to, days });
      return res.json(usage);
    } catch (error: any) {
      console.error('Failed to load usage analytics:', error);
      return res.status(500).json({ error: 'Failed to load usage analytics' });
    }
  },
);

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
});

router.get(
  '/orgs/:orgId/usage/summary',
  requireUserAuth,
  requireUsageFeature,
  loadOrgContext,
  requireOrgRole(['admin', 'member']),
  async (req: Request, res: Response) => {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parsed.error.issues,
      });
    }

    const { days } = parsed.data;

    try {
      const summary = await usageService.getOrgUsageSummary(req.orgId!, days);
      return res.json(summary);
    } catch (error: any) {
      console.error('Failed to load usage analytics summary:', error);
      return res.status(500).json({ error: 'Failed to load usage analytics summary' });
    }
  },
);

export default router;
