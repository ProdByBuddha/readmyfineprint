'use client';

import React, { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { SPAProviders } from './SPAProviders';
import { App } from './App';

/**
 * Main SPA Container Component
 * 
 * This component serves as the foundation for the React Router-based SPA
 * embedded within the Next.js application. It sets up all necessary providers
 * and the routing system.
 */
export function SPAContainer() {
  return (
    <SPAProviders>
      <BrowserRouter>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        }>
          <App />
        </Suspense>
      </BrowserRouter>
    </SPAProviders>
  );
}