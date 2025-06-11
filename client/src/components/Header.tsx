import { Button } from "@/components/ui/button";
import { Moon, Sun, Heart } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { Logo } from "@/components/Logo";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-teal-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <Logo size={48} />
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
          {/* Mobile menu button could be added here in the future */}
        </div>
      </div>
    </header>
  );
}