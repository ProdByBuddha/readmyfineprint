"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  attribute?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  attribute = "class"
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
    >
      {children}
    </NextThemesProvider>
  );
}