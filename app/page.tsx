'use client';

import { ResponsiveTest } from '@/components/ResponsiveTest';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Welcome to ReadMyFinePrint
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto sm:text-xl">
            Your privacy-first legal document analysis platform. Upload and analyze contracts securely with advanced PII protection and legal compliance.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 touch-manipulation">
            Get Started
          </button>
          <button className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 touch-manipulation">
            Learn More
          </button>
        </div>
      </div>
      
      {/* Temporary responsive test - will be removed */}
      <div className="mt-12">
        <ResponsiveTest />
      </div>
      
      {/* Current screen size indicator for debugging */}
      <div className="fixed bottom-4 right-4 bg-foreground text-background p-2 rounded text-sm z-50">
        <span className="block sm:hidden">XS (&lt; 640px)</span>
        <span className="hidden sm:block md:hidden">SM (640px+)</span>
        <span className="hidden md:block lg:hidden">MD (768px+)</span>
        <span className="hidden lg:block xl:hidden">LG (1024px+)</span>
        <span className="hidden xl:block 2xl:hidden">XL (1280px+)</span>
        <span className="hidden 2xl:block">2XL (1536px+)</span>
      </div>
    </div>
  );
}
