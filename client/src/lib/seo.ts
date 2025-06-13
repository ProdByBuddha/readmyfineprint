import { useEffect } from 'react';

// Add interface for structured data
interface StructuredData {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  structuredData?: StructuredData;
  noIndex?: boolean;
}

export const defaultSEO: SEOConfig = {
  title: 'ReadMyFinePrint - Advanced Legal Document Analysis',
  description: 'Transform complex legal documents into accessible summaries with advanced analysis. Upload your contracts, terms of service, and legal documents for instant insights. No legal degree required.',
  keywords: 'legal document analysis, contract review, AI legal assistant, document summary, terms of service analysis, legal tech, contract analyzer, document AI',
  canonical: 'https://readmyfineprint.com/',
  ogTitle: 'ReadMyFinePrint - Advanced Legal Document Analysis',
  ogDescription: 'Transform complex legal documents into accessible summaries with advanced analysis. Upload your contracts, terms of service, and legal documents for instant insights.',
  ogImage: 'https://readmyfineprint.com/og-image.png',
  twitterTitle: 'ReadMyFinePrint - Advanced Legal Document Analysis',
  twitterDescription: 'Transform complex legal documents into accessible summaries with advanced analysis. Upload your contracts, terms of service, and legal documents for instant insights.',
  twitterImage: 'https://readmyfineprint.com/og-image.png',
};

export const pageSEOConfigs: Record<string, SEOConfig> = {
  '/': {
    ...defaultSEO,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "ReadMyFinePrint",
      "description": "advanced legal document analysis tool that transforms complex legal documents into accessible summaries",
      "url": "https://readmyfineprint.com",
      "applicationCategory": "LegalApplication",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "ReadMyFinePrint",
        "url": "https://readmyfineprint.com"
      },
      "featureList": [
        "Legal document analysis",
        "Contract review",
        "Terms of service analysis",
        "advanced summaries",
        "Document upload",
        "Privacy-focused processing"
      ]
    }
  },
  '/privacy': {
    title: 'Privacy Policy - ReadMyFinePrint',
    description: 'Our privacy policy explains how ReadMyFinePrint protects your data and documents during advanced legal analysis.',
    keywords: 'privacy policy, data protection, legal document privacy, AI privacy, document security',
    canonical: 'https://readmyfineprint.com/privacy',
    ogTitle: 'Privacy Policy - ReadMyFinePrint',
    ogDescription: 'Our privacy policy explains how ReadMyFinePrint protects your data and documents during advanced legal analysis.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Privacy Policy",
      "description": "Privacy policy for ReadMyFinePrint legal document analysis tool",
      "url": "https://readmyfineprint.com/privacy"
    }
  },
  '/terms': {
    title: 'Terms of Service - ReadMyFinePrint',
    description: 'Terms of service and usage guidelines for ReadMyFinePrint advanced legal document analysis tool.',
    keywords: 'terms of service, usage terms, legal terms, AI tool terms, document analysis terms',
    canonical: 'https://readmyfineprint.com/terms',
    ogTitle: 'Terms of Service - ReadMyFinePrint',
    ogDescription: 'Terms of service and usage guidelines for ReadMyFinePrint advanced legal document analysis tool.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Terms of Service",
      "description": "Terms of service for ReadMyFinePrint legal document analysis tool",
      "url": "https://readmyfineprint.com/terms"
    }
  },
  '/cookies': {
    title: 'Cookie Policy - ReadMyFinePrint',
    description: 'Learn about how ReadMyFinePrint uses cookies to provide and improve our advanced legal document analysis service.',
    keywords: 'cookie policy, website cookies, privacy, data tracking, legal compliance',
    canonical: 'https://readmyfineprint.com/cookies',
    ogTitle: 'Cookie Policy - ReadMyFinePrint',
    ogDescription: 'Learn about how ReadMyFinePrint uses cookies to provide and improve our advanced legal document analysis service.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Cookie Policy",
      "description": "Cookie policy for ReadMyFinePrint legal document analysis tool",
      "url": "https://readmyfineprint.com/cookies"
    }
  },
  '/donate': {
    title: 'Support ReadMyFinePrint - Donate',
    description: 'Support the development of ReadMyFinePrint, the free advanced legal document analysis tool. Your donation helps keep this service free for everyone.',
    keywords: 'donate, support, legal tech, AI development, open source, legal document analysis',
    canonical: 'https://readmyfineprint.com/donate',
    ogTitle: 'Support ReadMyFinePrint - Donate',
    ogDescription: 'Support the development of ReadMyFinePrint, the free advanced legal document analysis tool. Your donation helps keep this service free for everyone.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Donate",
      "description": "Support ReadMyFinePrint development through donations",
      "url": "https://readmyfineprint.com/donate"
    }
  },
  '/roadmap': {
    title: 'Roadmap & Features - ReadMyFinePrint',
    description: 'See what\'s coming next for ReadMyFinePrint. View our development roadmap and upcoming features for advanced legal document analysis.',
    keywords: 'roadmap, features, development, AI improvements, legal tech roadmap, future features',
    canonical: 'https://readmyfineprint.com/roadmap',
    ogTitle: 'Roadmap & Features - ReadMyFinePrint',
    ogDescription: 'See what\'s coming next for ReadMyFinePrint. View our development roadmap and upcoming features for advanced legal document analysis.',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Roadmap",
      "description": "Development roadmap and upcoming features for ReadMyFinePrint",
      "url": "https://readmyfineprint.com/roadmap"
    }
  }
};

function updateMetaTag(property: string, content: string, isProperty = false) {
  const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
  let element = document.querySelector(selector) as HTMLMetaElement;

  if (!element) {
    element = document.createElement('meta');
    if (isProperty) {
      element.setAttribute('property', property);
    } else {
      element.setAttribute('name', property);
    }
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function updateCanonical(url: string) {
  let canonicalElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

  if (!canonicalElement) {
    canonicalElement = document.createElement('link');
    canonicalElement.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalElement);
  }

  canonicalElement.setAttribute('href', url);
}

function updateStructuredData(data: StructuredData) {
  // Remove existing structured data
  const existingLD = document.querySelector('script[type="application/ld+json"]#dynamic-ld');
  if (existingLD) {
    existingLD.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'dynamic-ld';
  script.textContent = JSON.stringify(data, null, 2);
  document.head.appendChild(script);
}

export function updateSEO(config: SEOConfig) {
  // Update title
  if (config.title) {
    document.title = config.title;
    updateMetaTag('title', config.title);
  }

  // Update meta tags
  if (config.description) {
    updateMetaTag('description', config.description);
  }

  if (config.keywords) {
    updateMetaTag('keywords', config.keywords);
  }

  // Update robots meta tag based on noIndex
  updateMetaTag('robots', config.noIndex ? 'noindex, nofollow' : 'index, follow');

  // Update canonical URL
  if (config.canonical) {
    updateCanonical(config.canonical);
  }

  // Update Open Graph tags
  if (config.ogTitle) {
    updateMetaTag('og:title', config.ogTitle, true);
  }

  if (config.ogDescription) {
    updateMetaTag('og:description', config.ogDescription, true);
  }

  if (config.ogImage) {
    updateMetaTag('og:image', config.ogImage, true);
  }

  if (config.canonical) {
    updateMetaTag('og:url', config.canonical, true);
  }

  // Update Twitter tags
  if (config.twitterTitle) {
    updateMetaTag('twitter:title', config.twitterTitle, true);
  }

  if (config.twitterDescription) {
    updateMetaTag('twitter:description', config.twitterDescription, true);
  }

  if (config.twitterImage) {
    updateMetaTag('twitter:image', config.twitterImage, true);
  }

  // Update structured data
  if (config.structuredData) {
    updateStructuredData(config.structuredData);
  }
}

export function useSEO(pathname: string, customConfig?: Partial<SEOConfig>) {
  useEffect(() => {
    const baseConfig = pageSEOConfigs[pathname] || defaultSEO;
    const finalConfig = { ...baseConfig, ...customConfig };
    updateSEO(finalConfig);
  }, [pathname, customConfig]);
}

// Breadcrumb structured data generator
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

// FAQ structured data generator
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

// Article structured data generator
export function generateArticleSchema(article: {
  title: string;
  description: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "datePublished": article.datePublished,
    "dateModified": article.dateModified || article.datePublished,
    "image": article.image,
    "url": article.url,
    "publisher": {
      "@type": "Organization",
      "name": "ReadMyFinePrint",
      "url": "https://readmyfineprint.com"
    }
  };
}
