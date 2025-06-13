import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { generateBreadcrumbSchema, updateSEO } from '@/lib/seo';

interface BreadcrumbItem {
  name: string;
  url: string;
  current?: boolean;
}

interface SEOBreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const defaultBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  '/': [
    { name: 'Home', url: '/', current: true }
  ],
  '/privacy': [
    { name: 'Home', url: '/' },
    { name: 'Privacy Policy', url: '/privacy', current: true }
  ],
  '/terms': [
    { name: 'Home', url: '/' },
    { name: 'Terms of Service', url: '/terms', current: true }
  ],
  '/cookies': [
    { name: 'Home', url: '/' },
    { name: 'Cookie Policy', url: '/cookies', current: true }
  ],
  '/donate': [
    { name: 'Home', url: '/' },
    { name: 'Donate', url: '/donate', current: true }
  ],
  '/roadmap': [
    { name: 'Home', url: '/' },
    { name: 'Roadmap', url: '/roadmap', current: true }
  ],
};

export function SEOBreadcrumbs({ items, className = '' }: SEOBreadcrumbsProps) {
  const [location] = useLocation();
  
  const breadcrumbItems = items || defaultBreadcrumbs[location] || defaultBreadcrumbs['/'];

  // Add structured data for breadcrumbs
  useEffect(() => {
    if (breadcrumbItems.length > 1) {
      const breadcrumbSchema = generateBreadcrumbSchema(
        breadcrumbItems.map(item => ({
          name: item.name,
          url: `https://readmyfineprint.com${item.url}`
        }))
      );
      
      updateSEO({
        structuredData: breadcrumbSchema
      });
    }
  }, [breadcrumbItems]);

  // Don't render breadcrumbs for home page or if only one item
  if (location === '/' || breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`mb-8 ${className}`}
      role="navigation"
    >
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl px-5 py-3 border border-gray-200/60 dark:border-gray-700/60 shadow-sm">
        <ol className="flex items-center space-x-1" itemScope itemType="https://schema.org/BreadcrumbList">
          {breadcrumbItems.map((item, index) => (
            <li 
              key={item.url} 
              className="flex items-center"
              itemProp="itemListElement" 
              itemScope 
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-2 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              )}
              
              {item.current ? (
                <span 
                  className="font-semibold text-gray-900 dark:text-white bg-primary/10 dark:bg-primary/20 px-3 py-2 rounded-lg text-sm"
                  itemProp="name"
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <Link 
                  to={item.url}
                  className="text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-sm flex items-center"
                  itemProp="item"
                >
                  <span itemProp="name" className="flex items-center">
                    {index === 0 && <Home className="w-4 h-4 mr-2" aria-hidden="true" />}
                    {item.name}
                  </span>
                </Link>
              )}
              
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

// Hook to automatically add breadcrumbs to pages
export function useBreadcrumbs(customItems?: BreadcrumbItem[]) {
  const [location] = useLocation();
  const items = customItems || defaultBreadcrumbs[location];

  useEffect(() => {
    if (items && items.length > 1) {
      const breadcrumbSchema = generateBreadcrumbSchema(
        items.map(item => ({
          name: item.name,
          url: `https://readmyfineprint.com${item.url}`
        }))
      );
      
      updateSEO({
        structuredData: breadcrumbSchema
      });
    }
  }, [items]);

  return items;
} 