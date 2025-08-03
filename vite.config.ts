import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Increase chunk size warning limit to 1MB (from default 500KB)
    chunkSizeWarningLimit: 1000,
    // SEO and Performance optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          vendor: ['react', 'react-dom'],
          // UI components
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-select',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip'
          ],
          // Large third-party libraries
          utils: [
            'html2canvas',
            'dompurify',
            'clsx',
            'tailwind-merge'
          ],
          // API and state management
          api: [
            '@tanstack/react-query'
          ]
        },
      },
    },
    // Asset optimization
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    // Source maps for better debugging in production
    sourcemap: true,
    // Minification settings
    minify: 'esbuild',
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
  },
  server: {
    port: 5173,
    strictPort: true, // Use exact port 5173
    host: true, // Listen on all addresses
    allowedHosts: [
      'localhost',
      '.replit.dev',
      '.repl.co',
      '.replit.app',
      '.repl.run',
      'edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev'
    ],
    // Enhanced CORS protection to mitigate esbuild vulnerability
    cors: {
      origin: [
        'http://localhost:5000',
        'https://localhost:5000',
        /^https?:\/\/.*\.replit\.dev$/,
        /^https?:\/\/.*\.repl\.co$/,
        /^https?:\/\/.*\.replit\.app$/,
        /^https?:\/\/.*\.repl\.run$/,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
  // Enable CSS preprocessing optimizations
  css: {
    devSourcemap: true,
  },
});