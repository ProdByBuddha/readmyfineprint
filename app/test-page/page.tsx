'use client';

import React from 'react';
import { ResponsiveTest } from '@/components/ResponsiveTest';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Debug Panel */}
      <div className="fixed top-4 right-4 bg-black text-white p-3 rounded-lg text-sm z-50 shadow-lg">
        <div className="font-semibold mb-1">Current Breakpoint:</div>
        <div className="space-y-1">
          <div className="block sm:hidden text-red-400">XS (&lt; 640px)</div>
          <div className="hidden sm:block md:hidden text-yellow-400">SM (640px+)</div>
          <div className="hidden md:block lg:hidden text-green-400">MD (768px+)</div>
          <div className="hidden lg:block xl:hidden text-blue-400">LG (1024px+)</div>
          <div className="hidden xl:block 2xl:hidden text-purple-400">XL (1280px+)</div>
          <div className="hidden 2xl:block text-pink-400">2XL (1536px+)</div>
        </div>
        <div className="mt-2 text-xs text-gray-300">
          Resize window to test
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-12">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
              Responsive Design Testing
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base md:text-lg lg:text-xl max-w-3xl mx-auto">
              This page tests all responsive breakpoints and ensures proper layout behavior across different screen sizes.
            </p>
          </div>

          {/* Breakpoint Visibility Tests */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold md:text-2xl">Breakpoint Visibility Tests</h2>
            <ResponsiveTest />
          </div>

          {/* Layout Testing */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold md:text-2xl">Layout Responsiveness</h2>
            
            {/* Grid System Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Grid System</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <div key={num} className="bg-blue-100 dark:bg-blue-900 p-4 rounded text-center font-medium">
                    {num}
                  </div>
                ))}
              </div>
            </div>

            {/* Flexbox Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Flexbox Layout</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-green-100 dark:bg-green-900 p-4 rounded">
                  <h4 className="font-medium mb-2">Column 1</h4>
                  <p className="text-sm">This should stack vertically on mobile and horizontally on larger screens.</p>
                </div>
                <div className="flex-1 bg-yellow-100 dark:bg-yellow-900 p-4 rounded">
                  <h4 className="font-medium mb-2">Column 2</h4>
                  <p className="text-sm">Equal width columns that adapt to screen size.</p>
                </div>
                <div className="flex-1 bg-purple-100 dark:bg-purple-900 p-4 rounded">
                  <h4 className="font-medium mb-2">Column 3</h4>
                  <p className="text-sm">Responsive flexbox behavior test.</p>
                </div>
              </div>
            </div>

            {/* Typography Scale Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Typography Scaling</h3>
              <div className="space-y-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold">
                  Responsive Heading H1
                </h1>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold">
                  Responsive Heading H2
                </h2>
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-medium">
                  Responsive Heading H3
                </h3>
                <p className="text-sm sm:text-base md:text-lg">
                  Responsive paragraph text that scales appropriately across different screen sizes to maintain readability.
                </p>
              </div>
            </div>

            {/* Spacing Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Responsive Spacing</h3>
              <div className="space-y-2 sm:space-y-4 md:space-y-6 lg:space-y-8">
                <div className="p-2 sm:p-4 md:p-6 lg:p-8 bg-red-100 dark:bg-red-900 rounded">
                  Responsive padding (increases with screen size)
                </div>
                <div className="p-2 sm:p-4 md:p-6 lg:p-8 bg-blue-100 dark:bg-blue-900 rounded">
                  Another box with responsive padding
                </div>
              </div>
            </div>

            {/* Navigation Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Navigation Patterns</h3>
              
              {/* Horizontal nav on desktop, hamburger concept on mobile */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <div className="block sm:hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Mobile Menu</span>
                    <div className="w-6 h-6 bg-gray-400 rounded"></div>
                  </div>
                </div>
                
                <div className="hidden sm:block">
                  <nav className="flex space-x-6">
                    <a href="#" className="text-sm font-medium hover:text-primary">Home</a>
                    <a href="#" className="text-sm font-medium hover:text-primary">About</a>
                    <a href="#" className="text-sm font-medium hover:text-primary">Services</a>
                    <a href="#" className="text-sm font-medium hover:text-primary">Contact</a>
                  </nav>
                </div>
              </div>
            </div>

            {/* Button Group Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Button Groups</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
                  Primary
                </button>
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors">
                  Secondary
                </button>
                <button className="px-4 py-2 border border-border bg-background rounded hover:bg-accent transition-colors">
                  Outline
                </button>
              </div>
            </div>

            {/* Card Layout Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Card Layouts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <div key={num} className="bg-card border border-border rounded-lg p-6">
                    <h4 className="font-semibold mb-2">Card {num}</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      This is a sample card that should adapt to different screen sizes appropriately.
                    </p>
                    <button className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
                      Action
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Container Width Test */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Container Behavior</h3>
              <div className="bg-accent p-4 rounded">
                <p className="text-sm">
                  This container should have proper margins and padding across all screen sizes.
                  Max width should be controlled by the container class.
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  Current container: max-w-7xl with responsive padding
                </div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Test Checklist</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>✓ Breakpoint indicators work correctly</div>
                <div>✓ Grid system adapts at each breakpoint</div>
                <div>✓ Typography scales appropriately</div>
                <div>✓ Spacing adjusts for screen size</div>
              </div>
              <div className="space-y-2">
                <div>✓ Navigation patterns are responsive</div>
                <div>✓ Button groups stack/align properly</div>
                <div>✓ Card layouts adapt to columns</div>
                <div>✓ Container widths behave correctly</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}