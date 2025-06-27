import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Database, 
  Mail, 
  Brain, 
  Server, 
  Shield, 
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Zap,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import TradeSecretProtection from "@/components/TradeSecretProtection";
import LawEnforcementRequest from '@/components/LawEnforcementRequest';
import { BlogAdmin } from '@/components/BlogAdmin';

interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    activeSubscriptions: number;
    pendingEmailRequests: number;
    securityEvents: number;
  };
  systemHealth: {
    database: { status: string; latency?: number };
    emailService: { status: string };
    openaiService: { status: string };
    priorityQueue: any;
    memoryUsage: any;
    uptime: number;
  };
  recentActivity: {
    newUsersLast24h: number;
    newUsersLast7d: number;
    activeSubscriptionsLast24h: number;
    documentsAnalyzedLast24h: number;
    documentsAnalyzedLast7d: number;
  };
}

interface User {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  message: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
}

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const { toast } = useToast();

  // Automatically send verification code when component mounts
  useEffect(() => {
    const sendInitialCode = async () => {
      setIsLoading(true);
      try {
        // Use the admin API key for verification request
        const adminKey = import.meta.env.VITE_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
        
        const response = await fetch("/api/admin/request-verification", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': adminKey || ''
          }
        });

        const data = await response.json();

        if (data.success) {
          setCodeSent(true);
          toast({
            title: "Admin Verification Required",
            description: "A verification code has been sent to your admin emails",
          });
        } else {
          toast({
            title: "Authentication Error",
            description: data.error || "Failed to send verification code",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Connection Error",
          description: "Failed to initiate admin verification",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    sendInitialCode();
  }, [toast]);

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const adminKey = import.meta.env.VITE_ADMIN_API_KEY || process.env.ADMIN_API_KEY;
      
      const response = await fetch("/api/admin/request-verification", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey || ''
        }
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Code Resent",
          description: "A new verification code has been sent",
        });
      } else {
        toast({
          title: "Resend Failed",
          description: data.error || "Failed to resend verification code",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend verification code",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/verify-code", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.adminToken);
        toast({
          title: "Admin Access Granted",
          description: "Welcome to the admin dashboard",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.error || "Invalid verification code",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify code",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Admin Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {!codeSent ? (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-muted-foreground">
                Sending verification code to admin emails...
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Verification code sent to:
                </p>
                <p className="text-xs text-muted-foreground">
                  admin@readmyfineprint.com<br/>
                  prodbybuddha@icloud.com
                </p>
              </div>
              
              <div>
                <Label htmlFor="code">6-Digit Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  className="placeholder:text-muted-foreground dark:placeholder:text-gray-400"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Code expires in 10 minutes
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Sending..." : "Resend Code"}
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || !verificationCode}>
                  {isLoading ? "Verifying..." : "Access Admin"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardOverview({ adminToken }: { adminToken: string }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Separate queries for each metric group with auto-refresh
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["/api/admin/metrics"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/metrics-subscription", {
        headers: { 
          "x-subscription-token": adminToken || "",
          "x-dashboard-auto-refresh": "true" // Prevent security events
        }
      });
      return await response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: true
  });

  const { data: systemHealthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/system-health-subscription", {
        headers: { 
          "x-subscription-token": adminToken || "",
          "x-dashboard-auto-refresh": "true" // Prevent security events
        }
      });
      return await response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time health
    refetchIntervalInBackground: true
  });

  const { data: activityData, isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ["/api/admin/activity"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/activity-subscription", {
        headers: { 
          "x-subscription-token": adminToken || "",
          "x-dashboard-auto-refresh": "true" // Prevent security events
        }
      });
      return await response.json();
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    refetchIntervalInBackground: true
  });

  console.log("Metrics data:", metricsData);
  console.log("System health data:", systemHealthData);
  console.log("Activity data:", activityData);
  
  if (systemHealthData?.uptime !== undefined) {
    console.log("Server uptime (seconds):", systemHealthData.uptime);
  }

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds < 1) {
      return "Just started";
    }
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard Overview</h2>
        <div className="text-sm text-muted-foreground">
          Auto-refreshing • {currentTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="text-2xl font-bold animate-pulse">Loading...</div>
            ) : metricsError ? (
              <div className="text-2xl font-bold text-red-500">Error</div>
            ) : (
              <div className="text-2xl font-bold">{metricsData?.totalUsers || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +{activityLoading ? "..." : (activityData?.newUsersLast24h || 0)} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="text-2xl font-bold animate-pulse">Loading...</div>
            ) : metricsError ? (
              <div className="text-2xl font-bold text-red-500">Error</div>
            ) : (
              <div className="text-2xl font-bold">{metricsData?.activeSubscriptions || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +{activityLoading ? "..." : (activityData?.activeSubscriptionsLast24h || 0)} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="text-2xl font-bold animate-pulse">Loading...</div>
            ) : activityError ? (
              <div className="text-2xl font-bold text-red-500">Error</div>
            ) : (
              <div className="text-2xl font-bold">{activityData?.documentsAnalyzedLast24h || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {activityLoading ? "..." : (activityData?.documentsAnalyzedLast7d || 0)} in last 7d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="text-2xl font-bold animate-pulse">Loading...</div>
            ) : metricsError ? (
              <div className="text-2xl font-bold text-red-500">Error</div>
            ) : (
              <div className="text-2xl font-bold">{metricsData?.securityEvents || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Pending email requests: {metricsLoading ? "..." : (metricsData?.pendingEmailRequests || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            System Health
            {healthLoading && <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                  <span className="text-sm bg-gray-200 rounded animate-pulse">Loading...</span>
                </div>
              ))}
            </div>
          ) : healthError ? (
            <div className="text-red-500 text-center py-4">
              Error loading system health: {healthError.message}
              <div className="text-xs text-muted-foreground mt-2">
                Will retry automatically in {5 - (Math.floor(Date.now() / 1000) % 5)}s
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Database:</span>
                <Badge variant={systemHealthData?.database?.status === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealthData?.database?.status || 'unknown'}
                </Badge>
                {systemHealthData?.database?.latency && (
                  <span className="text-xs text-muted-foreground">
                    ({systemHealthData.database.latency}ms)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm">Email Service:</span>
                <Badge variant={systemHealthData?.emailService?.status === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealthData?.emailService?.status || 'unknown'}
                </Badge>
              </div>

              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4" />
                <span className="text-sm">OpenAI Service:</span>
                <Badge variant={systemHealthData?.openaiService?.status === 'healthy' ? 'default' : 'destructive'}>
                  {systemHealthData?.openaiService?.status || 'unknown'}
                </Badge>
              </div>

              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4" />
                <span className="text-sm">Uptime:</span>
                <span className="text-sm font-medium">{formatUptime(systemHealthData?.uptime || 0)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Memory:</span>
                <span className="text-sm font-medium">
                  {formatMemory(systemHealthData?.memoryUsage?.used || 0)} / 
                  {formatMemory(systemHealthData?.memoryUsage?.total || 0)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm">Queue:</span>
                <span className="text-sm font-medium">
                  {systemHealthData?.priorityQueue?.currentlyProcessing || 0} processing
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserManagement({ adminToken }: { adminToken: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [hasSubscription, setHasSubscription] = useState<boolean | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const { data: usersData, isLoading, refetch } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", { page, search, sortBy, sortOrder, hasSubscription }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/users-subscription?page=${page}&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}${hasSubscription !== undefined ? `&hasSubscription=${hasSubscription}` : ''}`, {
        headers: { "x-subscription-token": adminToken || "" }
      });
      return await response.json();
    }
  });

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await apiRequest("PATCH", `/api/admin/users-subscription/${userId}`, {
        headers: { "x-subscription-token": adminToken || "" },
        body: updates
      });
      
      toast({
        title: "User Updated",
        description: "User information has been updated successfully",
      });
      
      refetch();
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">User Management</h2>
        <div className="flex items-center space-x-2">
          <LawEnforcementRequest adminToken={adminToken} />
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 placeholder:text-muted-foreground dark:placeholder:text-gray-400"
          />
        </div>

        <Select value={hasSubscription?.toString() || "all"} onValueChange={(value) => 
          setHasSubscription(value === "all" ? undefined : value === "true")
        }>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by subscription" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="true">With Subscription</SelectItem>
            <SelectItem value="false">Without Subscription</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Created Date</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="lastLoginAt">Last Login</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({usersData?.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersData?.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.emailVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {usersData && usersData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {usersData.page} of {usersData.totalPages} 
                ({usersData.total} total users)
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === usersData.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl bg-background dark:bg-gray-800 border-border dark:border-gray-700">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground dark:text-gray-200">Email</Label>
                  <Input value={selectedUser.email} readOnly className="bg-background dark:bg-gray-700 border-border dark:border-gray-600 text-foreground dark:text-gray-100" />
                </div>
                <div>
                  <Label className="text-foreground dark:text-gray-200">Username</Label>
                  <Input value={selectedUser.username || ''} readOnly className="bg-background dark:bg-gray-700 border-border dark:border-gray-600 text-foreground dark:text-gray-100" />
                </div>
                <div>
                  <Label className="text-foreground dark:text-gray-200">Status</Label>
                  <Select 
                    value={selectedUser.isActive ? 'active' : 'inactive'}
                    onValueChange={(value) => 
                      handleUpdateUser(selectedUser.id, { isActive: value === 'active' })
                    }
                  >
                    <SelectTrigger className="bg-background dark:bg-gray-700 border-border dark:border-gray-600">
                      <SelectValue className="text-foreground dark:text-gray-100" />
                    </SelectTrigger>
                    <SelectContent className="bg-background dark:bg-gray-700 border-border dark:border-gray-600">
                      <SelectItem value="active" className="text-foreground dark:text-gray-100">Active</SelectItem>
                      <SelectItem value="inactive" className="text-foreground dark:text-gray-100">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground dark:text-gray-200">Email Verified</Label>
                  <Select 
                    value={selectedUser.emailVerified ? 'true' : 'false'}
                    onValueChange={(value) => 
                      handleUpdateUser(selectedUser.id, { emailVerified: value === 'true' })
                    }
                  >
                    <SelectTrigger className="bg-background dark:bg-gray-700 border-border dark:border-gray-600">
                      <SelectValue className="text-foreground dark:text-gray-100" />
                    </SelectTrigger>
                    <SelectContent className="bg-background dark:bg-gray-700 border-border dark:border-gray-600">
                      <SelectItem value="true" className="text-foreground dark:text-gray-100">Verified</SelectItem>
                      <SelectItem value="false" className="text-foreground dark:text-gray-100">Not Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-foreground dark:text-gray-200">Created At</Label>
                <Input value={new Date(selectedUser.createdAt).toLocaleString()} readOnly className="bg-background dark:bg-gray-700 border-border dark:border-gray-600 text-foreground dark:text-gray-100" />
              </div>
              {selectedUser.lastLoginAt && (
                <div>
                  <Label className="text-foreground dark:text-gray-200">Last Login</Label>
                  <Input value={new Date(selectedUser.lastLoginAt).toLocaleString()} readOnly className="bg-background dark:bg-gray-700 border-border dark:border-gray-600 text-foreground dark:text-gray-100" />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SecurityEvents({ adminToken }: { adminToken: string }) {
  const [severity, setSeverity] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const { data: securityData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/security-events", { severity, limit }],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      
      // Only add severity if it's not "all"
      if (severity !== "all") {
        params.append('severity', severity.toUpperCase());
      }
      
      console.log('Fetching security events with params:', params.toString());
      
      const response = await apiRequest("GET", `/api/admin/security-events-subscription?${params.toString()}`, {
        headers: { 
          "x-subscription-token": adminToken || "",
          "x-dashboard-auto-refresh": "true"
        }
      });
      const result = await response.json();
      console.log('Security events response:', result);
      return result;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchIntervalInBackground: true
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Security Events</h2>
        <div className="text-sm text-muted-foreground flex items-center space-x-2">
          {isLoading && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>}
          <span>Auto-refreshing every 10s</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Number of events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Last 50 events</SelectItem>
            <SelectItem value="100">Last 100 events</SelectItem>
            <SelectItem value="200">Last 200 events</SelectItem>
            <SelectItem value="500">Last 500 events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Security Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events ({securityData?.events?.length || 0} events)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading security events...</div>
          ) : !securityData?.events ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events found</p>
              <p className="text-sm text-gray-400 mt-2">
                {securityData ? 'Events array is empty or missing' : 'No data received'}
              </p>
            </div>
          ) : securityData.events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events match your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityData?.events?.map((event: SecurityEvent, index: number) => (
                  <TableRow key={event.id || `security-event-${index}-${event.timestamp}`}>
                    <TableCell>
                      {new Date(event.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {event.type === 'DOCUMENT_ANALYSIS' && <FileText className="h-4 w-4" />}
                        {event.type === 'RATE_LIMIT' && <Zap className="h-4 w-4" />}
                        {event.type === 'INVALID_INPUT' && <X className="h-4 w-4" />}
                        {event.type === 'AUTH_FAILURE' && <Shield className="h-4 w-4" />}
                        {event.type === 'SUBSCRIPTION_EVENT' && <Activity className="h-4 w-4" />}
                        <Badge variant="outline">{event.type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {event.message}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {event.ip}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmailChangeRequests({ adminToken }: { adminToken: string }) {
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const { toast } = useToast();

  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/email-change-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/email-change-requests-subscription", {
        headers: { "x-subscription-token": adminToken || "" }
      });
      return await response.json();
    }
  });

  const handleRequestClick = async (request: any) => {
    if (selectedRequest?.id === request.id) {
      setSelectedRequest(null);
      return;
    }

    try {
      const response = await apiRequest("GET", `/api/admin/email-change-requests-subscription/${request.id}`, {
        headers: { "x-subscription-token": adminToken || "" }
      });
      const data = await response.json();
      setSelectedRequest({ ...data.request, user: data.user });
      setReviewNotes('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load request details",
        variant: "destructive"
      });
    }
  };

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    setReviewLoading(true);
    try {
      await apiRequest("POST", `/api/admin/email-change-requests-subscription/${selectedRequest.id}/review`, {
        headers: { "x-subscription-token": adminToken || "" },
        body: {
          action,
          adminNotes: reviewNotes.trim() || undefined
        }
      });

      toast({
        title: "Success",
        description: `Email change request ${action}ed successfully`,
      });

      refetch();
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} request`,
        variant: "destructive"
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: Date | string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h remaining`;
    
    const days = Math.floor(hours / 24);
    return `${days}d remaining`;
  };

  if (isLoading) {
    return <div>Loading email change requests...</div>;
  }

  const requests = requestsData?.requests || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Email Change Requests</h2>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending email change requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                  <div 
                    onClick={() => handleRequestClick(request)} 
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {getTimeRemaining(request.expiresAt)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(request.createdAt)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">From:</span> {request.currentEmail}
                      </div>
                      <div>
                        <span className="font-medium">To:</span> {request.newEmail}
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="font-medium">Reason:</span> {request.reason}
                    </div>
                  </div>

                  {selectedRequest && selectedRequest.id === request.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">User ID:</span> {selectedRequest.userId}
                        </div>
                        <div>
                          <span className="font-medium">Client IP:</span> {selectedRequest.clientIp}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium">User Agent:</span> {selectedRequest.userAgent}
                        </div>
                      </div>

                      {selectedRequest.user && (
                        <div className="bg-gray-50 p-3 rounded border">
                          <h4 className="font-medium mb-2">User Details</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium">Email:</span> {selectedRequest.user.email}</div>
                            <div><span className="font-medium">Username:</span> {selectedRequest.user.username || 'N/A'}</div>
                            <div><span className="font-medium">Account Created:</span> {formatDate(selectedRequest.user.createdAt)}</div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label htmlFor="admin-notes" className="block text-sm font-medium mb-2">Admin Notes (Optional)</label>
                          <textarea
                            id="admin-notes"
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add notes about your decision..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background dark:bg-gray-800 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-gray-400"
                          />
                        </div>

                        <div className="flex space-x-3">
                          <Button
                            onClick={() => handleReview('approve')}
                            disabled={reviewLoading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {reviewLoading ? 'Processing...' : 'Approve'}
                          </Button>
                          <Button
                            onClick={() => handleReview('reject')}
                            disabled={reviewLoading}
                            variant="destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            {reviewLoading ? 'Processing...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Analytics({ adminToken }: { adminToken: string }) {
  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      console.log('Fetching analytics data...');
      const response = await apiRequest("GET", "/api/admin/analytics-subscription", {
        headers: { 
          "x-subscription-token": adminToken || "",
          "x-dashboard-auto-refresh": "true"
        }
      });
      const result = await response.json();
      console.log('Analytics response:', result);
      return result;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    refetchIntervalInBackground: true
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold animate-pulse bg-gray-200 rounded h-8 w-20"></div>
                <p className="text-xs text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-500 mb-2">Error loading analytics data</p>
            <p className="text-sm text-gray-500">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('Rendering analytics with data:', analyticsData);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <div className="text-sm text-muted-foreground">
          Auto-refreshing every 60s
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analyticsData?.revenueAnalytics?.totalRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Estimated monthly</p>
            {!analyticsData && <p className="text-xs text-red-400">No data available</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Documents Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.usageAnalytics?.totalDocuments || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            {!analyticsData && <p className="text-xs text-red-400">No data available</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analyticsData?.usageAnalytics?.totalTokens || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            {!analyticsData && <p className="text-xs text-red-400">No data available</p>}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {!analyticsData?.subscriptionAnalytics?.byTier ? (
            <div className="text-center py-4 text-gray-500">
              <p>No subscription data available</p>
              <p className="text-xs mt-1">Data structure: {JSON.stringify(Object.keys(analyticsData || {}))}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(analyticsData?.subscriptionAnalytics?.byTier || []).map((tier: any, index: number) => (
                <div key={tier.tier || index} className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{tier.tier || tier.tierId || 'Unknown'}</Badge>
                    <span className="text-sm">{tier.count || 0} users</span>
                  </div>
                  <div className="text-sm font-medium">
                    ${(tier.revenue || 0).toFixed(2)}/month
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Info */}
      {analyticsData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 dark:text-gray-400">Debug - Analytics Data Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(analyticsData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin using existing subscription token
  useEffect(() => {
    const checkAdminStatus = async () => {
      const token = localStorage.getItem('subscriptionToken');
      
      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch('/api/users/validate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-subscription-token': token,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const adminEmails = ['admin@readmyfineprint.com', 'prodbybuddha@icloud.com'];
          
          if (adminEmails.includes(data.email)) {
            setIsAdmin(true);
            // For admin pages, we'll use the subscription token as admin token
            setAdminToken(token);
          }
        }
      } catch (error) {
        console.error('Admin auth check failed:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAdminStatus();
  }, []);

  const handleLogin = (token: string) => {
    setAdminToken(token);
  };


  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (!isAdmin || !adminToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">You don't have admin access to this page.</p>
            <Button onClick={() => window.location.href = '/'}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <TradeSecretProtection />
      <div className="container mx-auto px-4 py-8 bg-background dark:bg-gray-900">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="email-requests">Email Requests</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DashboardOverview adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="email-requests">
            <EmailChangeRequests adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityEvents adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="blog">
            <BlogAdmin />
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics adminToken={adminToken} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}