import { Link } from "wouter";
import { Heart, Github, Twitter } from "lucide-react";
import { SecurityBadges } from "@/components/SecurityBadges";

export function Footer() {
  return (
    <footer 
      id="footer"
      role="contentinfo" 
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          {/* Company Info */}
          <div className="flex flex-col items-center md:items-start">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
              ReadMyFinePrint
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-xs text-center md:text-left">
              © {new Date().getFullYear()} ReadMyFinePrint. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs">
            <Link 
              to="/privacy" 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link 
              to="/terms" 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Terms
            </Link>
            <Link 
              to="/donate" 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center"
            >
              <Heart className="w-3 h-3 mr-1 text-red-500" aria-hidden="true" />
              Donate
            </Link>
            <a 
              href="mailto:support@readmyfineprint.com"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Support
            </a>
          </div>

          {/* Security Badges */}
          <div className="flex items-center">
            <SecurityBadges variant="footer" className="scale-50 sm:scale-75" />
          </div>
        </div>
      </div>
    </footer>
  );
}