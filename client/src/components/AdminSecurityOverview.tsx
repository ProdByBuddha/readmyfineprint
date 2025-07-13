/**
 * Admin Security Overview Component
 * Comprehensive view of user security compliance across all tiers
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Search,
  TrendingUp,
  Crown,
  Key,
  Smartphone,
  Mail,
  RefreshCw,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SecurityOverviewStats {
  totalUsers: number;
  compliantUsers: number;
  nonCompliantUsers: number;
  compliancePercentage: number;
  tierBreakdown: {
    tier: string;
    totalUsers: number;
    compliantUsers: number;
    complianceRate: number;
  }[];
  securityFeatureUsage: {
    securityQuestions: number;
    twoFactorAuth: number;
    backupEmail: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
}

interface UserSecurityRecord {
  userId: string;
  email: string;
  tier: string;
  isCompliant: boolean;
  securityQuestionCount: number;
  twoFactorEnabled: boolean;
  backupEmailSet: boolean;
  missingRequirements: string[];
  lastSecurityUpdate: string;
  riskScore: number;
}

export function AdminSecurityOverview({ adminToken }: { adminToken: string }) {
  const [stats, setStats] = useState<SecurityOverviewStats | null>(null);
  const [users, setUsers] = useState<UserSecurityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchSecurityOverview();
  }, []);

  const fetchSecurityOverview = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, these would be separate API endpoints
      // For now, we'll simulate the data
      
      const mockStats: SecurityOverviewStats = {
        totalUsers: 1250,
        compliantUsers: 892,
        nonCompliantUsers: 358,
        compliancePercentage: 71.4,
        tierBreakdown: [
          { tier: 'free', totalUsers: 450, compliantUsers: 180, complianceRate: 40 },
          { tier: 'starter', totalUsers: 350, compliantUsers: 280, complianceRate: 80 },
          { tier: 'professional', totalUsers: 280, compliantUsers: 252, complianceRate: 90 },
          { tier: 'business', totalUsers: 120, compliantUsers: 115, complianceRate: 95.8 },
          { tier: 'enterprise', totalUsers: 35, compliantUsers: 35, complianceRate: 100 },
          { tier: 'ultimate', totalUsers: 15, compliantUsers: 15, complianceRate: 100 }
        ],
        securityFeatureUsage: {
          securityQuestions: 85,
          twoFactorAuth: 62,
          backupEmail: 45
        },
        riskLevel: 'medium'
      };

      const mockUsers: UserSecurityRecord[] = [
        {
          userId: '1',
          email: 'user1@example.com',
          tier: 'professional',
          isCompliant: true,
          securityQuestionCount: 4,
          twoFactorEnabled: true,
          backupEmailSet: false,
          missingRequirements: [],
          lastSecurityUpdate: '2024-01-15',
          riskScore: 85
        },
        {
          userId: '2',
          email: 'user2@example.com',
          tier: 'starter',
          isCompliant: false,
          securityQuestionCount: 1,
          twoFactorEnabled: false,
          backupEmailSet: false,
          missingRequirements: ['At least 2 security questions required'],
          lastSecurityUpdate: '2024-01-10',
          riskScore: 45
        }
      ];

      setStats(mockStats);
      setUsers(mockUsers);
      
    } catch (error) {
      console.error('Error fetching security overview:', error);
      toast({
        title: "Error",
        description: "Failed to load security overview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportSecurityReport = async () => {
    try {
      // In a real implementation, this would call an API endpoint
      toast({
        title: "Export Started",
        description: "Security compliance report is being generated...",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate security report",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === 'all' || user.tier === tierFilter;
    const matchesCompliance = complianceFilter === 'all' || 
      (complianceFilter === 'compliant' && user.isCompliant) ||
      (complianceFilter === 'non-compliant' && !user.isCompliant);
    
    return matchesSearch && matchesTier && matchesCompliance;
  });

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      case 'starter': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'professional': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'business': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'enterprise': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'ultimate': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading security overview...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load security overview data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Security Compliance Overview</h2>
          <p className="text-muted-foreground">Monitor user security compliance across all subscription tiers</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={exportSecurityReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={fetchSecurityOverview} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Total Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Compliant</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.compliantUsers.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{stats.compliancePercentage}% of total</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span>Non-Compliant</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.nonCompliantUsers.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{(100 - stats.compliancePercentage).toFixed(1)}% of total</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Risk Level</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getRiskColor(stats.riskLevel)}>
              {stats.riskLevel.charAt(0).toUpperCase() + stats.riskLevel.slice(1)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Compliance by Tier</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.tierBreakdown.map((tierData) => (
              <div key={tierData.tier} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Crown className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={getTierColor(tierData.tier)}>
                    {tierData.tier.charAt(0).toUpperCase() + tierData.tier.slice(1)}
                  </Badge>
                  <span className="text-sm">
                    {tierData.compliantUsers}/{tierData.totalUsers} users
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${tierData.complianceRate}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium w-12">{tierData.complianceRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Feature Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Feature Adoption</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Security Questions</span>
              </div>
              <span className="font-medium">{stats.securityFeatureUsage.securityQuestions}%</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Two-Factor Auth</span>
              </div>
              <span className="font-medium">{stats.securityFeatureUsage.twoFactorAuth}%</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Backup Email</span>
              </div>
              <span className="font-medium">{stats.securityFeatureUsage.backupEmail}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Security Details */}
      <Card>
        <CardHeader>
          <CardTitle>User Security Details</CardTitle>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="ultimate">Ultimate</SelectItem>
              </SelectContent>
            </Select>

            <Select value={complianceFilter} onValueChange={setComplianceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by compliance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="non-compliant">Non-Compliant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Security Features</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTierColor(user.tier)}>
                      {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {user.isCompliant ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      )}
                      <span className={user.isCompliant ? 'text-green-600' : 'text-orange-600'}>
                        {user.isCompliant ? 'Compliant' : 'Non-Compliant'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2 text-xs">
                      <span title="Security Questions">{user.securityQuestionCount} Q</span>
                      <span title="Two-Factor Auth">{user.twoFactorEnabled ? '2FA ✓' : '2FA ✗'}</span>
                      <span title="Backup Email">{user.backupEmailSet ? 'Email ✓' : 'Email ✗'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={user.riskScore >= 70 ? 'text-green-600' : user.riskScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                      {user.riskScore}%
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastSecurityUpdate}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              No users found matching the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}