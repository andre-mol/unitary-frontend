/**
 * ============================================================
 * STORAGE CONFIGURATION - CENTRAL BACKEND SWITCH
 * ============================================================
 * 
 * This is the SINGLE POINT where you switch between storage backends.
 * 
 * HOW TO SWITCH TO SUPABASE:
 * 1. Ensure Supabase repositories are fully implemented
 * 2. Change STORAGE_BACKEND from 'localStorage' to 'supabase'
 * 3. Restart the application
 * 
 * That's it! All services will automatically use the new backend.
 * 
 * ============================================================
 */

import type { PortfolioRepository } from '../domain/repositories/PortfolioRepository';
import type { PlanningRepository } from '../domain/repositories/PlanningRepository';

// Import LocalStorage implementations (current default)
import { 
    LocalStoragePortfolioRepository, 
    PORTFOLIO_UPDATE_EVENT as LS_PORTFOLIO_EVENT 
} from '../infrastructure/storage/LocalStoragePortfolioRepository';
import { 
    LocalStoragePlanningRepository, 
    BUDGET_UPDATE_EVENT as LS_BUDGET_EVENT 
} from '../infrastructure/storage/LocalStoragePlanningRepository';

// Import Supabase implementations (placeholders for now)
import { 
    SupabasePortfolioRepository, 
    SUPABASE_PORTFOLIO_UPDATE_EVENT 
} from '../infrastructure/database';
import { 
    SupabasePlanningRepository, 
    SUPABASE_BUDGET_UPDATE_EVENT 
} from '../infrastructure/database';

// ============================================================
// BACKEND CONFIGURATION
// ============================================================

/**
 * Storage backend type
 */
export type StorageBackend = 'localStorage' | 'supabase';

import { env } from './env';

/**
 * ⚠️ STORAGE BACKEND CONFIGURATION ⚠️
 * 
 * Current: 'supabase' (cloud database, requires auth)
 * Alternative: 'localStorage' (offline-first, browser storage)
 * In DEMO_MODE, always uses localStorage with pre-seeded data.
 */
export const STORAGE_BACKEND: StorageBackend = env.DEMO_MODE ? 'localStorage' : 'supabase';

// ============================================================
// REPOSITORY FACTORY
// ============================================================

/**
 * Creates the appropriate Portfolio Repository based on configuration
 */
export function createPortfolioRepository(): PortfolioRepository {
    switch (STORAGE_BACKEND) {
        case 'supabase':
            console.info('[Storage] Using Supabase Portfolio Repository');
            return new SupabasePortfolioRepository();
        
        case 'localStorage':
        default:
            console.info('[Storage] Using LocalStorage Portfolio Repository');
            return new LocalStoragePortfolioRepository();
    }
}

/**
 * Creates the appropriate Planning Repository based on configuration
 */
export function createPlanningRepository(): PlanningRepository {
    switch (STORAGE_BACKEND) {
        case 'supabase':
            console.info('[Storage] Using Supabase Planning Repository');
            return new SupabasePlanningRepository();
        
        case 'localStorage':
        default:
            console.info('[Storage] Using LocalStorage Planning Repository');
            return new LocalStoragePlanningRepository();
    }
}

// ============================================================
// UPDATE EVENTS
// ============================================================

/**
 * Returns the appropriate update event name for Portfolio updates
 */
export function getPortfolioUpdateEvent(): string {
    switch (STORAGE_BACKEND) {
        case 'supabase':
            return SUPABASE_PORTFOLIO_UPDATE_EVENT;
        case 'localStorage':
        default:
            return LS_PORTFOLIO_EVENT;
    }
}

/**
 * Returns the appropriate update event name for Budget updates
 */
export function getBudgetUpdateEvent(): string {
    switch (STORAGE_BACKEND) {
        case 'supabase':
            return SUPABASE_BUDGET_UPDATE_EVENT;
        case 'localStorage':
        default:
            return LS_BUDGET_EVENT;
    }
}

// ============================================================
// EXPORTED CONSTANTS (for backward compatibility)
// ============================================================

export const PORTFOLIO_UPDATE_EVENT = getPortfolioUpdateEvent();
export const BUDGET_UPDATE_EVENT = getBudgetUpdateEvent();

// ============================================================
// TYPE EXPORTS
// ============================================================

export type { PortfolioRepository } from '../domain/repositories/PortfolioRepository';
export type { PlanningRepository } from '../domain/repositories/PlanningRepository';

