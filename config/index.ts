/**
 * Configuration - Central Export
 */

export { env, validateEnv } from './env';
export { getSupabaseClient, isSupabaseConfigured } from './supabase';
export { 
    getRequiredUserId, 
    getCurrentUserId, 
    isAuthenticated,
    AuthenticationError,
    isAuthenticationError,
    AUTH_ERROR_CODE 
} from './supabaseAuth';

// Storage Configuration
export { 
    STORAGE_BACKEND, 
    createPortfolioRepository, 
    createPlanningRepository,
    PORTFOLIO_UPDATE_EVENT,
    BUDGET_UPDATE_EVENT
} from './storage';
export type { StorageBackend } from './storage';

