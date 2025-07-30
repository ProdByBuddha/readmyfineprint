declare module '../vite.config.js' {
  interface ViteConfig {
    [key: string]: any;
  }
  const config: ViteConfig;
  export = config;
}