
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import {
    TrendingUp, Wallet, ArrowUpRight, ArrowDownRight,
    Activity, PieChart as PieChartIcon, DollarSign,
    CreditCard, Target, AlertTriangle, CheckCircle2,
    Calendar, ArrowRight, Layers, Building2, Briefcase, Flag, ChevronDown, ChevronUp, Star, X
} from 'lucide-react';
import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { env } from '../../config/env';
import { Objective } from '../../lib/planningService';
import { Portfolio, PortfolioEvent, RechartsTooltipProps, RechartsTooltipPayloadEntry } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { StatCard } from './shared/StatCard';
import { calculateTotalExpenses, calculatePeriodResult, calculateProgressPercentage, calculatePreviousValue } from '../../domain/calculations';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../../lib/queryKeys';
import { fetchDashboardBundle } from '../../lib/queries/dashboard';
import { fetchExpenses } from '../../lib/queries/planning';
import { calculateMonthlyResultsForRange } from '../../lib/queries/kpiDrilldown';
import { fetchHistoricoFinanceiroRange, HistoricoFinanceiroData } from '../../lib/queries/historicoFinanceiro';
import { getAvailableYears } from '../../lib/queries/wealthSnapshots';
import { buildRangeMonths } from '../../lib/utils/monthRange';
import { AllocationDetailsModal } from './components/AllocationDetailsModal';
import { KpiDrilldownModal, KpiType } from './overview/KpiDrilldownModal';
import { SubscriptionSuccessModal } from '../subscription/SubscriptionSuccessModal';
import { useConsolidation } from '../../hooks/useConsolidation';
import { STALE_TIMES, GC_TIMES } from '../../lib/queryClient';
import { fetchEvolutionData } from '../../lib/queries/portfolios';

// --- TYPES & HELPERS ---

type TimeRange = '3M' | '6M' | '1A' | 'ALL';

const COLORS = ['#f59e0b', '#3f3f46', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4'];

const getPortfolioIcon = (type: string) => {
    switch (type) {
        case 'investments': return <TrendingUp size={18} />;
        case 'real_estate': return <Building2 size={18} />;
        case 'business': return <Briefcase size={18} />;
        default: return <Layers size={18} />;
    }
};

const OBJECTIVE_INFO: Record<string, { label: string, color: string, bg: string }> = {
    'growth': { label: 'Crescimento', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
    'income': { label: 'Renda', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    'protection': { label: 'Proteção', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
    'speculation': { label: 'Alto Risco', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    'mixed': { label: 'Misto', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const CustomTooltip = ({ active, payload, label }: RechartsTooltipProps) => {
    if (active && payload && payload.length) {
        // Verificar se netWorth é null (mês sem snapshot)
        const netWorthEntry = payload.find((entry: any) => entry.dataKey === 'netWorth');
        const netWorthValue = netWorthEntry?.value;

        // Se netWorth é null, mostrar "Sem snapshot"
        if (netWorthValue === null || netWorthValue === undefined) {
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-zinc-400 text-xs mb-2 font-bold">{label}</p>
                    <p className="text-xs text-zinc-500">Sem snapshot</p>
                </div>
            );
        }

        return (
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-zinc-400 text-xs mb-2 font-bold">{label}</p>
                {payload.map((entry: RechartsTooltipPayloadEntry, idx: number) => {
                    // Formatar Resultado com cor baseada no valor (verde se positivo, vermelho se negativo)
                    const isResult = entry.dataKey === 'result';
                    const value = entry.value as number;
                    // Resultado sempre é número (não null), mas expenses e netWorth podem ter valores diferentes
                    const colorClass = isResult && typeof value === 'number' && !isNaN(value)
                        ? (value >= 0 ? 'text-emerald-500' : 'text-red-500')
                        : 'text-white';

                    return (
                        <div key={idx} className="flex items-center gap-2 mb-1 last:mb-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className={`text-xs text-zinc-300 ${isResult ? colorClass : ''}`}>
                                {entry.name}: <span className={`font-mono font-bold ${colorClass}`}>
                                    {formatCurrency(value ?? 0, 'BRL')}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

const HistoryChartLegend = ({ payload }: { payload?: Array<{ value?: string; color?: string }> }) => {
    if (!payload || payload.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            {payload.map((entry, index) => (
                <div
                    key={`${entry.value || 'legend'}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-950/80 px-3 py-1.5"
                >
                    <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: entry.color || '#71717a' }}
                    />
                    <span className="text-xs font-medium text-zinc-300">
                        {entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

const formatCompactAxisValue = (value: number): string => {
    const abs = Math.abs(Number(value || 0));
    const sign = value < 0 ? '-' : '';

    if (abs >= 1_000_000) {
        const compact = abs / 1_000_000;
        const text = Number.isInteger(compact) ? String(compact) : compact.toFixed(1).replace(/\.0$/, '');
        return `${sign}${text}M`;
    }

    if (abs >= 1_000) {
        const compact = abs / 1_000;
        const text = Number.isInteger(compact) ? String(compact) : compact.toFixed(1).replace(/\.0$/, '');
        return `${sign}${text}k`;
    }

    return `${sign}${Math.round(abs)}`;
};

// --- MAIN COMPONENT ---

export const OverviewPage: React.FC = () => {
    // Auth state - CRÍTICO: verificar antes de carregar dados
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [portfolioScores, setPortfolioScores] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('6M');
    const [isInitialConsolidationDone, setIsInitialConsolidationDone] = useState(false);

    // Data State
    const [metrics, setMetrics] = useState({
        netWorth: 0,
        netWorthVarPct: 0,
        netWorthVarValue: 0,
        periodResult: 0,
        periodRevenues: 0,
        periodExpenses: 0
    });

    const [allocationData, setAllocationData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    // New: Active Objectives State
    const [activeObjectives, setActiveObjectives] = useState<Objective[]>([]);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);

    // Allocation chart state
    const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

    // KPI Modal state
    const [selectedKpi, setSelectedKpi] = useState<KpiType | null>(null);
    const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);

    // Subscription Success Modal
    const [searchParams, setSearchParams] = useSearchParams();
    const [isSubscriptionSuccessOpen, setIsSubscriptionSuccessOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get('upgraded') === 'true') {
            setIsSubscriptionSuccessOpen(true);
            // Clean URL
            setSearchParams(params => {
                params.delete('upgraded');
                return params;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // AIDEV-NOTE: Query otimizada para Histórico Financeiro com cache.
    // Usa fetchHistoricoFinanceiroRange que faz UMA query por tabela ao invés de N+1.
    const availableYearsQuery = useQuery({
        queryKey: queryKeys.availableYears(),
        queryFn: getAvailableYears,
        enabled: !!user && !authLoading,
        staleTime: STALE_TIMES.HISTORICAL,
        gcTime: GC_TIMES.HISTORICAL,
    });

    const minHistoryYear = useMemo(() => {
        const years = availableYearsQuery.data || [];
        if (years.length === 0) return new Date().getFullYear();
        return Math.min(...years.map((year) => Number(year)).filter((year) => Number.isFinite(year)));
    }, [availableYearsQuery.data]);

    const { months: chartMonths, startMonth, endMonth } = useMemo(
        () => buildRangeMonths(timeRange, undefined, minHistoryYear),
        [timeRange, minHistoryYear]
    );

    const historicoQuery = useQuery<HistoricoFinanceiroData, Error>({
        queryKey: ['hist-financeiro', user?.id, timeRange, startMonth, endMonth],
        queryFn: () => fetchHistoricoFinanceiroRange(timeRange),
        enabled: !!user && !authLoading && isInitialConsolidationDone,
        staleTime: STALE_TIMES.HISTORICAL, // Historical chart data - 30 min
        gcTime: GC_TIMES.HISTORICAL, // Historical data can stay longer
    });

    // AIDEV-NOTE: Consolidação sob demanda (lazy load) - Atualiza portfolios no primeiro acesso do dia
    const { consolidate } = useConsolidation();

    const { data: globalNetWorthSeries = [] } = useQuery<Array<{ monthKey: string; netWorth: number }>>({
        queryKey: ['global-networth-overview', user?.id, timeRange, startMonth],
        queryFn: async () => {
            if (!user) return [];
            const evolution = await fetchEvolutionData(undefined, timeRange);
            const mapped = evolution
                .map((point) => ({
                    monthKey: String(point.fullDate).slice(0, 7),
                    netWorth: Number(point.value || 0),
                }))
                .filter((point) => point.monthKey && Number.isFinite(point.netWorth) && point.netWorth > 0);
            if (env.isDevelopment) {
                const first = mapped[0];
                const last = mapped[mapped.length - 1];
                console.log('[histChart] global networth:', {
                    rows: mapped.length,
                    startMonth,
                    first,
                    last,
                });
            }
            return mapped;
        },
        enabled: !!user && !authLoading && isInitialConsolidationDone,
        staleTime: STALE_TIMES.HISTORICAL,
        gcTime: GC_TIMES.HISTORICAL,
    });

    // Load Data - SÓ quando usuário estiver autenticado
    // Primeiro consolida (se necessário), depois carrega dados


    // Calculate chart container dimensions for responsive radius
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const updateSize = () => {
            const rect = chartContainerRef.current?.getBoundingClientRect();
            if (rect) {
                setChartSize({ width: rect.width, height: rect.height });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);

        // Use ResizeObserver for more accurate tracking
        const resizeObserver = new ResizeObserver(updateSize);
        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateSize);
            resizeObserver.disconnect();
        };
    }, [allocationData, loading]);

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (!user) {
                return;
            }

            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const bundle = await queryClient.fetchQuery({
                queryKey: queryKeys.dashboard(user.id, null, monthKey),
                queryFn: () => fetchDashboardBundle(user.id, monthKey),
                staleTime: STALE_TIMES.DASHBOARD,
                gcTime: GC_TIMES.DEFAULT,
            });

            const {
                portfolios: allPortfolios,
                portfolioScores: bundledPortfolioScores,
                allocation,
                globalMetrics,
                objectives,
                budget,
                expenses,
                historyEvents,
            } = bundle;

            const sortedPortfolios = allPortfolios.sort((a, b) => {
                const dateA = new Date(a.lastAccessedAt || a.createdAt).getTime();
                const dateB = new Date(b.lastAccessedAt || b.createdAt).getTime();
                return dateB - dateA;
            });
            setPortfolios(sortedPortfolios);
            setPortfolioScores(bundledPortfolioScores);
            setAllocationData(allocation);

            // AIDEV-NOTE: Patrimônio Total - O valor atual usa portfolioService.getGlobalMetrics() (cálculo em tempo real).
            // Para histórico confiável e imutável, use wealth_monthly_snapshots via patrio_get_wealth_year_series RPC.
            // Os snapshots mensais são a fonte de verdade para evolução histórica do patrimônio.
            const previousNetWorth = calculatePreviousValue(globalMetrics.totalBalance, globalMetrics.monthlyVariation);
            const varValue = globalMetrics.totalBalance - previousNetWorth;

            const totalExpenses = calculateTotalExpenses(expenses);

            const currentMonthEvents = historyEvents.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });

            const passiveIncome = currentMonthEvents
                .filter(e => ['rent_income', 'profit_distribution', 'distribution', 'dividend', 'jcp'].includes(e.type))
                .reduce((acc, e) => acc + e.totalValue, 0);

            const totalRevenues = (budget.salary || 0) + passiveIncome;
            const periodResult = calculatePeriodResult(totalRevenues, totalExpenses);

            setMetrics({
                netWorth: globalMetrics.totalBalance,
                netWorthVarPct: globalMetrics.monthlyVariation,
                netWorthVarValue: varValue,
                periodResult,
                periodRevenues: totalRevenues,
                periodExpenses: totalExpenses
            });

            const active = objectives.filter(o => o.status === 'active');
            setActiveObjectives(active);

            // Chart data será gerado via useMemo baseado na query otimizada
            // Não precisa mais chamar generateChartData aqui

            const recentExpenses = expenses.map(e => ({
                id: e.id,
                type: 'expense',
                label: e.name,
                category: e.category,
                value: -e.value,
                date: e.createdAt,
                details: 'Gasto registrado'
            }));

            const recentPortfolioEvents = historyEvents.slice(0, 20).map(e => ({
                id: e.id,
                type: e.type,
                label: e.assetName,
                category: e.portfolioName || 'Investimentos',
                value: ['sell', 'rent_income', 'profit_distribution', 'distribution', 'dividend', 'jcp'].includes(e.type) ? e.totalValue : -e.totalValue,
                date: e.date,
                details: e.type === 'buy' ? 'Aporte' : e.type === 'rent_income' ? 'Aluguel Recebido' : e.type
            }));

            const unifiedFeed = [...recentPortfolioEvents, ...recentExpenses]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);

            setRecentActivity(unifiedFeed);
        } catch (err) {
            // Ignorar erros de autenticação - ProtectedRoute vai redirecionar
            const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
            const isAuthError = message.includes('NOT_AUTHENTICATED') ||
                message.includes('não autenticado') ||
                message.includes('AUTH_NOT_READY');

            if (!isAuthError) {
                console.error('OverviewPage loadDashboardData error:', err);
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    }, [user, queryClient]);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            setIsInitialConsolidationDone(false);
            return;
        }

        let cancelled = false;

        void consolidate().finally(() => {
            if (!cancelled) {
                setIsInitialConsolidationDone(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [user, authLoading, consolidate]);

    useEffect(() => {
        if (authLoading || !user || !isInitialConsolidationDone) {
            return;
        }

        void loadDashboardData();
    }, [user, authLoading, isInitialConsolidationDone, loadDashboardData]);

    // AIDEV-NOTE: Agregação otimizada de dados do gráfico usando useMemo.
    // Processa dados da query otimizada em O(n).
    const chartData = useMemo(() => {
        if (env.isDevelopment) {
            console.time('histChart:aggregate');
        }

        if (!historicoQuery.data || !user) {
            if (env.isDevelopment) {
                console.timeEnd('histChart:aggregate');
            }
            return [];
        }

        const { budgets, expenses, incomeEvents, netWorthSnapshots } = historicoQuery.data;
        const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        // Calcular resultados mensais usando a mesma lógica do KPI
        const monthlyResults = calculateMonthlyResultsForRange(chartMonths, budgets, expenses, incomeEvents);

        // Construir dados do gráfico
        const enrichedData = chartMonths.map(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = monthsShort[month - 1];
            const snapshot = netWorthSnapshots.get(monthKey);

            const result = monthlyResults.get(monthKey);
            const expensesTotal = result?.expensesTotal ?? 0;
            const netResult = result?.net ?? 0;

            return {
                monthKey,
                name: `${monthName}/${year}`,
                netWorth: snapshot ? snapshot.total_value : null,
                snapshotIsFinal: snapshot ? Boolean(snapshot.is_final) : null,
                expenses: expensesTotal,
                result: netResult,
                hasSnapshot: !!snapshot
            };
        });

        if (env.isDevelopment) {
            console.timeEnd('histChart:aggregate');
            console.log('[histChart] Chart data points:', enrichedData.length);
        }

        return enrichedData;
    }, [historicoQuery.data, chartMonths, user]);

    const chartDataVariationFallback = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        const byMonth = new Map<string, { expenses: number; result: number; label: string }>();
        chartData.forEach((row: any) => {
            const key = String(row.monthKey || '').slice(0, 7);
            if (!key) return;
            byMonth.set(key, {
                expenses: Number(row.expenses || 0),
                result: Number(row.result || 0),
                label: row.name,
            });
        });

        const snapshotByMonth = new Map<string, number>();
        const snapshotFinalByMonth = new Map<string, boolean>();
        chartData.forEach((row: any) => {
            const key = String(row.monthKey || '').slice(0, 7);
            const value = row.netWorth === null || row.netWorth === undefined ? null : Number(row.netWorth);
            if (!key || value === null || !Number.isFinite(value) || value <= 0) return;
            snapshotByMonth.set(key, value);
            snapshotFinalByMonth.set(key, Boolean(row.snapshotIsFinal));
        });

        const rollupByMonth = new Map<string, number>();
        if (globalNetWorthSeries && globalNetWorthSeries.length > 0) {
            for (const row of globalNetWorthSeries) {
                if (row.monthKey) {
                    const value = Number(row.netWorth || 0);
                    if (Number.isFinite(value) && value > 0) {
                        rollupByMonth.set(row.monthKey, value);
                    }
                }
            }
        }

        const currentMonthKey = chartMonths[chartMonths.length - 1];

        const combinedSeries = chartMonths.map((monthKey) => {
            const fin = byMonth.get(monthKey);
            const snapshotValue = snapshotByMonth.get(monthKey) ?? null;
            const rollupValue = rollupByMonth.get(monthKey) ?? null;
            const isSnapshotFinal = snapshotFinalByMonth.get(monthKey) ?? true;
            let netWorth = snapshotValue ?? rollupValue;

            // Guardrail: for current month, avoid provisional snapshot spikes and use real-time global metric.
            if (monthKey === currentMonthKey && metrics.netWorth > 0 && !isSnapshotFinal) {
                netWorth = metrics.netWorth;
            }

            return {
                d: monthKey,
                label: fin?.label || monthKey,
                netWorth: Number.isFinite(netWorth as number) ? Number(netWorth) : null,
                expenses: fin?.expenses ?? 0,
                resultBrl: fin?.result ?? 0,
            };
        });

        const hasNetWorthPoints = combinedSeries.some((row) => row.netWorth !== null);
        if (hasNetWorthPoints) {
            const firstPositiveIdx = combinedSeries.findIndex((row) => row.netWorth !== null);
            const trimmedSeries = (firstPositiveIdx > 0 ? combinedSeries.slice(firstPositiveIdx) : combinedSeries)
                .filter((row) => row.netWorth !== null);
            if (env.isDevelopment) {
                console.log('[histChart] source=global-networth-snapshots+rollup', {
                    points: trimmedSeries.length,
                    first: trimmedSeries[0],
                    last: trimmedSeries[trimmedSeries.length - 1],
                    firstPositiveIdx,
                });
            }
            return trimmedSeries;
        }

        return [];
    }, [chartData, globalNetWorthSeries, chartMonths, metrics.netWorth]);

    const netWorthVariationMoM = useMemo(() => {
        const latestMonthKey = chartMonths[chartMonths.length - 1];
        if (!latestMonthKey || chartDataVariationFallback.length === 0) {
            return {
                pct: metrics.netWorthVarPct,
                value: metrics.netWorthVarValue,
            };
        }

        const [year, month] = latestMonthKey.split('-').map(Number);
        const previousMonthDate = new Date(year, month - 2, 1);
        const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

        const latestRow = chartDataVariationFallback.find((row: any) => row.d === latestMonthKey)
            ?? chartDataVariationFallback[chartDataVariationFallback.length - 1];
        const previousRow = chartDataVariationFallback.find((row: any) => row.d === previousMonthKey);

        const latestValue = Number(latestRow?.netWorth ?? 0);
        const previousValue = Number(previousRow?.netWorth ?? 0);

        if (Number.isFinite(latestValue) && Number.isFinite(previousValue) && previousValue > 0) {
            const value = latestValue - previousValue;
            const pct = (value / previousValue) * 100;
            return { pct, value };
        }

        return {
            pct: metrics.netWorthVarPct,
            value: metrics.netWorthVarValue,
        };
    }, [chartMonths, chartDataVariationFallback, metrics.netWorthVarPct, metrics.netWorthVarValue]);

    const TimeRangeButton = ({ label, value }: { label: string, value: TimeRange }) => (
        <button
            onClick={() => setTimeRange(value)}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${timeRange === value
                ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
                : 'text-zinc-500 hover:text-white'
                }`}
        >
            {label}
        </button>
    );

    // Calculate visible objectives
    const visibleObjectives = isGoalsExpanded ? activeObjectives.slice(0, 10) : activeObjectives.slice(0, 2);

    return (
        <DashboardLayout
            title="Visão Geral"
            subtitle="Painel executivo da sua saúde financeira."
        >
            <SubscriptionSuccessModal
                isOpen={isSubscriptionSuccessOpen}
                onClose={() => setIsSubscriptionSuccessOpen(false)}
            />
            <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* BLOCO 1 - KPIs DE ESTADO */}
                {/* AIDEV-NOTE: Session replay masking - Add ph-no-capture class to components rendering financial values */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ph-no-capture">
                    {/* 1. Patrimônio Total */}
                    <StatCard
                        title="Patrimônio Total"
                        value={formatCurrency(metrics.netWorth, 'BRL')}
                        trend={netWorthVariationMoM.pct}
                        icon={<Wallet size={20} />}
                        highlight={true}
                        onClick={() => {
                            setSelectedKpi('netWorth');
                            setIsKpiModalOpen(true);
                        }}
                    />

                    {/* 2. Resultado do Período */}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedKpi('monthResult');
                            setIsKpiModalOpen(true);
                        }}
                        className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl flex flex-col justify-between h-full relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all text-left"
                    >
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="text-zinc-500 text-sm font-medium">Resultado do Mês</span>
                            <div className={`p-2 rounded-lg ${metrics.periodResult >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                <Activity size={20} />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className={`text-2xl md:text-3xl font-bold tracking-tight mb-2 ${metrics.periodResult >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {metrics.periodResult > 0 ? '+' : ''}{formatCurrency(metrics.periodResult, 'BRL')}
                            </h3>
                            <p className="text-xs text-zinc-600">Receitas menos despesas</p>
                        </div>
                    </button>

                    {/* 3. Receitas */}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedKpi('revenues');
                            setIsKpiModalOpen(true);
                        }}
                        className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl flex flex-col justify-between h-full hover:border-zinc-700 transition-colors cursor-pointer hover:ring-2 hover:ring-amber-500/50 text-left"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-zinc-500 text-sm font-medium">Receitas Totais</span>
                            <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg">
                                <ArrowUpRight size={20} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
                                {formatCurrency(metrics.periodRevenues, 'BRL')}
                            </h3>
                            <p className="text-xs text-zinc-600">Salário + Proventos</p>
                        </div>
                    </button>

                    {/* 4. Despesas */}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedKpi('expenses');
                            setIsKpiModalOpen(true);
                        }}
                        className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl flex flex-col justify-between h-full hover:border-zinc-700 transition-colors cursor-pointer hover:ring-2 hover:ring-amber-500/50 text-left"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-zinc-500 text-sm font-medium">Despesas Totais</span>
                            <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                                <ArrowDownRight size={20} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
                                {formatCurrency(metrics.periodExpenses, 'BRL')}
                            </h3>
                            <p className="text-xs text-zinc-600">Gastos registrados</p>
                        </div>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* --- COLUNA ESQUERDA (GRÁFICO + PORTFÓLIOS) --- */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* BLOCO 2 - GRÁFICO CENTRAL */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        Histórico Financeiro
                                    </h3>
                                    <p className="text-xs text-zinc-500 mt-1">Evolução do patrimônio global mês a mês vs fluxo mensal</p>
                                </div>
                                <div className="flex gap-1 bg-zinc-950 border border-zinc-800 rounded-md p-1">
                                    <TimeRangeButton label="3M" value="3M" />
                                    <TimeRangeButton label="6M" value="6M" />
                                    <TimeRangeButton label="1A" value="1A" />
                                    <TimeRangeButton label="Max" value="ALL" />
                                </div>
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                {chartDataVariationFallback.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartDataVariationFallback} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPortfolioFallback" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                            <XAxis dataKey="d" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                            <YAxis yAxisId="left" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} width={52} tickFormatter={(val) => formatCompactAxisValue(Number(val || 0))} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} hide />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                                                itemStyle={{ fontSize: '12px' }}
                                                labelStyle={{ color: '#71717a', fontWeight: 'bold', marginBottom: '4px' }}
                                                labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.label || ''}
                                                formatter={(val: number) => [formatCurrency(Number(val || 0), 'BRL')]}
                                            />
                                            <Legend
                                                verticalAlign="bottom"
                                                align="center"
                                                content={(props) => <HistoryChartLegend payload={props.payload as Array<{ value?: string; color?: string }>} />}
                                            />
                                            <Area yAxisId="left" type="monotone" dataKey="netWorth" name="Minha Carteira" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPortfolioFallback)" />
                                            <Bar yAxisId="right" dataKey="expenses" name="Despesas" fill="#ef4444" opacity={0.4} radius={[3, 3, 0, 0]} />
                                            <Line yAxisId="right" type="monotone" dataKey="resultBrl" name="Resultado" stroke="#10b981" strokeWidth={2} dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
                                        Nenhum dado de patrimônio disponível. Adicione transações para ver o gráfico.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* LISTA DE PORTFÓLIOS (RICH CARDS) */}
                        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-bold text-sm">Meus Portfólios</h3>
                                <Link to="/dashboard/portfolios">
                                    <Button size="sm" variant="outline" className="h-8 text-xs bg-zinc-900 border-zinc-800">
                                        <ArrowRight size={12} className="mr-1" /> Gerenciar
                                    </Button>
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {portfolios.length === 0 ? (
                                    <div className="col-span-full text-center py-8 text-zinc-600 text-sm italic">
                                        Nenhum portfólio criado.
                                    </div>
                                ) : (
                                    portfolios.slice(0, 4).map(p => {
                                        const score = portfolioScores[p.id] ?? p.userConvictionScore ?? 5;
                                        const objInfo = OBJECTIVE_INFO[p.objective || 'growth'];

                                        return (
                                            <Link key={p.id} to={`/dashboard/portfolio/${p.id}`}>
                                                <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all group relative overflow-hidden h-full flex flex-col justify-between">
                                                    {/* Header: Icon, Name, Type */}
                                                    <div>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2.5 bg-zinc-900 rounded-lg text-amber-500 group-hover:text-white group-hover:bg-amber-500 transition-colors border border-zinc-800 group-hover:border-amber-500">
                                                                    {getPortfolioIcon(p.type)}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-white font-bold text-sm truncate max-w-[120px]">{p.name}</h4>
                                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                                                                        {p.type === 'custom' ? 'Personalizado' : p.type === 'investments' ? 'Financeiro' : p.type === 'real_estate' ? 'Imóveis' : 'Empresas'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Value */}
                                                        <div className="mb-4">
                                                            <p className="text-xs text-zinc-500 mb-0.5 font-medium">Saldo Atual</p>
                                                            <p className="text-xl font-mono font-bold text-white tracking-tight">{formatCurrency(p.value, p.currency)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Badges */}
                                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-900 mt-auto">
                                                        {/* Objective Badge */}
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${objInfo.bg} ${objInfo.color}`}>
                                                            <Target size={9} /> {objInfo.label}
                                                        </span>

                                                        {/* Score Badge */}
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border bg-zinc-900 border-zinc-800 ${score >= 8 ? 'text-green-500' : score >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                                            <Star size={9} fill="currentColor" /> {score.toFixed(1)}
                                                        </span>
                                                    </div>

                                                    {/* Hover Arrow */}
                                                    <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                                                        <ArrowRight size={16} className="text-zinc-600" />
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- COLUNA DIREITA (ALOCAÇÃO + METAS + ATIVIDADES) --- */}
                    <div className="flex flex-col gap-6">
                        {/* Alocação */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col min-h-[200px]">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-white font-bold text-sm">Alocação Atual</h3>
                                <button
                                    onClick={() => setIsAllocationModalOpen(true)}
                                    className="text-amber-500 hover:text-amber-400 text-xs flex items-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded transition-colors"
                                >
                                    <PieChartIcon size={14} className="mr-1" /> Detalhes
                                </button>
                            </div>

                            <div className="flex-1 relative min-h-[160px]" ref={chartContainerRef}>
                                {metrics.netWorth > 0 ? (() => {
                                    // Calculate dynamic radii based on container size
                                    const minDimension = Math.min(chartSize.width, chartSize.height);
                                    const outerRadius = minDimension > 0 ? Math.min(minDimension * 0.35, 70) : 70;
                                    const innerRadius = outerRadius * 0.7; // ~70% of outerRadius for donut

                                    return (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={allocationData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={innerRadius}
                                                    outerRadius={outerRadius}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {allocationData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    );
                                })() : (
                                    <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                                        <div className="text-center">
                                            <PieChartIcon size={32} className="mx-auto mb-2 opacity-20" />
                                            <p>Sem ativos</p>
                                        </div>
                                    </div>
                                )}
                                {metrics.netWorth > 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xl font-bold text-white">{allocationData.length}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase">Classes</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metas de Bolso - UPDATED TO USER OBJECTIVES WITH EXPANSION */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 transition-all duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-bold text-sm">Progresso de Metas</h3>
                                <Link to="/dashboard/metas" className="text-amber-500 hover:text-amber-400 text-xs flex items-center">
                                    <Target size={14} className="mr-1" /> Gerenciar
                                </Link>
                            </div>

                            <div className="space-y-4">
                                {activeObjectives.length === 0 ? (
                                    <div className="text-center py-6 text-zinc-600">
                                        <Flag size={24} className="mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">Nenhum objetivo ativo.</p>
                                    </div>
                                ) : (
                                    <>
                                        {visibleObjectives.map(obj => {
                                            const progress = calculateProgressPercentage(obj.currentValue, obj.totalValue);

                                            return (
                                                <div key={obj.id} className="animate-in fade-in slide-in-from-top-1 duration-300">
                                                    <div className="flex justify-between text-xs mb-1.5">
                                                        <span className="text-zinc-300 font-medium truncate max-w-[120px]">{obj.name}</span>
                                                        <div className="flex gap-1 text-zinc-500 font-mono">
                                                            <span>{formatCurrency(obj.currentValue, 'BRL')}</span>
                                                            <span>/</span>
                                                            <span>{formatCurrency(obj.totalValue, 'BRL')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
                                                        <div
                                                            className="h-full bg-cyan-500 transition-all duration-500"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-right mt-0.5">
                                                        <span className={`text-[9px] font-bold ${progress >= 100 ? 'text-green-500' : 'text-cyan-500'}`}>
                                                            {progress.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {activeObjectives.length > 2 && (
                                            <button
                                                onClick={() => setIsGoalsExpanded(!isGoalsExpanded)}
                                                className="w-full flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-white pt-2 border-t border-zinc-800/50 transition-colors"
                                            >
                                                {isGoalsExpanded ? (
                                                    <>Ver menos <ChevronUp size={12} /></>
                                                ) : (
                                                    <>Ver mais ({activeObjectives.length - 2}) <ChevronDown size={12} /></>
                                                )}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* BLOCO 4 - ATIVIDADE RECENTE (Movido para a direita e compactado) */}
                        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden flex-1">
                            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/30">
                                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                    <Activity size={16} className="text-amber-500" /> Recente
                                </h3>
                                <Link to="/dashboard/linha-tempo" className="text-xs text-zinc-500 hover:text-white transition-colors">
                                    Ver tudo →
                                </Link>
                            </div>

                            <div className="divide-y divide-zinc-800/50">
                                {recentActivity.length === 0 ? (
                                    <div className="p-8 text-center text-zinc-600 text-xs italic">
                                        Nenhuma atividade recente.
                                    </div>
                                ) : (
                                    recentActivity.slice(0, 4).map((activity, idx) => ( // Limit to 4 items for better UX
                                        <div key={`${activity.id}-${idx}`} className="p-3 flex items-center justify-between hover:bg-zinc-900/40 transition-colors group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${activity.type === 'expense' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                    activity.type === 'buy' || activity.type === 'rent_income' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                        'bg-zinc-800 border-zinc-700 text-zinc-400'
                                                    }`}>
                                                    {activity.type === 'expense' ? <CreditCard size={14} /> :
                                                        activity.type === 'buy' ? <Wallet size={14} /> :
                                                            activity.type === 'rent_income' ? <DollarSign size={14} /> :
                                                                <Layers size={14} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{activity.label}</p>
                                                    <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 truncate">
                                                        <span>{new Date(activity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                        <span className="w-0.5 h-0.5 rounded-full bg-zinc-600"></span>
                                                        <span>{activity.type === 'expense' ? 'Gasto' : activity.type === 'buy' ? 'Aporte' : 'Evento'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`text-xs font-mono font-medium whitespace-nowrap pl-2 ${activity.value > 0 ? 'text-green-500' : 'text-zinc-400'}`}>
                                                {activity.value > 0 ? '+' : ''}{formatCurrency(activity.value, 'BRL')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Allocation Details Modal */}
            <AllocationDetailsModal
                isOpen={isAllocationModalOpen}
                onClose={() => setIsAllocationModalOpen(false)}
                allocationData={allocationData}
                totalValue={metrics.netWorth}
            />

            {/* KPI Drilldown Modal */}
            {selectedKpi && (
                <KpiDrilldownModal
                    open={isKpiModalOpen}
                    onClose={() => {
                        setIsKpiModalOpen(false);
                        setSelectedKpi(null);
                    }}
                    kpi={selectedKpi}
                    currency="BRL"
                    initialYear={new Date().getFullYear()}
                    currentNetWorth={metrics.netWorth}
                />
            )}
        </DashboardLayout>
    );
};
