import Link from "next/link";
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
      {/* Mobile Layout - Improved responsive design */}
      <div className="md:hidden px-3 py-2 sm:px-4">
        {/* Two-row layout for better mobile experience */}
        <div className="space-y-2">
          {/* Copyright row */}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} ReadMyFinePrint
          </div>
          
          {/* Links row - wrapped for better mobile experience */}
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs">
            <Link 
              href="/privacy" 
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors py-1.5 px-1 min-h-[44px] flex items-center"
              aria-label="Privacy Policy"
            >
              Privacy
            </Link>
            <Link 
              href="/terms" 
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors py-1.5 px-1 min-h-[44px] flex items-center"
              aria-label="Terms of Service"
            >
              Terms
            </Link>
            <Link 
              href="/cookies" 
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1 transition-colors py-1.5 px-1 min-h-[44px]"
              aria-label="Cookie Policy"
            >
              <Cookie className="w-3 h-3" aria-hidden="true" />
              Cookies
            </Link>
            <Link 
              href="/donate" 
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors py-1.5 px-1 min-h-[44px]"
              aria-label="Support us with a donation"
            >
              <Heart className="w-3 h-3" aria-hidden="true" />
              Donate
            </Link>
            <button
              onClick={handleShareClick}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors py-1.5 px-1 min-h-[44px]"
              aria-label="Share this website"
            >
              <Share2 className="w-3 h-3" aria-hidden="true" />
              Share
            </button>
            <a
              href="mailto:admin@readmyfineprint.com"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors py-1.5 px-1 min-h-[44px] flex items-center"
              aria-label="Contact us via email"
            >
              Contact
            </a>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Improved spacing and alignment */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 py-2 lg:py-1">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-0">
          {/* Company Info */}
          <div className="text-xs text-gray-600 dark:text-gray-300 text-center md:text-left">
            © {new Date().getFullYear()} ReadMyFinePrint
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end items-center gap-x-4 gap-y-1 text-xs">
            <Link
              href="/privacy"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out py-1.5 px-1"
              aria-label="Privacy Policy"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out py-1.5 px-1"
              aria-label="Terms of Service"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-300 ease-in-out inline-flex items-center py-1.5 px-1"
              aria-label="Cookie Policy"
            >
              <Cookie className="w-3 h-3 mr-1" aria-hidden="true" />
              Cookies
            </Link>
            <Link
              href="/donate"
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-300 ease-in-out inline-flex items-center py-1.5 px-1"
              aria-label="Support us with a donation"
            >
              <Heart className="w-3 h-3 mr-1" aria-hidden="true" />
              Donate
            </Link>
            <Link
              href="/roadmap"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-300 ease-in-out inline-flex items-center py-1.5 px-1"
              aria-label="View our roadmap"
            >
              <Target className="w-3 h-3 mr-1" aria-hidden="true" />
              Roadmap
            </Link>
            <button
              onClick={handleShareClick}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 ease-in-out inline-flex items-center py-1.5 px-1"
              aria-label="Share this website"
            >
              <Share2 className="w-3 h-3 mr-1" aria-hidden="true" />
              Share
            </button>
            <a
              href="mailto:admin@readmyfineprint.com"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-300 ease-in-out py-1.5 px-1"
              aria-label="Contact us via email"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}