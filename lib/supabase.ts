/**
 * Supabase Client - Legacy Export
 * 
 * ============================================================
 * DEPRECATED - Use config/supabase.ts instead
 * 
 * Este arquivo é mantido para compatibilidade.
 * Para novos usos, importe de:
 * 
 *   import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
 * 
 * ============================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
import { env } from '../config/env';

/**
 * @deprecated Use getSupabaseClient() from config/supabase.ts
 * 
 * Este export existe apenas para compatibilidade com código legado.
 * Em produção, o cliente só funciona se as variáveis estiverem configuradas.
 */
export const supabase = isSupabaseConfigured() 
    ? getSupabaseClient() 
    : null;

/**
 * Check if Supabase is available
 */
export const hasSupabase = isSupabaseConfigured;

/**
 * ============================================================
 * MIGRAÇÃO PARA SUPABASE
 * 
 * 1. Configure as variáveis no .env:
 *    VITE_SUPABASE_URL=https://seu-projeto.supabase.co
 *    VITE_SUPABASE_ANON_KEY=sua-anon-key
 * 
 * 2. Troque os repositories nos services:
 *    - authService.ts: SupabaseAuthRepository
 *    - portfolioService.ts: SupabasePortfolioRepository (a criar)
 *    - planningService.ts: SupabasePlanningRepository (a criar)
 * 
 * 3. Configure RLS (Row Level Security) nas tabelas
 * 
 * 4. Crie Edge Functions para operações sensíveis
 * ============================================================
 */
