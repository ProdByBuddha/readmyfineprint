import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useTeamManagement';
import {
  useCreateOrgApiKey,
  useOrgApiKeys,
  useRevokeOrgApiKey,
} from '@/hooks/useApiKeys';
import {
  AlertCircle,
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';

const ALLOWED_TIERS = ['professional', 'business', 'enterprise', 'ultimate'];
const API_KEY_FEATURE_ENABLED = import.meta.env.VITE_ENABLE_API_KEYS !== 'false';
const DEFAULT_SCOPE = 'documents.read';

const SCOPE_OPTIONS = [
  { value: 'documents.read', label: 'Read organization documents' },
  { value: 'documents.manage', label: 'Manage documents & annotations' },
];

interface ApiKeyManagementProps {
  userTier: string;
}

export default function ApiKeyManagement({ userTier }: ApiKeyManagementProps) {
  const { toast } = useToast();
  const { data: orgsData, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const organizations = orgsData?.organizations ?? [];
  const adminOrganizations = useMemo(
    () => organizations.filter((org) => org.role === 'admin'),
    [organizations],
  );

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>(DEFAULT_SCOPE);
  const [rateLimitOverride, setRateLimitOverride] = useState<string>('');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId && adminOrganizations.length > 0) {
      setSelectedOrgId(adminOrganizations[0].id);
    }
  }, [adminOrganizations, selectedOrgId]);

  const { data: apiKeysData, isLoading: keysLoading, error: apiKeysError } = useOrgApiKeys(selectedOrgId);
  const createApiKeyMutation = useCreateOrgApiKey(selectedOrgId);
  const revokeApiKeyMutation = useRevokeOrgApiKey(selectedOrgId);

  const hasApiAccess = ALLOWED_TIERS.includes(userTier);
  const apiKeys = apiKeysData?.apiKeys ?? [];

  const handleCreateApiKey = async () => {
    if (!selectedOrgId) {
      toast({
        title: 'Organization required',
        description: 'Select an organization before creating an API key.',
        variant: 'destructive',
      });
      return;
    }

    if (!newKeyName.trim()) {
      toast({
        title: 'Name required',
        description: 'Provide a friendly name for the API key.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createApiKeyMutation.mutateAsync({
        name: newKeyName.trim(),
        scopes: [selectedScope],
        rateLimitOverride: rateLimitOverride ? Number(rateLimitOverride) : undefined,
      });

      setGeneratedSecret(result.secret);
      setShowCreateDialog(false);
      setNewKeyName('');
      setRateLimitOverride('');
      setSelectedScope(DEFAULT_SCOPE);

      toast({
        title: 'API key created',
        description: 'Copy the key now. It will not be shown again.',
      });
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Unable to create API key.',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeApiKey = async (apiKeyId: string) => {
    if (!selectedOrgId) return;

    const confirmed = window.confirm('Revoke this API key? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    try {
      await revokeApiKeyMutation.mutateAsync({ apiKeyId });
      toast({
        title: 'API key revoked',
        description: 'The key is no longer usable.',
      });
    } catch (error) {
      toast({
        title: 'Revocation failed',
        description: error instanceof Error ? error.message : 'Unable to revoke API key.',
        variant: 'destructive',
      });
    }
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      toast({
        title: 'Copied to clipboard',
        description: 'Store the key in a secure password manager.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy API key to clipboard.',
        variant: 'destructive',
      });
    }
  };

  if (!API_KEY_FEATURE_ENABLED) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
            <Badge variant="outline" className="text-orange-500 border-orange-200">
              Coming Soon
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Preparing secure API access</AlertTitle>
            <AlertDescription>
              We are finalizing the API key management experience. Enterprise subscribers will receive early access notifications.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!hasApiAccess) {
    return (
      <Card data-testid="api-access-upgrade-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
            <Badge variant="outline" className="text-orange-500 border-orange-200">Upgrade</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Professional tier required</AlertTitle>
            <AlertDescription>
              API key management is available for Professional plans and above. Upgrade to generate secure tokens, monitor usage, and configure custom rate limits.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => (window.location.href = '/subscription?tab=plans')}>
            View subscription plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (orgsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading organizations…</span>
        </CardContent>
      </Card>
    );
  }

  if (orgsError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Unable to load organizations</AlertTitle>
            <AlertDescription>{orgsError instanceof Error ? orgsError.message : 'Unknown error'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (adminOrganizations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Administrator access required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              API keys can be managed by organization administrators. Ask an admin to grant you access or generate keys on your behalf.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const currentOrg = adminOrganizations.find((org) => org.id === selectedOrgId) ?? adminOrganizations[0];

  return (
    <div className="space-y-6">
      <Card data-testid="api-key-management-card">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key Management
              </CardTitle>
              <CardDescription>
                Generate and revoke organization-scoped API keys. Keys are shown only once when created.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="api-key-org-select" className="text-sm font-medium">
                  Organization
                </Label>
                <Select
                  value={currentOrg?.id ?? ''}
                  onValueChange={(value) => setSelectedOrgId(value)}
                  defaultValue={currentOrg?.id}
                >
                  <SelectTrigger id="api-key-org-select" className="min-w-[200px]">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedSecret && (
            <Alert>
              <AlertTitle className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                New API key created
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">Copy this key now. It will not be displayed again.</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{generatedSecret}</code>
                  <Button size="sm" variant="outline" onClick={() => copySecret(generatedSecret)}>
                    <Copy className="mr-1 h-4 w-4" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setGeneratedSecret(null)}>
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {keysLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading API keys…</span>
            </div>
          ) : apiKeysError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load API keys</AlertTitle>
              <AlertDescription>
                {apiKeysError instanceof Error ? apiKeysError.message : 'Unknown error occurred.'}
              </AlertDescription>
            </Alert>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              <p>No API keys created yet.</p>
              <p>Create your first key to integrate with the Read My Fine Print API.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <Card key={apiKey.id} className="border-l-4 border-l-primary/60">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">{apiKey.name}</h4>
                        <Badge variant={apiKey.status === 'active' ? 'default' : 'secondary'}>
                          {apiKey.status === 'active' ? 'Active' : 'Revoked'}
                        </Badge>
                        <Badge variant="outline">{formatScopeLabel(apiKey.scopes)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
                        <span>
                          Last used{' '}
                          {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'Never'}
                        </span>
                        {apiKey.rateLimitOverride ? (
                          <span>Rate limit override: {apiKey.rateLimitOverride} requests/minute</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                          {maskSecret(apiKey.prefix)}
                        </code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRevokeApiKey(apiKey.id)}
                        disabled={apiKey.status === 'revoked' || revokeApiKeyMutation.isPending}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Revoke
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Provide a friendly name and select the scope. The generated key inherits your organization permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Key name</Label>
              <Input
                id="api-key-name"
                placeholder="e.g. Production integration"
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-scope">Permissions</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger id="api-key-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-rate-limit">Custom rate limit (requests per minute)</Label>
              <Input
                id="api-key-rate-limit"
                type="number"
                placeholder="Optional"
                value={rateLimitOverride}
                onChange={(event) => setRateLimitOverride(event.target.value)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApiKey} disabled={createApiKeyMutation.isPending}>
              {createApiKeyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function maskSecret(prefix: string): string {
  return `${prefix}•••••••••••••`;
}

function formatScopeLabel(scopes: string[]): string {
  if (scopes.length === 0) {
    return 'Read';
  }

  if (scopes.includes('documents.manage')) {
    return 'Full access';
  }

  return 'Read only';
}
