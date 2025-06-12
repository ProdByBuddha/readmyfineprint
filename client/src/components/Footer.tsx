import { Shield, Scale, Cookie, Heart, Mail, Home } from "lucide-react";
import { useCookieConsent } from "@/components/CookieConsent";
import { Link } from "wouter";

export function Footer() {
  const { revokeCookies } = useCookieConsent();

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
    <div className="relative z-50">
      {/* Unified Static Footer for Both Mobile and Desktop */}
      <footer className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 z-50 border-t border-gray-200 dark:border-gray-700" style={{ position: 'fixed' }}>
        <div className="px-4 py-4 md:px-6">
          {/* Icon Navigation */}
          <div className="flex justify-center md:justify-around items-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
            <Link to="/" className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Home className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Home</span>
            </Link>
            <Link to="/privacy" className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Privacy</span>
            </Link>
            <Link to="/terms" className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Scale className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Terms</span>
            </Link>
            <button
              onClick={handleCookieSettings}
              className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Cookie className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Cookies</span>
            </button>
            <Link to="/donate" className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Heart className="w-5 h-5 md:w-6 md:h-6 text-red-500" fill="currentColor" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Donate</span>
            </Link>
            <button
              onClick={handleContactClick}
              className="flex flex-col items-center gap-1 p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Mail className="w-5 h-5 md:w-6 md:h-6 text-gray-600 dark:text-gray-400" />
              <span className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Contact</span>
            </button>
          </div>
          
          {/* Footer Information */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">
              © {new Date().getFullYear()} <span className="hidden md:inline">ReadMyFinePrint</span><span className="md:hidden">RMFP</span>
            </div>
            <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full"></div>
                Privacy-First
              </span>
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full"></div>
                Session-Based
              </span>
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full"></div>
                Advanced Analysis
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}