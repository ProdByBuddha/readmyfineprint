import { Link } from "wouter";
import { Heart, Github, Twitter, Mail } from "lucide-react";
import { SecurityBadges } from "@/components/SecurityBadges";

export function Footer() {
  return (
    <footer 
      id="footer"
      role="contentinfo" 
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ReadMyFinePrint
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
              Making legal documents accessible to everyone. Understand any contract 
              in plain English with our AI-powered analysis tool.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/readmyfineprint" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Visit our GitHub repository (opens in new window)"
              >
                <Github className="w-5 h-5" aria-hidden="true" />
              </a>
              <a 
                href="https://twitter.com/readmyfineprint" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Follow us on Twitter (opens in new window)"
              >
                <Twitter className="w-5 h-5" aria-hidden="true" />
              </a>
              <a 
                href="mailto:contact@readmyfineprint.com"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Send us an email"
              >
                <Mail className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <nav className="col-span-1" role="navigation" aria-labelledby="legal-heading">
            <h3 id="legal-heading" className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/privacy" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/cookies" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </nav>

          {/* Support Links */}
          <nav className="col-span-1" role="navigation" aria-labelledby="support-heading">
            <h3 id="support-heading" className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/donate" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded inline-flex items-center"
                >
                  <Heart className="w-4 h-4 mr-1 text-red-500" aria-hidden="true" />
                  Donate
                </Link>
              </li>
              <li>
                <Link 
                  to="/roadmap" 
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Roadmap
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:support@readmyfineprint.com"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-700" />
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              © {new Date().getFullYear()} ReadMyFinePrint. All rights reserved.
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              Made with ❤️ for legal transparency
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end">
            <SecurityBadges variant="footer" className="mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Enterprise-grade security & privacy
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}