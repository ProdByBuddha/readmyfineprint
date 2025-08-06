"use client";

import React from 'react';

export function ResponsiveTest() {
  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Responsive Breakpoint Test</h3>
      
      {/* Test different breakpoints */}
      <div className="space-y-2">
        <div className="block sm:hidden bg-red-200 dark:bg-red-800 p-2 rounded">
          Mobile only (&lt; 640px)
        </div>
        
        <div className="hidden sm:block md:hidden bg-yellow-200 dark:bg-yellow-800 p-2 rounded">
          Small screens (640px - 768px)
        </div>
        
        <div className="hidden md:block lg:hidden bg-green-200 dark:bg-green-800 p-2 rounded">
          Medium screens (768px - 1024px)
        </div>
        
        <div className="hidden lg:block xl:hidden bg-blue-200 dark:bg-blue-800 p-2 rounded">
          Large screens (1024px - 1280px)
        </div>
        
        <div className="hidden xl:block 2xl:hidden bg-purple-200 dark:bg-purple-800 p-2 rounded">
          Extra large screens (1280px - 1536px)
        </div>
        
        <div className="hidden 2xl:block bg-pink-200 dark:bg-pink-800 p-2 rounded">
          2XL screens (&gt;= 1536px)
        </div>
      </div>
      
      {/* Test responsive grid */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Responsive Grid Test</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-center">1</div>
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-center">2</div>
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-center">3</div>
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded text-center">4</div>
        </div>
      </div>
      
      {/* Test responsive text sizes */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Responsive Text Test</h4>
        <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">
          This text scales with screen size
        </p>
      </div>
      
      {/* Test responsive spacing */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Responsive Spacing Test</h4>
        <div className="p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-200 dark:bg-gray-700 rounded">
          Padding increases with screen size
        </div>
      </div>
    </div>
  );
}