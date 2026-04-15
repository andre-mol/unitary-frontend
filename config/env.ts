/**
 * Environment Configuration
 * 
 * ============================================================
 * VARIÁVEIS DE AMBIENTE
 * 
 * Centraliza o acesso às variáveis de ambiente do Vite.
 * Todas as variáveis devem ter prefixo VITE_ para serem expostas ao cliente.
 * 
 * VARIÁVEIS SUPORTADAS:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - VITE_POSTHOG_KEY (opcional)
 * - VITE_POSTHOG_HOST (opcional)
 * - VITE_POSTHOG_ENABLED (opcional, default: false)
 * - VITE_POSTHOG_DEBUG (opcional, default: false)
 * 
 * ARQUIVO .env (criar na raiz do projeto):
 * ```
 * VITE_SUPABASE_URL=https://seu-projeto.supabase.co
 * VITE_SUPABASE_ANON_KEY=sua-anon-key
 * VITE_APP_ENV=development
 * ```
 *
 * MODO DEMO (sem backend): defina VITE_DEMO_MODE=true em .env.local ou .env.development.
 * O Vite em `npm run dev` NÃO carrega .env.production — só build de produção.
 * 
 * IMPORTANTE:
 * - NUNCA commit o arquivo .env com chaves reais
 * - Use .env.example como template
 * - Em produção, configure as variáveis no host (Vercel, Netlify, etc)
 * - NUNCA inclua SERVICE_ROLE_KEY ou qualquer chave secreta
 * ============================================================
 */

/**
 * Safely get environment variable as string
 * Returns empty string if undefined/null (no crash on import)
 */
function getEnvString(key: string): string {
    const value = import.meta.env[key];
    if (value === undefined || value === null) {
        return '';
    }
    return String(value).trim();
}

/**
 * Application environment configuration
 * All values are read from import.meta.env (Vite standard)
 * 
 * IMPORTANTE: Variáveis vazias retornam '' e isSupabaseConfigured() lida com isso
 */
export const env = {
    /**
     * Demo Mode - when true, all backend calls are mocked
     */
    DEMO_MODE: getEnvString('VITE_DEMO_MODE') === 'true',
    
    /**
     * Supabase Project URL
     * Format: https://your-project.supabase.co
     */
    SUPABASE_URL: getEnvString('VITE_SUPABASE_URL'),
    
    /**
     * Supabase Anonymous Key (public, safe for client)
     * This key works with Row Level Security (RLS)
     * NUNCA inclua a SERVICE_ROLE_KEY aqui
     */
    SUPABASE_ANON_KEY: getEnvString('VITE_SUPABASE_ANON_KEY'),
    
    /**
     * Application environment
     * Values: 'development' | 'staging' | 'production'
     */
    APP_ENV: getEnvString('VITE_APP_ENV') || 'development',
    
    /**
     * Is development mode
     */
    isDevelopment: import.meta.env.DEV === true || getEnvString('VITE_APP_ENV') === 'development',
    
    /**
     * Is production mode
     */
    isProduction: import.meta.env.PROD === true || getEnvString('VITE_APP_ENV') === 'production',
    
    /**
     * PostHog Analytics Configuration (optional)
     * Only used if VITE_POSTHOG_ENABLED === 'true'
     */
    POSTHOG_KEY: getEnvString('VITE_POSTHOG_KEY'),
    POSTHOG_HOST: getEnvString('VITE_POSTHOG_HOST') || 'https://us.i.posthog.com',
    POSTHOG_ENABLED: getEnvString('VITE_POSTHOG_ENABLED') === 'true',
    POSTHOG_DEBUG: getEnvString('VITE_POSTHOG_DEBUG') === 'true',
} as const;

/**
 * Validate required environment variables
 * Call this at app startup to catch missing config early
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
    const required: (keyof typeof env)[] = [];
    const missing: string[] = [];
    
    // In production, Supabase config is required
    if (env.isProduction) {
        required.push('SUPABASE_URL', 'SUPABASE_ANON_KEY');
    }
    
    for (const key of required) {
        if (!env[key]) {
            missing.push(`VITE_${key}`);
        }
    }
    
    return { valid: missing.length === 0, missing };
}

/**
 * ============================================================
 * SEGURANÇA - O QUE NUNCA COLOCAR NO FRONTEND:
 * 
 * ❌ SUPABASE_SERVICE_ROLE_KEY (acesso admin)
 * ❌ Chaves de API privadas (Stripe secret, etc)
 * ❌ Credenciais de banco de dados
 * ❌ Secrets de JWT
 * 
 * Essas chaves devem ser usadas APENAS em:
 * - Edge Functions (Supabase)
 * - API Routes (Next.js, etc)
 * - Backend tradicional
 * ============================================================
 */

