/**
 * ============================================================
 * DATABASE INFRASTRUCTURE - SUPABASE PLACEHOLDERS
 * ============================================================
 * 
 * This module exports Supabase repository implementations.
 * Currently these are placeholders that will throw errors if used.
 * 
 * HOW TO ACTIVATE SUPABASE:
 * 1. Implement the repository methods in SupabasePortfolioRepository.ts
 * 2. Implement the repository methods in SupabasePlanningRepository.ts
 * 3. Change the STORAGE_BACKEND constant in config/storage.ts to 'supabase'
 * 
 * The switch happens automatically via the central configuration.
 */

export { SupabasePortfolioRepository, PORTFOLIO_UPDATE_EVENT as SUPABASE_PORTFOLIO_UPDATE_EVENT } from './SupabasePortfolioRepository';
export { SupabasePlanningRepository, BUDGET_UPDATE_EVENT as SUPABASE_BUDGET_UPDATE_EVENT } from './SupabasePlanningRepository';

