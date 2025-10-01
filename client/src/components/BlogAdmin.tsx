import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { adminApiRequest } from '@/lib/api';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  TrendingUp,
  Settings,
  BookOpen,
  RotateCcw,
  AlertTriangle,
  Save,
  X,
  Zap,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  status: string;
  publishedAt?: string;
  readingTime: number;
  viewCount: number;
  shareCount: number;
  displayShareCount?: number;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
}

interface BlogTopic {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  targetAudience: string;
  priority: number;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

interface SchedulerStatus {
  isRunning: boolean;
  config: {
    enabled: boolean;
    postsPerDay: number;
    hours: number[];
    timezone: string;
    minHoursBetweenPosts: number;
  };
  scheduledJobs: number;
  nextRuns: Array<{
    hour: number;
    nextRun: string;
  }>;
}

export function BlogAdmin() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [deletedPosts, setDeletedPosts] = useState<BlogPost[]>([]);
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [blogStats, setBlogStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPost, setGeneratingPost] = useState(false);

  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // New topic form
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    category: 'contract-law',
    difficulty: 'beginner',
    targetAudience: 'general',
    priority: 5,
  });

  // Topic management states
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editTopicData, setEditTopicData] = useState<Partial<BlogTopic>>({});
  const [topicOperationLoading, setTopicOperationLoading] = useState<string | null>(null);
  const [bulkGenerateCount, setBulkGenerateCount] = useState(10);
  const [bulkGenerateLoading, setBulkGenerateLoading] = useState(false);
  const [monthlyGenerateLoading, setMonthlyGenerateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load posts
      try {
        const postsData = await adminApiRequest('/api/blog/admin/posts', {
          method: 'GET'
        });
        setPosts(postsData.posts);
      } catch (error) {
        console.error('Failed to load posts:', error);
        setError('Failed to load posts: ' + (error instanceof Error ? error.message : String(error)));
      }

      // Load topics
      try {
        const topicsData = await adminApiRequest('/api/blog/admin/topics', {
          method: 'GET'
        });
        setTopics(topicsData.topics);
      } catch (error) {
        console.error('Failed to load topics:', error);
      }

      // Load scheduler status
      try {
        const schedulerData = await adminApiRequest('/api/blog/admin/scheduler/status', {
          method: 'GET'
        });
        setSchedulerStatus(schedulerData);
      } catch (error) {
        console.error('Failed to load scheduler status:', error);
      }

      // Load blog statistics
      try {
        const statsData = await adminApiRequest('/api/blog/admin/stats', {
          method: 'GET'
        });
        setBlogStats(statsData);
      } catch (error) {
        console.error('Failed to load blog stats:', error);
      }

      // Load deleted posts
      try {
        const deletedData = await adminApiRequest('/api/blog/admin/posts/deleted', {
          method: 'GET'
        });
        setDeletedPosts(deletedData.posts);
      } catch (error) {
        console.error('Failed to load deleted posts:', error);
      }
    } catch (error) {
      console.error('Error loading blog admin data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError('Failed to load blog admin data: ' + errorMessage);
      toast({
        title: 'Error',
        description: 'Failed to load blog admin data: ' + errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // First try to get user subscription to check admin status
        try {
          const subscriptionData = await fetch('/api/user/subscription', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!subscriptionData.ok) {
            const errorText = await subscriptionData.text().catch(() => 'Unknown error');
            console.error('Subscription check failed:', subscriptionData.status, errorText);
            setError(`Authentication failed: ${errorText}. Please log in to access admin features.`);
            setLoading(false);
            return;
          }

          const subData = await subscriptionData.json();
          console.log('Subscription data received:', subData);
          
          if (!subData.tier || subData.tier.id !== 'ultimate') {
            console.error('Insufficient tier access:', subData.tier);
            
            // In development mode, automatically try the auto-admin login
            if (import.meta.env.DEV) {
              console.log('🔄 Development mode: Attempting auto-admin login...');
              try {
                const autoLoginResponse = await fetch('/api/dev/auto-admin-login', {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });
                
                if (autoLoginResponse.ok) {
                  console.log('✅ Auto-admin login successful, retrying...');
                  // Retry the subscription check after auto-login
                  window.location.reload();
                  return;
                } else {
                  console.error('Auto-admin login failed:', await autoLoginResponse.text());
                }
              } catch (autoLoginError) {
                console.error('Auto-admin login error:', autoLoginError);
              }
            }
            
            setError(`Admin access required. Current tier: ${subData.tier?.id || 'none'}. You need ultimate tier access to manage the blog.`);
            setLoading(false);
            return;
          }
          
          console.log('✅ Admin access verified via ultimate tier');
        } catch (authError) {
          console.error('Authentication check failed:', authError);
          setError('Authentication failed: ' + (authError instanceof Error ? authError.message : String(authError)));
          setLoading(false);
          return;
        }

        // If we get here, user has admin access, load all data
        const [postsResponse, topicsResponse, schedulerResponse, statsResponse, deletedResponse] = await Promise.allSettled([
          adminApiRequest('/api/blog/admin/posts', {
            method: 'GET'
          }),
          adminApiRequest('/api/blog/admin/topics', {
            method: 'GET'
          }),
          adminApiRequest('/api/blog/admin/scheduler/status', {
            method: 'GET'
          }),
          adminApiRequest('/api/blog/admin/stats', {
            method: 'GET'
          }),
          adminApiRequest('/api/blog/admin/posts/deleted', {
            method: 'GET'
          })
        ]);

        if (postsResponse.status === 'fulfilled') {
          setPosts(postsResponse.value.posts);
        } else {
          console.error('Failed to load posts:', postsResponse.reason);
        }

        if (topicsResponse.status === 'fulfilled') {
          setTopics(topicsResponse.value.topics);
        } else {
          console.error('Failed to load topics:', topicsResponse.reason);
        }

        if (schedulerResponse.status === 'fulfilled') {
          setSchedulerStatus(schedulerResponse.value);
        } else {
          console.error('Failed to load scheduler status:', schedulerResponse.reason);
        }

        if (statsResponse.status === 'fulfilled') {
          setBlogStats(statsResponse.value);
        } else {
          console.error('Failed to load blog stats:', statsResponse.reason);
        }

        if (deletedResponse.status === 'fulfilled') {
          setDeletedPosts(deletedResponse.value.posts);
        } else {
          console.error('Failed to load deleted posts:', deletedResponse.reason);
        }

      } catch (error: any) {
        console.error('Admin access check failed:', error);
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          setError('Access denied: You need admin privileges to access this page. Please log in with an admin account.');
          toast({
            title: 'Error',
            description: 'Access denied: You need admin privileges to access this page. Please log in with an admin account.',
            variant: 'destructive',
          });
        } else {
          setError(`Failed to load admin data: ${error.message || error}`);
          toast({
            title: 'Error',
            description: `Failed to load admin data: ${error.message || error}`,
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartScheduler = async () => {
    try {
      await adminApiRequest('/api/blog/admin/scheduler/start', {
        method: 'POST'
      });

      toast({
        title: 'Success',
        description: 'Blog scheduler started successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start blog scheduler',
        variant: 'destructive',
      });
    }
  };

  const handleStopScheduler = async () => {
    try {
      await adminApiRequest('/api/blog/admin/scheduler/stop', {
        method: 'POST'
      });

      toast({
        title: 'Success',
        description: 'Blog scheduler stopped successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop blog scheduler',
        variant: 'destructive',
      });
    }
  };

  const handleGeneratePost = async () => {
    try {
      setGeneratingPost(true);
      const result = await adminApiRequest('/api/blog/admin/scheduler/trigger', {
        method: 'POST'
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Blog post generated successfully!',
        });
        loadData();
      } else {
        throw new Error(result.message || 'Failed to generate post');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate blog post',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleSeedTopics = async () => {
    try {
      await adminApiRequest('/api/blog/admin/seed-topics', {
        method: 'POST'
      });

      toast({
        title: 'Success',
        description: 'Topics seeded successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to seed topics',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTopic = async () => {
    try {
      await adminApiRequest('/api/blog/admin/topics', {
        method: 'POST',
        body: JSON.stringify(newTopic),
      });

      toast({
        title: 'Success',
        description: 'Topic created successfully',
      });
      setNewTopic({
        title: '',
        description: '',
        category: 'contract-law',
        difficulty: 'beginner',
        targetAudience: 'general',
        priority: 5,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create topic',
        variant: 'destructive',
      });
    }
  };

  const handleEditTopic = (topic: BlogTopic) => {
    setEditingTopic(topic.id);
    setEditTopicData({
      title: topic.title,
      description: topic.description,
      category: topic.category,
      difficulty: topic.difficulty,
      targetAudience: topic.targetAudience,
      priority: topic.priority,
    });
  };

  const handleSaveTopicEdit = async (topicId: string) => {
    try {
      setTopicOperationLoading(topicId);
      await adminApiRequest(`/api/blog/admin/topics/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify(editTopicData),
      });

      toast({
        title: 'Success',
        description: 'Topic updated successfully',
      });
      setEditingTopic(null);
      setEditTopicData({});
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update topic',
        variant: 'destructive',
      });
    } finally {
      setTopicOperationLoading(null);
    }
  };

  const handleCancelTopicEdit = () => {
    setEditingTopic(null);
    setEditTopicData({});
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      setTopicOperationLoading(topicId);
      await adminApiRequest(`/api/blog/admin/topics/${topicId}`, {
        method: 'DELETE',
      });

      toast({
        title: 'Success',
        description: 'Topic deleted successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete topic',
        variant: 'destructive',
      });
    } finally {
      setTopicOperationLoading(null);
    }
  };

  const handleResetTopicUsage = async (topicId: string) => {
    try {
      setTopicOperationLoading(topicId);
      await adminApiRequest(`/api/blog/admin/topics/${topicId}/reset`, {
        method: 'PATCH',
      });

      toast({
        title: 'Success',
        description: 'Topic usage reset successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset topic usage',
        variant: 'destructive',
      });
    } finally {
      setTopicOperationLoading(null);
    }
  };

  const handleMarkTopicAsUsed = async (topicId: string) => {
    try {
      setTopicOperationLoading(topicId);
      await adminApiRequest(`/api/blog/admin/topics/${topicId}/mark-used`, {
        method: 'PATCH',
      });

      toast({
        title: 'Success',
        description: 'Topic marked as used successfully',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark topic as used',
        variant: 'destructive',
      });
    } finally {
      setTopicOperationLoading(null);
    }
  };

  const handleGenerateMonthlyTopics = async () => {
    try {
      setMonthlyGenerateLoading(true);
      const result = await adminApiRequest('/api/blog/admin/generate-monthly-topics', {
        method: 'POST',
      });

      toast({
        title: 'Success',
        description: `Generated ${result.generated || 0} monthly topics successfully`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate monthly topics',
        variant: 'destructive',
      });
    } finally {
      setMonthlyGenerateLoading(false);
    }
  };

  const handleGenerateBulkTopics = async () => {
    try {
      setBulkGenerateLoading(true);
      const result = await adminApiRequest('/api/blog/admin/generate-bulk-topics', {
        method: 'POST',
        body: JSON.stringify({ count: bulkGenerateCount }),
      });

      toast({
        title: 'Success',
        description: `Generated ${result.generated || 0} bulk topics successfully`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate bulk topics',
        variant: 'destructive',
      });
    } finally {
      setBulkGenerateLoading(false);
    }
  };

  const handleDeletePost = async (postId: string, permanent: boolean = false) => {
    if (deleteLoading) return;

    try {
      setDeleteLoading(true);
      const endpoint = `/api/blog/admin/posts/${postId}${permanent ? '?permanent=true' : ''}`;
      const result = await adminApiRequest(endpoint, {
        method: 'DELETE'
      });

      toast({
        title: 'Success',
        description: permanent 
          ? 'Post permanently deleted'
          : 'Post moved to trash',
        variant: 'default',
      });

      // Reload data to update both active and deleted posts
      loadData();

      // Close dialogs
      setDeleteDialogOpen(false);
      setSelectedPost(null);
    } catch (error: any) {
      console.error('Delete post error:', error);

      let errorMessage = 'Failed to delete post';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (permanent) {
        errorMessage = 'Failed to permanently delete post. Please try again.';
      } else {
        errorMessage = 'Failed to move post to trash. Please try again.';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestorePost = async (postId: string) => {
    if (restoreLoading) return;

    try {
      setRestoreLoading(true);
      await adminApiRequest(`/api/blog/admin/posts/${postId}/restore`, {
        method: 'PATCH'
      });

      toast({
        title: 'Success',
        description: 'Post restored successfully',
      });

      // Reload data to update both active and deleted posts
      loadData();

      // Close dialogs
      setRestoreDialogOpen(false);
      setSelectedPost(null);
    } catch (error: any) {
      console.error('Restore post error:', error);

      let errorMessage = 'Failed to restore post';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else {
        errorMessage = 'Failed to restore post. The post may not exist or may already be active.';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const openDeleteDialog = (post: BlogPost, type: 'soft' | 'hard' = 'soft') => {
    if (!post || !post.id) {
      toast({
        title: 'Error',
        description: 'Invalid post selected',
        variant: 'destructive',
      });
      return;
    }
    setSelectedPost(post);
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const openRestoreDialog = (post: BlogPost) => {
    if (!post || !post.id) {
      toast({
        title: 'Error',
        description: 'Invalid post selected',
        variant: 'destructive',
      });
      return;
    }
    setSelectedPost(post);
    setRestoreDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md p-4 border border-red-500 bg-red-100 text-red-700">
        <AlertTriangle className="h-5 w-5 inline-block mr-2 align-middle" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Blog Management</h2>
          <p className="text-gray-600">Manage your automated blog content and SEO strategy</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="deleted">Deleted Posts ({deletedPosts.length})</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <BookOpen className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {blogStats?.posts?.total || posts.length}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {blogStats?.posts?.published || posts.filter(p => p.status === 'published').length} published
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Topics</CardTitle>
                <Settings className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {blogStats?.topics?.available || topics.filter(t => !t.isUsed).length}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {blogStats?.topics?.total || topics.length} total topics
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {blogStats?.posts?.totalViews?.toLocaleString() || posts.reduce((sum, post) => sum + (post.viewCount || 0), 0).toLocaleString()}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Across all posts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduler Status</CardTitle>
                <TrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {schedulerStatus?.isRunning ? 'Running' : 'Stopped'}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {schedulerStatus?.config.postsPerDay || 0} posts/day
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Generate content and manage your blog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={handleGeneratePost}
                  disabled={generatingPost}
                  className="flex items-center gap-2"
                >
                  {generatingPost ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Generate Post Now
                    </>
                  )}
                </Button>
                <Button onClick={handleSeedTopics} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Seed Topics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blog Posts</CardTitle>
              <CardDescription>
                Manage your published and draft blog posts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{post.title}</h3>
                      <p className="text-gray-600 text-sm line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                          {post.status}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.viewCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                        title="View post"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(post, 'soft')}
                        title="Move to trash"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(post, 'hard')}
                        title="Permanently delete"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {posts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No blog posts found. Generate your first post!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Posts</CardTitle>
              <CardDescription>
                Manage posts that have been moved to trash. You can restore or permanently delete them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deletedPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50 border-red-200">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-800">{post.title}</h3>
                      <p className="text-gray-600 text-sm line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <Badge variant="destructive">
                          {post.status}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Deleted: {formatDate(post.updatedAt || post.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.viewCount} views
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRestoreDialog(post)}
                        title="Restore post"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(post, 'hard')}
                        title="Permanently delete"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {deletedPosts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No deleted posts found. Trash is empty.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          {/* Bulk Generation Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Bulk Topic Generation</CardTitle>
              <CardDescription>
                Generate multiple topics automatically using AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={handleGenerateMonthlyTopics}
                  disabled={monthlyGenerateLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {monthlyGenerateLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4" />
                      Generate Monthly Topics
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkGenerateCount}
                    onChange={(e) => setBulkGenerateCount(parseInt(e.target.value) || 10)}
                    className="w-20"
                    placeholder="10"
                  />
                  <Button 
                    onClick={handleGenerateBulkTopics}
                    disabled={bulkGenerateLoading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {bulkGenerateLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Generate Bulk Topics
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create New Topic */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Topic</CardTitle>
              <CardDescription>
                Add a new topic for the AI to write about
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={newTopic.title}
                    onChange={(e) => setNewTopic({...newTopic, title: e.target.value})}
                    placeholder="e.g., Understanding Software License Agreements"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newTopic.category}
                    onValueChange={(value) => setNewTopic({...newTopic, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract-law">Contract Law</SelectItem>
                      <SelectItem value="employment-law">Employment Law</SelectItem>
                      <SelectItem value="intellectual-property">Intellectual Property</SelectItem>
                      <SelectItem value="business-law">Business Law</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newTopic.description}
                  onChange={(e) => setNewTopic({...newTopic, description: e.target.value})}
                  placeholder="Brief description of what this topic should cover..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select
                    value={newTopic.difficulty}
                    onValueChange={(value) => setNewTopic({...newTopic, difficulty: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Audience</label>
                  <Select
                    value={newTopic.targetAudience}
                    onValueChange={(value) => setNewTopic({...newTopic, targetAudience: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="business-owners">Business Owners</SelectItem>
                      <SelectItem value="legal-professionals">Legal Professionals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority (1-10)</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={newTopic.priority}
                    onChange={(e) => setNewTopic({...newTopic, priority: parseInt(e.target.value) || 5})}
                  />
                </div>
              </div>
              <Button onClick={handleCreateTopic} disabled={!newTopic.title}>
                <Plus className="h-4 w-4 mr-2" />
                Create Topic
              </Button>
            </CardContent>
          </Card>

          {/* Existing Topics with Enhanced Display */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Topics</CardTitle>
              <CardDescription>
                {topics.filter(t => !t.isUsed).length} unused topics available • {topics.filter(t => t.isUsed).length} used topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topics.map((topic) => (
                  <div key={topic.id} className={`border rounded-lg p-4 ${topic.isUsed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'}`}>
                    {editingTopic === topic.id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                              value={editTopicData.title || ''}
                              onChange={(e) => setEditTopicData({...editTopicData, title: e.target.value})}
                              placeholder="Topic title"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Category</label>
                            <Select
                              value={editTopicData.category || ''}
                              onValueChange={(value) => setEditTopicData({...editTopicData, category: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contract-law">Contract Law</SelectItem>
                                <SelectItem value="employment-law">Employment Law</SelectItem>
                                <SelectItem value="intellectual-property">Intellectual Property</SelectItem>
                                <SelectItem value="business-law">Business Law</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <Textarea
                            value={editTopicData.description || ''}
                            onChange={(e) => setEditTopicData({...editTopicData, description: e.target.value})}
                            placeholder="Topic description"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Difficulty</label>
                            <Select
                              value={editTopicData.difficulty || ''}
                              onValueChange={(value) => setEditTopicData({...editTopicData, difficulty: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Target Audience</label>
                            <Select
                              value={editTopicData.targetAudience || ''}
                              onValueChange={(value) => setEditTopicData({...editTopicData, targetAudience: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="business-owners">Business Owners</SelectItem>
                                <SelectItem value="legal-professionals">Legal Professionals</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Priority (1-10)</label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={editTopicData.priority || 5}
                              onChange={(e) => setEditTopicData({...editTopicData, priority: parseInt(e.target.value) || 5})}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSaveTopicEdit(topic.id)}
                            disabled={topicOperationLoading === topic.id}
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            {topicOperationLoading === topic.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={handleCancelTopicEdit}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-lg">{topic.title}</h4>
                            {topic.isUsed && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Used
                              </Badge>
                            )}
                          </div>
                          {topic.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{topic.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-sm">
                            <Badge variant="outline" className="capitalize">
                              {topic.category.replace('-', ' ')}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {topic.difficulty}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {topic.targetAudience.replace('-', ' ')}
                            </Badge>
                            <span className="text-gray-500">Priority: {topic.priority}</span>
                          </div>
                          {topic.isUsed && topic.usedAt && (
                            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Used on {formatDate(topic.usedAt)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => handleEditTopic(topic)}
                            variant="outline"
                            size="sm"
                            title="Edit topic"
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {topic.isUsed ? (
                            <Button
                              onClick={() => handleResetTopicUsage(topic.id)}
                              disabled={topicOperationLoading === topic.id}
                              variant="outline"
                              size="sm"
                              title="Reset usage - mark as unused"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                            >
                              {topicOperationLoading === topic.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleMarkTopicAsUsed(topic.id)}
                              disabled={topicOperationLoading === topic.id}
                              variant="outline"
                              size="sm"
                              title="Mark as used"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 flex items-center gap-1"
                            >
                              {topicOperationLoading === topic.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDeleteTopic(topic.id)}
                            disabled={topicOperationLoading === topic.id}
                            variant="outline"
                            size="sm"
                            title="Delete topic"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
                          >
                            {topicOperationLoading === topic.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {topics.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">No topics found</p>
                    <p className="text-sm">Create some topics manually or generate them automatically using the buttons above.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduler Control</CardTitle>
              <CardDescription>
                Manage the automated blog posting schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">
                    Status: {schedulerStatus?.isRunning ? 'Running' : 'Stopped'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {schedulerStatus?.config.enabled ? 'Scheduler is enabled' : 'Scheduler is disabled in config'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {schedulerStatus?.isRunning ? (
                    <Button onClick={handleStopScheduler} variant="outline">
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  ) : (
                    <Button onClick={handleStartScheduler}>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  )}
                </div>
              </div>

              {schedulerStatus && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Configuration</h4>
                      <div className="text-sm space-y-1">
                        <p>Posts per day: {schedulerStatus.config.postsPerDay}</p>
                        <p>Hours: {schedulerStatus.config.hours.join(', ')}</p>
                        <p>Timezone: {schedulerStatus.config.timezone}</p>
                        <p>Min hours between posts: {schedulerStatus.config.minHoursBetweenPosts}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Next Scheduled Runs</h4>
                      <div className="text-sm space-y-1">
                        {schedulerStatus.nextRuns.map((run, index) => (
                          <p key={index}>
                            {run.hour}:00 - {new Date(run.nextRun).toLocaleDateString()}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteType === 'hard' ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Permanently Delete Post
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5 text-orange-600" />
                  Move Post to Trash
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {deleteType === 'hard' ? (
                <>
                  This action cannot be undone. This will permanently delete the post "{selectedPost?.title}" 
                  and remove all associated data from the server.
                </>
              ) : (
                <>
                  Are you sure you want to move "{selectedPost?.title}" to trash? 
                  You can restore it later from the Deleted Posts tab.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={deleteType === 'hard' ? 'destructive' : 'default'}
              onClick={() => selectedPost && handleDeletePost(selectedPost.id, deleteType === 'hard')}
              className={deleteType === 'soft' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {deleteType === 'hard' ? 'Deleting...' : 'Moving to Trash...'}
                </>
              ) : (
                deleteType === 'hard' ? 'Permanently Delete' : 'Move to Trash'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-green-600" />
              Restore Post
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore "{selectedPost?.title}"? 
              This will move it back to your active posts and make it publicly available again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedPost && handleRestorePost(selectedPost.id)}
              className="bg-green-600 hover:bg-green-700"
              disabled={restoreLoading}
            >
              {restoreLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Restore Post'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}