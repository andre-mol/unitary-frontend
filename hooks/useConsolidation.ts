/**
 * useConsolidation Hook
 * 
 * Implements the lazy consolidation pattern (similar to Investidor10/Kinvo).
 * Consolidates user portfolios on first access of the day to save resources.
 * 
 * @see docs/PLAN-performance-optimization.md - Problem 8
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../config/supabase';

const CONSOLIDATION_KEY = 'patrio_last_consolidated';

interface ConsolidationResult {
    status: 'consolidated' | 'already_consolidated' | 'error' | 'skipped';
    portfolios_updated?: number;
    snapshots_created?: number;
    date?: string;
    message?: string;
}

interface UseConsolidationReturn {
    consolidate: () => Promise<ConsolidationResult>;
    isConsolidating: boolean;
    lastConsolidatedDate: string | null;
    forceConsolidate: () => Promise<ConsolidationResult>;
}

/**
 * Checks if consolidation is needed (not done today)
 */
function needsConsolidation(): boolean {
    if (typeof window === 'undefined') return false;

    const today = new Date().toISOString().split('T')[0];
    const lastConsolidated = localStorage.getItem(CONSOLIDATION_KEY);

    return lastConsolidated !== today;
}

/**
 * Records that consolidation was done today
 */
function markConsolidated(): void {
    if (typeof window === 'undefined') return;

    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(CONSOLIDATION_KEY, today);
}

/**
 * Clears the consolidation cache (for testing or forced refresh)
 */
export function clearConsolidationCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CONSOLIDATION_KEY);
}

/**
 * Hook for portfolio consolidation on first daily access
 */
export function useConsolidation(): UseConsolidationReturn {
    const [isConsolidating, setIsConsolidating] = useState(false);
    const [lastConsolidatedDate, setLastConsolidatedDate] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const consolidationPromiseRef = useRef<Promise<ConsolidationResult> | null>(null);

    // Load last consolidated date on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setLastConsolidatedDate(localStorage.getItem(CONSOLIDATION_KEY));
        }
    }, []);

    /**
     * Performs the actual consolidation via RPC
     */
    const performConsolidation = useCallback(async (force: boolean = false): Promise<ConsolidationResult> => {
        // Skip if already consolidated today (unless forced)
        if (!force && !needsConsolidation()) {
            return { status: 'already_consolidated' };
        }

        // Prevent duplicate calls - reuse existing promise
        if (consolidationPromiseRef.current && !force) {
            return consolidationPromiseRef.current;
        }

        const consolidationLogic = async (): Promise<ConsolidationResult> => {
            setIsConsolidating(true);

            try {
                const supabase = getSupabaseClient();
                const { data, error } = await supabase.rpc('consolidate_user_portfolios', {
                    p_force: force
                });

                if (error) {
                    console.error('[useConsolidation] RPC error:', error);
                    return { status: 'error', message: error.message };
                }

                const result = data as ConsolidationResult;

                // Mark as consolidated in localStorage
                if (result.status === 'consolidated' || result.status === 'already_consolidated') {
                    markConsolidated();
                    setLastConsolidatedDate(new Date().toISOString().split('T')[0]);

                    // Invalidate relevant queries to force refresh with new data
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
                        queryClient.invalidateQueries({ queryKey: ['evolution'] }),
                        queryClient.invalidateQueries({ queryKey: ['global-rollup-overview'] }),
                        queryClient.invalidateQueries({ queryKey: ['portfolio-details'] }),
                        queryClient.invalidateQueries({ queryKey: ['dashboard-historico'] }),
                    ]);
                }

                console.log('[useConsolidation] Result:', result);
                return result;

            } catch (err) {
                console.error('[useConsolidation] Unexpected error:', err);
                return {
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Unknown error'
                };
            } finally {
                setIsConsolidating(false);
                consolidationPromiseRef.current = null;
            }
        };

        consolidationPromiseRef.current = consolidationLogic();
        return consolidationPromiseRef.current;
    }, [queryClient]);

    /**
     * Normal consolidation - skips if already done today
     */
    const consolidate = useCallback(() => {
        return performConsolidation(false);
    }, [performConsolidation]);

    /**
     * Force consolidation - always runs regardless of today's status
     */
    const forceConsolidate = useCallback(() => {
        clearConsolidationCache();
        return performConsolidation(true);
    }, [performConsolidation]);

    return {
        consolidate,
        isConsolidating,
        lastConsolidatedDate,
        forceConsolidate,
    };
}

export default useConsolidation;
