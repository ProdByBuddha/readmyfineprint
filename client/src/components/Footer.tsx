import { Shield, Scale, Cookie, Github, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/CookieConsent";

export function Footer() {
  const { revokeCookies } = useCookieConsent();

  const handleCookieSettings = () => {
    revokeCookies();
    // This will cause the cookie banner to show again
    window.location.reload();
  };

  return (
    <footer className="border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              ReadMyFinePrint
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Privacy-first document analysis tool powered by AI.
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
              <a
                href="/privacy"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Shield className="w-3 h-3" />
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Scale className="w-3 h-3" />
                Terms of Service
              </a>
              <button
                onClick={handleCookieSettings}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Cookie className="w-3 h-3" />
                Cookie Preferences
              </button>
            </nav>
          </div>

          {/* Resources & Contact */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Resources
            </h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Not Legal Advice:</strong> This tool provides AI-powered analysis for informational purposes only. Consult qualified attorneys for legal matters.
              </div>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
              AI-Powered
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
