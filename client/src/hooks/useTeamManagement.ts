import { useQuery, useMutation, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { authFetch } from '@/lib/auth-fetch';

// Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  role: 'admin' | 'member' | 'viewer';
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
  user?: {
    email: string;
    emailVerified: boolean;
  };
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
  invitedBy?: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'member' | 'viewer';
}

// Hook: Fetch user's organizations
export function useOrganizations(): UseQueryResult<{ organizations: Organization[] }> {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await authFetch('/api/orgs');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook: Fetch organization details
export function useOrganization(orgId: string | undefined): UseQueryResult<{ organization: Organization }> {
  return useQuery({
    queryKey: ['organizations', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID required');
      const response = await authFetch(`/api/orgs/${orgId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }
      return response.json();
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook: Fetch organization members
export function useOrganizationMembers(orgId: string | undefined): UseQueryResult<{ members: OrganizationMember[] }> {
  return useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID required');
      const response = await authFetch(`/api/orgs/${orgId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      return response.json();
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook: Fetch pending invitations
export function useInvitations(orgId: string | undefined): UseQueryResult<{ invitations: Invitation[] }> {
  return useQuery({
    queryKey: ['organizations', orgId, 'invitations'],
    queryFn: async () => {
      if (!orgId) throw new Error('Organization ID required');
      const response = await authFetch(`/api/orgs/${orgId}/invitations`);
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      return response.json();
    },
    enabled: !!orgId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// Mutation: Create organization
export function useCreateOrganization(): UseMutationResult<
  { organization: Organization },
  Error,
  { name: string; slug: string }
> {
  return useMutation({
    mutationFn: async ({ name, slug }) => {
      const response = await authFetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create organization');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

// Mutation: Create invitation
export function useCreateInvitation(orgId: string): UseMutationResult<
  { invitation: Invitation },
  Error,
  CreateInvitationRequest
> {
  return useMutation({
    mutationFn: async (data) => {
      const response = await authFetch(`/api/orgs/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'invitations'] });
    },
  });
}

// Mutation: Revoke invitation
export function useRevokeInvitation(orgId: string): UseMutationResult<
  { success: boolean },
  Error,
  string
> {
  return useMutation({
    mutationFn: async (invitationId) => {
      const response = await authFetch(`/api/orgs/${orgId}/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'invitations'] });
    },
  });
}

// Mutation: Update member role
export function useUpdateMemberRole(orgId: string): UseMutationResult<
  { success: boolean },
  Error,
  { memberId: string; role: 'admin' | 'member' | 'viewer' }
> {
  return useMutation({
    mutationFn: async ({ memberId, role }) => {
      const response = await authFetch(`/api/orgs/${orgId}/members/${memberId}/role`, {
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
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
    },
  });
}

// Mutation: Remove member
export function useRemoveMember(orgId: string): UseMutationResult<
  { success: boolean },
  Error,
  string
> {
  return useMutation({
    mutationFn: async (memberId) => {
      const response = await authFetch(`/api/orgs/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] }); // Update member count
    },
  });
}
