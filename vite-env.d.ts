/// <reference types="vite/client" />

// Explicit augmentation so tsc picks it up regardless of moduleResolution
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
