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
}