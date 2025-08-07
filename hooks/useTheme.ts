<<<<<<< HEAD
"use client";

import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useNextTheme();
  
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return {
    theme: (resolvedTheme || theme) as "light" | "dark",
    setTheme: (newTheme: "light" | "dark") => setTheme(newTheme),
    toggleTheme,
    loading: false, // next-themes handles loading internally
    error: null,
  };
}
=======
"use client";

import { useTheme as useNextTheme } from "next-themes";

export const useTheme = useNextTheme;
>>>>>>> 7cc2891905625b3209b30e87e2aac95bced64f65
