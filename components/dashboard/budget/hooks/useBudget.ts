import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { planningService } from '../../../../lib/planningService';
import type { Goal, Expense, Budget } from '../../../../lib/planningService';
import { calculateCategoryStats, calculateTotalPercentage } from '../../../../domain/calculations';
import { useAuth } from '../../../auth/AuthProvider';
import { queryKeys } from '../../../../lib/queryKeys';
import { fetchGoals, fetchBudget, fetchExpenses } from '../../../../lib/queries/planning';
import { timelineService } from '../../../../services/api/timeline';
import type { TimelineEvent } from '../../../../types/timeline';

export function useBudget() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [salary, setSalary] = useState<string>('');
  const [selectedCategoryGoal, setSelectedCategoryGoal] = useState<Goal | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const monthKey = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  }, [currentDate]);

  const displayMonth = useMemo(() => {
    const str = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [currentDate]);

  const enabled = !!user && !authLoading;

  const goalsQuery = useQuery({
    queryKey: queryKeys.goals(user?.id),
    queryFn: fetchGoals,
    enabled,
  });

  const budgetQuery = useQuery<Budget>({
    queryKey: queryKeys.budget(user?.id, monthKey),
    queryFn: () => fetchBudget(monthKey),
    enabled,
    placeholderData: keepPreviousData,
  });

  const expensesQuery = useQuery<Expense[]>({
    queryKey: queryKeys.expenses(user?.id, monthKey),
    queryFn: () => fetchExpenses(monthKey),
    enabled,
    placeholderData: keepPreviousData,
  });

  const investmentEventsQuery = useQuery<TimelineEvent[]>({
    queryKey: ['budget-investment-events', user?.id, monthKey],
    queryFn: () => timelineService.getTimelineEvents(currentDate.getFullYear(), null, 'realized'),
    enabled: enabled && !!goalsQuery.data?.some((goal) => goal.category === 'Investimentos' || goal.category === 'Liberdade Financeira'),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (budgetQuery.data?.salary) {
      setSalary(String(budgetQuery.data.salary));
    } else {
      setSalary('');
    }
  }, [budgetQuery.data?.salary]);

  const handleSalaryChange = async (val: string) => {
    setSalary(val);
    const numVal = parseFloat(val) || 0;
    const nextBudget: Budget = {
      month: monthKey,
      salary: numVal,
      updatedAt: new Date().toISOString(),
    };
    await planningService.saveBudget(nextBudget);
    queryClient.setQueryData(queryKeys.budget(user?.id, monthKey), nextBudget);
  };

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const handleInvest = () => {
    const goals = goalsQuery.data ?? [];
    const investGoal = goals.find((g) => g.category === 'Investimentos' || g.category === 'Liberdade Financeira');
    if (!investGoal) return;

    const numSalary = parseFloat(salary) || 0;
    const investAmount = numSalary * (investGoal.percentage / 100);

    navigate('/dashboard/contributions', { state: { budget: investAmount } });
  };

  const handleOpenCategory = (goal: Goal) => {
    setSelectedCategoryGoal(goal);
    setIsExpenseModalOpen(true);
  };

  const handleCloseExpenseModal = () => {
    setIsExpenseModalOpen(false);
    if (user?.id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(user.id, monthKey) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budget(user.id, monthKey) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals(user.id) });
    }
  };

  const goals = goalsQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const realizedInvestmentAmount = (investmentEventsQuery.data ?? [])
    .filter((event) => event.date.startsWith(monthKey))
    .filter((event) => event.type === 'buy' || event.type === 'capital_call')
    .reduce((sum, event) => sum + Math.abs(Number(event.totalValue || 0)), 0);

  const totalPercentage = calculateTotalPercentage(goals);
  const numSalary = parseFloat(salary) || 0;

  const investmentGoal = goals.find(
    (g) => g.category === 'Investimentos' || g.category === 'Liberdade Financeira'
  );
  const expenseGoals = goals
    .filter((g) => g.id !== investmentGoal?.id)
    .sort((a, b) => b.percentage - a.percentage);

  const getCategoryStats = (category: string, percentage: number) => {
    const baseStats = calculateCategoryStats(category, percentage, numSalary, expenses);

    if (investmentGoal && category === investmentGoal.category) {
      const realized = baseStats.realized + realizedInvestmentAmount;
      const remaining = baseStats.planned - realized;
      return {
        ...baseStats,
        realized,
        remaining,
        percentUsed: baseStats.planned > 0 ? (realized / baseStats.planned) * 100 : 0,
      };
    }

    return baseStats;
  };

  const loading = goalsQuery.isLoading || budgetQuery.isLoading || expensesQuery.isLoading || investmentEventsQuery.isLoading;
  const error =
    goalsQuery.error || budgetQuery.error || expensesQuery.error || investmentEventsQuery.error
      ? 'Erro ao carregar dados'
      : null;

  return {
    loading,
    goals,
    expenses,
    salary,
    monthKey,
    displayMonth,
    selectedCategoryGoal,
    isExpenseModalOpen,
    totalPercentage,
    numSalary,
    investmentGoal,
    expenseGoals,
    handleSalaryChange,
    handleMonthChange,
    handleInvest,
    handleOpenCategory,
    handleCloseExpenseModal,
    getCategoryStats,
    navigate,
    error,
  };
}
