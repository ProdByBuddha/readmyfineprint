import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Database, 
  Mail, 
  Brain, 
  Server, 
  Shield, 
  Settings,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
                  autoFocus
                  required
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
  const { data: dashboardData, isLoading, refetch } = useQuery<AdminDashboardData>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: () => apiRequest("/api/admin/dashboard", {
      headers: { "X-Admin-Token": adminToken }
    })
  });

  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }

  if (!dashboardData) {
    return <div>Failed to load dashboard data</div>;
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard Overview</h2>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +{dashboardData.recentActivity.newUsersLast24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              +{dashboardData.recentActivity.activeSubscriptionsLast24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Analyzed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.recentActivity.documentsAnalyzedLast24h}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.recentActivity.documentsAnalyzedLast7d} in last 7d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.metrics.securityEvents}</div>
            <p className="text-xs text-muted-foreground">
              Pending email requests: {dashboardData.metrics.pendingEmailRequests}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span className="text-sm">Database:</span>
              <Badge variant={dashboardData.systemHealth.database.status === 'healthy' ? 'default' : 'destructive'}>
                {dashboardData.systemHealth.database.status}
              </Badge>
              {dashboardData.systemHealth.database.latency && (
                <span className="text-xs text-muted-foreground">
                  ({dashboardData.systemHealth.database.latency}ms)
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm">Email Service:</span>
              <Badge variant={dashboardData.systemHealth.emailService.status === 'healthy' ? 'default' : 'destructive'}>
                {dashboardData.systemHealth.emailService.status}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span className="text-sm">OpenAI Service:</span>
              <Badge variant={dashboardData.systemHealth.openaiService.status === 'healthy' ? 'default' : 'destructive'}>
                {dashboardData.systemHealth.openaiService.status}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span className="text-sm">Uptime:</span>
              <span className="text-sm font-medium">{formatUptime(dashboardData.systemHealth.uptime)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Memory:</span>
              <span className="text-sm font-medium">
                {formatMemory(dashboardData.systemHealth.memoryUsage.used)} / 
                {formatMemory(dashboardData.systemHealth.memoryUsage.total)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm">Queue:</span>
              <span className="text-sm font-medium">
                {dashboardData.systemHealth.priorityQueue.processing} processing
              </span>
            </div>
          </div>
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
    queryFn: () => apiRequest(`/api/admin/users?page=${page}&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}${hasSubscription !== undefined ? `&hasSubscription=${hasSubscription}` : ''}`, {
      headers: { "X-Admin-Token": adminToken }
    })
  });

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { "X-Admin-Token": adminToken },
        body: JSON.stringify(updates)
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
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
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
                  <TableHead>Username</TableHead>
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
                    <TableCell>{user.username || '-'}</TableCell>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={selectedUser.email} readOnly />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input value={selectedUser.username || ''} readOnly />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={selectedUser.isActive ? 'active' : 'inactive'}
                    onValueChange={(value) => 
                      handleUpdateUser(selectedUser.id, { isActive: value === 'active' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email Verified</Label>
                  <Select 
                    value={selectedUser.emailVerified ? 'true' : 'false'}
                    onValueChange={(value) => 
                      handleUpdateUser(selectedUser.id, { emailVerified: value === 'true' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Verified</SelectItem>
                      <SelectItem value="false">Not Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Created At</Label>
                <Input value={new Date(selectedUser.createdAt).toLocaleString()} readOnly />
              </div>
              {selectedUser.lastLoginAt && (
                <div>
                  <Label>Last Login</Label>
                  <Input value={new Date(selectedUser.lastLoginAt).toLocaleString()} readOnly />
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
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string>("all");
  const [timeframe, setTimeframe] = useState("24h");

  const { data: securityData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/security-events", { page, severity, timeframe }],
    queryFn: () => apiRequest(`/api/admin/security-events?page=${page}&severity=${severity}&timeframe=${timeframe}`, {
      headers: { "X-Admin-Token": adminToken }
    })
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Security Events</h2>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Security Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading security events...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityData?.events?.map((event: SecurityEvent) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      {new Date(event.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.type}</Badge>
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
                    <TableCell>
                      {event.userId || 'Anonymous'}
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

function Analytics({ adminToken }: { adminToken: string }) {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/admin/analytics"],
    queryFn: () => apiRequest("/api/admin/analytics", {
      headers: { "X-Admin-Token": adminToken }
    })
  });

  if (isLoading) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Analytics Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analyticsData?.revenue?.totalRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Estimated monthly</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Documents Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.usage?.totalDocuments || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.usage?.totalTokens?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData?.subscriptions?.byTier?.map((tier: any) => (
              <div key={tier.tier} className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{tier.tier}</Badge>
                  <span className="text-sm">{tier.count} users</span>
                </div>
                <div className="text-sm font-medium">
                  ${tier.revenue?.toFixed(2) || '0.00'}/month
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem('adminToken')
  );

  const handleLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('adminToken', token);
  };

  const handleLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('adminToken');
  };

  // Redirect to login modal if not authenticated
  if (!adminToken) {
    window.location.href = '/?login=admin';
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <Badge variant="outline">ReadMyFinePrint</Badge>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DashboardOverview adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="security">
            <SecurityEvents adminToken={adminToken} />
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics adminToken={adminToken} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}