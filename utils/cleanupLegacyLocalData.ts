import { env } from '../config/env';

/**
 * ============================================================
 * LEGACY LOCAL DATA CLEANUP
 * ============================================================
 * 
 * Utility to clean up old localStorage data after migrating to Supabase.
 * Should be run once after successful login.
 * 
 * IMPORTANT:
 * - Does NOT persist any cleanup flag to localStorage
 * - Uses in-memory flag to run only once per session
 * - Safe to run multiple times (no side effects after first run)
 * 
 * ============================================================
 */

// In-memory flag to track if cleanup has been performed this session
let cleanupPerformed = false;

/**
 * List of localStorage key prefixes used by the old local storage system
 */
const LEGACY_KEY_PREFIXES = [
    'patrio_',           // Main app data prefix
    'sb-',               // Supabase session (optional - keep if needed)
];

/**
 * Specific keys to always remove (legacy data keys)
 */
const LEGACY_KEYS_TO_REMOVE = [
    // Portfolio data
    'patrio_portfolios',
    'patrio_storage_version',
    
    // Planning data
    'patrio_goals',
    'patrio_objectives',
    
    // Budget data (pattern: patrio_budget_YYYY-MM)
    // Expenses data (pattern: patrio_expenses_YYYY-MM)
    // These are handled by prefix matching below
    
    // Dashboard configs (pattern: patrio_dashboard_*)
    // History/Events (pattern: patrio_history_*, patrio_events_*)
    // Categories
    'patrio_categories',
];

/**
 * Keys to preserve (do not delete)
 */
const KEYS_TO_PRESERVE: string[] = [
    // User preferences that might be useful to keep
    'patrio_cache_on_device',
];

/**
 * Clean up legacy localStorage data
 * 
 * @returns Object with cleanup results
 */
export function cleanupLegacyLocalData(): { 
    cleaned: boolean; 
    keysRemoved: string[]; 
    error?: string;
} {
    // Only run once per session
    if (cleanupPerformed) {
        return { cleaned: false, keysRemoved: [] };
    }

    // Modo demo e backend local: todo o app usa patrio_* no localStorage — apagar aqui
    // zera a Visão Geral logo após o seed (AuthProvider chama isto no login).
    if (env.DEMO_MODE) {
        cleanupPerformed = true;
        return { cleaned: false, keysRemoved: [] };
    }
    
    try {
        const keysRemoved: string[] = [];
        const allKeys = Object.keys(localStorage);
        
        for (const key of allKeys) {
            // Skip preserved keys
            if (KEYS_TO_PRESERVE.includes(key)) {
                continue;
            }
            
            // Check if key matches any legacy prefix
            const isLegacyKey = LEGACY_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
            
            // Check if key is in the specific removal list
            const isSpecificLegacyKey = LEGACY_KEYS_TO_REMOVE.includes(key);
            
            // Check for pattern-matched keys (budget, expenses by month)
            const isPatternMatch = 
                key.startsWith('patrio_budget_') ||
                key.startsWith('patrio_expenses_') ||
                key.startsWith('patrio_dashboard_') ||
                key.startsWith('patrio_history_') ||
                key.startsWith('patrio_events_') ||
                key.startsWith('patrio_items_');
            
            if (isLegacyKey || isSpecificLegacyKey || isPatternMatch) {
                // Skip Supabase auth keys (we want to keep the session)
                if (key.startsWith('sb-') && key.includes('auth')) {
                    continue;
                }
                
                localStorage.removeItem(key);
                keysRemoved.push(key);
            }
        }
        
        cleanupPerformed = true;
        
        if (keysRemoved.length > 0) {
            console.info(
                `[cleanupLegacyLocalData] Removed ${keysRemoved.length} legacy keys:`,
                keysRemoved
            );
        } else {
            console.info('[cleanupLegacyLocalData] No legacy keys found to remove');
        }
        
        return { cleaned: true, keysRemoved };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[cleanupLegacyLocalData] Error during cleanup:', error);
        return { cleaned: false, keysRemoved: [], error: message };
    }
}

/**
 * Check if cleanup has already been performed this session
 */
export function isCleanupPerformed(): boolean {
    return cleanupPerformed;
}

/**
 * Reset the cleanup flag (for testing purposes only)
 */
export function resetCleanupFlag(): void {
    cleanupPerformed = false;
}
