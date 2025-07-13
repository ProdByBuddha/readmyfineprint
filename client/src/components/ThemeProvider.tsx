import { createContext, useContext, useEffect } from "react";
import { useThemePreference } from "../hooks/useThemePreference";

type Theme = "light" | "dark";

type ThemeProviderContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  loading: boolean;
  error: string | null;
};

const ThemeProviderContext = createContext<ThemeProviderContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, toggleTheme, loading, error } = useThemePreference();

  useEffect(() => {
    if (loading) return; // Don't apply theme changes while loading
    
    const root = window.document.documentElement;
    const body = window.document.body;
    
    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");
    
    root.classList.add(theme);
    body.classList.add(theme);
  }, [theme, loading]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    loading,
    error,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
