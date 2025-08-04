import { Link } from "react-router-dom";
import { Heart, Cookie, Share2, Target } from "lucide-react";
import { CookieManagement } from "@/components/CookieManagement";
import { useToast } from "@/hooks/use-toast";

export function Footer() {
  const { toast } = useToast();

  const handleShareClick = async () => {
    const websiteUrl = "https://readmyfineprint.com/";

    try {
      await navigator.clipboard.writeText(websiteUrl);
      toast({
        title: "Link copied!",
        description: "Website URL has been copied to your clipboard.",
        duration: 3000,
      });
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = websiteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      toast({
        title: "Link copied!",
        description: "Website URL has been copied to your clipboard.",
        duration: 3000,
      });
    }
  };

      return (
    <>
      {/* Share Modal - Commented out for production, now using direct copy-to-clipboard */}
      {/*
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Share ReadMyFinePrint
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Help others discover our mission to make legal documents accessible!
                </p>
              </div>

              <SocialShare
                title="ReadMyFinePrint - Making Legal Documents Accessible"
                description="Check out this amazing platform that makes legal documents easier to understand for everyone!"
                hashtags={["legaltech", "accessibility", "transparency", "legal"]}
              />
            </div>
          </div>
        </div>
      )}
      */}

      <footer
      id="footer"
      role="contentinfo"
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-40 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 transition-all duration-300 ease-in-out flex-shrink-0"
      aria-label="Site footer"
    >
      {/* Mobile Layout - Ultra compact spacing */}
      <div className="md:hidden px-1 py-0">
        <div className="space-y-0">
          {/* Top row - Main links */}
          <div className="flex items-center justify-center gap-1 text-xs">
            <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">Privacy</Link>
            <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">Terms</Link>
            <Link to="/cookies" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium">
              Cookie Settings
            </Link>
            <a href="mailto:admin@readmyfineprint.com" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">Contact</a>
          </div>
          
          {/* Bottom row - Action links */}
          <div className="flex items-center justify-center gap-1 text-xs">
            <Link to="/donate" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-0.5">
              <Heart className="w-3 h-3" />Donate
            </Link>
            <Link to="/roadmap" className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-0.5">
              <Target className="w-3 h-3" />Roadmap
            </Link>
            <button
              onClick={handleShareClick}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
            >
              <Share2 className="w-3 h-3" />Share
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Compact */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
        <div className="flex justify-between items-center gap-2">
          {/* Company Info */}
          <div className="flex flex-col items-start">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
              ReadMyFinePrint
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-[0.65rem]">
              © {new Date().getFullYear()} ReadMyFinePrint. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs">
            <Link
              to="/privacy"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
            >
              Terms of Service
            </Link>
            <Link
              to="/cookies"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-300 ease-in-out inline-flex items-center font-medium"
            >
              <Cookie className="w-3 h-3 mr-1" aria-hidden="true" />
              Cookie Settings
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/donate"
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-300 ease-in-out inline-flex items-center"
              >
                <Heart className="w-3 h-3 mr-0.5" aria-hidden="true" />
                Donate
              </Link>
              <Link
                to="/roadmap"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-300 ease-in-out inline-flex items-center"
              >
                <Target className="w-3 h-3 mr-0.5" aria-hidden="true" />
                Roadmap
              </Link>
              <button
                onClick={handleShareClick}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 ease-in-out inline-flex items-center"
              >
                <Share2 className="w-3 h-3 mr-0.5" aria-hidden="true" />
                Share
              </button>
              <a
                href="mailto:admin@readmyfineprint.com"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
              >
                Contact
              </a>
            </div>
          </div>

        </div>
      </div>
    </footer>
    </>
  );
}