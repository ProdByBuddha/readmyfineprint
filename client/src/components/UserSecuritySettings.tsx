/**
 * User Security Settings Component
 * Comprehensive security management interface with tier-based requirements
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  Mail, 
  Smartphone, 
  Key, 
  Crown,
  TrendingUp,
  Settings,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SecurityStatus {
  userId: string;
  tier: string;
  requirements: {
    tier: string;
    tierName: string;
    minSecurityQuestions: number;
    maxSecurityQuestions: number;
    requireTwoFactor: boolean;
    requireBackupEmail: boolean;
    allowCustomQuestions: boolean;
    requireAdminApproval: boolean;
    description: string;
  };
  compliance: {
    hasMinSecurityQuestions: boolean;
    hasTwoFactorEnabled: boolean;
    hasBackupEmail: boolean;
    isCompliant: boolean;
    missingRequirements: string[];
  };
  securityQuestionCount: number;
  twoFactorEnabled: boolean;
  backupEmailSet: boolean;
}

interface SecurityRecommendation {
  priority: 'required' | 'recommended' | 'optional';
  action: string;
  description: string;
  completed: boolean;
}

interface SecurityDashboard {
  securityStatus: SecurityStatus;
  recommendations: SecurityRecommendation[];
  tierFeatures: {
    customQuestions: boolean;
    backupEmail: boolean;
    adminApproval: boolean;
    advancedRecovery: boolean;
    securityAudit: boolean;
  };
  securityScore: {
    score: number;
    maxScore: number;
    percentage: number;
    level: 'weak' | 'moderate' | 'strong' | 'excellent';
  };
  nextSteps: string[];
}

export function UserSecuritySettings() {
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSecurityDashboard();
  }, []);

  const fetchSecurityDashboard = async () => {
    try {
      const subscriptionToken = localStorage.getItem('subscriptionToken');
      if (!subscriptionToken) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/security/dashboard', {
        headers: {
          'x-subscription-token': subscriptionToken,
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      } else {
        throw new Error('Failed to fetch security dashboard');
      }
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to load security settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'strong': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'moderate': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'weak': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'required': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 'recommended': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'optional': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading security settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to access security settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { securityStatus, recommendations, tierFeatures, securityScore, nextSteps } = dashboard;

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Security Overview</span>
              <Badge variant="outline" className="ml-2">
                <Crown className="h-3 w-3 mr-1" />
                {securityStatus.requirements.tierName}
              </Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Security Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Security Score</span>
              <Badge className={getScoreColor(securityScore.level)}>
                {securityScore.percentage}% - {securityScore.level.charAt(0).toUpperCase() + securityScore.level.slice(1)}
              </Badge>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${securityScore.percentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-muted-foreground">
              {securityScore.score} of {securityScore.maxScore} security points
            </div>
          </div>

          {/* Compliance Status */}
          <div className="flex items-center space-x-2">
            {securityStatus.compliance.isCompliant ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Your account meets all security requirements for {securityStatus.requirements.tierName} tier
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  {securityStatus.compliance.missingRequirements.length} security requirement(s) need attention
                </span>
              </>
            )}
          </div>

          {/* Tier Requirements */}
          {showDetails && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">Your Tier Requirements:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Security Questions: {securityStatus.securityQuestionCount}/{securityStatus.requirements.minSecurityQuestions} required
                  </span>
                  {securityStatus.compliance.hasMinSecurityQuestions ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-orange-600" />
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span>Two-Factor Auth: {securityStatus.requirements.requireTwoFactor ? 'Required' : 'Optional'}</span>
                  {securityStatus.twoFactorEnabled ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : securityStatus.requirements.requireTwoFactor ? (
                    <AlertCircle className="h-3 w-3 text-orange-600" />
                  ) : (
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>Backup Email: {securityStatus.requirements.requireBackupEmail ? 'Required' : 'Optional'}</span>
                  {securityStatus.backupEmailSet ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : securityStatus.requirements.requireBackupEmail ? (
                    <AlertCircle className="h-3 w-3 text-orange-600" />
                  ) : (
                    <span className="text-xs text-muted-foreground">(Optional)</span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Custom Questions: {tierFeatures.customQuestions ? 'Available' : 'Not Available'}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Actions */}
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="settings">Security Settings</TabsTrigger>
          <TabsTrigger value="recovery">Account Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Security Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Excellent! You've completed all security recommendations for your tier.
                  </p>
                </div>
              ) : (
                recommendations.map((rec, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {rec.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{rec.description}</p>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(rec.priority)}`}>
                          {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    {!rec.completed && (
                      <Button size="sm" variant="outline">
                        Set Up
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Security Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <Key className="h-4 w-4" />
                  <span>Security Questions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Questions Set:</span>
                  <Badge variant="outline">
                    {securityStatus.securityQuestionCount}/{securityStatus.requirements.maxSecurityQuestions}
                  </Badge>
                </div>
                <Button className="w-full" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Questions
                </Button>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base">
                  <Smartphone className="h-4 w-4" />
                  <span>Two-Factor Auth</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={securityStatus.twoFactorEnabled ? "default" : "secondary"}>
                    {securityStatus.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Button className="w-full" variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure 2FA
                </Button>
              </CardContent>
            </Card>

            {/* Backup Email */}
            {tierFeatures.backupEmail && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <Mail className="h-4 w-4" />
                    <span>Backup Email</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status:</span>
                    <Badge variant={securityStatus.backupEmailSet ? "default" : "secondary"}>
                      {securityStatus.backupEmailSet ? "Set" : "Not Set"}
                    </Badge>
                  </div>
                  <Button className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Backup Email
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Account Recovery Options</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                {securityStatus.requirements.description}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Email Account Recovery</span>
                  </div>
                  <Badge variant="outline">Available</Badge>
                </div>

                {securityStatus.securityQuestionCount > 0 && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Security Question Recovery</span>
                    </div>
                    <Badge variant="outline">Available</Badge>
                  </div>
                )}

                {securityStatus.twoFactorEnabled && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Two-Factor Recovery</span>
                    </div>
                    <Badge variant="outline">Available</Badge>
                  </div>
                )}

                {securityStatus.requirements.requireAdminApproval && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Crown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Admin-Assisted Recovery</span>
                    </div>
                    <Badge variant="outline">Enterprise Feature</Badge>
                  </div>
                )}
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Keep your recovery options up to date. These methods help you regain access to your account if needed.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}