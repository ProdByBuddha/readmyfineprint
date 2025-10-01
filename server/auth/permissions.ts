import "./types";
/**
 * RBAC Permission System for Team Collaboration
 * 
 * Implements organization-level and workspace-level permissions
 * with a hierarchical evaluation model.
 */

import { type Request, type Response, type NextFunction } from 'express';

// Permission types and enums
export type OrgRole = 'admin' | 'member' | 'viewer';
export type WorkspaceRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type WorkspaceVisibility = 'org' | 'private';

export type ResourceType = 'organization' | 'workspace' | 'document' | 'annotation' | 'invitation';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'invite';

/**
 * Permission context for evaluation
 */
export interface PermissionContext {
  userId: string;
  orgId?: string;
  orgRole?: OrgRole;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
  workspaceVisibility?: WorkspaceVisibility;
  isResourceOwner?: boolean;
}

/**
 * Organization role permission matrix
 */
const ORG_PERMISSIONS: Record<OrgRole, Record<ResourceType, Action[]>> = {
  admin: {
    organization: ['read', 'update', 'delete', 'manage'],
    workspace: ['create', 'read', 'update', 'delete', 'manage'],
    document: ['create', 'read', 'update', 'delete'],
    annotation: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'read', 'delete'],
  },
  member: {
    organization: ['read'],
    workspace: ['create', 'read', 'update'], // Can create/manage own workspaces
    document: ['create', 'read', 'update'],
    annotation: ['create', 'read', 'update', 'delete'],
    invitation: [],
  },
  viewer: {
    organization: ['read'],
    workspace: ['read'],
    document: ['read'],
    annotation: ['read'],
    invitation: [],
  },
};

/**
 * Workspace role permission matrix
 */
const WORKSPACE_PERMISSIONS: Record<WorkspaceRole, Record<ResourceType, Action[]>> = {
  owner: {
    organization: [],
    workspace: ['read', 'update', 'delete', 'manage'],
    document: ['create', 'read', 'update', 'delete'],
    annotation: ['create', 'read', 'update', 'delete'],
    invitation: [],
  },
  editor: {
    organization: [],
    workspace: ['read'],
    document: ['create', 'read', 'update'],
    annotation: ['create', 'read', 'update', 'delete'],
    invitation: [],
  },
  commenter: {
    organization: [],
    workspace: ['read'],
    document: ['read'],
    annotation: ['create', 'read', 'update'],
    invitation: [],
  },
  viewer: {
    organization: [],
    workspace: ['read'],
    document: ['read'],
    annotation: ['read'],
    invitation: [],
  },
};

/**
 * Check if user has permission for an action on a resource
 * 
 * Permission evaluation rules:
 * 1. Org admins have full access to everything in the org
 * 2. For workspaces: effective permission = max(org_role, workspace_role)
 * 3. Private workspaces require explicit workspace membership
 * 4. Org-visible workspaces grant at least Viewer to all org members
 * 5. Resource owners have elevated permissions
 */
export function can(
  context: PermissionContext,
  action: Action,
  resource: ResourceType
): boolean {
  const { orgRole, workspaceRole, workspaceVisibility, isResourceOwner } = context;

  // No org role means no access (must be org member)
  if (!orgRole && resource !== 'organization') {
    return false;
  }

  // Organization-level checks
  if (resource === 'organization') {
    return orgRole ? hasPermission(ORG_PERMISSIONS[orgRole], resource, action) : false;
  }

  // Invitations are org-admin only
  if (resource === 'invitation') {
    return orgRole === 'admin';
  }

  // Workspace-specific checks
  if (resource === 'workspace') {
    // Org admins can do anything
    if (orgRole === 'admin') return true;

    // Workspace owner can do anything with their workspace
    if (workspaceRole === 'owner') return true;

    // Check workspace role permissions
    if (workspaceRole) {
      return hasPermission(WORKSPACE_PERMISSIONS[workspaceRole], resource, action);
    }

    // For org-visible workspaces, grant org-level permissions
    if (workspaceVisibility === 'org' && orgRole) {
      return hasPermission(ORG_PERMISSIONS[orgRole], resource, action);
    }

    // Private workspace without explicit membership = no access
    return false;
  }

  // Document and annotation checks
  if (resource === 'document' || resource === 'annotation') {
    // Org admins have full access
    if (orgRole === 'admin') return true;

    // Resource owners have elevated permissions
    if (isResourceOwner && (action === 'update' || action === 'delete')) {
      return true;
    }

    // Check workspace role first (more specific)
    if (workspaceRole) {
      if (hasPermission(WORKSPACE_PERMISSIONS[workspaceRole], resource, action)) {
        return true;
      }
    }

    // For org-visible workspaces, check org role
    if (workspaceVisibility === 'org' && orgRole) {
      return hasPermission(ORG_PERMISSIONS[orgRole], resource, action);
    }

    // Private workspace requires explicit workspace membership
    if (workspaceVisibility === 'private' && !workspaceRole) {
      return false;
    }

    return false;
  }

  return false;
}

/**
 * Helper to check if permissions array includes an action
 */
function hasPermission(
  permissions: Record<ResourceType, Action[]>,
  resource: ResourceType,
  action: Action
): boolean {
  const resourcePermissions = permissions[resource] || [];
  return resourcePermissions.includes(action) || resourcePermissions.includes('manage');
}

/**
 * Middleware: Require user to be a member of an organization
 */
export function requireOrgMembership(req: Request, res: Response, next: NextFunction) {
  const orgId = req.headers['x-org-id'] as string || req.query.orgId as string;
  
  if (!orgId) {
    return res.status(400).json({
      error: 'Organization context required',
      code: 'ORG_CONTEXT_MISSING',
    });
  }

  // Org membership will be loaded and validated by org context middleware
  req.orgId = orgId;
  next();
}

/**
 * Middleware: Require specific organization role
 */
export function requireOrgRole(requiredRole: OrgRole | OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userOrgRole = req.orgRole as OrgRole | undefined;

    if (!userOrgRole) {
      return res.status(403).json({
        error: 'Organization membership required',
        code: 'NOT_ORG_MEMBER',
      });
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Admin always has access
    if (userOrgRole === 'admin') {
      return next();
    }

    if (!allowedRoles.includes(userOrgRole)) {
      return res.status(403).json({
        error: 'Insufficient organization permissions',
        code: 'INSUFFICIENT_ORG_PERMISSIONS',
        required: allowedRoles,
        current: userOrgRole,
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific workspace permission
 */
export function requireWorkspacePermission(action: Action, resource: ResourceType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context: PermissionContext = {
      userId: req.user?.id || '',
      orgId: req.orgId,
      orgRole: req.orgRole as OrgRole,
      workspaceId: req.workspaceId,
      workspaceRole: req.workspaceRole as WorkspaceRole,
      workspaceVisibility: req.workspaceVisibility as WorkspaceVisibility,
      isResourceOwner: req.isResourceOwner,
    };

    if (!can(context, action, resource)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        action,
        resource,
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission on any resource
 */
export function requirePermission(action: Action, resource: ResourceType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context: PermissionContext = {
      userId: req.user?.id || '',
      orgId: req.orgId,
      orgRole: req.orgRole as OrgRole,
      workspaceId: req.workspaceId,
      workspaceRole: req.workspaceRole as WorkspaceRole,
      workspaceVisibility: req.workspaceVisibility as WorkspaceVisibility,
      isResourceOwner: req.isResourceOwner,
    };

    if (!can(context, action, resource)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        action,
        resource,
      });
    }

    next();
  };
}

/**
 * Check if user has admin access to organization
 */
export function isOrgAdmin(orgRole?: OrgRole): boolean {
  return orgRole === 'admin';
}

/**
 * Check if user has workspace owner access
 */
export function isWorkspaceOwner(workspaceRole?: WorkspaceRole): boolean {
  return workspaceRole === 'owner';
}

/**
 * Get effective workspace role considering org role
 */
export function getEffectiveWorkspaceRole(
  orgRole?: OrgRole,
  workspaceRole?: WorkspaceRole,
  workspaceVisibility?: WorkspaceVisibility
): WorkspaceRole | undefined {
  // Org admins act as workspace owners
  if (orgRole === 'admin') return 'owner';

  // Explicit workspace role takes precedence
  if (workspaceRole) return workspaceRole;

  // For org-visible workspaces, org members get viewer access
  if (workspaceVisibility === 'org' && orgRole) {
    return 'viewer';
  }

  return undefined;
}

// Extend Express Request type
declare global {
