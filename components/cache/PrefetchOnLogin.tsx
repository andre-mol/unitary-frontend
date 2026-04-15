import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { queryKeys } from '../../lib/queryKeys';
import { fetchPortfolios, fetchCategories } from '../../lib/queries/portfolios';
import { fetchProfile, fetchSubscription } from '../../lib/queries/user';
import { fetchGoals, fetchObjectives, fetchBudget, fetchExpenses } from '../../lib/queries/planning';

export function PrefetchOnLogin() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canAccessPlanning } = useSubscription();

  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!user) return;

    void queryClient.prefetchQuery({
      queryKey: queryKeys.me(user.id),
      queryFn: () => fetchProfile(user.id),
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.subscription(user.id),
      queryFn: fetchSubscription,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.portfolios(user.id),
      queryFn: fetchPortfolios,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.categories(user.id),
      queryFn: fetchCategories,
    });

    if (canAccessPlanning) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.goals(user.id),
        queryFn: fetchGoals,
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.objectives(user.id),
        queryFn: fetchObjectives,
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.budget(user.id, monthKey),
        queryFn: () => fetchBudget(monthKey),
      });
      void queryClient.prefetchQuery({
        queryKey: queryKeys.expenses(user.id, monthKey),
        queryFn: () => fetchExpenses(monthKey),
      });
    }
  }, [user, canAccessPlanning, queryClient, monthKey]);

  return null;
}
