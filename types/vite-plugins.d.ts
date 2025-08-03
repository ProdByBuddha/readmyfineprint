
declare module '@vitejs/plugin-react' {
  import { type PluginOption } from 'vite';
  function react(options?: any): PluginOption;
  export default react;
}

declare module '@replit/vite-plugin-runtime-error-modal' {
  import { type PluginOption } from 'vite';
  function runtimeErrorOverlay(options?: any): PluginOption;
  export default runtimeErrorOverlay;
}
