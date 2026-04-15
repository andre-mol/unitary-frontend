/**
 * Query Client Configuration with Optimized staleTime Per Query Type
 * 
 * @see docs/PLAN-performance-optimization.md - Problem 4
 * 
 * staleTime Strategy:
 * - User-specific data (portfolios): 3 min (default)
 * - Historical data (evolution, charts): 30 min (rarely changes)
 * - Public data (benchmarks, indices): 1 hour
 * - Static data (asset info): 2 hours
 */

import { QueryClient } from '@tanstack/react-query';

// ============================================================
// STALE TIME CONSTANTS (in milliseconds)
// ============================================================

export const STALE_TIMES = {
  /** User portfolios, items, etc - changes frequently */
  USER_DATA: 3 * 60 * 1000, // 3 minutes

  /** Historical evolution charts - calculated once, rarely changes */
  HISTORICAL: 30 * 60 * 1000, // 30 minutes

  /** Public benchmarks (CDI, IBOV, etc) - same for all users */
  BENCHMARKS: 60 * 60 * 1000, // 1 hour

  /** Static asset information (symbols, names) */
  STATIC: 2 * 60 * 60 * 1000, // 2 hours

  /** Dashboard bundle - moderate freshness needed */
  DASHBOARD: 5 * 60 * 1000, // 5 minutes
} as const;

// ============================================================
// GC TIME CONSTANTS (in milliseconds)
// ============================================================

export const GC_TIMES = {
  /** Keep in cache while user is active */
  DEFAULT: 45 * 60 * 1000, // 45 minutes

  /** Historical data can stay longer */
  HISTORICAL: 2 * 60 * 60 * 1000, // 2 hours

  /** Benchmarks are public, keep longer */
  BENCHMARKS: 4 * 60 * 60 * 1000, // 4 hours
} as const;

// ============================================================
// QUERY CLIENT CONFIGURATION
// ============================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.USER_DATA,
      gcTime: GC_TIMES.DEFAULT,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ============================================================
// QUERY OPTIONS PRESETS
// Use these with useQuery({ ...QUERY_PRESETS.historical, queryKey: [...], queryFn: ... })
// ============================================================

export const QUERY_PRESETS = {
  /** For evolution charts, historical data */
  historical: {
    staleTime: STALE_TIMES.HISTORICAL,
    gcTime: GC_TIMES.HISTORICAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },

  /** For benchmarks (CDI, IBOV, IPCA) */
  benchmarks: {
    staleTime: STALE_TIMES.BENCHMARKS,
    gcTime: GC_TIMES.BENCHMARKS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },

  /** For static data that almost never changes */
  static: {
    staleTime: STALE_TIMES.STATIC,
    gcTime: GC_TIMES.BENCHMARKS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  },

  /** For dashboard data - balanced freshness */
  dashboard: {
    staleTime: STALE_TIMES.DASHBOARD,
    gcTime: GC_TIMES.DEFAULT,
    refetchOnWindowFocus: false,
  },
} as const;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function clearQueryCache(): void {
  queryClient.clear();
}

/**
 * Invalidates all queries matching a key prefix
 * Useful after mutations that affect multiple queries
 */
export function invalidateQueriesWithPrefix(prefix: string): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith(prefix);
    }
  });
}
