import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  DollarSign,
  Clock,
  Download,
  Filter,
  Calendar,
  PieChart,
  Activity
} from "lucide-react";
import { sessionFetch } from "@/lib/sessionManager";

interface AnalyticsData {
  userGrowth?: Array<{
    date: string;
    newUsers: number;
    totalUsers: number;
    activeUsers?: number;
  }>;
  subscriptionAnalytics?: {
    totalRevenue: number;
    monthlyRecurring?: number;
    byTier: Array<{
      tier: string;
      count: number;
      revenue: number;
      percentage?: number;
    }>;
    churnRate?: number;
    conversionRate?: number;
  };
  usageAnalytics?: {
    totalDocuments: number;
    totalTokens?: number;
    avgDocumentsPerUser?: number;
    byTier: Array<{
      tier: string;
      documents: number;
      tokens?: number;
    }>;
  };
  revenueAnalytics?: {
    totalRevenue: number;
    byTier: Array<{
      tier: string;
      revenue: number;
    }>;
    growth?: Array<{
      date: string;
      revenue: number;
    }>;
  };
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  error?: string;
}

export default function AdvancedAnalytics() {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ["/api/admin/analytics-subscription", timeRange],
    queryFn: async () => {
      const response = await sessionFetch(`/api/admin/analytics-subscription?timeframe=${timeRange}`, {
        method: 'GET',
        headers: { 
          "Content-Type": "application/json",
          "x-dashboard-auto-refresh": "true"
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchIntervalInBackground: true
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="analytics-loading">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 bg-slate-200 rounded w-64 animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-48 animate-pulse"></div>
          </div>
          <div className="flex space-x-2">
            <div className="h-10 bg-slate-200 rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-slate-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Analytics Unavailable</h3>
          <p className="text-red-600">Unable to load analytics data. Please try refreshing the page.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="advanced-analytics">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Advanced Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Comprehensive insights and performance metrics • Last updated: {currentTime.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-40" data-testid="select-metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="users">User Analytics</SelectItem>
              <SelectItem value="subscriptions">Subscriptions</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-timerange">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="button-export-analytics">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(100, 85)}
            </div>
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="metric-total-users">
              {formatNumber(analyticsData?.userGrowth?.slice(-1)[0]?.totalUsers || 0)}
            </div>
            <div className="text-sm text-blue-600 mt-1">
              +{analyticsData?.userGrowth?.slice(-1)[0]?.newUsers || 0} this period
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-green-600 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(120, 100)}
            </div>
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="metric-revenue">
              {formatCurrency(analyticsData?.subscriptionAnalytics?.totalRevenue || analyticsData?.revenueAnalytics?.totalRevenue || 0)}
            </div>
            <div className="text-sm text-green-600 mt-1">
              {(analyticsData?.subscriptionAnalytics?.conversionRate || 0).toFixed(1)}% conversion rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-600 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(95, 100)}
            </div>
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Documents Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="metric-documents">
              {formatNumber(analyticsData?.documentAnalytics?.totalProcessed || 0)}
            </div>
            <div className="text-sm text-purple-600 mt-1">
              {(analyticsData?.documentAnalytics?.successRate || 0).toFixed(1)}% success rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-orange-600 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              {getTrendIcon(80, 90)}
            </div>
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="metric-processing-time">
              {(analyticsData?.documentAnalytics?.averageProcessingTime || 0).toFixed(1)}s
            </div>
            <div className="text-sm text-orange-600 mt-1">
              15% improvement
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="border-0 shadow-md" data-testid="card-user-growth">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">User Growth Trends</CardTitle>
                  <p className="text-sm text-slate-500">Daily new user registrations</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                +23% vs last period
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {analyticsData?.userGrowth?.slice(-7).map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-slate-600">
                      {day.newUsers} new users
                    </div>
                    <div className="w-24">
                      <Progress value={(day.newUsers / Math.max(...(analyticsData.userGrowth?.map(d => d.newUsers) || [1]))) * 100} className="h-2" />
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center text-slate-500 py-8">
                  No user growth data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Analytics */}
        <Card className="border-0 shadow-md" data-testid="card-subscription-analytics">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <PieChart className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Subscription Distribution</CardTitle>
                  <p className="text-sm text-slate-500">Revenue by tier</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {(analyticsData?.subscriptionAnalytics?.churnRate || 0).toFixed(1)}% churn
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {analyticsData?.subscriptionAnalytics?.byTier?.map((tier) => (
                <div key={tier.tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                        {tier.tier}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tier.count} users
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(tier.revenue)}
                    </div>
                  </div>
                  <Progress value={tier.percentage} className="h-2" />
                  <div className="text-xs text-slate-500">
                    {tier.percentage.toFixed(1)}% of total revenue
                  </div>
                </div>
              )) || (
                <div className="text-center text-slate-500 py-8">
                  No subscription data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Processing Analytics */}
      <Card className="border-0 shadow-md" data-testid="card-document-analytics">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Document Processing Analytics</CardTitle>
                <p className="text-sm text-slate-500">Popular document types and processing trends</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              {(analyticsData?.documentAnalytics?.successRate || 0).toFixed(1)}% success rate
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Popular Document Types */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Popular Document Types
              </h3>
              {analyticsData?.documentAnalytics?.popularTypes?.map((type) => (
                <div key={type.type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                      {type.type.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {type.count.toLocaleString()} ({type.percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <Progress value={type.percentage} className="h-2" />
                </div>
              )) || (
                <div className="text-center text-slate-500 py-4">
                  No document type data available
                </div>
              )}
            </div>

            {/* Processing Performance */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Processing Performance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {(analyticsData?.documentAnalytics?.averageProcessingTime || 0).toFixed(1)}s
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Avg Processing Time</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {(analyticsData?.documentAnalytics?.successRate || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Success Rate</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Recent Trends
                </h4>
                {analyticsData?.documentAnalytics?.processingTrends?.slice(-5).map((trend) => (
                  <div key={trend.date} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(trend.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {trend.count}
                      </Badge>
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {trend.avgTime.toFixed(1)}s
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-slate-500 py-4 text-sm">
                    No trend data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="border-0 shadow-md" data-testid="card-performance-metrics">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">System Performance Metrics</CardTitle>
              <p className="text-sm text-slate-500">API response times and system health</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* API Performance */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                API Response Times
              </h3>
              <div className="space-y-3">
                {analyticsData?.performanceMetrics?.apiResponseTimes?.map((api) => (
                  <div key={api.endpoint} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {api.endpoint}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={`text-xs ${api.errorRate > 5 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                          {api.errorRate.toFixed(1)}% error
                        </Badge>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {api.avgTime}ms avg
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${api.avgTime < 200 ? 'bg-green-500' : api.avgTime < 500 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min((api.avgTime / 1000) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-slate-500">
                      P95: {api.p95Time}ms
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-slate-500 py-4">
                    No API performance data available
                  </div>
                )}
              </div>
            </div>

            {/* System Metrics */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                System Resources
              </h3>
              <div className="space-y-4">
                {analyticsData?.performanceMetrics?.systemMetrics && Object.entries(analyticsData.performanceMetrics.systemMetrics).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {typeof value === 'number' ? `${value.toFixed(1)}%` : value}
                      </div>
                    </div>
                    {typeof value === 'number' && (
                      <Progress 
                        value={value} 
                        className={`h-2 ${value > 80 ? '[&>div]:bg-red-500' : value > 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} 
                      />
                    )}
                  </div>
                )) || (
                  <div className="text-center text-slate-500 py-4">
                    No system metrics available
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}