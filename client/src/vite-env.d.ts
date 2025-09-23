/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly MODE: string
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