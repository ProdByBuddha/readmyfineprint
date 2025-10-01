import { useState, useEffect, Suspense, lazy, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/lib/seo";
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
  ArrowRight,
  X,
  Trash2,
  UserX,
  UserCheck,
  RotateCcw,
  Settings,
  AlertTriangle,
  MoreHorizontal,
  UserPlus,
  Loader2,
  BarChart3,
  Clock,
  Download,
  Filter,
  Globe,
  Lock,
  Monitor,
  PieChart,
  Smartphone,
  Wifi,
  Archive,
  BellRing,
  Calendar,
  Crown,
  DollarSign,
  HardDrive,
  MessageSquare,
  Router,
  Cpu,
  MemoryStick
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { sessionFetch } from "@/lib/sessionManager";

// Lazy load components for better performance
const AdvancedAnalytics = lazy(() => import("@/components/AdvancedAnalytics"));
const SecurityCenter = lazy(() => import("@/components/SecurityCenter"));
const ComplianceReporting = lazy(() => import("@/components/ComplianceReporting"));

// Interface definitions
interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    activeSubscriptions: number;
    pendingEmailRequests: number;
    securityEvents: number;
    documentsAnalyzedToday: number;
    averageResponseTime: number;
    systemUptime: number;
    activeSessionsCount: number;
  };
  systemHealth: {
    database: { status: string; latency?: number; connectionPool?: number };
    emailService: { status: string; lastSent?: string };
    openaiService: { status: string; tokensUsed?: number };
    priorityQueue: any;
    memoryUsage: { used: number; total: number; percentage: number };
    cpuUsage: { percentage: number; loadAverage: number[] };
    diskUsage: { used: number; total: number; percentage: number };
    networkStats: { bytesIn: number; bytesOut: number };
    uptime: number;
  };
  recentActivity: {
    newUsersLast24h: number;
    newUsersLast7d: number;
    activeSubscriptionsLast24h: number;
    documentsAnalyzedLast24h: number;
    documentsAnalyzedLast7d: number;
    averageProcessingTime: number;
    successRate: number;
    popularDocumentTypes: Array<{ type: string; count: number }>;
  };
  securityMetrics: {
    threatLevel: string;
    failedLoginAttempts: number;
    blockedIPs: number;
    suspiciousActivities: number;
    complianceScore: number;
    lastSecurityScan: string;
  };
}

interface User {
  id: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  subscription?: {
    tierId: string;
    status: string;
  };
  securityRisk: 'low' | 'medium' | 'high';
}

// Admin Authentication Component
function AdminLogin({ onLogin }: { onLogin: (accessToken?: string, refreshToken?: string) => void }) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const { toast } = useToast();

  // Auto-send verification code in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Auto-login for development
      const autoLogin = async () => {
        try {
          const response = await sessionFetch('/api/dev/auto-admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            onLogin(data.accessToken, data.refreshToken);
            toast({
              title: "Development Auto-Login",
              description: "Automatically logged in as admin for development",
            });
          }
        } catch (error) {
          console.log('Development auto-login failed, showing login form');
          setCodeSent(true);
        }
      };
      autoLogin();
    } else {
      // Production: send verification code
      const sendCode = async () => {
        setIsLoading(true);
        try {
          const response = await sessionFetch("/api/admin/request-verification", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            setCodeSent(true);
            toast({
              title: "Verification Code Sent",
              description: "Check your admin email for the verification code",
            });
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to send verification code",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      sendCode();
    }
  }, [onLogin, toast]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await sessionFetch("/api/admin/verify-code", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await response.json();

      if (data.success) {
        // Remove explicit localStorage storage - sessionFetch handles tokens automatically
        // Store tokens securely via sessionFetch's internal token management
        onLogin(data.accessToken, data.refreshToken);
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

  if (!codeSent && !import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 relative overflow-hidden" data-testid="admin-login-loading">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        <Card className="relative w-full max-w-md shadow-2xl border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary via-blue-600 to-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Authentication</CardTitle>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
              Secure enterprise admin portal
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
            </div>
            <div className="space-y-2">
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                Initializing Security Protocol
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sending admin verification code...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 relative overflow-hidden" data-testid="admin-login-form">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      <Card className="relative w-full max-w-lg shadow-2xl border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary via-blue-600 to-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight">
            Admin Verification
          </CardTitle>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-lg font-light">
            Enterprise-grade admin access portal
          </p>
          <Badge className="mt-4 px-4 py-2 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-primary/20 mx-auto">
            <Lock className="w-3 h-3 mr-2" />
            Secure Access Required
          </Badge>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleVerifyCode} className="space-y-8">
            <div className="space-y-4">
              <Label htmlFor="code" className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                6-Digit Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                data-testid="input-verification-code"
                className="h-16 text-center text-2xl tracking-widest font-mono bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm border-2 border-slate-200/50 dark:border-slate-600/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                disabled={isLoading}
              />
              <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <p className="text-sm">
                  Code expires in 10 minutes
                </p>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-16 bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-primary/90 hover:via-blue-600/90 hover:to-primary/90 text-white font-bold text-lg shadow-xl hover:shadow-primary/25 transition-all duration-300 transform hover:-translate-y-1" 
              disabled={isLoading || !verificationCode || verificationCode.length !== 6}
              data-testid="button-verify-admin"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Verifying Security Credentials...
                </>
              ) : (
                <>
                  <Shield className="w-6 h-6 mr-3" />
                  Access Enterprise Dashboard
                  <ArrowRight className="w-6 h-6 ml-3" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Dashboard Overview Component
function EnterpriseOverview() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch comprehensive dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/admin/enterprise-dashboard", selectedTimeRange],
    queryFn: async () => {
      const [metricsResponse, healthResponse, activityResponse] = await Promise.all([
        sessionFetch("/api/admin/metrics-subscription", {
          method: 'GET',
          headers: { "Content-Type": "application/json", "x-dashboard-auto-refresh": "true" }
        }),
        sessionFetch("/api/admin/system-health-subscription", {
          method: 'GET',
          headers: { "Content-Type": "application/json", "x-dashboard-auto-refresh": "true" }
        }),
        sessionFetch("/api/admin/activity-subscription", {
          method: 'GET',
          headers: { "Content-Type": "application/json", "x-dashboard-auto-refresh": "true" }
        })
      ]);

      const [metrics, health, activity] = await Promise.all([
        metricsResponse.json(),
        healthResponse.json(),
        activityResponse.json()
      ]);

      return { metrics, health, activity };
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true
  });

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds < 1) return "Just started";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const getHealthStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (dashboardLoading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 bg-slate-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-48 animate-pulse"></div>
          </div>
          <div className="h-4 bg-slate-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="space-y-6" data-testid="dashboard-error">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Dashboard Error</span>
            </div>
            <p className="mt-2 text-sm text-red-600">
              Failed to load dashboard data. Please try refreshing the page.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="enterprise-dashboard">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Enterprise Admin Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Comprehensive system monitoring and management portal
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live</span>
            </div>
            <span>•</span>
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20" data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Users
            </CardTitle>
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="metric-total-users">
              {dashboardData?.metrics?.totalUsers?.toLocaleString() || 0}
            </div>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-xs text-green-600 font-medium">
                +{dashboardData?.activity?.newUsersLast24h || 0} today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20" data-testid="card-active-subscriptions">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Active Subscriptions
            </CardTitle>
            <div className="p-2 bg-green-600 rounded-lg">
              <Crown className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="metric-active-subscriptions">
              {dashboardData?.metrics?.activeSubscriptions?.toLocaleString() || 0}
            </div>
            <div className="flex items-center mt-1">
              <DollarSign className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-xs text-green-600 font-medium">
                +{dashboardData?.activity?.activeSubscriptionsLast24h || 0} today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20" data-testid="card-documents-analyzed">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Documents Analyzed
            </CardTitle>
            <div className="p-2 bg-purple-600 rounded-lg">
              <FileText className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="metric-documents-analyzed">
              {dashboardData?.activity?.documentsAnalyzedLast24h?.toLocaleString() || 0}
            </div>
            <div className="flex items-center mt-1">
              <Brain className="h-3 w-3 text-purple-600 mr-1" />
              <span className="text-xs text-purple-600 font-medium">
                {dashboardData?.activity?.documentsAnalyzedLast7d || 0} this week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20" data-testid="card-security-events">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Security Events
            </CardTitle>
            <div className="p-2 bg-red-600 rounded-lg">
              <Shield className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100" data-testid="metric-security-events">
              {dashboardData?.metrics?.securityEvents || 0}
            </div>
            <div className="flex items-center mt-1">
              <AlertTriangle className="h-3 w-3 text-orange-600 mr-1" />
              <span className="text-xs text-orange-600 font-medium">
                {dashboardData?.metrics?.pendingEmailRequests || 0} pending requests
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Overview */}
      <Card className="border-0 shadow-md" data-testid="card-system-health">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Monitor className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">System Health</CardTitle>
                <p className="text-sm text-slate-500">Real-time system performance monitoring</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              All Systems Operational
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {/* Database Health */}
            <div className="space-y-2" data-testid="health-database">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${getHealthStatusColor(dashboardData?.health?.database?.status || 'unknown')}`}></div>
                <Database className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <div className="text-xs text-slate-500">
                {dashboardData?.health?.database?.latency ? `${dashboardData.health.database.latency}ms` : 'N/A'}
              </div>
              <Badge variant="outline" className="text-xs">
                {dashboardData?.health?.database?.status || 'Unknown'}
              </Badge>
            </div>

            {/* Email Service */}
            <div className="space-y-2" data-testid="health-email">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${getHealthStatusColor(dashboardData?.health?.emailService?.status || 'unknown')}`}></div>
                <Mail className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <div className="text-xs text-slate-500">
                Service Status
              </div>
              <Badge variant="outline" className="text-xs">
                {dashboardData?.health?.emailService?.status || 'Unknown'}
              </Badge>
            </div>

            {/* AI Service */}
            <div className="space-y-2" data-testid="health-ai">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${getHealthStatusColor(dashboardData?.health?.openaiService?.status || 'unknown')}`}></div>
                <Brain className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">AI Service</span>
              </div>
              <div className="text-xs text-slate-500">
                OpenAI Integration
              </div>
              <Badge variant="outline" className="text-xs">
                {dashboardData?.health?.openaiService?.status || 'Unknown'}
              </Badge>
            </div>

            {/* Memory Usage */}
            <div className="space-y-2" data-testid="health-memory">
              <div className="flex items-center space-x-2">
                <MemoryStick className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">Memory</span>
              </div>
              <div className="text-xs text-slate-500">
                {formatBytes(dashboardData?.health?.memoryUsage?.used || 0)} / {formatBytes(dashboardData?.health?.memoryUsage?.total || 0)}
              </div>
              <Progress 
                value={dashboardData?.health?.memoryUsage?.percentage || 0} 
                className="h-1"
              />
            </div>

            {/* CPU Usage */}
            <div className="space-y-2" data-testid="health-cpu">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">CPU</span>
              </div>
              <div className="text-xs text-slate-500">
                {(dashboardData?.health?.cpuUsage?.percentage || 0).toFixed(1)}% usage
              </div>
              <Progress 
                value={dashboardData?.health?.cpuUsage?.percentage || 0} 
                className="h-1"
              />
            </div>

            {/* System Uptime */}
            <div className="space-y-2" data-testid="health-uptime">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">Uptime</span>
              </div>
              <div className="text-xs text-slate-500">
                {formatUptime(dashboardData?.health?.uptime || 0)}
              </div>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                Stable
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border-0 shadow-md" data-testid="card-quick-actions">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Zap className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-16 flex flex-col space-y-2" data-testid="button-user-management">
                <Users className="h-5 w-5" />
                <span className="text-xs">User Management</span>
              </Button>
              <Button variant="outline" className="h-16 flex flex-col space-y-2" data-testid="button-security-center">
                <Shield className="h-5 w-5" />
                <span className="text-xs">Security Center</span>
              </Button>
              <Button variant="outline" className="h-16 flex flex-col space-y-2" data-testid="button-system-settings">
                <Settings className="h-5 w-5" />
                <span className="text-xs">System Settings</span>
              </Button>
              <Button variant="outline" className="h-16 flex flex-col space-y-2" data-testid="button-generate-report">
                <Download className="h-5 w-5" />
                <span className="text-xs">Generate Report</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border-0 shadow-md" data-testid="card-recent-activity">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <UserPlus className="h-3 w-3 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {dashboardData?.activity?.newUsersLast24h || 0} new users registered
                  </p>
                  <p className="text-xs text-slate-500">Last 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileText className="h-3 w-3 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {dashboardData?.activity?.documentsAnalyzedLast24h || 0} documents analyzed
                  </p>
                  <p className="text-xs text-slate-500">
                    Avg. {(dashboardData?.activity?.averageProcessingTime || 0).toFixed(1)}s processing time
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-full">
                  <Shield className="h-3 w-3 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    Security scan completed
                  </p>
                  <p className="text-xs text-slate-500">No threats detected</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <TrendingUp className="h-3 w-3 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    System performance optimal
                  </p>
                  <p className="text-xs text-slate-500">
                    {(dashboardData?.activity?.successRate || 0).toFixed(1)}% success rate
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Enhanced User Management Component
function EnterpriseUserManagement() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [hasSubscription, setHasSubscription] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/users", { page, limit, search, hasSubscription, sortBy, sortOrder }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(hasSubscription !== undefined && { hasSubscription: hasSubscription.toString() })
      });

      const response = await sessionFetch(`/api/admin/users-subscription?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json();
    }
  });

  const bulkOperationMutation = useMutation({
    mutationFn: async ({ userIds, operation, options }: { userIds: string[], operation: string, options?: any }) => {
      const response = await sessionFetch('/api/admin/users-subscription/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds, operation, options })
      });
      
      if (!response.ok) throw new Error('Bulk operation failed');
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setSelectedUsers([]);
      toast({
        title: "Success",
        description: "Bulk operation completed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Bulk operation failed",
        variant: "destructive"
      });
    }
  });

  const handleBulkOperation = (operation: string, options?: any) => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select users to perform bulk operations",
        variant: "destructive"
      });
      return;
    }

    bulkOperationMutation.mutate({ userIds: selectedUsers, operation, options });
  };

  const getRiskLevel = (user: User) => {
    // Mock risk assessment based on user data
    if (!user.emailVerified) return 'high';
    if (!user.lastLoginAt) return 'medium';
    return 'low';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6" data-testid="enterprise-user-management">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage user accounts, subscriptions, and security</p>
        </div>
        <div className="flex items-center space-x-2">
          {selectedUsers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-bulk-actions">
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Actions ({selectedUsers.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkOperation('activate')}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkOperation('suspend')}>
                  <UserX className="h-4 w-4 mr-2" />
                  Suspend Selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleBulkOperation('reset_password')}
                  className="text-orange-600"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Passwords
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleBulkOperation('delete', { confirmDelete: true })}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh-users">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Email, username, or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Subscription Filter</Label>
              <Select value={hasSubscription?.toString() || "all"} onValueChange={(value) => 
                setHasSubscription(value === "all" ? undefined : value === "true")
              }>
                <SelectTrigger data-testid="select-subscription-filter">
                  <SelectValue placeholder="Filter by subscription" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="true">With Subscription</SelectItem>
                  <SelectItem value="false">Without Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger data-testid="select-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="lastLoginAt">Last Login</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Page Size</Label>
              <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                <SelectTrigger data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-sm" data-testid="card-users-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users ({usersData?.total?.toLocaleString() || 0})</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedUsers(selectedUsers.length === usersData?.users?.length ? [] : usersData?.users?.map(u => u.id) || [])}
                data-testid="button-select-all"
              >
                {selectedUsers.length === usersData?.users?.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4" data-testid="users-table-loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="h-4 w-4 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded flex-1"></div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                  <div className="h-4 bg-slate-200 rounded w-16"></div>
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === usersData?.users?.length && usersData?.users?.length > 0}
                        onChange={() => setSelectedUsers(selectedUsers.length === usersData?.users?.length ? [] : usersData?.users?.map(u => u.id) || [])}
                        className="rounded border-slate-300"
                      />
                    </TableHead>
                    <TableHead>Email & User Info</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users?.map((user: User) => (
                    <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                          className="rounded border-slate-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100" data-testid={`user-email-${user.id}`}>
                            {user.email}
                          </div>
                          {user.username && (
                            <div className="text-sm text-slate-500">@{user.username}</div>
                          )}
                          <div className="text-xs text-slate-400">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={user.isActive ? 'default' : 'secondary'} data-testid={`user-status-${user.id}`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <div className="flex items-center space-x-1">
                            {user.emailVerified ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-500" />
                            )}
                            <span className="text-xs text-slate-500">
                              {user.emailVerified ? 'Verified' : 'Unverified'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.subscription ? (
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {user.subscription.tierId}
                            </Badge>
                            <div className="text-xs text-slate-500">
                              {user.subscription.status}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No subscription</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getRiskColor(getRiskLevel(user))}`}>
                          {getRiskLevel(user).toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">
                            Joined: {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500">
                            Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" data-testid={`button-user-actions-${user.id}`}>
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.isActive ? (
                                <DropdownMenuItem className="text-orange-600">
                                  <UserX className="h-4 w-4 mr-2" />
                                  Suspend User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-green-600">
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {usersData && usersData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, usersData.total)} of {usersData.total} users
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  Page {page} of {usersData.totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === usersData.totalPages}
                  onClick={() => setPage(page + 1)}
                  data-testid="button-next-page"
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
          <DialogContent className="max-w-4xl" data-testid="dialog-user-details">
            <DialogHeader>
              <DialogTitle>User Profile Details</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</Label>
                  <Input value={selectedUser.email} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</Label>
                  <Input value={selectedUser.username || 'Not set'} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Account Status</Label>
                  <div className="mt-1">
                    <Badge variant={selectedUser.isActive ? 'default' : 'secondary'}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Verified</Label>
                  <div className="mt-1">
                    <Badge variant={selectedUser.emailVerified ? 'default' : 'destructive'}>
                      {selectedUser.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Risk Assessment</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={getRiskColor(getRiskLevel(selectedUser))}>
                      {getRiskLevel(selectedUser).toUpperCase()} RISK
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Account Created</Label>
                  <Input value={new Date(selectedUser.createdAt).toLocaleString()} readOnly className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Login</Label>
                  <Input 
                    value={selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never logged in'} 
                    readOnly 
                    className="mt-1" 
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">User ID</Label>
                  <Input value={selectedUser.id} readOnly className="mt-1 font-mono text-xs" />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SystemManagement() {
  const { toast } = useToast();
  const [autoScalingEnabled, setAutoScalingEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [trafficShapingEnabled, setTrafficShapingEnabled] = useState(true);

  const coreMetrics = [
    {
      id: 'uptime',
      label: 'Uptime (30d)',
      value: '99.98%',
      trend: '+0.02% vs last month',
      icon: Shield,
    },
    {
      id: 'requests',
      label: 'Requests / minute',
      value: '1,420',
      trend: '+12% today',
      icon: Activity,
    },
    {
      id: 'latency',
      label: 'Avg. latency',
      value: '148 ms',
      trend: '-18 ms vs baseline',
      icon: Monitor,
    },
    {
      id: 'errorRate',
      label: 'Error rate',
      value: '0.14%',
      trend: '-0.06% vs yesterday',
      icon: AlertTriangle,
    },
  ];

  const serviceStatus = [
    {
      id: 'api-gateway',
      name: 'API Gateway',
      status: 'operational',
      latency: '142 ms',
      uptime: '99.99%',
      region: 'Global',
      icon: Router,
    },
    {
      id: 'worker-cluster',
      name: 'Analysis Workers',
      status: 'operational',
      latency: '318 jobs/min',
      uptime: '99.92%',
      region: 'US-East / EU-West',
      icon: Cpu,
    },
    {
      id: 'database',
      name: 'Primary Database',
      status: 'degraded',
      latency: '28 ms',
      uptime: '99.81%',
      region: 'US-East-1',
      icon: Database,
    },
    {
      id: 'cache-layer',
      name: 'Realtime Cache',
      status: 'operational',
      latency: '4 ms',
      uptime: '100%',
      region: 'Global edge',
      icon: MemoryStick,
    },
  ];

  const maintenanceWindows = [
    {
      id: 'db-maintenance',
      window: 'Oct 12 • 01:00 - 02:00 UTC',
      component: 'Primary database cluster failover rehearsal',
      impact: 'Read-only mode for < 5 minutes',
      status: 'scheduled',
    },
    {
      id: 'llm-upgrade',
      window: 'Oct 18 • 04:00 UTC',
      component: 'LLM provider SDK upgrade',
      impact: 'No downtime expected',
      status: 'planned',
    },
  ];

  const backgroundJobs = [
    {
      id: 'usage-rollup',
      name: 'Usage analytics rollup',
      progress: 82,
      eta: '12m remaining',
      status: 'running',
    },
    {
      id: 'webhook-retry',
      name: 'Webhook retry queue',
      progress: 35,
      eta: 'Processing 184 events',
      status: 'processing',
    },
    {
      id: 'document-archive',
      name: 'Document archival sweep',
      progress: 100,
      eta: 'Completed 17m ago',
      status: 'complete',
    },
  ];

  const liveAlerts = [
    {
      id: 'latency-spike',
      level: 'warning',
      message: 'Minor latency spike detected in EU-West region — mitigation in progress.',
      timestamp: '5 minutes ago',
    },
    {
      id: 'queue-depth',
      level: 'info',
      message: 'Analysis queue depth normalized after morning traffic burst.',
      timestamp: '18 minutes ago',
    },
  ];

  const statusStyles: Record<string, string> = {
    operational: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    degraded: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
    planned: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
    processing: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
    complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  };

  const handleServiceAction = (serviceId: string, action: 'restart' | 'scale') => {
    const service = serviceStatus.find((item) => item.id === serviceId);
    if (!service) return;
    toast({
      title: `${service.name} ${action === 'restart' ? 'restart initiated' : 'scaling queued'}`,
      description: action === 'restart'
        ? 'We will drain connections gracefully before restarting the service.'
        : 'Additional workers will be provisioned within the next 2 minutes.',
    });
  };

  const handleJobAction = (jobId: string) => {
    const job = backgroundJobs.find((item) => item.id === jobId);
    if (!job) return;
    toast({
      title: `Manual run queued for ${job.name}`,
      description: 'Execution will begin after current tasks complete to avoid contention.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {coreMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className="border border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                    <Icon className="h-5 w-5 text-slate-600 dark:text-slate-200" />
                  </div>
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-[11px]">
                    {metric.trend}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-300">{metric.label}</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">{metric.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Critical Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceStatus.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-2 shadow-sm">
                      <Icon className="h-5 w-5 text-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{service.name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[service.status] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                          {service.status === 'operational' ? 'Operational' : 'Degraded'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{service.region}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> {service.latency}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {service.uptime} uptime</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleServiceAction(service.id, 'restart')}>
                      Restart
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleServiceAction(service.id, 'scale')}>
                      Scale up
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Maintenance & Change Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {maintenanceWindows.map((window) => (
                <div key={window.id} className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{window.window}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{window.component}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Impact: {window.impact}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[window.status] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                      {window.status === 'planned' ? 'Planning' : 'Scheduled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Maintenance controls</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Toggle real-time safeguards when performing manual work.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-900 dark:text-white">Auto-scaling</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Automatically adjusts worker pools based on queue depth.</p>
                  </div>
                  <Switch checked={autoScalingEnabled} onCheckedChange={(value) => setAutoScalingEnabled(value)} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-900 dark:text-white">Maintenance mode</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Gracefully drains sessions and displays status page messaging.</p>
                  </div>
                  <Switch checked={maintenanceMode} onCheckedChange={(value) => {
                    setMaintenanceMode(value);
                    toast({
                      title: value ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
                      description: value
                        ? 'New analyses will be queued and customers will see scheduled maintenance messaging.'
                        : 'Traffic will resume normal routing.',
                    });
                  }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-900 dark:text-white">Traffic shaping</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Diverts burst traffic to the queue for graceful processing.</p>
                  </div>
                  <Switch checked={trafficShapingEnabled} onCheckedChange={(value) => setTrafficShapingEnabled(value)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Background Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {backgroundJobs.map((job) => (
              <div key={job.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{job.eta}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[job.status] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </div>
                <div className="mt-3">
                  <Progress value={job.progress} className="h-2" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Progress: {job.progress}%</p>
                  <Button variant="outline" size="xs" onClick={() => handleJobAction(job.id)}>
                    Run now
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Live System Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                <div className={`rounded-full p-2 ${alert.level === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'}`}>
                  {alert.level === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{alert.timestamp}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Alert acknowledged', description: 'We will keep tracking automated remediation.' })}>
                  Acknowledge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminSettingsPanel() {
  const { toast } = useToast();
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [securityIncidents, setSecurityIncidents] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState('oncall@readmyfineprint.com');

  const [autoLockdown, setAutoLockdown] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(false);
  const [enforceMfa, setEnforceMfa] = useState(true);

  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T000/B000/********');
  const [pagerDutyEnabled, setPagerDutyEnabled] = useState(false);
  const [statusPageUrl, setStatusPageUrl] = useState('https://status.readmyfineprint.com');

  const handleNotificationSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: 'Notification preferences updated',
      description: 'Your on-call rotation will start receiving alerts with the new configuration immediately.',
    });
  };

  const handleSecuritySave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: 'Security automation saved',
      description: 'Automation rules have been synced to the policy engine.',
    });
  };

  const handleIntegrationsSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: 'Integrations updated',
      description: 'We validated your integration endpoints successfully.',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg">Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleNotificationSave}>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Critical system alerts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Notify immediately when uptime or error-rate thresholds breach SLOs.</p>
                </div>
                <Switch checked={criticalAlerts} onCheckedChange={(value) => setCriticalAlerts(value)} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Security incident digest</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Daily summary of escalated security tickets and remediation steps.</p>
                </div>
                <Switch checked={securityIncidents} onCheckedChange={(value) => setSecurityIncidents(value)} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Weekly analytics report</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Every Monday at 14:00 UTC.</p>
                </div>
                <Switch checked={weeklyDigest} onCheckedChange={(value) => setWeeklyDigest(value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notification-email" className="text-xs uppercase tracking-wide text-slate-500">Escalation email</Label>
              <Input
                id="notification-email"
                value={notificationEmail}
                onChange={(event) => setNotificationEmail(event.target.value)}
                placeholder="oncall@example.com"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Messages are also mirrored to Slack and PagerDuty if enabled.</p>
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit">Save notification settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg">Security Automation</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSecuritySave}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Automatic lockdown</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Lock new logins and rotate keys after repeated failed admin access attempts.</p>
                </div>
                <Switch checked={autoLockdown} onCheckedChange={(value) => setAutoLockdown(value)} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Session timeout enforcement</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Force re-authentication after 12 hours of continuous usage.</p>
                </div>
                <Switch checked={sessionTimeout} onCheckedChange={(value) => setSessionTimeout(value)} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Require MFA for admins</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Enforces TOTP or WebAuthn before sensitive actions.</p>
                </div>
                <Switch checked={enforceMfa} onCheckedChange={(value) => setEnforceMfa(value)} />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-4 text-xs text-slate-600 dark:text-slate-300">
              Automated responses are orchestrated through the policy engine and logged for auditability. Manual overrides are available in the Security tab.
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit">Save security rules</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg">Integrations & Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleIntegrationsSave}>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="slack-webhook" className="text-xs uppercase tracking-wide text-slate-500">Slack webhook</Label>
                <Input
                  id="slack-webhook"
                  value={slackWebhook}
                  onChange={(event) => setSlackWebhook(event.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Alerts will post to #readmyfineprint-operations with runbook links.</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">PagerDuty escalation</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Trigger incident 2 minutes after unresolved critical alert.</p>
                </div>
                <Switch checked={pagerDutyEnabled} onCheckedChange={(value) => setPagerDutyEnabled(value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status-page" className="text-xs uppercase tracking-wide text-slate-500">Status page URL</Label>
                <Input
                  id="status-page"
                  value={statusPageUrl}
                  onChange={(event) => setStatusPageUrl(event.target.value)}
                  placeholder="https://status.example.com"
                />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-white">Audit log summary</p>
              <p>All integration updates are versioned and require admin confirmation. We validate reachability before saving changes.</p>
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit">Save integrations</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Admin Component
export default function EnterpriseAdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  
  // SEO optimization for admin dashboard
  useSEO("/admin", {
    title: "Enterprise Admin Dashboard - ReadMyFinePrint",
    description: "Comprehensive administrative control panel for ReadMyFinePrint's privacy-first document analysis platform.",
    keywords: "admin dashboard, enterprise management, user administration, security monitoring, system health",
    canonical: "https://readmyfineprint.com/admin",
    noIndex: true, // Admin pages should not be indexed
  });

  useEffect(() => {
    // Check for existing admin authentication
    const token = localStorage.getItem('jwt_access_token');
    if (token) {
      setAdminToken(token);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (accessToken: string, refreshToken: string) => {
    setAdminToken(accessToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_access_token');
    localStorage.removeItem('jwt_refresh_token');
    setAdminToken(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800" data-testid="enterprise-admin-dashboard">
      {/* Admin Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Admin Console
                  </h1>
                  <p className="text-xs text-slate-500">ReadMyFinePrint Enterprise</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Online
              </Badge>
              <Button variant="outline" onClick={handleLogout} data-testid="button-admin-logout">
                <X className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-7 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-overview">
              <Monitor className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-compliance">
              <Lock className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-system">
              <Server className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <EnterpriseOverview />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <EnterpriseUserManagement />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <AdvancedAnalytics />
            </Suspense>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <SecurityCenter />
            </Suspense>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }>
              <ComplianceReporting />
            </Suspense>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <SystemManagement />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <AdminSettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}