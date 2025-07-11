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
    // SEO and Performance optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog'],
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
    strictPort: false, // Will find next available port if 5173 is taken
    host: true, // Listen on all addresses
    allowedHosts: [
      'localhost',
      '.replit.dev',
      '.repl.co',
      '.replit.app',
      '.repl.run',
      'edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev'
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Backend runs on 5000
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
