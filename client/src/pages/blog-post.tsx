import { useState, useEffect, useCallback } from 'react';
import { Link, useRoute } from "wouter";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  Calendar, 
  Eye, 
  Share2, 
  ArrowLeft, 
  Twitter, 
  Facebook, 
  Linkedin,
  Copy,
  CheckCircle,
  BookOpen,
  User,
  Tag,
  TrendingUp,
  AlertCircle,
  RefreshCcw,
  ArrowUp,
  Bookmark,
  Mail,
  MessageCircle,
  Zap
} from 'lucide-react';
import { MobileAppWrapper } from '@/components/MobileAppWrapper';
// Temporarily disabled TradeSecretProtection due to interference with app functionality
// import TradeSecretProtection from '@/components/TradeSecretProtection';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useSEO } from '@/lib/seo';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags?: string;
  publishedAt: string;
  readingTime: number;
  viewCount: number;
  displayViewCount?: number;
  shareCount: number;
  displayShareCount?: number;
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string;
  structuredData?: string;
}

interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: number;
}

interface BlogPostResponse {
  post: BlogPost;
  relatedPosts: RelatedPost[];
}

export default function BlogPostPage() {
  const [match, params] = useRoute('/blog/:slug');
  const slug = params?.slug;
  const [copySuccess, setCopySuccess] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Fetch blog post with React Query
  const {
    data: blogData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      
      const response = await fetch(`/api/blog/posts/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Article not found');
        }
        throw new Error(`Failed to load article: ${response.status}`);
      }
      
      return response.json() as Promise<BlogPostResponse>;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return false;
      }
      return failureCount < 2;
    }
  });

  const post = blogData?.post;
  const relatedPosts = blogData?.relatedPosts || [];

  // Use project SEO utilities instead of manual DOM manipulation
  useEffect(() => {
    if (!post || !slug) return;

    const title = post.metaTitle || `${post.title} | ReadMyFinePrint`;
    
    // Get structured data - either from post or create fallback
    let structuredData;
    if (post.structuredData) {
      try {
        structuredData = JSON.parse(post.structuredData);
      } catch (error) {
        console.warn('Invalid structured data from post:', error);
        structuredData = null;
      }
    }
    
    if (!structuredData) {
      structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.metaDescription || post.excerpt,
        "datePublished": post.publishedAt,
        "dateModified": post.publishedAt,
        "author": {
          "@type": "Organization",
          "name": "ReadMyFinePrint"
        },
        "publisher": {
          "@type": "Organization",
          "name": "ReadMyFinePrint",
          "url": `${window.location.origin}`
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": `${window.location.origin}/blog/${slug}`
        },
        "url": `${window.location.origin}/blog/${slug}`,
        "wordCount": Math.round(post.readingTime * 250),
        "timeRequired": `PT${post.readingTime}M`,
        "articleSection": formatCategory(post.category),
        "keywords": post.keywords || parseTags(post.tags).join(', ')
      };
    }

    useSEO(`/blog/${slug}`, {
      title,
      description: post.metaDescription || post.excerpt,
      keywords: post.keywords || parseTags(post.tags).join(', '),
      canonical: `${window.location.origin}/blog/${slug}`,
      ogTitle: title,
      ogDescription: post.metaDescription || post.excerpt,
      twitterTitle: title,
      twitterDescription: post.metaDescription || post.excerpt,
      structuredData
    });
  }, [post, slug]);

  // Reading progress tracker
  useEffect(() => {
    if (!post) return;

    const updateReadingProgress = () => {
      const article = document.querySelector('#article-content');
      if (!article) return;

      const articleTop = article.offsetTop;
      const articleHeight = article.offsetHeight;
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      const articleBottom = articleTop + articleHeight;
      const viewportBottom = scrollTop + viewportHeight;

      let progress = 0;
      if (scrollTop > articleTop) {
        const readHeight = Math.min(viewportBottom - articleTop, articleHeight);
        progress = Math.max(0, Math.min(100, (readHeight / articleHeight) * 100));
      }

      setReadingProgress(progress);
    };

    window.addEventListener('scroll', updateReadingProgress);
    updateReadingProgress();

    return () => window.removeEventListener('scroll', updateReadingProgress);
  }, [post]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const formatCategory = useCallback((category: string) => {
    return category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }, []);

  const parseTags = useCallback((tags?: string) => {
    if (!tags || typeof tags !== 'string') return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(tag => tag.trim());
    }
  }, []);

  const processContent = useCallback((content: string) => {
    // Check if content is wrapped in markdown code blocks
    const htmlBlockMatch = content.match(/```html\s*\n([\s\S]*?)\n```/);
    if (htmlBlockMatch) {
      // Extract HTML from markdown code block and combine with rest of content
      const htmlContent = htmlBlockMatch[1];
      const remainingContent = content.replace(/```html\s*\n[\s\S]*?\n```\s*/, '');
      return htmlContent + remainingContent;
    }
    return content;
  }, []);

  const shareUrl = `${window.location.origin}/blog/${slug}`;
  const shareTitle = post?.title || '';

  const shareOnTwitter = () => {
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}&via=ReadMyFinePrint`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareOnFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareOnLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out this article: ${shareTitle}`);
    const body = encodeURIComponent(`I thought you might find this article interesting:\n\n${shareTitle}\n\n${shareUrl}\n\nFrom ReadMyFinePrint - Privacy-first document analysis`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // Here you would typically save to localStorage or API
    const bookmarks = JSON.parse(localStorage.getItem('bookmarked-articles') || '[]');
    if (isBookmarked) {
      localStorage.setItem('bookmarked-articles', JSON.stringify(bookmarks.filter((id: string) => id !== post?.id)));
    } else {
      localStorage.setItem('bookmarked-articles', JSON.stringify([...bookmarks, post?.id]));
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check if article is bookmarked on mount
  useEffect(() => {
    if (post) {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarked-articles') || '[]');
      setIsBookmarked(bookmarks.includes(post.id));
    }
  }, [post]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
        {/* <TradeSecretProtection /> */}
        <MobileAppWrapper>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="animate-pulse space-y-8" data-testid="loading-skeleton">
              <Skeleton className="h-8 w-32" />
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="space-y-4">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
        </MobileAppWrapper>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
        {/* <TradeSecretProtection /> */}
        <MobileAppWrapper>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Alert className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200 mb-8" data-testid="error-alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error?.message || 'Article not found'}
              </AlertDescription>
            </Alert>
            
            <div className="text-center py-12" data-testid="error-fallback">
              <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-6" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {error?.message?.includes('not found') ? 'Article Not Found' : 'Failed to Load Article'}
              </h1>
              <p className="text-gray-600 dark:text-gray-100 mb-8 max-w-md mx-auto">
                {error?.message?.includes('not found') 
                  ? "The article you're looking for doesn't exist or has been moved."
                  : "We're having trouble loading this article. Please try again."}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/blog" data-testid="back-to-blog-error">
                  <Button className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to Blog
                  </Button>
                </Link>
                
                {!error?.message?.includes('not found') && (
                  <Button 
                    variant="outline" 
                    onClick={() => refetch()}
                    data-testid="retry-button"
                    className="flex items-center gap-2"
                  >
                    <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>
        </MobileAppWrapper>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 page-transition min-h-screen">
      {/* Temporarily disabled TradeSecretProtection due to interference with app functionality */}
      {/* <TradeSecretProtection /> */}
      
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <Progress 
          value={readingProgress} 
          className="h-1 rounded-none" 
          data-testid="reading-progress"
          aria-label={`Reading progress: ${Math.round(readingProgress)}%`}
        />
      </div>

      <MobileAppWrapper>
        {/* Skip to content link for accessibility */}
        <a 
          href="#article-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-6 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
          data-testid="skip-to-content"
        >
          Skip to article content
        </a>

        <div className="container mx-auto px-4 py-8 max-w-4xl pt-12" role="main">
          {/* Back to Blog Navigation */}
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link 
              to="/blog" 
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 group"
              data-testid="back-to-blog"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" aria-hidden="true" />
              Back to Blog
            </Link>
          </nav>

          {/* Article */}
          <article className="mb-16" data-testid="blog-article">
            {/* Article Header */}
            <header className="mb-8">
              {/* Category and Featured Badge */}
              <div className="flex items-center gap-4 mb-6" data-testid="article-badges">
                <Badge 
                  variant="secondary" 
                  className="text-sm font-medium px-3 py-1"
                  data-testid={`category-badge-${post.category}`}
                >
                  <Tag className="h-3 w-3 mr-1" aria-hidden="true" />
                  {formatCategory(post.category)}
                </Badge>
                {post.isFeatured && (
                  <Badge 
                    variant="default" 
                    className="text-sm bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700 px-3 py-1"
                    data-testid="featured-badge"
                  >
                    <Zap className="h-3 w-3 mr-1" aria-hidden="true" />
                    Featured Article
                  </Badge>
                )}
              </div>

              {/* Article Title */}
              <h1 
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight"
                data-testid="article-title"
              >
                {post.title}
              </h1>

              {/* Article Excerpt */}
              <p 
                className="text-xl md:text-2xl text-gray-600 dark:text-gray-100 mb-8 leading-relaxed">
                data-testid="article-excerpt"
              >
                {post.excerpt}
              </p>

              {/* Article Metadata */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-300 mb-6" data-testid="article-metadata">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  <time dateTime={post.publishedAt} data-testid="publish-date">
                    {formatDate(post.publishedAt)}
                  </time>
                </div>
                
                <div className="flex items-center gap-2" data-testid="reading-time">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>{post.readingTime} min read</span>
                </div>
                
                <div className="flex items-center gap-2" data-testid="view-count">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>{(post.displayViewCount || post.viewCount).toLocaleString()} views</span>
                </div>

                <div className="flex items-center gap-2" data-testid="share-count">
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  <span>{(post.displayShareCount || post.shareCount).toLocaleString()} shares</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleBookmark}
                  className={cn(
                    "flex items-center gap-2 hover:bg-transparent",
                    isBookmarked 
                      ? "text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400" 
                      : "hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                  data-testid="bookmark-button"
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark article"}
                >
                  <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </span>
                </Button>
              </div>

              {/* Tags */}
              {parseTags(post.tags).length > 0 && (
                <div className="mb-8" data-testid="article-tags">
                  <div className="flex flex-wrap gap-2">
                    {parseTags(post.tags).map((tag: string, index: number) => (
                      <Badge 
                        key={index} 
                        variant="outline" 
                        className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                        data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="mb-8" />
            </header>

            {/* Article Content */}
            <div 
              id="article-content"
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-blockquote:text-gray-600 prose-blockquote:border-l-blue-500 prose-code:text-gray-800 prose-code:bg-gray-100 prose-pre:bg-gray-100 dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 dark:prose-strong:text-gray-100 dark:prose-ul:text-gray-300 dark:prose-ol:text-gray-300 dark:prose-blockquote:text-gray-400 dark:prose-blockquote:border-l-blue-400 dark:prose-em:text-gray-400 dark:prose-code:text-gray-200 dark:prose-code:bg-gray-800 dark:prose-pre:bg-gray-800"
              dangerouslySetInnerHTML={{ __html: processContent(post.content) }}
              data-testid="article-content"
            />

            {/* Share Section */}
            <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700" data-testid="share-section">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Share this article
                  </h3>
                  <p className="text-gray-600 dark:text-gray-100 text-sm">
                    Help others discover this content
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareOnTwitter}
                    className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                    data-testid="share-twitter"
                    aria-label="Share on Twitter"
                  >
                    <Twitter className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Twitter</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareOnFacebook}
                    className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                    data-testid="share-facebook"
                    aria-label="Share on Facebook"
                  >
                    <Facebook className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Facebook</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareOnLinkedIn}
                    className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:border-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                    data-testid="share-linkedin"
                    aria-label="Share on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">LinkedIn</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareViaEmail}
                    className="flex items-center gap-2 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:border-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                    data-testid="share-email"
                    aria-label="Share via email"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Email</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className={cn(
                      "flex items-center gap-2 transition-colors duration-200",
                      copySuccess 
                        ? "text-green-700 border-green-200 bg-green-50 dark:text-green-300 dark:border-green-800 dark:bg-green-950"
                        : "hover:bg-gray-50 hover:border-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:border-gray-600 dark:hover:text-gray-300"
                    )}
                    data-testid="copy-link"
                    aria-label="Copy article link"
                  >
                    {copySuccess ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {copySuccess ? 'Copied!' : 'Copy Link'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </article>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16" data-testid="related-posts">
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Related Articles
                </h2>
                <p className="text-gray-600 dark:text-gray-100">
                  Continue reading with these related articles
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost, index) => (
                  <article key={relatedPost.id} data-testid={`related-post-${relatedPost.slug}`}>
                    <Card className="hover:shadow-xl transition-all duration-300 h-full border-l-4 border-l-transparent hover:border-l-blue-500 dark:hover:border-l-blue-400 group">
                      <CardHeader>
                        <CardTitle className="text-lg line-clamp-2 mb-3">
                          <Link 
                            to={`/blog/${relatedPost.slug}`}
                            className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 group-hover:underline decoration-2 underline-offset-2"
                            data-testid={`related-post-title-${relatedPost.slug}`}
                          >
                            {relatedPost.title}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p 
                          className="text-gray-600 dark:text-gray-100 line-clamp-3 mb-4 leading-relaxed">
                          data-testid={`related-post-excerpt-${relatedPost.slug}`}
                        >
                          {relatedPost.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-300">
                          <div className="flex items-center gap-1" data-testid={`related-post-date-${relatedPost.slug}`}>
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            <time dateTime={relatedPost.publishedAt}>
                              {formatDate(relatedPost.publishedAt)}
                            </time>
                          </div>
                          <div className="flex items-center gap-1" data-testid={`related-post-reading-time-${relatedPost.slug}`}>
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            <span>{relatedPost.readingTime} min read</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Back to top button */}
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
        </div>
      </MobileAppWrapper>
    </div>
  );
}