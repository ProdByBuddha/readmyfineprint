
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly MODE: string
  readonly PROD: boolean
  readonly SSR: boolean
  readonly BASE_URL: string
  readonly VITE_API_URL: string
  readonly VITE_STRIPE_PUBLIC_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_VERSION: string
  readonly VITE_ENABLE_API_KEYS: string
  readonly VITE_ADMIN_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// EventTarget polyfill for compatibility
declare global {
  interface Window {
    Target?: typeof EventTarget;
  }
}

// Ensure EventTarget is available
if (typeof window !== 'undefined') {
  if (!window.EventTarget) {
    class CustomEventTarget {
      private listeners: { [key: string]: any[] } = {};
      
      addEventListener(type: string, listener: any) {
        if (!this.listeners[type]) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
      }
      
      removeEventListener(type: string, listener: any) {
        if (this.listeners[type]) {
          const index = this.listeners[type].indexOf(listener);
          if (index > -1) {
            this.listeners[type].splice(index, 1);
          }
        }
      }
      
      dispatchEvent(event: any) {
        if (this.listeners[event.type]) {
          this.listeners[event.type].forEach((listener: any) => {
            listener.call(this, event);
          });
        }
        return true;
      }
    }
    
    (window as any).EventTarget = CustomEventTarget;
  }
  
  // Ensure Target alias exists
  if (typeof (window as any).Target === 'undefined') {
    (window as any).Target = window.EventTarget;
  }
}

export {};
