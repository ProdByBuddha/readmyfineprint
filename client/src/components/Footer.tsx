import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import customLogo from '@assets/ChatGPT Image Jun 9, 2025, 07_07_26 AM_1749598570251.png';

export function Footer() {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleFooter = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      {/* Toggle Button */}
      <div className="fixed bottom-0 right-4 z-50">
        <Button
          onClick={toggleFooter}
          size="sm"
          variant="outline"
          className="mb-2 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 border-gray-200 dark:border-gray-700"
          style={{
            transform: `translateY(${isExpanded ? '-40vh' : '-3rem'})`,
            transition: 'transform 0.7s ease-out'
          }}
        >
          {isExpanded ? (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Collapse</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">More Info</span>
            </>
          )}
        </Button>
      </div>

      <footer 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 z-40 border-t border-gray-200 dark:border-gray-700"
        style={{
          width: '100vw',
          height: isExpanded ? '40vh' : '3rem',
          transform: isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 3rem))',
          overflowY: isExpanded ? 'auto' : 'hidden',
          transition: 'transform 0.7s ease-out, height 0.7s ease-out',
          willChange: 'transform, height'
        }}
      >
        <div className="w-full h-full" style={{ width: '100vw' }}>
          {/* Collapsed view - just the copyright */}
          <div className={`${isExpanded ? 'hidden' : 'flex justify-center items-center h-full'}`}>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} <span className="hidden md:inline">ReadMyFinePrint</span><span className="md:hidden">RMFP</span>
            </div>
          </div>

          {/* Expanded view - full footer */}
          <div className={`${isExpanded ? 'block' : 'hidden'} h-full`}>
            <div className="container mx-auto px-4 py-4 h-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* About */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    <span className="hidden md:inline">ReadMyFinePrint</span>
                    <span className="md:hidden">RMFP</span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Transform complex legal documents into accessible summaries with AI-powered analysis.
                  </p>
                  <div className="flex items-center gap-2">
                    <img 
                      src={customLogo} 
                      alt="ReadMyFinePrint Logo" 
                      className="w-6 h-6"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      <span className="hidden md:inline">ReadMyFinePrint</span>
                      <span className="md:hidden">RMFP</span>
                    </span>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Quick Links</h3>
                  <div className="space-y-1">
                    <div>
                      <Link href="/" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        Document Analysis
                      </Link>
                    </div>
                    <div>
                      <Link href="/donate" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        Support Us
                      </Link>
                    </div>
                    <div>
                      <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        Privacy Policy
                      </Link>
                    </div>
                    <div>
                      <Link href="/cookies" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        Cookie Policy
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Features</h3>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>AI-Powered Analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>PDF Export with QR</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Privacy-First Design</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Session-Based</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Advanced Analysis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}