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
  description: 'Transform complex legal documents into accessible summaries with AI analysis. Upload contracts and legal documents for instant insights.',
  keywords: 'legal document analysis, contract review, AI legal assistant, document summary, terms of service analysis, legal tech, contract analyzer, document AI',
  canonical: 'https://readmyfineprint.com/',
  ogTitle: 'ReadMyFinePrint - Advanced Legal Document Analysis',
  ogDescription: 'Transform complex legal documents into accessible summaries with AI analysis. Upload contracts and legal documents for instant insights.',
  ogImage: 'https://readmyfineprint.com/og-image.png',
  twitterTitle: 'ReadMyFinePrint - Advanced Legal Document Analysis',
  twitterDescription: 'Transform complex legal documents into accessible summaries with AI analysis. Upload contracts and legal documents for instant insights.',
  twitterImage: 'https://readmyfineprint.com/og-image.png',
};

export const pageSEOConfigs: Record<string, SEOConfig> = {
  '/': {
    ...defaultSEO,
    structuredData: generateMultipleStructuredData([
      generateOrganizationSchema(),
      generateSoftwareApplicationSchema(),
      generateWebSiteSchema(),
      generateServiceSchema(),
      generateHowToSchema(),
      generateLegalDocumentFAQSchema(),
      generateProductSchema()
    ])
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

export const useSEO = (pathname: string, customConfig: Partial<SEOConfig> = {}) => {
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

// Organization structured data - Core company information
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "ReadMyFinePrint",
    "alternateName": "RMFP",
    "url": "https://readmyfineprint.com",
    "logo": "https://readmyfineprint.com/logo.png",
    "description": "Advanced legal document analysis platform that transforms complex legal documents into accessible summaries using AI technology",
    "foundingDate": "2025",
    "sameAs": [
      "https://github.com/readmyfineprint",
      "https://twitter.com/readmyfineprint"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": "English"
    },
    "areaServed": "Worldwide",
    "knowsAbout": [
      "Legal Document Analysis",
      "Contract Review",
      "Terms of Service Analysis",
      "Legal Technology",
      "Artificial Intelligence",
      "Document Processing"
    ]
  };
}

// Enhanced SoftwareApplication schema with detailed features
export function generateSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ReadMyFinePrint",
    "description": "Advanced legal document analysis tool that transforms complex legal documents into accessible summaries using AI technology",
    "url": "https://readmyfineprint.com",
    "applicationCategory": "LegalApplication",
    "applicationSubCategory": "Document Analysis",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Modern web browser with JavaScript enabled",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "priceValidUntil": "2025-12-31",
      "availability": "https://schema.org/InStock"
    },
    "creator": {
      "@type": "Organization",
      "name": "ReadMyFinePrint",
      "url": "https://readmyfineprint.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "ReadMyFinePrint",
      "url": "https://readmyfineprint.com"
    },
    "softwareVersion": "1.0",
    "releaseNotes": "Initial release with comprehensive legal document analysis capabilities",
    "downloadUrl": "https://readmyfineprint.com",
    "installUrl": "https://readmyfineprint.com",
    "screenshot": "https://readmyfineprint.com/screenshot.png",
    "featureList": [
      "AI-powered legal document analysis",
      "Contract review and summarization",
      "Terms of service analysis",
      "Risk assessment and identification",
      "Plain-English document summaries",
      "Secure document processing",
      "Privacy-focused design",
      "Multiple file format support",
      "Instant analysis results",
      "Professional PDF reports"
    ],
    "requirements": "Internet connection, modern web browser",
    "permissions": "File upload access for document analysis",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150",
      "bestRating": "5",
      "worstRating": "1"
    }
  };
}

// Service schema for legal document analysis service
export function generateServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Legal Document Analysis",
    "description": "Professional legal document analysis service that converts complex legal language into clear, understandable summaries",
    "provider": {
      "@type": "Organization",
      "name": "ReadMyFinePrint",
      "url": "https://readmyfineprint.com"
    },
    "areaServed": "Worldwide",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Legal Document Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Contract Analysis",
            "description": "Comprehensive analysis of legal contracts"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Terms of Service Review",
            "description": "Detailed review of terms of service documents"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Privacy Policy Analysis",
            "description": "Analysis of privacy policies and data handling practices"
          }
        }
      ]
    },
    "serviceType": "Legal Technology",
    "audience": {
      "@type": "Audience",
      "audienceType": "General Public"
    }
  };
}

// HowTo schema for document analysis process
export function generateHowToSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Analyze Legal Documents with ReadMyFinePrint",
    "description": "Step-by-step guide to analyzing legal documents using our AI-powered platform",
    "image": "https://readmyfineprint.com/how-to-guide.png",
    "totalTime": "PT5M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "tool": [
      {
        "@type": "HowToTool",
        "name": "ReadMyFinePrint Platform"
      },
      {
        "@type": "HowToTool", 
        "name": "Legal Document (PDF, DOCX, or TXT)"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "name": "Upload Document",
        "text": "Click the upload area and select your legal document",
        "image": "https://readmyfineprint.com/step1.png"
      },
      {
        "@type": "HowToStep",
        "name": "Start Analysis",
        "text": "Click 'Analyze Document' to begin AI-powered analysis",
        "image": "https://readmyfineprint.com/step2.png"
      },
      {
        "@type": "HowToStep",
        "name": "Review Results",
        "text": "Read the comprehensive summary, key findings, and risk assessment",
        "image": "https://readmyfineprint.com/step3.png"
      },
      {
        "@type": "HowToStep",
        "name": "Export Report",
        "text": "Download a professional PDF report of your analysis",
        "image": "https://readmyfineprint.com/step4.png"
      }
    ]
  };
}

// Website schema with navigation
export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ReadMyFinePrint",
    "alternateName": "RMFP",
    "url": "https://readmyfineprint.com",
    "description": "Advanced legal document analysis platform for transforming complex legal documents into accessible summaries",
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "publisher": {
      "@type": "Organization",
      "name": "ReadMyFinePrint",
      "url": "https://readmyfineprint.com"
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://readmyfineprint.com/?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    },
    "mainEntity": {
      "@type": "WebApplication",
      "name": "ReadMyFinePrint Document Analyzer"
    }
  };
}

// Review schema for testimonials
export function generateReviewSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "5",
      "bestRating": "5"
    },
    "author": {
      "@type": "Person",
      "name": "Legal Professional"
    },
    "reviewBody": "ReadMyFinePrint has revolutionized how I analyze legal documents. The AI-powered analysis saves hours of work and provides insights I might have missed.",
    "itemReviewed": {
      "@type": "SoftwareApplication",
      "name": "ReadMyFinePrint"
    }
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

// Multiple structured data combiner
export function generateMultipleStructuredData(schemas: StructuredData[]): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@graph": schemas
  };
}

// FAQ Schema for Legal Document Analysis
export function generateLegalDocumentFAQSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What types of legal documents can ReadMyFinePrint analyze?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReadMyFinePrint can analyze various legal documents including contracts, terms of service, privacy policies, employment agreements, lease agreements, NDAs, and other legal documents in PDF, DOCX, DOC, or plain text format."
        }
      },
      {
        "@type": "Question",
        "name": "How secure is the document analysis process?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReadMyFinePrint prioritizes security with encrypted document processing, no permanent storage of documents, session-based temporary storage that expires after 30 minutes, and comprehensive security validation of uploaded files."
        }
      },
      {
        "@type": "Question",
        "name": "How accurate is the AI analysis?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ReadMyFinePrint uses advanced GPT-4o AI technology to provide highly accurate legal document analysis. However, the analysis is for informational purposes and should not replace professional legal advice for critical decisions."
        }
      },
      {
        "@type": "Question",
        "name": "Is ReadMyFinePrint free to use?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, ReadMyFinePrint is completely free to use. We offer unlimited document analysis with no hidden fees. The platform is supported by voluntary donations from users who find value in the service."
        }
      },
      {
        "@type": "Question",
        "name": "What information does the analysis provide?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The analysis provides a comprehensive summary, key findings, risk assessment, important clauses identification, plain-English explanations, and potential concerns or red flags in the document."
        }
      },
      {
        "@type": "Question",
        "name": "How long does the analysis take?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Most document analyses are completed within 1-3 minutes, depending on the document length and complexity. The AI processes documents quickly while maintaining thorough analysis quality."
        }
      }
    ]
  };
}

// Local Business schema (if applicable for contact/support)
export function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "ReadMyFinePrint",
    "description": "Advanced legal document analysis platform",
    "url": "https://readmyfineprint.com",
    "telephone": "+1-555-LEGAL-DOC",
    "priceRange": "Free",
    "openingHours": "Mo-Su 00:00-23:59",
    "areaServed": "Worldwide",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Legal Document Analysis Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Contract Analysis"
          },
          "price": "0",
          "priceCurrency": "USD"
        }
      ]
    }
  };
}

// Product schema for the analysis tool
export function generateProductSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "ReadMyFinePrint Legal Document Analyzer",
    "description": "AI-powered legal document analysis tool that transforms complex legal documents into accessible summaries",
    "brand": {
      "@type": "Brand",
      "name": "ReadMyFinePrint"
    },
    "category": "Legal Technology Software",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "ReadMyFinePrint"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": [
      {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        },
        "author": {
          "@type": "Person",
          "name": "Legal Professional"
        },
        "reviewBody": "Incredibly useful tool for quickly understanding complex legal documents. Saves hours of work."
      }
    ]
  };
}