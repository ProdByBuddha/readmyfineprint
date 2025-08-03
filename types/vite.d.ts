declare module 'vite' {
  import { Server } from 'http';
  
  interface ViteDevServer {
    middlewares: any;
    listen(): Promise<ViteDevServer>;
    close(): Promise<void>;
    transformIndexHtml(url: string, html: string): Promise<string>;
    ssrFixStacktrace(e: Error): void;
  }

  interface Logger {
    info(msg: string, options?: any): void;
    warn(msg: string, options?: any): void;
    error(msg: string, options?: any): void;
  }

  interface ViteServerOptions {
    middlewareMode?: boolean | 'html' | 'ssr';
    hmr?: boolean | { server?: Server };
    allowedHosts?: boolean | string[];
  }

  interface ViteConfig {
    configFile?: false | string;
    customLogger?: Logger;
    server?: ViteServerOptions;
    appType?: 'spa' | 'mpa' | 'custom';
    [key: string]: any;
  }

  export function createServer(config?: ViteConfig): Promise<ViteDevServer>;
  export function createLogger(): Logger;

    export function defineConfig(arg0: { plugins: any[]; resolve: { alias: { "@": string; "@shared": string; "@assets": string; }; }; root: string; build: { outDir: string; emptyOutDir: boolean; chunkSizeWarningLimit: number; rollupOptions: { output: { manualChunks: { vendor: string[]; ui: string[]; utils: string[]; api: string[]; }; }; }; assetsInlineLimit: number; cssCodeSplit: boolean; sourcemap: boolean; minify: string; target: string[]; }; server: { port: number; strictPort: boolean; host: boolean; allowedHosts: string[]; cors: { origin: (string | RegExp)[]; credentials: boolean; methods: string[]; allowedHeaders: string[]; }; fs: { strict: boolean; deny: string[]; }; proxy: { '/api': { target: string; changeOrigin: boolean; secure: boolean; }; }; }; optimizeDeps: { include: string[]; }; css: { devSourcemap: boolean; }; }) {
        throw new Error("Function not implemented.");
    }
}