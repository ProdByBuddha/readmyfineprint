"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder on the server and initial client render
    return (
      <Button variant="ghost" size="sm" className="mr-2" disabled>
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="sm"
      className="mr-2"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
      <span className="sr-only">
        {theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      </span>
    </Button>
  );
}
