import { useState, useEffect } from 'react';
import { Link, useLocation } from "wouter";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  Search, 
  Calendar, 
  Eye, 
  Share2, 
  Filter,
  ArrowUp,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Zap
} from 'lucide-react';
import { MobileAppWrapper } from '@/components/MobileAppWrapper';
import TradeSecretProtection from '@/components/TradeSecretProtection';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useSEO } from '@/lib/seo';

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
  displayViewCount?: number;
  shareCount: number;
  displayShareCount?: number;
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
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFeatured, setShowFeatured] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  
  // Use project SEO utilities instead of manual DOM manipulation
  useSEO('/blog', {
    title: 'Legal Insights & Contract Law Blog | ReadMyFinePrint',
    description: 'Expert insights on contract law, privacy protection, and legal technology. Learn how to protect your rights and understand complex legal documents.',
    keywords: 'legal blog, contract law, privacy protection, legal technology, legal insights, contract analysis',
    canonical: `${window.location.origin}/blog`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "ReadMyFinePrint Blog",
      "description": "Expert insights on contract law, privacy protection, and legal technology",
      "url": `${window.location.origin}/blog`,
      "publisher": {
        "@type": "Organization",
        "name": "ReadMyFinePrint",
        "url": `${window.location.origin}`
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${window.location.origin}/blog`
      }
    }
  });

  // Fetch blog posts with React Query
  const {
    data: blogData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['blog', 'posts', {
      page: currentPage,
      search: isSearchSubmitted ? searchTerm : '',
      category: selectedCategory,
      featured: showFeatured
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(isSearchSubmitted && searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(showFeatured && { featured: 'true' }),
      });

      const response = await fetch(`/api/blog/posts?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      
      return response.json() as Promise<BlogResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Fetch categories with React Query
  const {
    data: categoriesData,
    isLoading: categoriesLoading
  } = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: async () => {
      const response = await fetch('/api/blog/categories');
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      
      const data = await response.json();
      return data.categories as Category[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });

  const posts = blogData?.posts || [];
  const pagination = blogData?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
  const categories = categoriesData || [];

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedCategory, showFeatured, currentPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearchSubmitted(true);
    setCurrentPage(1);
    // React Query will automatically refetch due to dependency change
  };

  const clearSearch = () => {
    setSearchTerm('');
    setIsSearchSubmitted(false);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleFeaturedToggle = () => {
    setShowFeatured(!showFeatured);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top functionality
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (!tags || typeof tags !== 'string') return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(tag => tag.trim());
    }
  };

  // Error boundary component
  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <TradeSecretProtection />
        <MobileAppWrapper>
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Alert className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" data-testid="error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load blog posts. Please try refreshing the page or check your connection.
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4"
                  onClick={() => refetch()}
                  data-testid="retry-button"
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </MobileAppWrapper>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 page-transition min-h-screen">
      <TradeSecretProtection />
      <MobileAppWrapper>
        {/* Skip to content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
          data-testid="skip-link"
        >
          Skip to main content
        </a>
        
        <div className="container mx-auto px-4 py-8 max-w-6xl" role="main" id="main-content">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight"
              data-testid="blog-title"
            >
              Legal Insights & Contract Law Blog
            </h1>
            <p 
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6 leading-relaxed"
              data-testid="blog-description"
            >
              Expert advice, guides, and insights to help you understand contracts, 
              negotiate better terms, and protect your legal interests.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2" data-testid="total-articles">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>{pagination.total} Articles</span>
              </div>
              <div className="flex items-center gap-2" data-testid="categories-count">
                <Filter className="h-4 w-4" aria-hidden="true" />
                <span>{categories.length} Categories</span>
              </div>
              {showFeatured && (
                <div className="flex items-center gap-2" data-testid="featured-indicator">
                  <Zap className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                  <span>Featured Only</span>
                </div>
              )}
            </div>
          </header>

          {/* Search and Filters */}
          <section className="mb-12 space-y-6" aria-label="Search and filters">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4" role="search">
              <div className="flex-1 relative">
                <label htmlFor="search-input" className="sr-only">
                  Search articles
                </label>
                <Search 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" 
                  aria-hidden="true"
                />
                <Input
                  id="search-input"
                  type="text"
                  placeholder="Search articles about privacy, contracts, legal tech..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-base md:text-sm"
                  data-testid="search-input"
                  aria-describedby="search-help"
                />
                <div id="search-help" className="sr-only">
                  Search through all blog articles by title, content, or keywords
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="flex items-center gap-2"
                  data-testid="search-button"
                  disabled={isLoading}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </Button>
                {(isSearchSubmitted && searchTerm) && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={clearSearch}
                    data-testid="clear-search-button"
                    aria-label="Clear search"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Category filters">
                <Button
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange('')}
                  data-testid="category-all"
                  aria-pressed={selectedCategory === ''}
                >
                  All Categories
                </Button>
                {categoriesLoading ? (
                  <>  
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </>
                ) : (
                  categories.map((category) => (
                    <Button
                      key={category.name}
                      variant={selectedCategory === category.name ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleCategoryChange(category.name)}
                      data-testid={`category-${category.name}`}
                      aria-pressed={selectedCategory === category.name}
                    >
                      {formatCategory(category.name)} ({category.count})
                    </Button>
                  ))
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <Button
                  variant={showFeatured ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleFeaturedToggle}
                  data-testid="featured-filter"
                  aria-pressed={showFeatured}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  Featured Only
                </Button>
                
                {(selectedCategory || showFeatured || (isSearchSubmitted && searchTerm)) && (
                  <div className="text-sm text-gray-600 dark:text-gray-400" data-testid="active-filters">
                    <span className="font-medium">Active filters:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCategory && (
                        <Badge variant="secondary" className="text-xs">
                          Category: {formatCategory(selectedCategory)}
                        </Badge>
                      )}
                      {showFeatured && (
                        <Badge variant="secondary" className="text-xs">
                          Featured posts
                        </Badge>
                      )}
                      {(isSearchSubmitted && searchTerm) && (
                        <Badge variant="secondary" className="text-xs">
                          Search: "{searchTerm}"
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Loading State */}
          {isLoading && (
            <section className="mb-8" aria-label="Loading articles">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="loading-skeleton">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse" role="presentation">
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                      <Skeleton className="h-6 w-full mb-2" />
                      <Skeleton className="h-4 w-5/6" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-4">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Blog Posts Grid */}
          {!isLoading && (
            <>
              <section 
                className="mb-12" 
                aria-label={`${posts.length} blog articles`}
                data-testid="blog-posts-section"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map((post, index) => (
                    <article 
                      key={post.id} 
                      className="group"
                      data-testid={`blog-post-${post.slug}`}
                    >
                      <Card className="hover:shadow-xl transition-all duration-300 h-full flex flex-col border-l-4 border-l-transparent hover:border-l-blue-500 dark:hover:border-l-blue-400">
                        <CardHeader className="flex-grow">
                          <div className="flex items-center justify-between mb-3">
                            <Badge 
                              variant="secondary" 
                              className="text-xs font-medium"
                              data-testid={`category-badge-${post.category}`}
                            >
                              {formatCategory(post.category)}
                            </Badge>
                            {post.isFeatured && (
                              <Badge 
                                variant="default" 
                                className="text-xs bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700"
                                data-testid={`featured-badge-${post.id}`}
                              >
                                <Zap className="h-3 w-3 mr-1" aria-hidden="true" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          
                          <CardTitle className="text-lg md:text-xl mb-3 line-height-tight">
                            <Link 
                              to={`/blog/${post.slug}`}
                              className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 group-hover:underline decoration-2 underline-offset-2"
                              data-testid={`post-title-${post.slug}`}
                              aria-describedby={`excerpt-${post.id}`}
                            >
                              {post.title}
                            </Link>
                          </CardTitle>
                          
                          <CardDescription 
                            className="text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed"
                            id={`excerpt-${post.id}`}
                            data-testid={`post-excerpt-${post.slug}`}
                          >
                            {post.excerpt}
                          </CardDescription>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Meta information */}
                            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1" data-testid={`post-date-${post.slug}`}>
                                  <Calendar className="h-4 w-4" aria-hidden="true" />
                                  <time dateTime={post.publishedAt}>
                                    {formatDate(post.publishedAt)}
                                  </time>
                                </div>
                                <div className="flex items-center gap-1" data-testid={`reading-time-${post.slug}`}>
                                  <Clock className="h-4 w-4" aria-hidden="true" />
                                  <span>{post.readingTime} min read</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Engagement metrics */}
                            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1" data-testid={`view-count-${post.slug}`}>
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                  <span>{(post.displayViewCount || post.viewCount).toLocaleString()} views</span>
                                </div>
                                <div className="flex items-center gap-1" data-testid={`share-count-${post.slug}`}>
                                  <Share2 className="h-4 w-4" aria-hidden="true" />
                                  <span>{(post.displayShareCount || post.shareCount).toLocaleString()} shares</span>
                                </div>
                              </div>
                            </div>

                            {/* Tags */}
                            {parseTags(post.tags).length > 0 && (
                              <div className="flex flex-wrap gap-1" data-testid={`post-tags-${post.slug}`}>
                                {parseTags(post.tags).slice(0, 3).map((tag: string, tagIndex: number) => (
                                  <Badge 
                                    key={tagIndex} 
                                    variant="outline" 
                                    className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                                    data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {parseTags(post.tags).length > 3 && (
                                  <Badge variant="outline" className="text-xs text-gray-400">
                                    +{parseTags(post.tags).length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </article>
                  ))}
                </div>
              </section>

              {/* No Posts */}
              {posts.length === 0 && (
                <div 
                  className="text-center py-16 px-4" 
                  data-testid="no-posts-message"
                  role="region" 
                  aria-label="No articles found"
                >
                  <div className="max-w-md mx-auto">
                    <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-6" aria-hidden="true" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      No articles found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      {isSearchSubmitted && searchTerm
                        ? `No articles match your search for "${searchTerm}". Try different keywords or browse by category.`
                        : selectedCategory
                        ? `No articles found in the "${formatCategory(selectedCategory)}" category.`
                        : showFeatured
                        ? 'No featured articles available at the moment.'
                        : 'No articles are currently available. Please check back later.'}
                    </p>
                    
                    <div className="space-y-3">
                      {(isSearchSubmitted && searchTerm) && (
                        <Button 
                          variant="outline" 
                          onClick={clearSearch}
                          data-testid="clear-search-no-results"
                        >
                          Clear search
                        </Button>
                      )}
                      
                      {(selectedCategory || showFeatured) && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSelectedCategory('');
                            setShowFeatured(false);
                            setCurrentPage(1);
                          }}
                          data-testid="clear-filters"
                        >
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <nav 
                  className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-12"
                  aria-label="Blog pagination"
                  data-testid="pagination"
                >
                  <Button
                    variant="outline"
                    disabled={!pagination.hasPrev || isLoading}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    data-testid="previous-page"
                    className="flex items-center gap-2"
                    aria-label={`Go to page ${pagination.page - 1}`}
                  >
                    <ArrowUp className="h-4 w-4 rotate-[-90deg]" aria-hidden="true" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span data-testid="current-page">Page {pagination.page}</span>
                    <span>of</span>
                    <span data-testid="total-pages">{pagination.totalPages}</span>
                    <span className="mx-2">•</span>
                    <span data-testid="total-articles">{pagination.total.toLocaleString()} articles</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    disabled={!pagination.hasNext || isLoading}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    data-testid="next-page"
                    className="flex items-center gap-2"
                    aria-label={`Go to page ${pagination.page + 1}`}
                  >
                    Next
                    <ArrowUp className="h-4 w-4 rotate-90" aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </>
          )}

          {/* Back to top button */}
          {posts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToTop}
              className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
              data-testid="scroll-to-top"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </MobileAppWrapper>
    </div>
  );
}