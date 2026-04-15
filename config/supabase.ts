/**
 * Supabase Client Configuration
 * 
 * ============================================================
 * CONFIGURAÇÃO DO SUPABASE
 * 
 * Este arquivo gerencia a criação do cliente Supabase.
 * O cliente só é criado quando as variáveis de ambiente estão configuradas.
 * 
 * VARIÁVEIS NECESSÁRIAS (.env):
 * - VITE_SUPABASE_URL: URL do seu projeto Supabase
 * - VITE_SUPABASE_ANON_KEY: Chave pública (anon key) do Supabase
 * 
 * SEGURANÇA:
 * ❌ NUNCA coloque a SERVICE_ROLE_KEY no frontend
 * ❌ NUNCA inclua chaves secretas de qualquer tipo
 * ✅ A ANON_KEY é segura para uso no cliente (com RLS configurado)
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { createMockSupabaseClient } from '../mocks/mockSupabaseClient';

// Singleton instance
let supabaseClient: SupabaseClient | null = null;
let mockClient: any = null;

// App version for debugging (optional header)
const APP_VERSION = '1.0.0';

/**
 * Check if Supabase is configured
 * Returns true only if real credentials are provided
 * 
 * Validation rules:
 * - URL must not be empty
 * - URL must not contain 'placeholder'
 * - ANON_KEY must not be empty
 */
export function isSupabaseConfigured(): boolean {
    if (env.DEMO_MODE) return true;

    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_ANON_KEY;

    if (!url || !key) return false;
    if (url.includes('placeholder') || url.includes('your-project')) return false;
    if (!url.startsWith('https://')) return false;
    if (key.length < 20) return false;

    return true;
}

/**
 * Get the Supabase client instance
 * Creates the client on first call (lazy initialization)
 * 
 * Configuration:
 * - persistSession: true (keeps session in localStorage)
 * - autoRefreshToken: true (automatically refreshes JWT before expiry)
 * - detectSessionInUrl: true (handles OAuth redirects)
 * 
 * @throws Error if Supabase is not configured
 */
export function getSupabaseClient(): SupabaseClient {
    if (env.DEMO_MODE) {
        if (!mockClient) {
            mockClient = createMockSupabaseClient();
        }
        return mockClient as unknown as SupabaseClient;
    }

    if (!isSupabaseConfigured()) {
        throw new Error(
            'Supabase não está configurado. ' +
            'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env'
        );
    }

    if (!supabaseClient) {
        supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
            global: {
                headers: {
                    'X-Client-Info': `patrio-web/${APP_VERSION}`,
                },
            },
        });
    }

    return supabaseClient;
}

/**
 * ============================================================
 * EDGE FUNCTIONS - Pontos de Integração
 * 
 * Quando usar Edge Functions ao invés de chamadas diretas:
 * 
 * 1. OPERAÇÕES COM SERVICE_ROLE_KEY:
 *    - Deletar usuário e todos os dados
 *    - Operações administrativas
 *    - Bypass de RLS quando necessário
 * 
 * 2. LÓGICA DE NEGÓCIO COMPLEXA:
 *    - Cálculos que precisam acessar múltiplas tabelas
 *    - Operações que precisam de atomicidade
 *    - Validações complexas do lado do servidor
 * 
 * 3. INTEGRAÇÕES EXTERNAS:
 *    - Webhooks de pagamento (Stripe)
 *    - Envio de emails customizados
 *    - Integração com APIs de mercado (cotações)
 * 
 * EXEMPLO DE USO:
 * ```typescript
 * const { data, error } = await supabase.functions.invoke('function-name', {
 *     body: { key: 'value' }
 * });
 * ```
 * ============================================================
 */

