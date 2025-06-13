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
      className={`mb-4 ${className}`}
      role="navigation"
    >
      <ol className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400" itemScope itemType="https://schema.org/BreadcrumbList">
        {breadcrumbItems.map((item, index) => (
          <li 
            key={item.url} 
            className="flex items-center"
            itemProp="itemListElement" 
            itemScope 
            itemType="https://schema.org/ListItem"
          >
            {index > 0 && (
              <ChevronRight className="w-3 h-3 mx-1.5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            )}
            
            {item.current ? (
              <span 
                className="text-gray-700 dark:text-gray-300 font-medium"
                itemProp="name"
                aria-current="page"
              >
                {item.name}
              </span>
            ) : (
              <Link 
                to={item.url}
                className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150"
                itemProp="item"
              >
                <span itemProp="name" className="flex items-center">
                  {index === 0 && <Home className="w-3 h-3 mr-1" aria-hidden="true" />}
                  {item.name}
                </span>
              </Link>
            )}
            
            <meta itemProp="position" content={String(index + 1)} />
          </li>
        ))}
      </ol>
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