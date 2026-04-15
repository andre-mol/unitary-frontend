/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_APP_ENV?: string;
    readonly VITE_DEMO_MODE?: string;
    readonly VITE_ADMIN_API_URL?: string;
    readonly VITE_API_URL?: string;
    readonly VITE_POSTHOG_KEY?: string;
    readonly VITE_POSTHOG_HOST?: string;
    readonly VITE_POSTHOG_ENABLED?: string;
    readonly VITE_POSTHOG_DEBUG?: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
