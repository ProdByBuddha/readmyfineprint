/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_ADMIN_API_KEY: string
  readonly DEV: boolean
  readonly MODE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}