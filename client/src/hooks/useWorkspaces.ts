import { useQuery, useMutation, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { authFetch } from '@/lib/auth-fetch';

// Types
export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  visibility: 'org' | 'private';
  isDefault: boolean;
  memberCount: number;
  documentCount: number;
  role: 'owner' | 'editor' | 'commenter' | 'viewer' | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  email: string;
  emailVerified: boolean;
  addedByUserId: string | null;
  createdAt: string;
}

export interface WorkspaceDocument {
  documentId: number;
  workspaceId: string;
  addedByUserId: string;
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  visibility: 'org' | 'private';
  isDefault?: boolean;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  visibility?: 'org' | 'private';
  isDefault?: boolean;
}

export interface AddWorkspaceMemberRequest {
  userId: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
}

export interface ShareDocumentRequest {
  documentId: number;
}

// Hook: Fetch workspaces for an organization
export function useWorkspaces(orgId: string | undefined): UseQueryResult<{ workspaces: Workspace[] }> {
  return useQuery({
    queryKey: ['workspaces', 'org', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID required');
      const response = await authFetch(`/api/orgs/${orgId}/workspaces`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      return response.json();
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook: Fetch workspace details
export function useWorkspace(workspaceId: string | undefined): UseQueryResult<{ workspace: Workspace }> {
  return useQuery({
    queryKey: ['workspaces', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');
      const response = await authFetch(`/api/workspaces/${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace');
      }
      return response.json();
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  });
}

// Hook: Fetch workspace members
export function useWorkspaceMembers(workspaceId: string | undefined): UseQueryResult<{ members: WorkspaceMember[] }> {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');
      const response = await authFetch(`/api/workspaces/${workspaceId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace members');
      }
      return response.json();
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  });
}

// Hook: Fetch workspace documents
export function useWorkspaceDocuments(workspaceId: string | undefined): UseQueryResult<{ documents: WorkspaceDocument[] }> {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'documents'],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');
      const response = await authFetch(`/api/workspaces/${workspaceId}/documents`);
      if (!response.ok) {
        throw new Error('Failed to fetch workspace documents');
      }
      return response.json();
    },
    enabled: !!workspaceId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Mutation: Create workspace
export function useCreateWorkspace(orgId: string): UseMutationResult<
  { workspace: Workspace },
  Error,
  CreateWorkspaceRequest
> {
  return useMutation({
    mutationFn: async (data) => {
      const response = await authFetch(`/api/orgs/${orgId}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create workspace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', 'org', orgId] });
    },
  });
}

// Mutation: Update workspace
export function useUpdateWorkspace(workspaceId: string): UseMutationResult<
  { workspace: Workspace },
  Error,
  UpdateWorkspaceRequest
> {
  return useMutation({
    mutationFn: async (data) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update workspace');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', 'org', data.workspace.orgId] });
    },
  });
}

// Mutation: Delete workspace
export function useDeleteWorkspace(workspaceId: string, orgId: string): UseMutationResult<
  { success: boolean; workspaceId: string },
  Error,
  void
> {
  return useMutation({
    mutationFn: async () => {
      const response = await authFetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workspace');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', 'org', orgId] });
      queryClient.removeQueries({ queryKey: ['workspaces', workspaceId] });
    },
  });
}

// Mutation: Add workspace member
export function useAddWorkspaceMember(workspaceId: string): UseMutationResult<
  { member: WorkspaceMember },
  Error,
  AddWorkspaceMemberRequest
> {
  return useMutation({
    mutationFn: async (data) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to add member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }); // Update member count
    },
  });
}

// Mutation: Update workspace member role
export function useUpdateWorkspaceMemberRole(workspaceId: string): UseMutationResult<
  { member: WorkspaceMember },
  Error,
  { userId: string; role: 'owner' | 'editor' | 'commenter' | 'viewer' }
> {
  return useMutation({
    mutationFn: async ({ userId, role }) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update member role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] });
    },
  });
}

// Mutation: Remove workspace member
export function useRemoveWorkspaceMember(workspaceId: string): UseMutationResult<
  { success: boolean },
  Error,
  string
> {
  return useMutation({
    mutationFn: async (userId) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to remove member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }); // Update member count
    },
  });
}

// Mutation: Share document to workspace
export function useShareDocument(workspaceId: string): UseMutationResult<
  { shared: WorkspaceDocument },
  Error,
  ShareDocumentRequest
> {
  return useMutation({
    mutationFn: async (data) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to share document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }); // Update document count
    },
  });
}

// Mutation: Unshare document from workspace
export function useUnshareDocument(workspaceId: string): UseMutationResult<
  { success: boolean },
  Error,
  number
> {
  return useMutation({
    mutationFn: async (documentId) => {
      const response = await authFetch(`/api/workspaces/${workspaceId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unshare document');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }); // Update document count
    },
  });
}
