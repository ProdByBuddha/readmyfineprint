import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface OrgApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimitOverride: number | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: 'active' | 'revoked';
}

export interface ListOrgApiKeysResponse {
  apiKeys: OrgApiKeySummary[];
}

export interface CreateOrgApiKeyRequest {
  name: string;
  scopes?: string[];
  rateLimitOverride?: number | null;
}

export interface CreateOrgApiKeyResponse {
  apiKey: OrgApiKeySummary;
  secret: string;
}

export interface RevokeOrgApiKeyResponse {
  apiKey: OrgApiKeySummary;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') {
      return data.error;
    }
    if (Array.isArray(data?.details) && data.details.length > 0) {
      return data.details[0]?.message ?? 'Validation failed';
    }
  } catch (error) {
    console.warn('Failed to parse API key error response', error);
  }

  return `Request failed with status ${response.status}`;
}

export function useOrgApiKeys(orgId: string | null | undefined) {
  return useQuery<ListOrgApiKeysResponse, Error>({
    queryKey: ['org-api-keys', orgId],
    queryFn: async () => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const response = await authFetch(`/api/orgs/${orgId}/api-keys`);
      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return response.json() as Promise<ListOrgApiKeysResponse>;
    },
    enabled: Boolean(orgId),
    staleTime: 60 * 1000,
  });
}

export function useCreateOrgApiKey(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<CreateOrgApiKeyResponse, Error, CreateOrgApiKeyRequest>({
    mutationFn: async (payload) => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const response = await authFetch(`/api/orgs/${orgId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return response.json() as Promise<CreateOrgApiKeyResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-api-keys', orgId] });
    },
  });
}

export function useRevokeOrgApiKey(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<RevokeOrgApiKeyResponse, Error, { apiKeyId: string }>({
    mutationFn: async ({ apiKeyId }) => {
      if (!orgId) {
        throw new Error('Organization ID required');
      }

      const response = await authFetch(`/api/orgs/${orgId}/api-keys/${apiKeyId}/revoke`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      return response.json() as Promise<RevokeOrgApiKeyResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-api-keys', orgId] });
    },
  });
}

export function getApiKeyErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}
