/**
 * Workspace API Routes
 * Implements /api/workspaces endpoints for workspace management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as workspaceService from './workspace-service';
import * as orgService from './organization-service';
import { requireUserAuth } from './auth';
import { requireOrgRole } from './auth/permissions';
import { isFeatureEnabled } from './feature-flags';

const router = Router();

// Zod validation schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['org', 'private']),
  isDefault: z.boolean().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  visibility: z.enum(['org', 'private']).optional(),
  isDefault: z.boolean().optional(),
});

const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'editor', 'commenter', 'viewer']),
});

const updateWorkspaceMemberSchema = z.object({
  role: z.enum(['owner', 'editor', 'commenter', 'viewer']),
});

const shareDocumentSchema = z.object({
  documentId: z.number().int().positive(),
});

// Middleware to check feature flag
const requireWorkspacesFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('workspaces')) {
    return res.status(503).json({
      error: 'Workspaces feature is not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

// Middleware to verify workspace access
const requireWorkspaceAccess = async (req: Request, res: Response, next: Function) => {
  const workspaceId = req.params.workspaceId;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const hasAccess = await workspaceService.hasWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied to this workspace',
        code: 'WORKSPACE_ACCESS_DENIED',
      });
    }
    next();
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to verify workspace access',
      message: error.message,
    });
  }
};

// Middleware to require workspace owner/editor role
const requireWorkspaceEditor = async (req: Request, res: Response, next: Function) => {
  const workspaceId = req.params.workspaceId;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const role = await workspaceService.getUserWorkspaceRole(workspaceId, userId);
    if (!role || (role !== 'owner' && role !== 'editor')) {
      return res.status(403).json({
        error: 'Editor or owner role required',
        code: 'INSUFFICIENT_WORKSPACE_PERMISSIONS',
      });
    }
    next();
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to verify workspace permissions',
      message: error.message,
    });
  }
};

// Middleware to require workspace owner role
const requireWorkspaceOwner = async (req: Request, res: Response, next: Function) => {
  const workspaceId = req.params.workspaceId;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const role = await workspaceService.getUserWorkspaceRole(workspaceId, userId);
    if (role !== 'owner') {
      return res.status(403).json({
        error: 'Owner role required',
        code: 'INSUFFICIENT_WORKSPACE_PERMISSIONS',
      });
    }
    next();
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to verify workspace permissions',
      message: error.message,
    });
  }
};

/**
 * POST /api/orgs/:orgId/workspaces
 * Create a new workspace
 */
router.post(
  '/orgs/:orgId/workspaces',
  requireUserAuth,
  requireWorkspacesFeature,
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;
      const userId = req.user!.id;

      // Validate input
      const validation = createWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: validation.error.issues,
        });
      }

      // Verify user is org member
      const membership = await orgService.getUserOrgMembership(userId, orgId);
      if (!membership) {
        return res.status(403).json({
          error: 'Not a member of this organization',
          code: 'NOT_ORG_MEMBER',
        });
      }

      // Create workspace
      const workspace = await workspaceService.createWorkspace({
        orgId,
        name: validation.data.name,
        description: validation.data.description,
        visibility: validation.data.visibility,
        isDefault: validation.data.isDefault,
        createdByUserId: userId,
      });

      return res.status(201).json({ workspace });
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      return res.status(500).json({
        error: 'Failed to create workspace',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/orgs/:orgId/workspaces
 * List all workspaces in an organization
 */
router.get(
  '/orgs/:orgId/workspaces',
  requireUserAuth,
  requireWorkspacesFeature,
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.orgId;
      const userId = req.user!.id;

      // Verify user is org member
      const membership = await orgService.getUserOrgMembership(userId, orgId);
      if (!membership) {
        return res.status(403).json({
          error: 'Not a member of this organization',
          code: 'NOT_ORG_MEMBER',
        });
      }

      const workspaces = await workspaceService.listWorkspacesByOrg(orgId, userId);

      return res.json({ workspaces });
    } catch (error: any) {
      console.error('Error listing workspaces:', error);
      return res.status(500).json({
        error: 'Failed to list workspaces',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId
 * Get workspace details
 */
router.get(
  '/workspaces/:workspaceId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceAccess,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;
      const userId = req.user!.id;

      const workspace = await workspaceService.getWorkspaceById(workspaceId, userId);

      return res.json({ workspace });
    } catch (error: any) {
      console.error('Error getting workspace:', error);
      return res.status(500).json({
        error: 'Failed to get workspace',
        message: error.message,
      });
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId
 * Update workspace
 */
router.patch(
  '/workspaces/:workspaceId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;

      // Validate input
      const validation = updateWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: validation.error.issues,
        });
      }

      const workspace = await workspaceService.updateWorkspace(
        workspaceId,
        validation.data,
        req.user!.id
      );

      return res.json({ workspace });
    } catch (error: any) {
      console.error('Error updating workspace:', error);
      return res.status(500).json({
        error: 'Failed to update workspace',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId
 * Delete (archive) workspace
 */
router.delete(
  '/workspaces/:workspaceId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;

      const result = await workspaceService.deleteWorkspace(
        workspaceId,
        req.user!.id
      );

      return res.json(result);
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      return res.status(500).json({
        error: 'Failed to delete workspace',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/members
 * List workspace members
 */
router.get(
  '/workspaces/:workspaceId/members',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceAccess,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;

      const members = await workspaceService.listWorkspaceMembers(workspaceId);

      return res.json({ members });
    } catch (error: any) {
      console.error('Error listing workspace members:', error);
      return res.status(500).json({
        error: 'Failed to list workspace members',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/members
 * Add member to workspace
 */
router.post(
  '/workspaces/:workspaceId/members',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;
      const addedByUserId = req.user!.id;

      // Validate input
      const validation = addWorkspaceMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: validation.error.issues,
        });
      }

      const member = await workspaceService.addWorkspaceMember({
        workspaceId,
        userId: validation.data.userId,
        role: validation.data.role,
        addedByUserId,
      });

      return res.status(201).json({ member });
    } catch (error: any) {
      console.error('Error adding workspace member:', error);
      return res.status(400).json({
        error: 'Failed to add workspace member',
        message: error.message,
      });
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId/members/:userId
 * Update workspace member role
 */
router.patch(
  '/workspaces/:workspaceId/members/:userId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, userId } = req.params;

      // Validate input
      const validation = updateWorkspaceMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: validation.error.issues,
        });
      }

      const member = await workspaceService.updateWorkspaceMemberRole(
        workspaceId,
        userId,
        validation.data.role,
        req.user!.id
      );

      return res.json({ member });
    } catch (error: any) {
      console.error('Error updating workspace member:', error);
      return res.status(400).json({
        error: 'Failed to update workspace member',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId/members/:userId
 * Remove member from workspace
 */
router.delete(
  '/workspaces/:workspaceId/members/:userId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceOwner,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, userId } = req.params;

      const result = await workspaceService.removeWorkspaceMember(
        workspaceId,
        userId,
        req.user!.id
      );

      return res.json(result);
    } catch (error: any) {
      console.error('Error removing workspace member:', error);
      return res.status(400).json({
        error: 'Failed to remove workspace member',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/documents
 * List documents in workspace
 */
router.get(
  '/workspaces/:workspaceId/documents',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceAccess,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;

      const documents = await workspaceService.listWorkspaceDocuments(workspaceId);

      return res.json({ documents });
    } catch (error: any) {
      console.error('Error listing workspace documents:', error);
      return res.status(500).json({
        error: 'Failed to list workspace documents',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/documents
 * Share document to workspace
 */
router.post(
  '/workspaces/:workspaceId/documents',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceEditor,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.workspaceId;
      const addedByUserId = req.user!.id;

      // Validate input
      const validation = shareDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: validation.error.issues,
        });
      }

      const shared = await workspaceService.shareDocumentToWorkspace({
        workspaceId,
        documentId: validation.data.documentId,
        addedByUserId,
      });

      return res.status(201).json({ shared });
    } catch (error: any) {
      console.error('Error sharing document:', error);
      return res.status(400).json({
        error: 'Failed to share document',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId/documents/:documentId
 * Unshare document from workspace
 */
router.delete(
  '/workspaces/:workspaceId/documents/:documentId',
  requireUserAuth,
  requireWorkspacesFeature,
  requireWorkspaceEditor,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId, documentId } = req.params;

      const result = await workspaceService.unshareDocumentFromWorkspace(
        workspaceId,
        parseInt(documentId, 10),
        req.user!.id
      );

      return res.json(result);
    } catch (error: any) {
      console.error('Error unsharing document:', error);
      return res.status(400).json({
        error: 'Failed to unshare document',
        message: error.message,
      });
    }
  }
);

export default router;
