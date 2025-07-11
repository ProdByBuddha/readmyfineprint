import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, Search, Calendar, Eye, Share2 } from 'lucide-react';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  tags?: string;
  publishedAt: string;
  readingTime: number;
  viewCount: number;
  shareCount: number;
  isFeatured: boolean;
  metaDescription?: string;
  keywords?: string;
}

interface BlogResponse {
  posts: BlogPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface Category {
  name: string;
  count: number;
  slug: string;
}

export default function BlogPage() {
  const [location] = useLocation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<BlogResponse['pagination']>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);

  // Load blog posts
  const loadPosts = async (page = 1, search = '', category = '', featured = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(category && { category }),
        ...(featured && { featured: 'true' }),
      });

      const response = await fetch(`/api/blog/posts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      
      const data: BlogResponse = await response.json();
      setPosts(data.posts);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/blog/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      setCategories(data.categories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    loadPosts(1, searchTerm, selectedCategory, showFeatured);
  }, [searchTerm, selectedCategory, showFeatured]);

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPosts(1, searchTerm, selectedCategory, showFeatured);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCategory = (category: string) => {
    return category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const parseTags = (tags?: string) => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(tag => tag.trim());
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Legal Insights & Contract Law Blog
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Expert advice, guides, and insights to help you understand contracts, 
          negotiate better terms, and protect your legal interests.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('')}
          >
            All Categories
          </Button>
          {categories.map((category) => (
            <Button
              key={category.slug}
              variant={selectedCategory === category.name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.name)}
            >
              {formatCategory(category.name)} ({category.count})
            </Button>
          ))}
          <Button
            variant={showFeatured ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFeatured(!showFeatured)}
          >
            Featured Only
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Blog Posts Grid */}
      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {posts.map((post) => (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">
                      {formatCategory(post.category)}
                    </Badge>
                    {post.isFeatured && (
                      <Badge variant="default">Featured</Badge>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2 hover:text-blue-600">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {post.excerpt}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(post.publishedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {post.readingTime} min read
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {post.viewCount}
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 className="h-4 w-4" />
                        {post.shareCount}
                      </div>
                    </div>
                  </div>

                  {parseTags(post.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {parseTags(post.tags).slice(0, 3).map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* No Posts */}
          {posts.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No articles found
              </h3>
              <p className="text-gray-600">
                Try adjusting your search terms or filters.
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <Button
                variant="outline"
                disabled={!pagination.hasPrev}
                onClick={() => loadPosts(pagination.page - 1, searchTerm, selectedCategory, showFeatured)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={!pagination.hasNext}
                onClick={() => loadPosts(pagination.page + 1, searchTerm, selectedCategory, showFeatured)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}