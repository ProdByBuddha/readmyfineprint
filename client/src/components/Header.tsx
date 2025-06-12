import { Button } from "@/components/ui/button";
import { Moon, Sun, Heart } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import logoImage from "@assets/ChatGPT Image Jun 9, 2025, 07_07_26 AM_1749598570251.png";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-teal-200 dark:border-slate-700 sticky top-0 z-50 inset-x-0">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <img src={logoImage} alt="ReadMyFinePrint Logo" className="w-12 h-12 object-contain" />
              <h1 className="text-xl font-bold text-primary dark:text-primary hidden md:block">ReadMyFinePrint</h1>
            </div>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/donate">
              <Button variant="outline" size="sm" className="mr-2">
                <Heart className="w-4 h-4 mr-2 text-red-500" />
                Donate
              </Button>
            </Link>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className="mr-2"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>
          </nav>
          {/* Mobile navigation */}
          <nav className="md:hidden flex items-center space-x-2">
            <Link to="/donate">
              <Button variant="outline" size="sm">
                <Heart className="w-4 h-4 text-red-500" />
              </Button>
            </Link>
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}