'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { SecurityQuestionsProvider } from '@/contexts/SecurityQuestionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface SPAProvidersProps {
  children: React.ReactNode;
}

/**
 * SPA Providers Component
 * 
 * This component sets up all the necessary providers for the SPA:
 * - QueryClientProvider for React Query state management
 * - SecurityQuestionsProvider for security question state
 * - ErrorBoundary for error handling
 * 
 * Note: ThemeProvider is handled at the Next.js layout level to ensure
 * consistent theming across the entire application.
 */
export function SPAProviders({ children }: SPAProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SecurityQuestionsProvider>
          {children}
        </SecurityQuestionsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}