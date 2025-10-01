/**
 * Unit tests for RBAC permission system
 */

import { describe, it, expect } from 'vitest';
import { can, getEffectiveWorkspaceRole, isOrgAdmin, isWorkspaceOwner, type PermissionContext } from '../../server/auth/permissions';

describe('RBAC Permission System', () => {
  describe('Organization Permissions', () => {
    it('should allow org admin to manage organization', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'admin',
      };
      
      expect(can(context, 'read', 'organization')).toBe(true);
      expect(can(context, 'update', 'organization')).toBe(true);
      expect(can(context, 'delete', 'organization')).toBe(true);
    });

    it('should allow org member to read organization', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
      };
      
      expect(can(context, 'read', 'organization')).toBe(true);
      expect(can(context, 'update', 'organization')).toBe(false);
      expect(can(context, 'delete', 'organization')).toBe(false);
    });

    it('should allow org viewer to only read organization', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'viewer',
      };
      
      expect(can(context, 'read', 'organization')).toBe(true);
      expect(can(context, 'update', 'organization')).toBe(false);
    });
  });

  describe('Workspace Permissions', () => {
    it('should allow org admin full access to all workspaces', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'admin',
        workspaceId: 'ws1',
      };
      
      expect(can(context, 'read', 'workspace')).toBe(true);
      expect(can(context, 'update', 'workspace')).toBe(true);
      expect(can(context, 'delete', 'workspace')).toBe(true);
    });

    it('should allow workspace owner full access to their workspace', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceId: 'ws1',
        workspaceRole: 'owner',
      };
      
      expect(can(context, 'read', 'workspace')).toBe(true);
      expect(can(context, 'update', 'workspace')).toBe(true);
      expect(can(context, 'delete', 'workspace')).toBe(true);
    });

    it('should allow org member to read org-visible workspace', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceId: 'ws1',
        workspaceVisibility: 'org',
      };
      
      expect(can(context, 'read', 'workspace')).toBe(true);
      expect(can(context, 'update', 'workspace')).toBe(false);
    });

    it('should deny org member access to private workspace without membership', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceId: 'ws1',
        workspaceVisibility: 'private',
      };
      
      expect(can(context, 'read', 'workspace')).toBe(false);
    });

    it('should allow workspace editor to read but not delete workspace', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceId: 'ws1',
        workspaceRole: 'editor',
      };
      
      expect(can(context, 'read', 'workspace')).toBe(true);
      expect(can(context, 'delete', 'workspace')).toBe(false);
    });
  });

  describe('Document Permissions', () => {
    it('should allow org admin to manage all documents', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'admin',
      };
      
      expect(can(context, 'create', 'document')).toBe(true);
      expect(can(context, 'read', 'document')).toBe(true);
      expect(can(context, 'update', 'document')).toBe(true);
      expect(can(context, 'delete', 'document')).toBe(true);
    });

    it('should allow workspace editor to create and edit documents', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'editor',
        workspaceVisibility: 'org',
      };
      
      expect(can(context, 'create', 'document')).toBe(true);
      expect(can(context, 'read', 'document')).toBe(true);
      expect(can(context, 'update', 'document')).toBe(true);
    });

    it('should allow workspace commenter to only read documents', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'commenter',
        workspaceVisibility: 'org',
      };
      
      expect(can(context, 'read', 'document')).toBe(true);
      expect(can(context, 'create', 'document')).toBe(false);
      expect(can(context, 'update', 'document')).toBe(false);
    });

    it('should allow document owner to delete their own document', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'viewer',
        isResourceOwner: true,
      };
      
      expect(can(context, 'delete', 'document')).toBe(true);
    });
  });

  describe('Annotation Permissions', () => {
    it('should allow workspace editor to create annotations', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'editor',
      };
      
      expect(can(context, 'create', 'annotation')).toBe(true);
      expect(can(context, 'read', 'annotation')).toBe(true);
    });

    it('should allow workspace commenter to create annotations', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'commenter',
      };
      
      expect(can(context, 'create', 'annotation')).toBe(true);
      expect(can(context, 'update', 'annotation')).toBe(true);
    });

    it('should not allow workspace viewer to create annotations', () => {
      const context: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'member',
        workspaceRole: 'viewer',
      };
      
      expect(can(context, 'read', 'annotation')).toBe(true);
      expect(can(context, 'create', 'annotation')).toBe(false);
    });
  });

  describe('Invitation Permissions', () => {
    it('should allow only org admin to manage invitations', () => {
      const adminContext: PermissionContext = {
        userId: 'user1',
        orgId: 'org1',
        orgRole: 'admin',
      };
      
      const memberContext: PermissionContext = {
        userId: 'user2',
        orgId: 'org1',
        orgRole: 'member',
      };
      
      expect(can(adminContext, 'create', 'invitation')).toBe(true);
      expect(can(memberContext, 'create', 'invitation')).toBe(false);
    });
  });

  describe('Helper Functions', () => {
    it('should correctly identify org admins', () => {
      expect(isOrgAdmin('admin')).toBe(true);
      expect(isOrgAdmin('member')).toBe(false);
      expect(isOrgAdmin('viewer')).toBe(false);
    });

    it('should correctly identify workspace owners', () => {
      expect(isWorkspaceOwner('owner')).toBe(true);
      expect(isWorkspaceOwner('editor')).toBe(false);
      expect(isWorkspaceOwner('viewer')).toBe(false);
    });

    it('should calculate effective workspace role correctly', () => {
      // Org admin becomes workspace owner
      expect(getEffectiveWorkspaceRole('admin', undefined, 'org')).toBe('owner');
      
      // Explicit workspace role takes precedence
      expect(getEffectiveWorkspaceRole('member', 'editor', 'org')).toBe('editor');
      
      // Org-visible workspace grants viewer to org members
      expect(getEffectiveWorkspaceRole('member', undefined, 'org')).toBe('viewer');
      
      // Private workspace without membership grants no access
      expect(getEffectiveWorkspaceRole('member', undefined, 'private')).toBe(undefined);
    });
  });
});
