import { useQuery } from '@tanstack/react-query';
import { portfolioService } from '../lib/portfolioService';
import { useAuth } from '../components/auth/AuthProvider';

export function usePortfolios() {
    const { user, loading: authLoading } = useAuth();

    const query = useQuery({
        queryKey: ['portfolios', user?.id],
        queryFn: () => portfolioService.getPortfolios(),
        enabled: !!user && !authLoading,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return {
        portfolios: query.data || [],
        loading: query.isLoading,
        error: query.error
    };
}
