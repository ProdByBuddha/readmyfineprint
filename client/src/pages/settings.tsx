import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Shield, 
  Lock, 
  Palette, 
  Bell, 
  CreditCard, 
  Key,
  Download,
  Settings as SettingsIcon,
  ChevronRight,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { UserSecuritySettings } from '@/components/UserSecuritySettings';
import DataExportButton from '@/components/DataExportButton';
import AccountDeletion from '@/components/AccountDeletion';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { sessionFetch } from '@/lib/sessionManager';

interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  legal_disclaimer_accepted: boolean;
  cookie_consent: {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  donation_page_visited: boolean;
  device_fingerprint_backup: string | null;
}

interface SubscriptionInfo {
  tier: {
    id: string;
    name: string;
    monthlyPrice: number;
  };
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('account');
  const [showPreferencesDetails, setShowPreferencesDetails] = useState<boolean>(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  // Fetch user profile with React Query
  const { data: userProfile, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['/api/user/profile'],
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch user preferences with React Query
  const { data: preferencesData, isLoading: preferencesLoading, error: preferencesError } = useQuery({
    queryKey: ['/api/user/preferences'],
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loading = userLoading || preferencesLoading;
  const user = userProfile?.user;
  const subscription = userProfile ? { tier: userProfile.tier, subscription: userProfile.subscription } : null;
  const preferences = preferencesData?.preferences;

  // Mutation for updating preferences with CSRF protection
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const response = await sessionFetch(`/api/user/preferences/${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(key === 'theme' ? { theme: value } : value),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to update preference');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch preferences
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      
      // Update theme immediately in UI if it's a theme change
      if (variables.key === 'theme') {
        setTheme(variables.value);
      }
      
      toast({
        title: "Settings Updated",
        description: "Your preference has been saved successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating preference:', error);
      toast({
        title: "Update Failed",
        description: `Failed to save your preference: ${error.message}`,
        variant: "destructive"
      });
    },
  });

  const updatePreference = (key: string, value: any) => {
    updatePreferenceMutation.mutate({ key, value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Please log in to access your settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Manage your account, security, privacy, and application preferences
          </p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:max-w-4xl">
            <TabsTrigger value="account" className="text-xs sm:text-sm" data-testid="tab-account">
              <User className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm" data-testid="tab-security">
              <Shield className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm" data-testid="tab-privacy">
              <Lock className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs sm:text-sm" data-testid="tab-preferences">
              <Palette className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm" data-testid="tab-notifications">
              <Bell className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs sm:text-sm" data-testid="tab-billing">
              <CreditCard className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
          </TabsList>

          {/* Account Settings Tab */}
          <TabsContent value="account" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card data-testid="account-info-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span>Account Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        value={user.email}
                        disabled
                        className="mt-1"
                        data-testid="input-email"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Contact support to change your email address
                      </p>
                    </div>
                    <div>
                      <Label>Account Status</Label>
                      <div className="mt-1 flex items-center space-x-2">
                        <Badge variant={user.emailVerified ? "default" : "secondary"} data-testid="badge-email-status">
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                        <Badge variant={user.isActive ? "default" : "destructive"} data-testid="badge-account-status">
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Account Created</Label>
                      <p className="font-medium" data-testid="text-created-at">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Login</Label>
                      <p className="font-medium" data-testid="text-last-login">
                        {user.lastLoginAt 
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Current Subscription */}
            {subscription && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card data-testid="subscription-info-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-5 w-5" />
                        <span>Current Subscription</span>
                      </div>
                      <Link href="/subscription">
                        <Button variant="outline" size="sm" data-testid="button-manage-subscription">
                          Manage <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold" data-testid="text-tier-name">
                          {subscription.tier.name}
                        </h3>
                        <p className="text-muted-foreground" data-testid="text-tier-price">
                          {subscription.tier.monthlyPrice === 0 
                            ? 'Free Plan' 
                            : `$${subscription.tier.monthlyPrice}/month`
                          }
                        </p>
                      </div>
                      <Badge 
                        variant={subscription.subscription?.status === 'active' ? 'default' : 'secondary'}
                        data-testid="badge-subscription-status"
                      >
                        {subscription.subscription?.status === 'active' ? 'Active' : subscription.tier.name}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <UserSecuritySettings />
            </motion.div>
          </TabsContent>

          {/* Privacy & Data Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <Card data-testid="privacy-controls-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lock className="h-5 w-5" />
                    <span>Privacy Controls</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {preferences && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Cookie Consent</Label>
                          <p className="text-sm text-muted-foreground">
                            Manage your cookie preferences
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPreferencesDetails(!showPreferencesDetails)}
                          data-testid="button-toggle-cookie-details"
                        >
                          {showPreferencesDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      {showPreferencesDetails && (
                        <div className="space-y-3 p-4 bg-muted rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="necessary-cookies">Necessary Cookies</Label>
                            <Switch
                              id="necessary-cookies"
                              checked={preferences.cookie_consent?.necessary ?? true}
                              disabled
                              data-testid="switch-necessary-cookies"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="analytics-cookies">Analytics Cookies</Label>
                            <Switch
                              id="analytics-cookies"
                              checked={preferences.cookie_consent?.analytics ?? false}
                              onCheckedChange={(checked) => 
                                updatePreference('cookie-consent', {
                                  ...preferences.cookie_consent,
                                  analytics: checked
                                })
                              }
                              data-testid="switch-analytics-cookies"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="marketing-cookies">Marketing Cookies</Label>
                            <Switch
                              id="marketing-cookies"
                              checked={preferences.cookie_consent?.marketing ?? false}
                              onCheckedChange={(checked) => 
                                updatePreference('cookie-consent', {
                                  ...preferences.cookie_consent,
                                  marketing: checked
                                })
                              }
                              data-testid="switch-marketing-cookies"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="data-export-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Download className="h-5 w-5" />
                    <span>Data Export & Deletion</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Export Your Data</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Download a complete copy of your personal data in JSON format (GDPR compliant).
                      </p>
                      <DataExportButton />
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-medium mb-2 text-destructive">Delete Account</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Permanently delete your account and anonymize your personal data.
                      </p>
                      <AccountDeletion 
                        userEmail={user.email} 
                        onSuccess={() => {
                          toast({
                            title: "Account Deleted",
                            description: "Your account has been successfully deleted.",
                          });
                          // Redirect would be handled by the AccountDeletion component
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Application Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card data-testid="appearance-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Palette className="h-5 w-5" />
                    <span>Appearance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="theme-select">Theme</Label>
                    <Select
                      value={theme}
                      onValueChange={(value: 'light' | 'dark') => {
                        setTheme(value);
                        updatePreference('theme', value);
                      }}
                    >
                      <SelectTrigger className="mt-1" data-testid="select-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light" data-testid="option-light-theme">Light</SelectItem>
                        <SelectItem value="dark" data-testid="option-dark-theme">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card data-testid="notifications-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="h-5 w-5" />
                    <span>Notification Preferences</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert data-testid="alert-notifications-coming-soon">
                    <SettingsIcon className="h-4 w-4" />
                    <AlertDescription>
                      Notification preferences will be available in a future update. We'll notify existing users when this feature is ready.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card data-testid="billing-redirect-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5" />
                    <span>Billing & Subscription</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Manage your subscription, billing history, and payment methods
                    </p>
                    <Link href="/subscription">
                      <Button className="w-full sm:w-auto" data-testid="button-go-to-subscription">
                        Go to Subscription Management
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}