import { useInfiniteQuery, useMutation, useQuery, UseInfiniteQueryResult, UseMutationResult, UseQueryResult, InfiniteData } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { queryClient } from '@/lib/queryClient';

export interface AnnotationThreadSummary {
  id: string;
  orgId: string;
  workspaceId: string;
  documentId: number;
  anchor: string;
  isResolved: boolean;
  createdByUserId: string;
  createdAt: string;
  resolvedAt: string | null;
  commentCount: number;
  lastActivityAt: string;
}

export interface AnnotationCommentRecord {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  userEmail: string;
}

export interface AnnotationThreadDetail {
  thread: {
    id: string;
    orgId: string;
    workspaceId: string;
    documentId: number;
    anchor: string;
    isResolved: boolean;
    createdByUserId: string;
    createdByEmail: string;
    createdAt: string;
    resolvedAt: string | null;
  };
  comments: AnnotationCommentRecord[];
}

interface AnnotationThreadsPage {
  threads: AnnotationThreadSummary[];
  nextCursor?: string;
}

export interface AnnotationThreadListFilters {
  documentId?: number;
  includeResolved?: boolean;
  limit?: number;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'undefined' || value === null) continue;
    search.set(key, String(value));
  }
  return search.toString();
}

export function useAnnotationThreads(
  workspaceId: string | undefined,
  filters: AnnotationThreadListFilters = {}
): UseInfiniteQueryResult<InfiniteData<AnnotationThreadsPage, unknown>, Error> {
  return useInfiniteQuery<AnnotationThreadsPage>({
    queryKey: ['annotations', workspaceId, 'threads', filters],
    enabled: Boolean(workspaceId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to load annotation threads');
      }

      const query = buildQueryString({
        documentId: filters.documentId,
        includeResolved: filters.includeResolved,
        limit: filters.limit,
        cursor: pageParam as string | undefined,
      });

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads${query ? `?${query}` : ''}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to load annotation threads';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationThreadsPage;
    },
  });
}

export function useAnnotationThread(
  workspaceId: string | undefined,
  threadId: string | undefined
): UseQueryResult<AnnotationThreadDetail> {
  return useQuery<AnnotationThreadDetail>({
    queryKey: ['annotations', workspaceId, 'thread', threadId],
    enabled: Boolean(workspaceId && threadId),
    queryFn: async () => {
      if (!workspaceId || !threadId) {
        throw new Error('Workspace ID and thread ID are required');
      }

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads/${threadId}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to load annotation thread';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationThreadDetail;
    },
    staleTime: 30 * 1000,
  });
}

export interface CreateAnnotationThreadInput {
  documentId: number;
  anchor: string;
  initialComment?: string;
}

export function useCreateAnnotationThread(
  workspaceId: string | undefined
): UseMutationResult<AnnotationThreadDetail, Error, CreateAnnotationThreadInput> {
  return useMutation<AnnotationThreadDetail, Error, CreateAnnotationThreadInput>({
    mutationFn: async (payload) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to create annotation threads');
      }

      const response = await authFetch(`/api/workspaces/${workspaceId}/annotations/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to create annotation thread';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationThreadDetail;
    },
    onSuccess: () => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId] });
    },
  });
}

export interface AddAnnotationCommentInput {
  body: string;
}

export function useAddAnnotationComment(
  workspaceId: string | undefined,
  threadId: string | undefined
): UseMutationResult<AnnotationCommentRecord, Error, AddAnnotationCommentInput> {
  return useMutation<AnnotationCommentRecord, Error, AddAnnotationCommentInput>({
    mutationFn: async (payload) => {
      if (!workspaceId || !threadId) {
        throw new Error('Workspace ID and thread ID are required to add comments');
      }

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads/${threadId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to add annotation comment';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationCommentRecord;
    },
    onSuccess: () => {
      if (!workspaceId || !threadId) return;
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId, 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId], exact: false });
    },
  });
}

export interface UpdateAnnotationCommentInput {
  commentId: string;
  body: string;
}

export function useUpdateAnnotationComment(
  workspaceId: string | undefined,
  threadId: string | undefined
): UseMutationResult<AnnotationCommentRecord, Error, UpdateAnnotationCommentInput> {
  return useMutation<AnnotationCommentRecord, Error, UpdateAnnotationCommentInput>({
    mutationFn: async ({ commentId, body }) => {
      if (!workspaceId || !threadId) {
        throw new Error('Workspace ID and thread ID are required to update comments');
      }

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads/${threadId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to update annotation comment';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationCommentRecord;
    },
    onSuccess: () => {
      if (!workspaceId || !threadId) return;
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId, 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId], exact: false });
    },
  });
}

export interface DeleteAnnotationCommentInput {
  commentId: string;
}

export function useDeleteAnnotationComment(
  workspaceId: string | undefined,
  threadId: string | undefined
): UseMutationResult<{ success: true }, Error, DeleteAnnotationCommentInput> {
  return useMutation<{ success: true }, Error, DeleteAnnotationCommentInput>({
    mutationFn: async ({ commentId }) => {
      if (!workspaceId || !threadId) {
        throw new Error('Workspace ID and thread ID are required to delete comments');
      }

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads/${threadId}/comments/${commentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to delete annotation comment';
        throw new Error(message);
      }

      return (await response.json()) as { success: true };
    },
    onSuccess: () => {
      if (!workspaceId || !threadId) return;
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId, 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId], exact: false });
    },
  });
}

export interface ToggleThreadResolutionInput {
  resolved: boolean;
}

export function useToggleThreadResolution(
  workspaceId: string | undefined,
  threadId: string | undefined
): UseMutationResult<AnnotationThreadSummary, Error, ToggleThreadResolutionInput> {
  return useMutation<AnnotationThreadSummary, Error, ToggleThreadResolutionInput>({
    mutationFn: async ({ resolved }) => {
      if (!workspaceId || !threadId) {
        throw new Error('Workspace ID and thread ID are required to update resolution');
      }

      const response = await authFetch(
        `/api/workspaces/${workspaceId}/annotations/threads/${threadId}/resolve`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error?.error ?? 'Failed to update annotation resolution state';
        throw new Error(message);
      }

      return (await response.json()) as AnnotationThreadSummary;
    },
    onSuccess: () => {
      if (!workspaceId || !threadId) return;
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId, 'thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['annotations', workspaceId], exact: false });
    },
  });
}
