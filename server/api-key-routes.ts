import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { requireOrgRole } from './auth/permissions';
import { isFeatureEnabled } from './feature-flags';
import * as orgService from './organization-service';
import * as apiKeyService from './api-key-service';

const router = Router();

const requireApiKeyFeature = (req: Request, res: Response, next: NextFunction) => {
  if (!isFeatureEnabled('orgApiKeys')) {
    return res.status(503).json({
      error: 'API keys are not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

const loadOrgContext = async (req: Request, res: Response, next: NextFunction) => {
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

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128, 'Name is too long'),
  scopes: z.array(z.string().trim().min(1)).max(10).optional(),
  rateLimitOverride: z.number().int().positive().max(10000).nullable().optional(),
});

router.get(
  '/orgs/:orgId/api-keys',
  requireUserAuth,
  requireApiKeyFeature,
  loadOrgContext,
  requireOrgRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const apiKeys = await apiKeyService.listOrgApiKeys(req.orgId!);
      res.json({ apiKeys: apiKeys.map(mapResponseRecord) });
    } catch (error) {
      console.error('Failed to list API keys', error);
      res.status(500).json({ error: 'Failed to load API keys' });
    }
  },
);

router.post(
  '/orgs/:orgId/api-keys',
  requireUserAuth,
  requireApiKeyFeature,
  loadOrgContext,
  requireOrgRole('admin'),
  async (req: Request, res: Response) => {
    const parseResult = createApiKeySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    try {
      const result = await apiKeyService.createOrgApiKey({
        orgId: req.orgId!,
        name: parseResult.data.name,
        scopes: parseResult.data.scopes,
        rateLimitOverride: parseResult.data.rateLimitOverride ?? null,
        createdByUserId: req.user!.id,
      });

      res.status(201).json({
        apiKey: mapResponseRecord(result.apiKey),
        secret: result.secret,
      });
    } catch (error) {
      console.error('Failed to create API key', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  },
);

router.post(
  '/orgs/:orgId/api-keys/:apiKeyId/revoke',
  requireUserAuth,
  requireApiKeyFeature,
  loadOrgContext,
  requireOrgRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const record = await apiKeyService.revokeOrgApiKey(req.orgId!, req.params.apiKeyId);
      if (!record) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ apiKey: mapResponseRecord(record) });
    } catch (error) {
      console.error('Failed to revoke API key', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  },
);

function mapResponseRecord(record: apiKeyService.OrgApiKeyRecord) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    scopes: record.scopes,
    rateLimitOverride: record.rateLimitOverride,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
    status: record.revokedAt ? 'revoked' : 'active',
  };
}

export default router;
