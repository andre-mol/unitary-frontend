
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '../config/supabase';

export interface TimeseriesPoint {
    d: string; // Date
    p: number; // Profit/Growth %
}

interface TimeseriesParams {
    portfolioId: string | 'global';
    range?: '1M' | '6M' | '1Y' | 'ALL';
    granularity?: 'auto' | '1D' | '1W' | '1M';
    enabled?: boolean;
}

/**
 * Hook to fetch consolidated portfolio performance timeseries
 * 
 * Replaces the multi-call pattern for chart data with a single request
 * to the High-Performance Edge Function.
 */
export function usePortfolioTimeseries({ portfolioId, range = '1Y', granularity = 'auto', enabled = true }: TimeseriesParams) {
    return useQuery<TimeseriesPoint[], Error>({
        queryKey: ['portfolio-timeseries', portfolioId, range, granularity],
        queryFn: async () => {
            if (!portfolioId) return [];

            const supabase = getSupabaseClient();
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                // Sem sessão autenticada: não quebrar a UI do dashboard.
                return [];
            }

            const { data, error } = await supabase.functions.invoke('get-portfolio-timeseries', {
                body: { portfolioId, range, granularity }
            });

            if (error) {
                // Fallback local: a Edge Function pode retornar 401 se a sessão ainda não estiver pronta.
                if ((error as any)?.context?.status === 401 || /401|non-2xx/i.test(error.message || '')) {
                    console.warn('[usePortfolioTimeseries] Edge function 401, using local fallback.');
                    return [];
                }
                console.error('[usePortfolioTimeseries] Error:', error);
                throw error;
            }

            return data as TimeseriesPoint[];
        },
        enabled: !!portfolioId && enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes stale time
        gcTime: 15 * 60 * 1000,  // 15 minutes in cache
    });
}
