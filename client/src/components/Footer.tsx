import { Shield, Scale, Cookie, Github, ExternalLink, Heart, Mail, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/CookieConsent";
import { Link } from "wouter";
import { useState } from "react";

export function Footer() {
  const { revokeCookies } = useCookieConsent();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCookieSettings = () => {
    revokeCookies();
    // This will cause the cookie banner to show again
    window.location.reload();
  };

  const handleContactClick = () => {
    // Anti-abuse protection: construct email dynamically
    const domain = 'readmyfineprint.com';
    const user = 'admin';
    const subject = encodeURIComponent('ReadMyFinePrint Contact');
    const body = encodeURIComponent('Hello,\n\nI am reaching out regarding ReadMyFinePrint.\n\nBest regards,');
    
    // Rate limiting check
    const lastContact = localStorage.getItem('last-contact-attempt');
    const now = Date.now();
    if (lastContact && (now - parseInt(lastContact)) < 60000) { // 1 minute cooldown
      alert('Please wait a moment before sending another message.');
      return;
    }
    
    localStorage.setItem('last-contact-attempt', now.toString());
    window.open(`mailto:${user}@${domain}?subject=${subject}&body=${body}`, '_self');
  };

  return (
    <footer className={`fixed bottom-0 left-0 right-0 border-t bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm transition-transform duration-300 ease-in-out z-40 max-h-screen overflow-y-auto ${
      isExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-2.5rem)]'
    }`}>
      {/* Toggle Button */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-50">
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
          size="sm"
          className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 h-8 w-16"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className={`container mx-auto px-4 ${isExpanded ? 'py-8' : 'py-0'}`}>
        {/* Collapsed view - just the copyright */}
        <div className={`${isExpanded ? 'hidden' : 'block'} text-center py-2`}>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} <span className="hidden md:inline">ReadMyFinePrint</span><span className="md:hidden">RMFP</span>
          </div>
        </div>

        {/* Expanded view - full footer */}
        <div className={`${isExpanded ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                <span className="hidden md:inline">ReadMyFinePrint</span>
                <span className="md:hidden">RMFP</span>
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
            <div className="space-y-3">
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
            <div className="space-y-3">
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

          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} <span className="hidden md:inline">ReadMyFinePrint</span><span className="md:hidden">RMFP</span>.
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
    </footer>
  );
}
