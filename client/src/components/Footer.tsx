import { Shield, Scale, Cookie, Github, ExternalLink, Heart, Mail, ChevronUp, ChevronDown, Home, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/CookieConsent";
import { Link } from "wouter";
import { useState } from "react";

export function Footer() {
  const { revokeCookies } = useCookieConsent();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCookieSettings = () => {
    revokeCookies();
  };

  const handleContactClick = () => {
    const user = 'support';
    const domain = 'readmyfineprint.com';
    const subject = encodeURIComponent('ReadMyFinePrint Support Request');
    const body = encodeURIComponent(`Hello ReadMyFinePrint Team,

I would like to get in touch regarding:

[Please describe your inquiry here]

Best regards`);
    
    const now = Date.now();
    const lastAttempt = localStorage.getItem('last-contact-attempt');
    
    if (lastAttempt && (now - parseInt(lastAttempt)) < 5000) {
      return; // Rate limit contact attempts
    }
    
    localStorage.setItem('last-contact-attempt', now.toString());
    window.open(`mailto:${user}@${domain}?subject=${subject}&body=${body}`, '_self');
  };

  return (
    <div className="relative z-20">
      {/* Desktop Toggle Button - positioned outside footer */}
      <div className={`hidden md:block fixed left-1/2 transform -translate-x-1/2 z-50 transition-all duration-700 ease-out ${
        isExpanded ? 'bottom-[calc(40vh-2.5rem)]' : 'bottom-12'
      }`}>
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
          size="sm"
          className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-700 ease-out h-8 w-8"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </Button>
      </div>

      {/* Mobile Static Footer */}
      <footer className="md:hidden fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 z-30 border-t border-gray-200 dark:border-gray-700">
        <div className="px-3 py-3">
          {/* Mobile Icon Navigation */}
          <div className="flex justify-around items-center py-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-3">
            <Link to="/" className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Home className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Home</span>
            </Link>
            <Link to="/privacy" className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Privacy</span>
            </Link>
            <Link to="/terms" className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Scale className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Terms</span>
            </Link>
            <button
              onClick={handleCookieSettings}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Cookie className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Cookies</span>
            </button>
            <Link to="/donate" className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Heart className="w-5 h-5 text-red-500" fill="currentColor" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Donate</span>
            </Link>
            <button
              onClick={handleContactClick}
              className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Contact</span>
            </button>
          </div>
          
          {/* Mobile Simple Footer */}
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              © {new Date().getFullYear()} RMFP
            </div>
            <div className="flex justify-center items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Privacy-First
              </span>
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                Session-Based
              </span>
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                AI Analysis
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Desktop Sliding Footer */}
      <footer 
        className="hidden md:block fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 z-30 border-t border-gray-200 dark:border-gray-700 transition-all duration-700 ease-out"
        style={{
          height: isExpanded ? '40vh' : '3rem',
          paddingBottom: '1px',
          marginBottom: '0',
          transform: isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 3rem))',
          overflow: 'hidden'
        }}
      >
        <div className="w-full h-full relative" style={{ paddingBottom: isExpanded ? '0.25rem' : '0' }}>
          <div className="w-full h-full">
            <div className={`${isExpanded ? 'container mx-auto px-3 py-2' : 'w-full h-full'} relative`}>
              {/* Collapsed view - just the copyright */}
              <div className={`${isExpanded ? 'hidden' : 'flex justify-center items-center h-full'}`}>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  © {new Date().getFullYear()} ReadMyFinePrint
                </div>
              </div>

              {/* Expanded view - full footer */}
              <div className={`${isExpanded ? 'block' : 'hidden'}`}>
                {/* Desktop Grid Layout */}
                <div className="grid grid-cols-3 gap-4">
                  {/* About */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      ReadMyFinePrint
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Privacy-first document analysis tool for understanding legal documents.
                      Session-based processing with no permanent storage of your documents.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Shield className="w-3 h-3" />
                      <span>Privacy-First Design</span>
                    </div>
                  </div>

                  {/* Legal Links */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Legal
                    </h3>
                    <nav className="space-y-2">
                      <Link to="/privacy" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <Shield className="w-3 h-3" />
                        Privacy Policy
                      </Link>
                      <Link to="/terms" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <Scale className="w-3 h-3" />
                        Terms of Service
                      </Link>
                      <button
                        onClick={handleCookieSettings}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        <Cookie className="w-3 h-3" />
                        Cookie Preferences
                      </button>
                    </nav>
                  </div>

                  {/* Support & Resources */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Support & Resources
                    </h3>
                    <div className="space-y-2">
                      <Link to="/donate">
                        <Button variant="outline" size="sm" className="w-full">
                          <Heart className="w-4 h-4 mr-2 text-red-500" fill="currentColor" />
                          Support Our Mission
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleContactClick}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Contact Us
                      </Button>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Not Legal Advice:</strong> This tool provides analysis for informational purposes only. Consult qualified attorneys for legal matters.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Simple Footer */}
                <div className="md:hidden mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                    © {new Date().getFullYear()} RMFP
                  </div>
                  <div className="flex justify-center items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Privacy-First
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      Session-Based
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                      AI Analysis
                    </span>
                  </div>
                </div>

                {/* Desktop Footer */}
                <div className="hidden md:block border-t mt-4 pt-3">
                  <div className="flex flex-row justify-between items-center gap-3">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      © {new Date().getFullYear()} ReadMyFinePrint.
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Privacy-First
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Session-Based
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        Advanced Analysis
                      </span>
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