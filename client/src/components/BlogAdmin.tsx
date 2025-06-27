import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
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
  BookOpen
} from 'lucide-react';

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
  createdAt: string;
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
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPost, setGeneratingPost] = useState(false);
  
  // New topic form
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    category: 'contract-law',
    difficulty: 'beginner',
    targetAudience: 'general',
    priority: 5,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('subscriptionToken');
      
      // Load posts
      const postsResponse = await fetch('/api/blog/admin/posts', {
        headers: { 'x-subscription-token': token || '' },
      });
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setPosts(postsData.posts);
      }
      
      // Load topics
      const topicsResponse = await fetch('/api/blog/admin/topics', {
        headers: { 'x-subscription-token': token || '' },
      });
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        setTopics(topicsData.topics);
      }
      
      // Load scheduler status
      const schedulerResponse = await fetch('/api/blog/admin/scheduler/status', {
        headers: { 'x-subscription-token': token || '' },
      });
      if (schedulerResponse.ok) {
        const schedulerData = await schedulerResponse.json();
        setSchedulerStatus(schedulerData);
      }
    } catch (error) {
      console.error('Error loading blog admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog admin data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartScheduler = async () => {
    try {
      const token = localStorage.getItem('subscriptionToken');
      const response = await fetch('/api/blog/admin/scheduler/start', {
        method: 'POST',
        headers: { 'x-subscription-token': token || '' },
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Blog scheduler started successfully',
        });
        loadData();
      } else {
        throw new Error('Failed to start scheduler');
      }
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
      const token = localStorage.getItem('subscriptionToken');
      const response = await fetch('/api/blog/admin/scheduler/stop', {
        method: 'POST',
        headers: { 'x-subscription-token': token || '' },
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Blog scheduler stopped successfully',
        });
        loadData();
      } else {
        throw new Error('Failed to stop scheduler');
      }
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
      const token = localStorage.getItem('subscriptionToken');
      const response = await fetch('/api/blog/admin/scheduler/trigger', {
        method: 'POST',
        headers: { 'x-subscription-token': token || '' },
      });
      
      const result = await response.json();
      
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
      const token = localStorage.getItem('subscriptionToken');
      const response = await fetch('/api/blog/admin/seed-topics', {
        method: 'POST',
        headers: { 'x-subscription-token': token || '' },
      });
      
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Topics seeded successfully',
        });
        loadData();
      } else {
        throw new Error('Failed to seed topics');
      }
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
      const token = localStorage.getItem('subscriptionToken');
      const response = await fetch('/api/blog/admin/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-subscription-token': token || '',
        },
        body: JSON.stringify(newTopic),
      });
      
      if (response.ok) {
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
      } else {
        throw new Error('Failed to create topic');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create topic',
        variant: 'destructive',
      });
    }
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
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{posts.length}</div>
                <p className="text-xs text-muted-foreground">
                  {posts.filter(p => p.status === 'published').length} published
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Topics</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {topics.filter(t => !t.isUsed).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {topics.length} total topics
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {posts.reduce((sum, post) => sum + (post.viewCount || 0), 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all posts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduler Status</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {schedulerStatus?.isRunning ? 'Running' : 'Stopped'}
                </div>
                <p className="text-xs text-muted-foreground">
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
                      >
                        <Eye className="h-4 w-4" />
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

        <TabsContent value="topics" className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle>Existing Topics</CardTitle>
              <CardDescription>
                {topics.filter(t => !t.isUsed).length} unused topics available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <h4 className="font-medium">{topic.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Badge variant="outline">{topic.category}</Badge>
                        <Badge variant="outline">{topic.difficulty}</Badge>
                        <span>Priority: {topic.priority}</span>
                        {topic.isUsed && (
                          <Badge variant="secondary">Used</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {topics.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No topics found. Create some topics or seed the database.
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
    </div>
  );
}