import path from "path";
import { transformWithEsbuild } from 'vite';

// Custom React plugin that doesn't require @vitejs/plugin-react
const reactPlugin = () => ({
  name: 'vite:react-custom',
  config() {
    return {
      esbuild: {
        jsx: 'automatic',
        jsxDev: false,
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      },
      optimizeDeps: {
        include: ['react', 'react-dom'],
      },
    };
  },
  async transform(code, id) {
    // Only transform .jsx and .tsx files
    if (!/\.[jt]sx?$/.test(id)) return null;
    
    // Use esbuild to transform JSX
    const result = await transformWithEsbuild(code, id, {
      jsx: 'automatic',
      jsxImportSource: 'react',
      loader: id.endsWith('.tsx') ? 'tsx' : id.endsWith('.ts') ? 'ts' : 'jsx',
    });
    
    return result;
  },
});

export default {
  plugins: [reactPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client", "src"),
      "@shared": path.resolve(process.cwd(), "shared"),
      "@assets": path.resolve(process.cwd(), "attached_assets"),
    },
  },
  root: path.resolve(process.cwd(), "client"),
  build: {
    outDir: path.resolve(process.cwd(), "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: [
      'localhost',
      '.replit.dev',
      '.repl.co',
      '.replit.app',
      '.repl.run',
      'edcf3ef7-a826-4eed-8e04-7a485b2e183a-00-1wytaob2mj6u8.kirk.replit.dev'
    ],
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
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
};