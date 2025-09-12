import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Key, 
  Plus, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Settings, 
  Crown,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  permissions: 'read' | 'full';
  status: 'active' | 'revoked';
}

interface ApiKeyManagementProps {
  userTier: string;
}

// Feature flag for API key management - can be controlled via environment variable
const API_KEY_FEATURE_ENABLED = import.meta.env.VITE_ENABLE_API_KEYS === 'true' || false;

export default function ApiKeyManagement({ userTier }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<'read' | 'full'>('read');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const hasApiAccess = ['professional', 'business', 'enterprise', 'ultimate'].includes(userTier);

  // Hide entire component if feature is not enabled
  if (!API_KEY_FEATURE_ENABLED) {
    return (
      <Card data-testid="api-feature-disabled-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>API Access</span>
            <Crown className="h-4 w-4 text-orange-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert data-testid="alert-api-feature-coming-soon">
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">API Access Coming Soon</p>
                <p>We're working on bringing you comprehensive API access with:</p>
                <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                  <li>Secure API key generation and management</li>
                  <li>Fine-grained permission controls</li>
                  <li>Usage analytics and rate limiting</li>
                  <li>Comprehensive API documentation</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-3">
                  Stay tuned for updates! This feature will be available to Professional tier and above.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    if (hasApiAccess) {
      fetchApiKeys();
    } else {
      setLoading(false);
    }
  }, [hasApiAccess]);

  const fetchApiKeys = async () => {
    try {
      // This would be implemented when the API key system is ready
      // For now, show placeholder data for enterprise users
      setApiKeys([
        {
          id: '1',
          name: 'Production API',
          key: 'rmp_key_1234567890abcdef',
          createdAt: '2024-01-15',
          lastUsed: '2024-01-20',
          permissions: 'full',
          status: 'active'
        }
      ]);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the API key",
        variant: "destructive"
      });
      return;
    }

    try {
      // This would be implemented when the API key system is ready
      toast({
        title: "Coming Soon",
        description: "API key creation will be available in a future update",
      });
      setShowCreateForm(false);
      setNewKeyName('');
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create API key. Please try again.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const revokeApiKey = async (keyId: string) => {
    if (window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      try {
        // This would be implemented when the API key system is ready
        toast({
          title: "Coming Soon",
          description: "API key revocation will be available in a future update",
        });
      } catch (error) {
        console.error('Error revoking API key:', error);
        toast({
          title: "Revocation Failed",
          description: "Failed to revoke API key. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  if (!hasApiAccess) {
    return (
      <Card data-testid="api-access-upgrade-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>API Access</span>
            <Crown className="h-4 w-4 text-orange-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert data-testid="alert-api-access-required">
            <Crown className="h-4 w-4 text-orange-500" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Professional Tier Required</p>
                <p>API access is available for Professional tier and above. Upgrade your subscription to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Generate and manage API keys</li>
                  <li>Integrate document analysis into your applications</li>
                  <li>Access usage analytics and rate limiting</li>
                  <li>Get comprehensive API documentation</li>
                </ul>
                <Button 
                  className="mt-3"
                  onClick={() => window.location.href = '/subscription?tab=plans'}
                  data-testid="button-upgrade-for-api"
                >
                  Upgrade to Professional
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading API keys...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="api-key-management-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>API Key Management</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {userTier.charAt(0).toUpperCase() + userTier.slice(1)}
              </Badge>
            </CardTitle>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2"
              data-testid="button-create-api-key"
            >
              <Plus className="h-4 w-4" />
              <span>Create Key</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert data-testid="alert-api-coming-soon">
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <strong>Coming Soon:</strong> Full API key management is currently in development. 
              This interface shows the planned functionality for Professional tier and above.
            </AlertDescription>
          </Alert>

          {showCreateForm && (
            <Card className="border-dashed" data-testid="card-create-api-key">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="key-name">API Key Name</Label>
                    <Input
                      id="key-name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production API, Development Key"
                      data-testid="input-api-key-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="key-permissions">Permissions</Label>
                    <select
                      id="key-permissions"
                      value={newKeyPermissions}
                      onChange={(e) => setNewKeyPermissions(e.target.value as 'read' | 'full')}
                      className="w-full p-2 border rounded-md"
                      data-testid="select-api-key-permissions"
                    >
                      <option value="read">Read Only</option>
                      <option value="full">Full Access</option>
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={createApiKey} data-testid="button-confirm-create-key">
                      Create Key
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCreateForm(false)}
                      data-testid="button-cancel-create-key"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-api-keys">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No API keys created yet</p>
                <p className="text-sm">Create your first API key to get started</p>
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <Card key={apiKey.id} className="border-l-4 border-l-green-500" data-testid={`api-key-card-${apiKey.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium" data-testid={`text-api-key-name-${apiKey.id}`}>{apiKey.name}</h4>
                          <Badge variant={apiKey.permissions === 'full' ? 'default' : 'secondary'}>
                            {apiKey.permissions === 'full' ? 'Full Access' : 'Read Only'}
                          </Badge>
                          <Badge variant={apiKey.status === 'active' ? 'default' : 'destructive'}>
                            {apiKey.status === 'active' ? 'Active' : 'Revoked'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                          <span>
                            Last used: {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {visibleKeys.has(apiKey.id) ? apiKey.key : '••••••••••••••••••••'}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            data-testid={`button-toggle-visibility-${apiKey.id}`}
                          >
                            {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(apiKey.key)}
                            data-testid={`button-copy-key-${apiKey.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeApiKey(apiKey.id)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-revoke-key-${apiKey.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="api-usage-card">
        <CardHeader>
          <CardTitle>API Usage & Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Coming Soon:</strong> Comprehensive API documentation, usage analytics, 
              and rate limiting information will be available here.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Rate Limit</h4>
              <p className="text-2xl font-bold text-green-600">1000/hour</p>
              <p className="text-sm text-muted-foreground">Based on {userTier} tier</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium">This Month</h4>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">API calls made</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Success Rate</h4>
              <p className="text-2xl font-bold text-green-600">-</p>
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}