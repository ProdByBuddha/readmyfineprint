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
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-40 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 transition-all duration-300 ease-in-out flex-shrink-0 pb-4 sm:pb-6"
      aria-label="Site footer"
    >
      {/* Mobile Layout - Ultra Compact */}
      <div className="md:hidden px-2 py-2">
        <div className="flex items-center justify-center text-xs whitespace-nowrap overflow-hidden min-h-[20px]">
          <div className="flex items-center gap-1.5 flex-shrink min-w-0">
            <Link to="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 flex items-center h-4">Privacy</Link>
            <Link to="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 flex items-center h-4">Terms</Link>
            <CookieManagement
              trigger={
                <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center flex-shrink-0 h-4">
                  <Cookie className="w-2 h-2 mr-0.5" />Cookies
                </button>
              }
            />
            <Link to="/donate" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center flex-shrink-0 h-4">
              <Heart className="w-2 h-2 mr-0.5 text-red-500" />Donate
            </Link>
            <Link to="/roadmap" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center flex-shrink-0 h-4">
              <Target className="w-2 h-2 mr-0.5 text-purple-500" />Roadmap
            </Link>
            <button
              onClick={handleShareClick}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center flex-shrink-0 h-4"
            >
              <Share2 className="w-2 h-2 mr-0.5" />Share
            </button>
            <a href="mailto:admin@readmyfineprint.com" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 flex items-center h-4">Contact</a>
            {/* <a href="/contact.vcf" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 flex items-center h-4" title="Download Contact Card">vCard</a> */}
          </div>
        </div>
      </div>

      {/* Desktop Layout - Full */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center gap-4">
          {/* Company Info */}
          <div className="flex flex-col items-start">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              ReadMyFinePrint
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-xs">
              © {new Date().getFullYear()} ReadMyFinePrint. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs">
            <Link
              to="/privacy"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
            >
              Terms
            </Link>
            <CookieManagement
              trigger={
                <button className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out inline-flex items-center">
                  <Cookie className="w-3 h-3 mr-1" aria-hidden="true" />
                  Cookie Settings
                </button>
              }
            />
            <Link
              to="/donate"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out inline-flex items-center"
            >
              <Heart className="w-3 h-3 mr-1 text-red-500" aria-hidden="true" />
              Donate
            </Link>
            <Link
              to="/roadmap"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out inline-flex items-center"
            >
              <Target className="w-3 h-3 mr-1 text-purple-500" aria-hidden="true" />
              Roadmap
            </Link>
            <button
              onClick={handleShareClick}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out inline-flex items-center"
            >
              <Share2 className="w-3 h-3 mr-1" aria-hidden="true" />
              Share
            </button>
            <a
              href="mailto:admin@readmyfineprint.com"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
            >
              Contact
            </a>
            {/* <a
              href="/contact.vcf"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out"
              title="Download Contact Card with Logo"
            >
              vCard
            </a> */}
          </div>

        </div>
      </div>
    </footer>
    </>
  );
}