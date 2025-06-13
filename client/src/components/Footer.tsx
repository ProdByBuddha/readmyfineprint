import { Link } from "wouter";
import { Heart, Github, Twitter, Cookie } from "lucide-react";
import { SecurityBadges } from "@/components/SecurityBadges";
import { CookieManagement } from "@/components/CookieManagement";

export function Footer() {
  return (
    <footer
      id="footer"
      role="contentinfo"
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-40 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 transition-all duration-300 ease-in-out flex-shrink-0"
      aria-label="Site footer"
    >
      {/* Mobile Layout - Ultra Compact */}
      <div className="md:hidden px-2 py-0.5">
        <div className="flex items-center justify-between text-xs whitespace-nowrap overflow-hidden min-h-[20px]">
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
            <a href="mailto:admin@readmyfineprint.com" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 flex items-center h-4">Contact</a>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0 ml-2 flex items-center h-4">© {new Date().getFullYear()}</p>
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
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Terms
            </Link>
            <CookieManagement 
              trigger={
                <button className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 inline-flex items-center">
                  <Cookie className="w-3 h-3 mr-1" aria-hidden="true" />
                  Cookie Settings
                </button>
              }
            />
            <Link
              to="/donate"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 inline-flex items-center"
            >
              <Heart className="w-3 h-3 mr-1 text-red-500" aria-hidden="true" />
              Donate
            </Link>
            <a
              href="mailto:admin@readmyfineprint.com"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Contact
            </a>
          </div>

          {/* Security Badges */}
          <div className="flex items-center">
            <SecurityBadges variant="footer" className="scale-75" />
          </div>
        </div>
      </div>
    </footer>
  );
}
