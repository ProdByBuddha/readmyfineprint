import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
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
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-button', '@radix-ui/react-card'],
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
    fs: {
      strict: true,
      deny: ["**/.*"],
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
