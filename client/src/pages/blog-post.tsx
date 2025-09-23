import { useState, useEffect } from 'react';
import { Link, useRoute } from "wouter";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Tag,
  AlertCircle,
  RefreshCcw,
  Mail
} from 'lucide-react';
import { MobileAppWrapper } from '@/components/MobileAppWrapper';
import { useQuery } from '@tanstack/react-query';

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

// Version 3.0.0 - Completely redesigned to fix React hooks error
export default function BlogPostPage() {
  const [match, params] = useRoute<{ slug: string }>('/blog/:slug');
  const slug = params ? params.slug : undefined;
  const [copySuccess, setCopySuccess] = useState(false);

  // Simple fetch without complex hooks
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/blog/posts', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      const response = await fetch(`/api/blog/posts/${slug}`);
      if (!response.ok) throw new Error('Failed to load article');
      return response.json() as Promise<BlogPostResponse>;
    },
    enabled: !!slug
  });

  const post = data?.post;
  const relatedPosts = data?.relatedPosts || [];

  // Set page title
  useEffect(() => {
    if (post) {
      document.title = `${post.title} | ReadMyFinePrint`;
    }
  }, [post]);

  // Simple date formatter
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Simple category formatter
  const formatCategory = (category: string) => {
    return category.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Simple tags parser
  const parseTags = (tags?: string) => {
    if (!tags) return [];
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }
  };

  // Simple share functions
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/blog/${slug}` : '';
  
  const handleShare = (platform: string) => {
    if (!post) return;
    
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(`Check out this article: ${shareUrl}`)}`,
    };

    if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      });
    } else if (urls[platform]) {
      window.open(urls[platform], '_blank', 'noopener,noreferrer');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <MobileAppWrapper>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="space-y-8">
              <Skeleton className="h-8 w-32" />
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
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
        <MobileAppWrapper>
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Article Not Found
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                The article you're looking for doesn't exist or has been moved.
              </p>
              <Link to="/blog">
                <Button className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Blog
                </Button>
              </Link>
            </div>
          </div>
        </MobileAppWrapper>
      </div>
    );
  }

  // Main render
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <MobileAppWrapper>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          
          {/* Back Navigation */}
          <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Blog
          </Link>

          {/* Article Header */}
          <article className="mb-16">
            <header className="mb-8">
              {/* Category Badge */}
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {formatCategory(post.category)}
                </Badge>
                {post.isFeatured && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-600">
                    Featured
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {post.title}
              </h1>

              {/* Excerpt */}
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                {post.excerpt}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(post.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{post.readingTime} min read</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>{(post.displayViewCount || post.viewCount).toLocaleString()} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  <span>{(post.displayShareCount || post.shareCount).toLocaleString()} shares</span>
                </div>
              </div>

              {/* Tags */}
              {parseTags(post.tags).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {parseTags(post.tags).map((tag: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator className="mb-8" />
            </header>

            {/* Content */}
            <div 
              className="prose prose-lg max-w-none 
                prose-headings:text-gray-900 dark:prose-headings:text-gray-100 
                prose-p:text-gray-700 dark:prose-p:text-gray-300 
                prose-a:text-blue-600 dark:prose-a:text-blue-400
                prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                prose-ul:text-gray-700 dark:prose-ul:text-gray-300
                prose-ol:text-gray-700 dark:prose-ol:text-gray-300
                prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400
                prose-blockquote:border-l-blue-500 dark:prose-blockquote:border-l-blue-400
                prose-code:text-gray-800 dark:prose-code:text-gray-200
                prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800"
              dangerouslySetInnerHTML={{ 
                __html: post.content.replace(/```html\s*\n([\s\S]*?)\n```/, '$1')
              }}
            />

            {/* Share Section */}
            <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Share this article
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Help others discover this content
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('twitter')}
                    className="flex items-center gap-2"
                  >
                    <Twitter className="h-4 w-4" />
                    <span className="hidden sm:inline">Twitter</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('facebook')}
                    className="flex items-center gap-2"
                  >
                    <Facebook className="h-4 w-4" />
                    <span className="hidden sm:inline">Facebook</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('linkedin')}
                    className="flex items-center gap-2"
                  >
                    <Linkedin className="h-4 w-4" />
                    <span className="hidden sm:inline">LinkedIn</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('email')}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">Email</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('copy')}
                    className="flex items-center gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="hidden sm:inline">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="hidden sm:inline">Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </article>

          {/* Related Articles */}
          {relatedPosts.length > 0 && (
            <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                Related Articles
              </h2>
              
              <div className="grid gap-6 md:grid-cols-2">
                {relatedPosts.map((relatedPost) => (
                  <Link key={relatedPost.id} to={`/blog/${relatedPost.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="text-lg line-clamp-2">
                          {relatedPost.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                          {relatedPost.excerpt}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{formatDate(relatedPost.publishedAt)}</span>
                          <span>{relatedPost.readingTime} min read</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>
      </MobileAppWrapper>
    </div>
  );
}