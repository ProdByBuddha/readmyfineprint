import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface ActivityEvent {
  id: string;
  orgId: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  workspaceName: string | null;
  userEmail: string | null;
}

export interface ActivityEventsResponse {
  events: ActivityEvent[];
  nextCursor?: string;
}

export interface ActivitySummaryItem {
  action: string;
  count: number;
}

interface ActivityEventOptions {
  workspaceId?: string;
  limit?: number;
  actions?: string[];
}

export function useActivityEvents(
  orgId: string | undefined,
  { workspaceId, limit = 25, actions }: ActivityEventOptions = {},
) {
  return useInfiniteQuery<ActivityEventsResponse, Error>({
    queryKey: ['activity-events', orgId, workspaceId ?? 'all', actions?.join(',') ?? 'all', limit],
    queryFn: async ({ pageParam }) => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const params = new URLSearchParams();
      params.set('limit', String(limit));

      if (workspaceId) {
        params.set('workspaceId', workspaceId);
      }

      if (actions && actions.length > 0) {
        params.set('actions', actions.join(','));
      }

      if (typeof pageParam === 'string' && pageParam.length > 0) {
        params.set('cursor', pageParam);
      }

      const response = await authFetch(`/api/orgs/${orgId}/activity-events?${params.toString()}`);

      if (!response.ok) {
        const errorText = await safeParseError(response);
        throw new Error(errorText || 'Failed to load activity events');
      }

      return response.json() as Promise<ActivityEventsResponse>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    enabled: Boolean(orgId),
  });
}

export function useActivitySummary(orgId: string | undefined, days = 7) {
  return useQuery<ActivitySummaryItem[], Error>({
    queryKey: ['activity-summary', orgId, days],
    queryFn: async () => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const params = new URLSearchParams();
      params.set('days', String(days));

      const response = await authFetch(`/api/orgs/${orgId}/activity-events/summary?${params.toString()}`);

      if (!response.ok) {
        const errorText = await safeParseError(response);
        throw new Error(errorText || 'Failed to load activity summary');
      }

      return response.json() as Promise<ActivitySummaryItem[]>;
    },
    enabled: Boolean(orgId),
    staleTime: 60 * 1000,
  });
}

async function safeParseError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') {
      return data.error;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    return undefined;
  } catch (error) {
    console.warn('Failed to parse activity API error response', error);
    return undefined;
  }
}
