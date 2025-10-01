import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface UsageRecord {
  date: string;
  tokensUsed: number;
  analysesCount: number;
  annotationsCount: number;
  apiCallsCount: number;
}

export interface UsageTotals {
  tokensUsed: number;
  analysesCount: number;
  annotationsCount: number;
  apiCallsCount: number;
}

export interface UsageResponse {
  usage: UsageRecord[];
  totals: UsageTotals;
  period: {
    from: string;
    to: string;
    days: number;
  };
}

export interface UsageSummaryResponse {
  totals: UsageTotals;
  period: {
    from: string;
    to: string;
    days: number;
  };
}

interface UsageQueryOptions {
  days?: number;
  from?: string;
  to?: string;
}

export function useOrgUsage(orgId: string | undefined, options: UsageQueryOptions = {}) {
  const { days, from, to } = options;

  return useQuery<UsageResponse, Error>({
    queryKey: ['org-usage', orgId, days ?? null, from ?? null, to ?? null],
    queryFn: async () => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const params = new URLSearchParams();

      if (from) {
        params.set('from', from);
      }

      if (to) {
        params.set('to', to);
      }

      if (!from && days) {
        params.set('days', String(days));
      }

      const query = params.toString();
      const url = query.length > 0 ? `/api/orgs/${orgId}/usage?${query}` : `/api/orgs/${orgId}/usage`;
      const response = await authFetch(url);

      if (!response.ok) {
        const errorText = await safeParseError(response);
        throw new Error(errorText || 'Failed to load organization usage');
      }

      return response.json() as Promise<UsageResponse>;
    },
    enabled: Boolean(orgId),
    staleTime: 60 * 1000,
  });
}

export function useOrgUsageSummary(orgId: string | undefined, days = 30) {
  return useQuery<UsageSummaryResponse, Error>({
    queryKey: ['org-usage-summary', orgId, days],
    queryFn: async () => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const params = new URLSearchParams();
      if (days) {
        params.set('days', String(days));
      }

      const response = await authFetch(`/api/orgs/${orgId}/usage/summary?${params.toString()}`);
      if (!response.ok) {
        const errorText = await safeParseError(response);
        throw new Error(errorText || 'Failed to load usage summary');
      }

      return response.json() as Promise<UsageSummaryResponse>;
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
  } catch (error) {
    console.warn('Failed to parse usage API error response', error);
  }

  return undefined;
}
