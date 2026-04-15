/**
 * KpiDrilldownModal - Modal showing detailed breakdown for a selected KPI
 * Displays year/month selectors, charts, and detailed tables
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Wallet, Activity, ArrowUpRight, ArrowDownRight, Loader2, ChevronDown } from 'lucide-react';
import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, BarChart, Cell, LineChart
} from 'recharts';
import { useAuth } from '../../auth/AuthProvider';
import { queryKeys } from '../../../lib/queryKeys';
import {
    getYearBudgets,
    getYearExpenses,
    getYearIncomeEvents,
    aggregateMonthData,
    aggregateExpensesByCategory,
    aggregatePassiveIncomeByType,
    type MonthData,
    type ExpenseCategoryData,
    type PassiveIncomeByType
} from '../../../lib/queries/kpiDrilldown';
import {
    ensureCurrentMonthSnapshot,
    getWealthYearSeries,
    getWealthMonthBreakdown,
    getWealthYearTotalsFromBreakdowns,
    selfHealZeroWealthSnapshots,
    getAvailableYears,
    toMonthKey,
    mergeFullYearWithSnapshots,
    type WealthYearSeriesItem,
    type WealthMonthBreakdown,
    type WealthYearSeriesItemWithStatus
} from '../../../lib/queries/wealthSnapshots';
import { formatCurrency } from '../../../utils/formatters';
import { env } from '../../../config/env';
import type { Expense } from '../../../lib/planningService';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

export type KpiType = 'netWorth' | 'monthResult' | 'revenues' | 'expenses';

interface KpiDrilldownModalProps {
    open: boolean;
    onClose: () => void;
    kpi: KpiType;
    initialYear?: number;
    initialMonth?: string | null;
    currency?: string;
    currentNetWorth?: number;
}

const KPI_CONFIG: Record<KpiType, { label: string; icon: React.ReactNode; subtitle: string }> = {
    netWorth: {
        label: 'Patrimônio Total',
        icon: <Wallet size={24} className="text-amber-500" />,
        subtitle: 'Evolução do patrimônio ao longo do tempo'
    },
    monthResult: {
        label: 'Resultado do Mês',
        icon: <Activity size={24} className="text-emerald-500" />,
        subtitle: 'Receitas menos despesas do período'
    },
    revenues: {
        label: 'Receitas Totais',
        icon: <ArrowUpRight size={24} className="text-blue-500" />,
        subtitle: 'Total de receitas registradas'
    },
    expenses: {
        label: 'Despesas Totais',
        icon: <ArrowDownRight size={24} className="text-red-500" />,
        subtitle: 'Total de despesas registradas'
    }
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const KpiDrilldownModal: React.FC<KpiDrilldownModalProps> = ({
    open,
    onClose,
    kpi,
    initialYear,
    initialMonth = null,
    currency = 'BRL',
    currentNetWorth = 0
}) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const currentYear = new Date().getFullYear();
    const currentMonthKey = toMonthKey(currentYear, new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear || currentYear);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(initialMonth);
    const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);
    const [netWorthRepairAttempts, setNetWorthRepairAttempts] = useState<number[]>([]);

    // Only fetch data for monthResult, revenues, and expenses
    const shouldFetchData = kpi !== 'netWorth';

    // Mutation para garantir snapshot do mês atual (apenas para netWorth)
    const ensureCurrentMonthSnapshotMutation = useMutation({
        mutationFn: ensureCurrentMonthSnapshot,
        onSuccess: () => {
            // Invalidar query da série anual para recarregar dados atualizados
            queryClient.invalidateQueries({ queryKey: queryKeys.wealthYearSeries(selectedYear) });
        },
        // Não mostrar erro se snapshot já existe/finalizado (não é crítico)
        onError: (error) => {
            // Silenciosamente ignorar erros de snapshot já finalizado
            if (!error.message.includes('finalized') && !error.message.includes('final')) {
                // Apenas logar outros erros, mas não bloquear UI
            }
        }
    });

    const repairZeroSnapshotsMutation = useMutation({
        mutationFn: (year: number) => selfHealZeroWealthSnapshots(year),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.wealthYearSeries(selectedYear) });
            if (selectedMonth) {
                queryClient.invalidateQueries({ queryKey: queryKeys.wealthBreakdown(selectedMonth) });
            }
        }
    });

    // React Query hooks para netWorth (snapshots)
    const wealthYearSeriesQuery = useQuery({
        queryKey: queryKeys.wealthYearSeries(selectedYear),
        queryFn: () => getWealthYearSeries(selectedYear),
        enabled: kpi === 'netWorth' && open && !!user,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });

    const wealthPreviousYearSeriesQuery = useQuery({
        queryKey: queryKeys.wealthYearSeries(selectedYear - 1),
        queryFn: () => getWealthYearSeries(selectedYear - 1),
        enabled: kpi === 'netWorth' && open && !!user,
        staleTime: 2 * 60 * 1000,
    });

    const wealthBreakdownQuery = useQuery({
        queryKey: queryKeys.wealthBreakdown(selectedMonth || ''),
        queryFn: () => getWealthMonthBreakdown(selectedMonth!),
        enabled: kpi === 'netWorth' && open && !!user && selectedMonth !== null,
        staleTime: 2 * 60 * 1000,
    });

    const shouldUseNetWorthBreakdownFallback = useMemo(() => {
        if (kpi !== 'netWorth' || !wealthYearSeriesQuery.data || wealthYearSeriesQuery.data.length === 0) {
            return false;
        }

        const snapshotsWithValue = wealthYearSeriesQuery.data.filter((item) => Number(item.total_value || 0) > 0);
        return snapshotsWithValue.length === 0;
    }, [kpi, wealthYearSeriesQuery.data]);

    const hasRepairableZeroSnapshots = useMemo(() => {
        if (kpi !== 'netWorth' || !wealthYearSeriesQuery.data || wealthYearSeriesQuery.data.length === 0) {
            return false;
        }

        return wealthYearSeriesQuery.data.some((item) =>
            item.is_final === true && Number(item.total_value || 0) === 0
        );
    }, [kpi, wealthYearSeriesQuery.data]);

    const wealthYearTotalsFallbackQuery = useQuery({
        queryKey: ['wealth-year-totals-fallback', selectedYear],
        queryFn: () => getWealthYearTotalsFromBreakdowns(selectedYear),
        enabled: kpi === 'netWorth' && open && !!user && shouldUseNetWorthBreakdownFallback,
        staleTime: 2 * 60 * 1000,
    });

    // Garantir snapshot do mês atual ao abrir modal para netWorth
    useEffect(() => {
        if (open && kpi === 'netWorth' && user) {
            ensureCurrentMonthSnapshotMutation.mutate();
        }
    }, [open, kpi, user]);

    // Resetar mês selecionado se não pertencer ao ano atual (apenas para netWorth)
    useEffect(() => {
        if (kpi === 'netWorth' && selectedMonth && selectedMonth !== null) {
            const monthYear = parseInt(selectedMonth.split('-')[0]);
            if (monthYear !== selectedYear) {
                setSelectedMonth(null);
            }
        }
    }, [selectedYear, kpi]);

    useEffect(() => {
        if (!open) {
            setDrilldownMonth(null);
            setNetWorthRepairAttempts([]);
            return;
        }

        if (drilldownMonth && !drilldownMonth.startsWith(`${selectedYear}-`)) {
            setDrilldownMonth(null);
        }
    }, [open, selectedYear, drilldownMonth]);

    useEffect(() => {
        if (
            kpi !== 'netWorth' ||
            !open ||
            !user ||
            wealthYearSeriesQuery.isLoading ||
            repairZeroSnapshotsMutation.isPending ||
            !hasRepairableZeroSnapshots
        ) {
            return;
        }

        if (netWorthRepairAttempts.includes(selectedYear)) {
            return;
        }

        setNetWorthRepairAttempts((prev) => [...prev, selectedYear]);
        repairZeroSnapshotsMutation.mutate(selectedYear);
    }, [
        kpi,
        open,
        user,
        selectedYear,
        wealthYearSeriesQuery.isLoading,
        repairZeroSnapshotsMutation.isPending,
        hasRepairableZeroSnapshots,
        netWorthRepairAttempts,
    ]);

    // Listen for budget/expense updates from portfolioService syncs
    useEffect(() => {
        if (!open) return;

        const handleBudgetUpdate = () => {
            // Invalidate all related queries for the current year
            queryClient.invalidateQueries({
                queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `expenses-${kpi}`)
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `income-${kpi}`)
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `budgets-${kpi}`)
            });
        };

        window.addEventListener('supabase-budget-update', handleBudgetUpdate);
        window.addEventListener('patrio_budget_updated', handleBudgetUpdate);

        return () => {
            window.removeEventListener('supabase-budget-update', handleBudgetUpdate);
            window.removeEventListener('patrio_budget_updated', handleBudgetUpdate);
        };
    }, [open, user?.id, selectedYear, kpi, queryClient]);


    // React Query hooks para outros KPIs
    const budgetsQuery = useQuery({
        queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `budgets-${kpi}`),
        queryFn: () => getYearBudgets(selectedYear),
        enabled: shouldFetchData && open && !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const expensesQuery = useQuery({
        queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `expenses-${kpi}`),
        queryFn: () => getYearExpenses(selectedYear),
        enabled: shouldFetchData && open && !!user,
        staleTime: 5 * 60 * 1000,
    });

    const incomeEventsQuery = useQuery({
        queryKey: queryKeys.kpiDrilldown(user?.id, selectedYear, `income-${kpi}`),
        queryFn: () => getYearIncomeEvents(selectedYear),
        enabled: shouldFetchData && open && !!user,
        staleTime: 5 * 60 * 1000,
    });

    // Aggregate month data
    const monthData = useMemo<MonthData[]>(() => {
        if (!shouldFetchData || !budgetsQuery.data || !expensesQuery.data || !incomeEventsQuery.data) {
            return [];
        }
        return aggregateMonthData(selectedYear, budgetsQuery.data, expensesQuery.data, incomeEventsQuery.data);
    }, [selectedYear, budgetsQuery.data, expensesQuery.data, incomeEventsQuery.data, shouldFetchData]);

    // Get selected month data (para outros KPIs, não netWorth)
    const selectedMonthData = useMemo(() => {
        if (!selectedMonth || !monthData.length) return null;
        // selectedMonth já é 'YYYY-MM' completo (monthOptions sempre retorna esse formato)
        return monthData.find(m => m.month === selectedMonth) || null;
    }, [selectedMonth, monthData]);

    // Get expenses for selected month (para outros KPIs)
    const selectedMonthExpenses = useMemo<Expense[]>(() => {
        if (!selectedMonth || !expensesQuery.data) return [];
        // selectedMonth já é 'YYYY-MM' completo (monthOptions sempre retorna esse formato)
        return expensesQuery.data.get(selectedMonth) || [];
    }, [selectedMonth, expensesQuery.data]);

    // Get income events for selected month (para outros KPIs)
    const selectedMonthIncomeEvents = useMemo(() => {
        if (!selectedMonth || !incomeEventsQuery.data) return [];
        // selectedMonth já é 'YYYY-MM' completo (monthOptions sempre retorna esse formato)
        return incomeEventsQuery.data.filter(event => {
            const eventDate = event.date.split('T')[0];
            return eventDate.startsWith(selectedMonth);
        });
    }, [selectedMonth, incomeEventsQuery.data]);

    // Aggregate expenses by category for selected month
    const expensesByCategory = useMemo<ExpenseCategoryData[]>(() => {
        return aggregateExpensesByCategory(selectedMonthExpenses);
    }, [selectedMonthExpenses]);

    // Aggregate passive income by type for selected month
    const passiveIncomeByType = useMemo<PassiveIncomeByType[]>(() => {
        return aggregatePassiveIncomeByType(selectedMonthIncomeEvents);
    }, [selectedMonthIncomeEvents]);

    const drilldownMonthData = useMemo(() => {
        if (!drilldownMonth || !monthData.length) return null;
        return monthData.find((m) => m.month === drilldownMonth) || null;
    }, [drilldownMonth, monthData]);

    const drilldownMonthExpenses = useMemo<Expense[]>(() => {
        if (!drilldownMonth || !expensesQuery.data) return [];
        return expensesQuery.data.get(drilldownMonth) || [];
    }, [drilldownMonth, expensesQuery.data]);

    const drilldownMonthIncomeEvents = useMemo(() => {
        if (!drilldownMonth || !incomeEventsQuery.data) return [];
        return incomeEventsQuery.data.filter(event => {
            const eventDate = event.date.split('T')[0];
            return eventDate.startsWith(drilldownMonth);
        });
    }, [drilldownMonth, incomeEventsQuery.data]);

    const drilldownExpensesByCategory = useMemo<ExpenseCategoryData[]>(() => {
        return aggregateExpensesByCategory(drilldownMonthExpenses);
    }, [drilldownMonthExpenses]);

    const drilldownPassiveIncomeByType = useMemo<PassiveIncomeByType[]>(() => {
        return aggregatePassiveIncomeByType(drilldownMonthIncomeEvents);
    }, [drilldownMonthIncomeEvents]);

    const drilldownChartData = useMemo(() => {
        if (!drilldownMonthData) return [] as Array<{
            name: string;
            value: number;
            absValue: number;
            kind: 'income' | 'expense';
            group: 'Receitas' | 'Despesas';
            color: string;
        }>;

        const rows: Array<{
            name: string;
            value: number;
            absValue: number;
            kind: 'income' | 'expense';
            group: 'Receitas' | 'Despesas';
            color: string;
        }> = [];

        if (kpi !== 'expenses' && drilldownMonthData.salary > 0) {
            rows.push({
                name: 'Salário',
                value: drilldownMonthData.salary,
                absValue: drilldownMonthData.salary,
                kind: 'income',
                group: 'Receitas',
                color: '#3b82f6'
            });
        }

        if (kpi !== 'expenses') {
            drilldownPassiveIncomeByType
                .filter((item) => item.total > 0)
                .forEach((item) => {
                    rows.push({
                        name: item.label,
                        value: item.total,
                        absValue: item.total,
                        kind: 'income',
                        group: 'Receitas',
                        color: '#10b981'
                    });
                });
        }

        if (kpi !== 'revenues') {
            drilldownExpensesByCategory
                .filter((item) => item.total > 0)
                .forEach((item) => {
                    rows.push({
                        name: item.category,
                        value: kpi === 'expenses' ? item.total : -item.total,
                        absValue: item.total,
                        kind: 'expense',
                        group: 'Despesas',
                        color: '#ef4444'
                    });
                });
        }

        return rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }, [drilldownMonthData, drilldownPassiveIncomeByType, drilldownExpensesByCategory, kpi]);

    // Top expenses for selected month
    const topExpenses = useMemo(() => {
        return [...selectedMonthExpenses]
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [selectedMonthExpenses]);

    // Chart data for year view
    const chartData = useMemo(() => {
        return monthData.map(m => {
            const monthNum = parseInt(m.month.split('-')[1]);
            return {
                month: MONTH_NAMES[monthNum - 1],
                monthFull: m.month,
                net: m.net,
                revenues: m.revenuesTotal,
                expenses: m.expensesTotal,
                salary: m.salary,
                passiveIncome: m.passiveIncomeTotal,
            };
        });
    }, [monthData]);

    const isLoading = budgetsQuery.isLoading || expensesQuery.isLoading || incomeEventsQuery.isLoading;
    const hasError = budgetsQuery.isError || expensesQuery.isError || incomeEventsQuery.isError;

    // Loading/error states para netWorth
    const isNetWorthLoading = wealthYearSeriesQuery.isLoading ||
        wealthPreviousYearSeriesQuery.isLoading ||
        repairZeroSnapshotsMutation.isPending ||
        wealthYearTotalsFallbackQuery.isLoading ||
        (selectedMonth !== null && wealthBreakdownQuery.isLoading);
    const hasNetWorthError = wealthYearSeriesQuery.isError ||
        wealthPreviousYearSeriesQuery.isError ||
        wealthYearTotalsFallbackQuery.isError ||
        (selectedMonth !== null && wealthBreakdownQuery.isError);

    // Calcular variação MoM para série anual de netWorth (com dados mesclados para 12 meses)
    const netWorthWithMomChange = useMemo(() => {
        if (kpi !== 'netWorth' || !wealthYearSeriesQuery.data) {
            return [];
        }

        // Mesclar dados completos do ano com snapshots retornados
        const fallbackTotals = wealthYearTotalsFallbackQuery.data;
        const mergedData = mergeFullYearWithSnapshots(selectedYear, wealthYearSeriesQuery.data)
            .map((item) => {
                if (!item.hasSnapshot) return item;
                if (
                    selectedYear === currentYear &&
                    item.month === currentMonthKey &&
                    !item.is_final &&
                    currentNetWorth > 0
                ) {
                    return {
                        ...item,
                        total_value: currentNetWorth,
                    };
                }

                const fallbackTotal = Number(fallbackTotals?.get(item.month) || 0);
                const currentTotal = Number(item.total_value || 0);

                if (currentTotal > 0 || fallbackTotal <= 0) {
                    return item;
                }

                return {
                    ...item,
                    total_value: fallbackTotal,
                };
            });

        const previousYearMerged = mergeFullYearWithSnapshots(
            selectedYear - 1,
            wealthPreviousYearSeriesQuery.data || []
        );
        const snapshotByMonth = new Map<string, WealthYearSeriesItemWithStatus>();
        previousYearMerged.forEach((s) => snapshotByMonth.set(s.month, s));
        mergedData.forEach((s) => snapshotByMonth.set(s.month, s));

        const getPreviousMonthKey = (monthKey: string) => {
            const [yearStr, monthStr] = monthKey.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            return month === 1
                ? `${year - 1}-12`
                : `${year}-${String(month - 1).padStart(2, '0')}`;
        };

        return mergedData.map((item) => {
            const previousItem = snapshotByMonth.get(getPreviousMonthKey(item.month)) || null;

            // Só calcular MoM quando ambos os meses têm snapshot
            const momChange = previousItem && previousItem.hasSnapshot && item.hasSnapshot && previousItem.total_value > 0
                ? ((item.total_value - previousItem.total_value) / previousItem.total_value) * 100
                : null;

            return {
                ...item,
                momChange
            };
        });
    }, [kpi, wealthYearSeriesQuery.data, wealthPreviousYearSeriesQuery.data, selectedYear, currentYear, currentMonthKey, currentNetWorth, wealthYearTotalsFallbackQuery.data]);

    // Chart data para netWorth (série anual com dados mesclados)
    const netWorthChartData = useMemo(() => {
        if (kpi !== 'netWorth' || !wealthYearSeriesQuery.data) {
            return [];
        }

        // Mesclar dados completos do ano com snapshots retornados
        const fallbackTotals = wealthYearTotalsFallbackQuery.data;
        const mergedData = mergeFullYearWithSnapshots(selectedYear, wealthYearSeriesQuery.data)
            .map((item) => {
                if (!item.hasSnapshot) return item;
                if (
                    selectedYear === currentYear &&
                    item.month === currentMonthKey &&
                    !item.is_final &&
                    currentNetWorth > 0
                ) {
                    return {
                        ...item,
                        total_value: currentNetWorth,
                    };
                }

                const fallbackTotal = Number(fallbackTotals?.get(item.month) || 0);
                const currentTotal = Number(item.total_value || 0);

                if (currentTotal > 0 || fallbackTotal <= 0) {
                    return item;
                }

                return {
                    ...item,
                    total_value: fallbackTotal,
                };
            });

        return mergedData.map(item => {
            const monthNum = parseInt(item.month.split('-')[1]);
            return {
                month: MONTH_NAMES[monthNum - 1],
                monthFull: item.month,
                // Usar null para meses sem snapshot (Recharts mostrará gap)
                total_value: item.hasSnapshot ? item.total_value : null,
            };
        });
    }, [kpi, wealthYearSeriesQuery.data, selectedYear, currentYear, currentMonthKey, currentNetWorth, wealthYearTotalsFallbackQuery.data]);

    // Handle ESC key to close modal
    useEffect(() => {
        if (!open) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, onClose]);

    // React Query hook for available years
    const availableYearsQuery = useQuery({
        queryKey: queryKeys.availableYears(),
        queryFn: getAvailableYears,
        enabled: open && !!user,
        staleTime: 5 * 60 * 1000,
    });

    // Generate year options from query or fallback
    const yearOptions = availableYearsQuery.data || Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Generate month options - valores são 'YYYY-MM' baseados em selectedYear
    const monthOptions = useMemo(() => {
        const options: { value: string | null; label: string }[] = [
            { value: null, label: 'Todos os meses' }
        ];

        for (let m = 1; m <= 12; m++) {
            const monthKey = toMonthKey(selectedYear, m);
            options.push({
                value: monthKey,
                label: MONTH_NAMES[m - 1]
            });
        }

        return options;
    }, [selectedYear]);

    const config = KPI_CONFIG[kpi];

    // Custom tooltip for charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Verificar se o valor é null (mês sem snapshot)
            const value = payload[0]?.value;
            if (value === null || value === undefined) {
                return (
                    <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl">
                        <p className="text-zinc-400 text-xs mb-2 font-bold">{label}</p>
                        <p className="text-xs text-zinc-500">Sem snapshot</p>
                    </div>
                );
            }

            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl">
                    <p className="text-zinc-400 text-xs mb-2 font-bold">{label}</p>
                    {payload.map((entry: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 mb-1 last:mb-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs text-zinc-300">
                                {entry.name}: <span className="font-mono font-bold text-white">{formatCurrency(entry.value, currency)}</span>
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const DrilldownTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || payload.length === 0) return null;
        const point = payload[0]?.payload;
        if (!point) return null;

        return (
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl">
                <p className="text-zinc-400 text-xs mb-2 font-bold">{label}</p>
                <p className="text-xs text-zinc-300">
                    {point.group}: <span className="font-mono font-bold text-white">{formatCurrency(point.absValue, currency)}</span>
                </p>
            </div>
        );
    };

    const renderMonthDrilldownModal = () => {
        if (!drilldownMonth || !drilldownMonthData || kpi === 'netWorth') return null;

        const monthNum = parseInt(drilldownMonth.split('-')[1], 10);
        const monthLabel = `${MONTH_NAMES[monthNum - 1]}/${drilldownMonth.split('-')[0]}`;
        const showRevenues = kpi !== 'expenses';
        const showExpenses = kpi !== 'revenues';

        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm"
                    onClick={() => setDrilldownMonth(null)}
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                            <div>
                                <h4 className="text-white font-bold text-lg">Detalhamento de {monthLabel}</h4>
                                <p className="text-zinc-500 text-xs mt-1">Origem detalhada de receitas e gastos do mês</p>
                            </div>
                            <button
                                onClick={() => setDrilldownMonth(null)}
                                className="text-zinc-500 hover:text-white transition-colors rounded p-1"
                                aria-label="Fechar detalhamento do mês"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(85vh-72px)]">
                            <div className={`grid gap-3 ${kpi === 'monthResult' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                {showRevenues && (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <p className="text-zinc-500 text-xs mb-1">Receitas</p>
                                        <p className="text-white font-mono font-bold text-lg">{formatCurrency(drilldownMonthData.revenuesTotal, currency)}</p>
                                    </div>
                                )}
                                {showExpenses && (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <p className="text-zinc-500 text-xs mb-1">Despesas</p>
                                        <p className="text-white font-mono font-bold text-lg">{formatCurrency(drilldownMonthData.expensesTotal, currency)}</p>
                                    </div>
                                )}
                                {kpi === 'monthResult' && (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <p className="text-zinc-500 text-xs mb-1">Resultado</p>
                                        <p className={`font-mono font-bold text-lg ${drilldownMonthData.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {drilldownMonthData.net >= 0 ? '+' : ''}{formatCurrency(drilldownMonthData.net, currency)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                <h5 className="text-white font-semibold text-sm mb-3">Composição detalhada</h5>
                                <div className="h-[320px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={drilldownChartData}
                                            layout="vertical"
                                            margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                            <XAxis
                                                type="number"
                                                stroke="#52525b"
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(val) => `${val < 0 ? '-' : ''}${Math.abs(val / 1000).toFixed(0)}k`}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                stroke="#a1a1aa"
                                                fontSize={11}
                                                width={110}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip content={<DrilldownTooltip />} />
                                            <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                                                {drilldownChartData.map((entry, idx) => (
                                                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {showRevenues && (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <h5 className="text-white font-semibold text-sm mb-3">Receitas por origem</h5>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                                                <span className="text-zinc-300 text-sm">Salário</span>
                                                <span className="text-white font-mono text-sm">{formatCurrency(drilldownMonthData.salary, currency)}</span>
                                            </div>
                                            {drilldownPassiveIncomeByType.map((item) => (
                                                <div key={item.type} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                    <span className="text-zinc-300 text-sm">{item.label}</span>
                                                    <span className="text-white font-mono text-sm">{formatCurrency(item.total, currency)}</span>
                                                </div>
                                            ))}
                                            {drilldownMonthData.revenuesTotal === 0 && (
                                                <p className="text-zinc-500 text-xs">Nenhuma receita no mês.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {showExpenses && (
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                        <h5 className="text-white font-semibold text-sm mb-3">Gastos por categoria</h5>
                                        <div className="space-y-2">
                                            {drilldownExpensesByCategory.map((item) => (
                                                <div key={item.category} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                    <span className="text-zinc-300 text-sm">{item.category}</span>
                                                    <span className="text-white font-mono text-sm">{formatCurrency(item.total, currency)}</span>
                                                </div>
                                            ))}
                                            {drilldownMonthData.expensesTotal === 0 && (
                                                <p className="text-zinc-500 text-xs">Nenhuma despesa no mês.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {drilldownMonthExpenses.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <h5 className="text-white font-semibold text-sm mb-3">Lançamentos de despesas</h5>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {drilldownMonthExpenses
                                            .slice()
                                            .sort((a, b) => b.value - a.value)
                                            .map((expense) => (
                                                <div key={expense.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                    <div className="min-w-0 pr-3">
                                                        <p className="text-zinc-300 text-sm truncate">{expense.name}</p>
                                                        <p className="text-zinc-600 text-xs">{expense.category}</p>
                                                    </div>
                                                    <span className="text-white font-mono text-sm">{formatCurrency(expense.value, currency)}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    };

    const renderContent = () => {
        if (kpi === 'netWorth') {
            // Renderização específica para netWorth usando snapshots
            if (isNetWorthLoading) {
                return (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-amber-500" size={32} />
                    </div>
                );
            }

            if (hasNetWorthError) {
                // Capturar erros específicos das queries
                const yearError = wealthYearSeriesQuery.error as Error & {
                    details?: string;
                    hint?: string;
                    code?: string;
                    status?: number;
                };
                const breakdownError = wealthBreakdownQuery.error as Error & {
                    details?: string;
                    hint?: string;
                    code?: string;
                    status?: number;
                };
                const activeError = selectedMonth !== null ? breakdownError : yearError;

                return (
                    <div className="text-center py-12 space-y-4">
                        <p className="text-red-500 text-sm">Erro ao carregar dados de patrimônio. Tente novamente.</p>

                        {/* Detalhes técnicos apenas em DEV */}
                        {env.isDevelopment && activeError && (
                            <details className="mt-4 text-left max-w-2xl mx-auto">
                                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
                                    Detalhes técnicos (DEV)
                                </summary>
                                <div className="mt-2 p-3 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-zinc-400 space-y-1">
                                    <div><span className="text-zinc-500">RPC:</span> {selectedMonth !== null ? 'patrio_get_wealth_month_breakdown' : 'patrio_get_wealth_year_series'}</div>
                                    {activeError.message && (
                                        <div><span className="text-zinc-500">Mensagem:</span> {activeError.message}</div>
                                    )}
                                    {activeError.code && (
                                        <div><span className="text-zinc-500">Código:</span> {activeError.code}</div>
                                    )}
                                    {activeError.status && (
                                        <div><span className="text-zinc-500">Status HTTP:</span> {activeError.status}</div>
                                    )}
                                    {activeError.details && (
                                        <div><span className="text-zinc-500">Detalhes:</span> {activeError.details}</div>
                                    )}
                                    {activeError.hint && (
                                        <div><span className="text-zinc-500">Dica:</span> {activeError.hint}</div>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                );
            }

            if (selectedMonth) {
                // Visão mensal: mostrar breakdown
                const breakdown = wealthBreakdownQuery.data;

                if (!breakdown || !breakdown.snapshot_exists) {
                    return (
                        <div className="text-center py-12">
                            <p className="text-zinc-500 text-sm mb-2">
                                Nenhum snapshot disponível para este mês.
                            </p>
                            <p className="text-zinc-600 text-xs">
                                Execute o backfill ou aguarde a finalização automática do mês.
                            </p>
                        </div>
                    );
                }

                // selectedMonth já é 'YYYY-MM' completo
                const snapshotFromSeries = wealthYearSeriesQuery.data?.find(s => s.month === selectedMonth);
                const breakdownTotal = breakdown.categories.reduce((sum, cat) => sum + Number(cat.total || 0), 0);
                const seriesTotal = Number(snapshotFromSeries?.total_value || 0);
                const totalValue = seriesTotal > 0 ? seriesTotal : breakdownTotal;

                return (
                    <div className="space-y-6">
                        {/* Summary Card */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <p className="text-zinc-500 text-xs mb-1">Patrimônio Total</p>
                            <p className="text-white font-bold text-2xl">
                                {formatCurrency(totalValue, currency)}
                            </p>
                        </div>

                        {/* Categories Table */}
                        {breakdown.categories.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                <h4 className="text-white font-semibold text-sm mb-3">Distribuição por Categoria</h4>
                                <div className="space-y-2">
                                    {breakdown.categories.map((cat) => (
                                        <div key={cat.category} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <span className="text-zinc-300 text-sm">{cat.category}</span>
                                            <span className="text-white font-mono font-medium">{formatCurrency(cat.total, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Portfolios Table */}
                        {breakdown.portfolios.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                <h4 className="text-white font-semibold text-sm mb-3">Distribuição por Portfolio</h4>
                                <div className="space-y-2">
                                    {breakdown.portfolios.map((portfolio) => (
                                        <div key={portfolio.portfolio_id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <span className="text-zinc-300 text-sm">{portfolio.portfolio_id.substring(0, 8)}...</span>
                                            <span className="text-white font-mono font-medium">{formatCurrency(portfolio.total, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Top Items */}
                        {breakdown.top_items.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                <h4 className="text-white font-semibold text-sm mb-3">Principais Itens</h4>
                                <div className="space-y-2">
                                    {breakdown.top_items.map((item, idx) => (
                                        <div key={item.item_id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-zinc-300 text-sm truncate">
                                                    #{idx + 1} - {item.category}
                                                </p>
                                                <p className="text-zinc-600 text-xs">{item.item_id.substring(0, 8)}...</p>
                                            </div>
                                            <span className="text-white font-mono font-medium ml-4">{formatCurrency(item.value, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // Visão anual: gráfico e tabela
            // Sempre mostrar 12 meses (mesmo que alguns não tenham snapshot)
            // Não mostrar mensagem de "sem dados" pois sempre teremos 12 meses para exibir

            return (
                <div className="space-y-6">
                    {/* Chart */}
                    {netWorthChartData.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <h4 className="text-white font-semibold text-sm mb-4">Evolução Mensal do Patrimônio</h4>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={netWorthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="total_value"
                                            name="Patrimônio Total"
                                            stroke="#f59e0b"
                                            strokeWidth={2}
                                            dot={{ fill: '#f59e0b', r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    {netWorthWithMomChange.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-zinc-950 border-b border-zinc-800">
                                        <tr>
                                            <th className="text-left text-xs font-semibold text-zinc-400 px-4 py-3">Mês</th>
                                            <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Total</th>
                                            <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Variação MoM</th>
                                            <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {netWorthWithMomChange.map((item) => {
                                            const monthNum = parseInt(item.month.split('-')[1]);
                                            const monthName = MONTH_NAMES[monthNum - 1];
                                            const hasSnapshot = 'hasSnapshot' in item ? item.hasSnapshot : true; // Fallback para compatibilidade

                                            return (
                                                <tr
                                                    key={item.month}
                                                    className={`transition-colors ${hasSnapshot
                                                        ? 'hover:bg-zinc-800/50 cursor-pointer'
                                                        : 'cursor-default'
                                                        }`}
                                                    onClick={() => {
                                                        // Só permitir clique em meses com snapshot
                                                        if (hasSnapshot) {
                                                            setSelectedMonth(item.month);
                                                        }
                                                    }}
                                                >
                                                    <td className="px-4 py-3 text-sm text-zinc-300">{monthName}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono text-white">
                                                        {hasSnapshot
                                                            ? formatCurrency(item.total_value, currency)
                                                            : <span className="text-zinc-500">—</span>
                                                        }
                                                    </td>
                                                    <td className={`px-4 py-3 text-sm text-right font-mono ${item.momChange === null
                                                        ? 'text-zinc-500'
                                                        : item.momChange >= 0
                                                            ? 'text-emerald-500'
                                                            : 'text-red-500'
                                                        }`}>
                                                        {item.momChange === null
                                                            ? <span>—</span>
                                                            : `${item.momChange >= 0 ? '+' : ''}${item.momChange.toFixed(2)}%`
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right">
                                                        {hasSnapshot ? (
                                                            item.is_final ? (
                                                                <span className="text-xs text-zinc-500">Finalizado</span>
                                                            ) : (
                                                                <span className="text-xs text-amber-500">Provisório</span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-zinc-500">Sem snapshot</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-amber-500" size={32} />
                </div>
            );
        }

        if (hasError) {
            return (
                <div className="text-center py-12">
                    <p className="text-red-500 text-sm">Erro ao carregar dados. Tente novamente.</p>
                </div>
            );
        }

        if (selectedMonth) {
            // Month view: show summary cards and breakdown tables
            return (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {kpi === 'monthResult' && selectedMonthData && (
                            <>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <p className="text-zinc-500 text-xs mb-1">Receitas</p>
                                    <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.revenuesTotal, currency)}</p>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <p className="text-zinc-500 text-xs mb-1">Despesas</p>
                                    <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.expensesTotal, currency)}</p>
                                </div>
                                <div className={`bg-zinc-900 border rounded-lg p-4 ${selectedMonthData.net >= 0 ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                                    <p className="text-zinc-500 text-xs mb-1">Resultado</p>
                                    <p className={`font-bold text-lg ${selectedMonthData.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {selectedMonthData.net >= 0 ? '+' : ''}{formatCurrency(selectedMonthData.net, currency)}
                                    </p>
                                </div>
                            </>
                        )}
                        {kpi === 'revenues' && selectedMonthData && (
                            <>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <p className="text-zinc-500 text-xs mb-1">Salário</p>
                                    <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.salary, currency)}</p>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <p className="text-zinc-500 text-xs mb-1">Renda Passiva</p>
                                    <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.passiveIncomeTotal, currency)}</p>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <p className="text-zinc-500 text-xs mb-1">Total</p>
                                    <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.revenuesTotal, currency)}</p>
                                </div>
                            </>
                        )}
                        {kpi === 'expenses' && selectedMonthData && (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                <p className="text-zinc-500 text-xs mb-1">Total de Despesas</p>
                                <p className="text-white font-bold text-lg">{formatCurrency(selectedMonthData.expensesTotal, currency)}</p>
                            </div>
                        )}
                    </div>

                    {/* Breakdown Tables */}
                    {kpi === 'monthResult' && (
                        <div className="space-y-6">
                            {/* Expenses by Category */}
                            {expensesByCategory.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <h4 className="text-white font-semibold text-sm mb-3">Despesas por Categoria</h4>
                                    <div className="space-y-2">
                                        {expensesByCategory.map((cat) => (
                                            <div key={cat.category} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                <span className="text-zinc-300 text-sm">{cat.category}</span>
                                                <span className="text-white font-mono font-medium">{formatCurrency(cat.total, currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Revenues Breakdown */}
                            {selectedMonthData && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <h4 className="text-white font-semibold text-sm mb-3">Receitas</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                                            <span className="text-zinc-300 text-sm">Salário</span>
                                            <span className="text-white font-mono font-medium">{formatCurrency(selectedMonthData.salary, currency)}</span>
                                        </div>
                                        {passiveIncomeByType.map((item) => (
                                            <div key={item.type} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                <span className="text-zinc-300 text-sm">{item.label}</span>
                                                <span className="text-white font-mono font-medium">{formatCurrency(item.total, currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {kpi === 'revenues' && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                            <h4 className="text-white font-semibold text-sm mb-3">Breakdown de Receitas</h4>
                            <div className="space-y-2">
                                {selectedMonthData && (
                                    <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                                        <span className="text-zinc-300 text-sm">Salário</span>
                                        <span className="text-white font-mono font-medium">{formatCurrency(selectedMonthData.salary, currency)}</span>
                                    </div>
                                )}
                                {passiveIncomeByType.map((item) => (
                                    <div key={item.type} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                        <span className="text-zinc-300 text-sm">{item.label}</span>
                                        <span className="text-white font-mono font-medium">{formatCurrency(item.total, currency)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {kpi === 'expenses' && (
                        <div className="space-y-6">
                            {/* Expenses by Category */}
                            {expensesByCategory.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <h4 className="text-white font-semibold text-sm mb-3">Despesas por Categoria</h4>
                                    <div className="space-y-2">
                                        {expensesByCategory.map((cat) => (
                                            <div key={cat.category} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                <span className="text-zinc-300 text-sm">{cat.category}</span>
                                                <span className="text-white font-mono font-medium">{formatCurrency(cat.total, currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Expenses */}
                            {topExpenses.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                                    <h4 className="text-white font-semibold text-sm mb-3">Maiores Despesas</h4>
                                    <div className="space-y-2">
                                        {topExpenses.map((expense) => (
                                            <div key={expense.id} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-zinc-300 text-sm truncate">{expense.name}</p>
                                                    <p className="text-zinc-600 text-xs">{expense.category}</p>
                                                </div>
                                                <span className="text-white font-mono font-medium ml-4">{formatCurrency(expense.value, currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        // Year view: show chart and table
        return (
            <div className="space-y-6">
                {/* Chart */}
                {chartData.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                        <h4 className="text-white font-semibold text-sm mb-4">
                            {kpi === 'monthResult' && 'Evolução Mensal: Receitas, Despesas e Resultado'}
                            {kpi === 'revenues' && 'Evolução Mensal: Salário vs Renda Passiva'}
                            {kpi === 'expenses' && 'Evolução Mensal: Despesas'}
                        </h4>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                {kpi === 'monthResult' ? (
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Area type="monotone" dataKey="net" name="Resultado" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                                        <Line type="monotone" dataKey="revenues" name="Receitas" stroke="#3b82f6" strokeWidth={2} />
                                        <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" />
                                    </ComposedChart>
                                ) : kpi === 'revenues' ? (
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="salary" name="Salário" stackId="revenues" fill="#3b82f6" />
                                        <Bar dataKey="passiveIncome" name="Renda Passiva" stackId="revenues" fill="#10b981" />
                                    </BarChart>
                                ) : (
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                        <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="expenses" name="Despesas" fill="#ef4444" />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Table */}
                {monthData.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-zinc-950 border-b border-zinc-800">
                                    <tr>
                                        <th className="text-left text-xs font-semibold text-zinc-400 px-4 py-3">Mês</th>
                                        {kpi === 'monthResult' && (
                                            <>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Receitas</th>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Despesas</th>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Resultado</th>
                                            </>
                                        )}
                                        {kpi === 'revenues' && (
                                            <>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Salário</th>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Renda Passiva</th>
                                                <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Total</th>
                                            </>
                                        )}
                                        {kpi === 'expenses' && (
                                            <th className="text-right text-xs font-semibold text-zinc-400 px-4 py-3">Total</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {monthData.map((m) => {
                                        const monthNum = parseInt(m.month.split('-')[1]);
                                        const monthName = MONTH_NAMES[monthNum - 1];
                                        return (
                                            <tr key={m.month} className="hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-4 py-3 text-sm text-zinc-300">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDrilldownMonth(m.month)}
                                                        className="inline-flex items-center gap-2 text-zinc-300 hover:text-white transition-colors group"
                                                        title={`Ver detalhamento de ${monthName}`}
                                                    >
                                                        <span>{monthName}</span>
                                                        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">detalhar</span>
                                                    </button>
                                                </td>
                                                {kpi === 'monthResult' && (
                                                    <>
                                                        <td className="px-4 py-3 text-sm text-right font-mono text-white">{formatCurrency(m.revenuesTotal, currency)}</td>
                                                        <td className="px-4 py-3 text-sm text-right font-mono text-white">{formatCurrency(m.expensesTotal, currency)}</td>
                                                        <td className={`px-4 py-3 text-sm text-right font-mono font-bold ${m.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {m.net >= 0 ? '+' : ''}{formatCurrency(m.net, currency)}
                                                        </td>
                                                    </>
                                                )}
                                                {kpi === 'revenues' && (
                                                    <>
                                                        <td className="px-4 py-3 text-sm text-right font-mono text-white">{formatCurrency(m.salary, currency)}</td>
                                                        <td className="px-4 py-3 text-sm text-right font-mono text-white">{formatCurrency(m.passiveIncomeTotal, currency)}</td>
                                                        <td className="px-4 py-3 text-sm text-right font-mono font-bold text-white">{formatCurrency(m.revenuesTotal, currency)}</td>
                                                    </>
                                                )}
                                                {kpi === 'expenses' && (
                                                    <td className="px-4 py-3 text-sm text-right font-mono font-bold text-white">{formatCurrency(m.expensesTotal, currency)}</td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {chartData.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-zinc-500 text-sm">Nenhum dado disponível para o período selecionado.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col ph-no-capture"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="kpi-modal-title"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
                                <div className="flex items-center gap-3">
                                    {config.icon}
                                    <div>
                                        <h3 id="kpi-modal-title" className="text-white font-bold text-lg">
                                            {config.label}
                                        </h3>
                                        <p className="text-zinc-500 text-xs mt-1">
                                            {config.subtitle}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-zinc-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded p-1"
                                    aria-label="Fechar"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Controls Row */}
                            <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row gap-4">
                                {/* Year Selector */}
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">
                                        Ano
                                    </label>
                                    <DropdownMenu className="w-full">
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all cursor-pointer flex items-center justify-between"
                                            >
                                                <span>{selectedYear}</span>
                                                <ChevronDown size={16} className="text-zinc-500" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-80 max-w-[42vw] max-h-[190px] overflow-y-auto bg-zinc-900 border-zinc-700">
                                            {yearOptions.map((year) => (
                                                <DropdownMenuItem
                                                    key={year}
                                                    onClick={() => setSelectedYear(year)}
                                                    className={selectedYear === year ? 'bg-zinc-800 text-white' : 'text-zinc-300'}
                                                >
                                                    {year}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Month Selector */}
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">
                                        Mês
                                    </label>
                                    <select
                                        value={selectedMonth || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setSelectedMonth(value || null);
                                        }}
                                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                    >
                                        {monthOptions.map(month => (
                                            <option key={month.value || 'all'} value={month.value || ''}>
                                                {month.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {renderContent()}
                            </div>
                        </div>
                    </motion.div>
                    {renderMonthDrilldownModal()}
                </>
            )}
        </AnimatePresence>
    );
};
