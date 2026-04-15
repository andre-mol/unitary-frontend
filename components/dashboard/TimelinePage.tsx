import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { DashboardLayout } from './DashboardLayout';
import { BUDGET_UPDATE_EVENT, Expense, Goal, Objective, planningService } from '../../lib/planningService';
import { PORTFOLIO_UPDATE_EVENT } from '../../lib/portfolioService';
import { RechartsTooltipProps } from '../../types';
import { useAuth } from '../auth/AuthProvider';
import { timelineService } from '../../services/api/timeline';
import { TimelineBucket, TimelineEvent, TimelineMode } from '../../types/timeline';
import { usePortfolios } from '../../hooks/usePortfolios';
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Target,
    TrendingUp
} from 'lucide-react';
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis
} from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { formatCurrency } from '../../utils/formatters';

interface MonthData {
    monthIndex: number;
    label: string;
    netWorthStart: number;
    netWorthEnd: number;
    variationRealized: number;
    variationProjected: number;
    contributions: number;
    withdrawals: number;
    income: number;
    expenses: number;
    valuation: number;
    result: number;
    isProjected: boolean;
    hasSnapshot: boolean;
    noData: boolean;
    events: TimelineEvent[];
}

interface ExpenseCategorySummary {
    category: string;
    amount: number;
    count: number;
}

interface GoalComparison {
    id: string;
    category: string;
    percentage: number;
    color: string;
    targetAmount: number;
    actualAmount: number;
}

interface ObjectiveHighlight {
    id: string;
    name: string;
    status: Objective['status'];
    progress: number;
    currentValue: number;
    totalValue: number;
    monthContribution: number;
}

interface SelectedMonthInsights {
    visibleEvents: TimelineEvent[];
    workIncome: number;
    passiveIncome: number;
    contributionTotal: number;
    withdrawalTotal: number;
    expenseTotalFromEvents: number;
    informationalCount: number;
    expenseCategories: ExpenseCategorySummary[];
    goalComparisons: GoalComparison[];
    objectiveHighlights: ObjectiveHighlight[];
}

interface HistoricalObjectiveSnapshot {
    id: string;
    name: string;
    status: Objective['status'];
    progress: number;
    currentValue: number;
    totalValue: number;
    monthContribution: number;
}

interface DateRangeFilter {
    start: string;
    end: string;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PASSIVE_EVENT_TYPES = new Set(['dividend', 'jcp', 'rent_income', 'profit_distribution', 'distribution']);
const CONTRIBUTION_EVENT_TYPES = new Set(['buy', 'capital_call']);
const WITHDRAWAL_EVENT_TYPES = new Set(['sell']);
const EXPENSE_EVENT_TYPES = new Set(['expense']);

const CustomTick = (props: any) => {
    const { x, y, payload } = props;
    return (
        <text x={x} y={y} dy={16} textAnchor="middle" fill="#52525b" fontSize={12} className="font-medium">
            {MONTH_NAMES[payload.value]}
        </text>
    );
};

function getNumericAmount(event: TimelineEvent): number {
    return Math.abs(Number(event.totalValue ?? 0));
}

function getEventNature(event: TimelineEvent): string {
    return typeof event.metadata?.canonical_nature === 'string' ? event.metadata.canonical_nature : '';
}

function isIncomeEvent(event: TimelineEvent): boolean {
    const nature = getEventNature(event);
    if (nature === 'income') return true;
    return PASSIVE_EVENT_TYPES.has(event.type) || event.type === 'income' || event.type === 'salary';
}

function isPassiveIncomeEvent(event: TimelineEvent): boolean {
    if (!isIncomeEvent(event)) return false;

    const source = typeof event.metadata?.source === 'string' ? event.metadata.source : '';
    const category = typeof event.metadata?.category === 'string' ? event.metadata.category.toLowerCase() : '';

    return PASSIVE_EVENT_TYPES.has(event.type) ||
        source === 'get_user_dividends' ||
        source === 'implied_rent' ||
        category.includes('aluguel') ||
        category.includes('dividend') ||
        category.includes('jcp');
}

function isExpenseEvent(event: TimelineEvent): boolean {
    const nature = getEventNature(event);
    if (nature === 'expense') return true;
    return EXPENSE_EVENT_TYPES.has(event.type);
}

function isContributionEvent(event: TimelineEvent): boolean {
    const nature = getEventNature(event);
    if (nature === 'contribution') return true;
    return CONTRIBUTION_EVENT_TYPES.has(event.type);
}

function isWithdrawalEvent(event: TimelineEvent): boolean {
    const nature = getEventNature(event);
    if (nature === 'withdrawal') return true;
    return WITHDRAWAL_EVENT_TYPES.has(event.type);
}

function isInformationalEvent(event: TimelineEvent): boolean {
    return event.metadata?.is_informational_only === true;
}

function getEventTypeLabel(type: string): string {
    switch (type) {
        case 'buy':
            return 'Aporte';
        case 'capital_call':
            return 'Capital Call';
        case 'sell':
            return 'Retirada';
        case 'expense':
            return 'Despesa';
        case 'salary':
            return 'Salario';
        case 'income':
            return 'Receita';
        case 'rent_income':
            return 'Aluguel';
        case 'dividend':
            return 'Dividendo';
        case 'jcp':
            return 'JCP';
        case 'profit_distribution':
        case 'distribution':
            return 'Distribuicao';
        case 'manual_update':
            return 'Atualizacao';
        case 'valuation_update':
            return 'Valorizacao';
        case 'profit_report':
            return 'Relatorio';
        case 'profit_registered':
            return 'Lucro';
        case 'rent_start':
            return 'Inicio de aluguel';
        case 'rent_end':
            return 'Fim de aluguel';
        case 'adjustment':
            return 'Ajuste';
        default:
            return type;
    }
}

function getSourceLabel(source?: string): string {
    switch (source) {
        case 'planning_income':
        case 'planning_expenses':
            return 'Orcamento';
        case 'planning_budgets':
            return 'Orcamento base';
        case 'portfolio_events':
            return 'Portfolio';
        case 'item_transactions_legacy':
            return 'Historico';
        case 'get_user_dividends':
            return 'Dividendos';
        case 'implied_rent':
            return 'Projecao';
        default:
            return source || 'Geral';
    }
}

function getExpenseCategory(event: TimelineEvent): string {
    if (typeof event.metadata?.category === 'string' && event.metadata.category.trim()) {
        return event.metadata.category;
    }

    return 'Sem categoria';
}

function getDisplayAmount(event: TimelineEvent): { value: string; className: string } {
    const amount = getNumericAmount(event);

    if (isExpenseEvent(event)) return { value: `-${formatCurrency(amount, 'BRL')}`, className: 'text-red-400' };
    if (isWithdrawalEvent(event)) return { value: `-${formatCurrency(amount, 'BRL')}`, className: 'text-orange-400' };
    if (isContributionEvent(event)) return { value: `+${formatCurrency(amount, 'BRL')}`, className: 'text-blue-400' };
    if (isIncomeEvent(event)) return { value: `+${formatCurrency(amount, 'BRL')}`, className: 'text-emerald-400' };

    return { value: formatCurrency(amount, 'BRL'), className: 'text-zinc-400' };
}

function getEventTitle(event: TimelineEvent): string {
    if (event.title?.trim()) return event.title;
    if (event.assetName?.trim()) return event.assetName;
    return 'Evento';
}

function getEventStatusLabel(eventStatus?: unknown): string {
    if (typeof eventStatus !== 'string') return '';

    switch (eventStatus) {
        case 'expected':
            return 'Esperado';
        case 'received':
            return 'Recebido';
        case 'executed':
            return 'Executado';
        default:
            return eventStatus;
    }
}

function getPayloadDetails(event: TimelineEvent): string[] {
    const payload = event.metadata?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];

    const data = payload as Record<string, unknown>;

    if (data.source === 'contribution_planner') {
        const details: string[] = [];
        const score = typeof data.portfolio_score === 'number' ? data.portfolio_score : null;
        const allocated = typeof data.allocated_amount === 'number' ? data.allocated_amount : null;
        const suggested = typeof data.suggested_amount === 'number' ? data.suggested_amount : null;
        const manual = typeof data.manual_amount === 'number' ? data.manual_amount : null;
        const queuePosition = typeof data.queue_position === 'number' ? data.queue_position : null;
        const queueTotal = typeof data.queue_total === 'number' ? data.queue_total : null;

        if (score !== null) details.push(`Planejador: nota ${score.toFixed(1)}`);
        if (allocated !== null) details.push(`Alocado no portfolio: ${formatCurrency(allocated, 'BRL')}`);
        if (suggested !== null) details.push(`Sugestao do ativo: ${formatCurrency(suggested, 'BRL')}`);
        if (manual !== null) details.push(`Override manual: ${formatCurrency(manual, 'BRL')}`);
        if (queuePosition !== null && queueTotal !== null) details.push(`Fila de execucao: ${queuePosition}/${queueTotal}`);

        return details;
    }

    const detailRows: string[] = [];
    const numericKeys = ['amount_to_user', 'amount_total_company', 'revenue', 'gross_profit', 'net_profit'];
    const labelMap: Record<string, string> = {
        amount_to_user: 'Valor ao usuario',
        amount_total_company: 'Valor total',
        revenue: 'Receita',
        gross_profit: 'Lucro bruto',
        net_profit: 'Lucro liquido'
    };

    for (const key of numericKeys) {
        if (typeof data[key] === 'number') {
            detailRows.push(`${labelMap[key]}: ${formatCurrency(data[key] as number, 'BRL')}`);
        }
    }

    return detailRows.slice(0, 3);
}

export const TimelinePage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { portfolios } = usePortfolios();
    const queryClient = useQueryClient();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
    const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState<TimelineMode>('both');
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>({ start: '', end: '' });
    const [isEventTypeMenuOpen, setIsEventTypeMenuOpen] = useState(false);
    const scopeMenuRef = useRef<HTMLDivElement | null>(null);
    const eventTypeMenuRef = useRef<HTMLDivElement | null>(null);

    const enabled = !!user && !authLoading;

    const timelineQuery = useQuery({
        queryKey: ['timeline', user?.id, selectedYear, selectedPortfolioId, viewMode],
        queryFn: async () => {
            const [buckets, events] = await Promise.all([
                timelineService.getTimeline(selectedYear, selectedPortfolioId, viewMode),
                timelineService.getTimelineEvents(selectedYear, selectedPortfolioId, viewMode)
            ]);
            return { buckets, events };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData
    });

    const planningContextQuery = useQuery({
        queryKey: ['timeline-planning-context', user?.id, selectedYear],
        queryFn: async () => {
            const [goals, objectives] = await Promise.all([
                planningService.getGoals(),
                planningService.getObjectives()
            ]);

            if (objectives.length === 0) {
                return { goals, objectives, objectiveExpenses: [] as Expense[] };
            }

            const createdYears = objectives.map((objective) => {
                const year = Number(new Date(objective.createdAt).getFullYear());
                return Number.isFinite(year) ? year : selectedYear;
            });
            const startYear = Math.min(selectedYear, ...createdYears);
            const yearlyExpenseMaps = await Promise.all(
                Array.from({ length: selectedYear - startYear + 1 }, (_, index) => startYear + index)
                    .map((year) => planningService.getExpensesByYearRange(year))
            );
            const objectiveExpenses = yearlyExpenseMaps
                .flatMap((expenseMap) => Array.from(expenseMap.values()).flat())
                .filter((expense) => expense.category?.toLowerCase().includes('meta') || !!expense.objectiveId);

            return { goals, objectives, objectiveExpenses };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData
    });

    useEffect(() => {
        const handleDataUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['timeline'] });
            queryClient.invalidateQueries({ queryKey: ['timeline-planning-context'] });
        };

        window.addEventListener(BUDGET_UPDATE_EVENT, handleDataUpdate);
        window.addEventListener(PORTFOLIO_UPDATE_EVENT, handleDataUpdate);
        return () => {
            window.removeEventListener(BUDGET_UPDATE_EVENT, handleDataUpdate);
            window.removeEventListener(PORTFOLIO_UPDATE_EVENT, handleDataUpdate);
        };
    }, [queryClient]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (scopeMenuRef.current && !scopeMenuRef.current.contains(event.target as Node)) {
                setIsScopeMenuOpen(false);
            }
            if (eventTypeMenuRef.current && !eventTypeMenuRef.current.contains(event.target as Node)) {
                setIsEventTypeMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (selectedPortfolioId && !portfolios.some((portfolio) => portfolio.id === selectedPortfolioId)) {
            setSelectedPortfolioId(null);
        }
    }, [portfolios, selectedPortfolioId]);

    const timelineData = useMemo(() => {
        if (!timelineQuery.data) return [];

        const { buckets, events } = timelineQuery.data;

        return Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const bucket = buckets.find((entry: TimelineBucket) => entry.month === month);

            if (!bucket) {
                return {
                    monthIndex: i,
                    label: MONTH_NAMES[i],
                    netWorthStart: 0,
                    netWorthEnd: 0,
                    variationRealized: 0,
                    variationProjected: 0,
                    contributions: 0,
                    withdrawals: 0,
                    income: 0,
                    expenses: 0,
                    valuation: 0,
                    result: 0,
                    isProjected: false,
                    hasSnapshot: false,
                    noData: true,
                    events: []
                };
            }

            const monthEvents = events
                .filter((event: TimelineEvent) => {
                    const eventDate = new Date(event.date);
                    const sameMonth = eventDate.getMonth() === i;
                    const sameMode = viewMode === 'both' ? true : event.status === viewMode;
                    return sameMonth && sameMode;
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const netCashflow = ((bucket.cashflow_income_realized ?? 0) + (bucket.income_projected ?? 0)) -
                ((bucket.cashflow_expense_realized ?? 0) + (bucket.expense_projected ?? 0));

            let effectiveRealized = bucket.economic_result_realized ?? 0;
            let effectiveValuation = bucket.patrimony_valuation ?? 0;

            if (Math.abs(effectiveRealized) < 0.01 && Math.abs(netCashflow) > 0.01) {
                effectiveRealized = netCashflow;
                effectiveValuation = 0;
            }

            const isProjected = bucket.flags?.is_projected ?? false;
            let effectiveProjected = 0;

            if (isProjected) {
                const projectedPatrimonyDelta = (bucket.patrimony_end ?? 0) - (bucket.patrimony_start ?? 0);
                const projectedResult = projectedPatrimonyDelta - ((bucket.contributions_projected ?? 0) - (bucket.withdrawals_projected ?? 0));
                effectiveProjected = Math.abs(projectedResult) < 0.01 ? netCashflow : projectedResult;
            }

            return {
                monthIndex: i,
                label: MONTH_NAMES[i],
                netWorthStart: bucket.patrimony_start ?? 0,
                netWorthEnd: bucket.patrimony_end ?? 0,
                variationRealized: isProjected ? 0 : effectiveRealized,
                variationProjected: isProjected ? effectiveProjected : 0,
                contributions: (bucket.contributions_realized ?? 0) + (bucket.contributions_projected ?? 0),
                withdrawals: (bucket.withdrawals_realized ?? 0) + (bucket.withdrawals_projected ?? 0),
                income: (bucket.cashflow_income_realized ?? 0) + (bucket.income_projected ?? 0),
                expenses: (bucket.cashflow_expense_realized ?? 0) + (bucket.expense_projected ?? 0),
                valuation: isProjected ? 0 : effectiveValuation,
                result: isProjected ? effectiveProjected : effectiveRealized,
                isProjected,
                hasSnapshot: bucket.flags?.has_snapshot ?? false,
                noData: bucket.flags?.no_data ?? false,
                events: monthEvents
            };
        });
    }, [timelineQuery.data, viewMode]);

    useEffect(() => {
        if (selectedYear === new Date().getFullYear() && selectedMonthIndex === null && timelineData.length > 0) {
            setSelectedMonthIndex(new Date().getMonth());
        }
    }, [selectedYear, selectedMonthIndex, timelineData.length]);

    const loading = authLoading || timelineQuery.isLoading;
    const error = timelineQuery.error;
    const selectedData = selectedMonthIndex !== null ? timelineData[selectedMonthIndex] : null;
    const selectedScopeLabel = selectedPortfolioId === null
        ? 'Consolidado'
        : portfolios.find((portfolio) => portfolio.id === selectedPortfolioId)?.name ?? 'Portfolio';
    const planningContext = planningContextQuery.data ?? {
        goals: [] as Goal[],
        objectives: [] as Objective[],
        objectiveExpenses: [] as Expense[]
    };

    const availableEventTypes = useMemo(() => {
        if (!selectedData) return [];

        return Array.from(new Set(selectedData.events.map((event) => event.type))).sort((a, b) => a.localeCompare(b));
    }, [selectedData]);

    const eventTypeSummary = useMemo(() => {
        if (availableEventTypes.length === 0) return 'Tipos';
        if (selectedEventTypes.length === availableEventTypes.length) return 'Todos os tipos';
        if (selectedEventTypes.length === 0) return 'Nenhum tipo';
        if (selectedEventTypes.length === 1) return getEventTypeLabel(selectedEventTypes[0]);
        return `${selectedEventTypes.length} tipos`;
    }, [availableEventTypes, selectedEventTypes]);

    useEffect(() => {
        setSelectedEventTypes(availableEventTypes);
        setDateRangeFilter({ start: '', end: '' });
        setIsEventTypeMenuOpen(false);
    }, [availableEventTypes]);

    const historicalObjectiveSnapshots = useMemo<HistoricalObjectiveSnapshot[]>(() => {
        if (!selectedData) return [];

        const selectedMonth = selectedData.monthIndex + 1;
        const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

        return planningContext.objectives
            .map<HistoricalObjectiveSnapshot>((objective) => {
                const relevantExpenses = planningContext.objectiveExpenses.filter((expense) => expense.objectiveId === objective.id);

                const historicalValue = relevantExpenses
                    .filter((expense) => expense.month <= selectedMonthKey)
                    .reduce((total, expense) => total + Number(expense.value || 0), 0);
                const monthContribution = relevantExpenses
                    .filter((expense) => expense.month === selectedMonthKey)
                    .reduce((total, expense) => total + Number(expense.value || 0), 0);

                let historicalStatus = objective.status;
                if (objective.status === 'completed' && objective.completedAt) {
                    const completedMonth = objective.completedAt.slice(0, 7);
                    if (completedMonth > selectedMonthKey) {
                        historicalStatus = 'active';
                    }
                }

                return {
                    id: objective.id,
                    name: objective.name,
                    status: historicalStatus,
                    progress: objective.totalValue > 0 ? Math.min(100, (historicalValue / objective.totalValue) * 100) : 0,
                    currentValue: historicalValue,
                    totalValue: objective.totalValue,
                    monthContribution
                };
            })
            .filter((objective) => objective.currentValue > 0 || objective.monthContribution > 0);
    }, [planningContext.objectiveExpenses, planningContext.objectives, selectedData, selectedYear]);

    const selectedMonthInsights = useMemo<SelectedMonthInsights | null>(() => {
        if (!selectedData) return null;

        const visibleEvents = selectedData.events.filter((event) => {
            const matchesType = availableEventTypes.length === 0 ? true : selectedEventTypes.includes(event.type);
            const matchesStart = !dateRangeFilter.start || event.date >= dateRangeFilter.start;
            const matchesEnd = !dateRangeFilter.end || event.date <= dateRangeFilter.end;
            return matchesType && matchesStart && matchesEnd;
        });
        const informationalEvents = visibleEvents.filter((event) => isInformationalEvent(event));
        const financialEvents = visibleEvents.filter((event) => !isInformationalEvent(event));
        const workIncomeEvents = financialEvents.filter((event) => isIncomeEvent(event) && !isPassiveIncomeEvent(event));
        const passiveIncomeEvents = financialEvents.filter((event) => isPassiveIncomeEvent(event));
        const contributionEvents = financialEvents.filter((event) => isContributionEvent(event));
        const withdrawalEvents = financialEvents.filter((event) => isWithdrawalEvent(event));
        const expenseEvents = financialEvents.filter((event) => isExpenseEvent(event));

        const expenseCategoryMap = expenseEvents.reduce<Map<string, ExpenseCategorySummary>>((map, event) => {
            const key = getExpenseCategory(event);
            const existing = map.get(key) ?? { category: key, amount: 0, count: 0 };
            existing.amount += getNumericAmount(event);
            existing.count += 1;
            map.set(key, existing);
            return map;
        }, new Map());

        const objectiveHighlights = historicalObjectiveSnapshots
            .map<ObjectiveHighlight>((objective) => {
                const monthContribution = expenseEvents
                    .filter((event) => event.metadata?.objective_id === objective.id)
                    .reduce((total, event) => total + getNumericAmount(event), 0);

                return {
                    ...objective,
                    monthContribution: monthContribution > 0 ? monthContribution : objective.monthContribution
                };
            })
            .filter((objective) => objective.currentValue > 0 || objective.monthContribution > 0)
            .sort((a, b) => (b.monthContribution - a.monthContribution) || (b.progress - a.progress))
            .slice(0, 4);

        const workIncome = workIncomeEvents.reduce((total, event) => total + getNumericAmount(event), 0);
        const contributionTotal = contributionEvents.reduce((total, event) => total + getNumericAmount(event), 0);

        const goalComparisons = selectedPortfolioId !== null
            ? []
            : planningContext.goals
                .filter((goal) => goal.percentage > 0)
                .map<GoalComparison>((goal) => {
                    const targetAmount = workIncome * (goal.percentage / 100);
                    const lowerCategory = goal.category.toLowerCase();

                    let actualAmount = 0;
                    if (lowerCategory.includes('invest')) {
                        actualAmount = contributionTotal;
                    } else if (lowerCategory.includes('meta')) {
                        actualAmount = expenseEvents
                            .filter((event) => {
                                const category = getExpenseCategory(event).toLowerCase();
                                return category.includes('meta') || !!event.metadata?.objective_id;
                            })
                            .reduce((total, event) => total + getNumericAmount(event), 0);
                    } else {
                        actualAmount = expenseEvents
                            .filter((event) => getExpenseCategory(event).toLowerCase() === lowerCategory)
                            .reduce((total, event) => total + getNumericAmount(event), 0);
                    }

                    return {
                        id: goal.id,
                        category: goal.category,
                        percentage: goal.percentage,
                        color: goal.color,
                        targetAmount,
                        actualAmount
                    };
                })
                .sort((a, b) => b.targetAmount - a.targetAmount);

        return {
            visibleEvents,
            workIncome,
            passiveIncome: passiveIncomeEvents.reduce((total, event) => total + getNumericAmount(event), 0),
            contributionTotal,
            withdrawalTotal: withdrawalEvents.reduce((total, event) => total + getNumericAmount(event), 0),
            expenseTotalFromEvents: expenseEvents.reduce((total, event) => total + getNumericAmount(event), 0),
            informationalCount: informationalEvents.length,
            expenseCategories: Array.from(expenseCategoryMap.values()).sort((a, b) => b.amount - a.amount),
            goalComparisons,
            objectiveHighlights
        };
    }, [availableEventTypes.length, dateRangeFilter.end, dateRangeFilter.start, historicalObjectiveSnapshots, planningContext.goals, selectedData, selectedEventTypes, selectedPortfolioId]);

    const handleMonthClick = (data: { activePayload?: Array<{ payload: MonthData }> } | null) => {
        if (data?.activePayload?.length) {
            setSelectedMonthIndex(data.activePayload[0].payload.monthIndex);
        }
    };

    const handleEventTypeToggle = (type: string) => {
        setSelectedEventTypes((current) => (
            current.includes(type)
                ? current.filter((entry) => entry !== type)
                : [...current, type].sort((a, b) => a.localeCompare(b))
        ));
    };

    const CustomTooltip = ({ active, payload, label }: RechartsTooltipProps) => {
        if (!(active && payload && payload.length)) return null;

        const value = payload[0].value;
        const monthName = typeof label === 'number' ? MONTH_NAMES[label] : label;

        return (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs shadow-xl backdrop-blur-md">
                <p className="mb-1 font-bold text-zinc-400">{monthName} / {selectedYear}</p>
                <p className={`text-lg font-bold font-mono ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {value > 0 ? '+' : ''}{formatCurrency(value, 'BRL')}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">Variacao liquida</p>
            </div>
        );
    };

    if (loading) {
        return (
            <DashboardLayout
                title="Linha do Tempo Financeira"
                subtitle="Visualize a evolucao do seu patrimonio e os eventos que marcaram cada mes."
            >
                <div className="flex h-96 items-center justify-center">
                    <div className="text-zinc-500">Carregando dados...</div>
                </div>
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout
                title="Linha do Tempo Financeira"
                subtitle="Visualize a evolucao do seu patrimonio e os eventos que marcaram cada mes."
            >
                <div className="flex h-96 items-center justify-center">
                    <div className="text-red-500">
                        Erro ao carregar dados: {error instanceof Error ? error.message : 'Erro desconhecido'}
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            title="Linha do Tempo Financeira"
            subtitle="Visualize a evolucao do seu patrimonio e os eventos que marcaram cada mes."
        >
            <div className="animate-in slide-in-from-bottom-4 fade-in space-y-8 pb-20 duration-500">
                <div className="flex flex-col items-center justify-between gap-6 border-b border-zinc-900 pb-6 md:flex-row">
                    <div className="flex items-center gap-4 rounded-xl bg-zinc-900/50 p-2">
                        <button
                            onClick={() => setSelectedYear((year) => year - 1)}
                            className="rounded-full p-2 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="px-2 text-center">
                            <h2 className="text-2xl font-bold tracking-tight text-white">{selectedYear}</h2>
                        </div>

                        <button
                            onClick={() => setSelectedYear((year) => year + 1)}
                            className="rounded-full p-2 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white"
                            disabled={selectedYear >= new Date().getFullYear() + 1}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative" ref={scopeMenuRef}>
                            <button
                                onClick={() => setIsScopeMenuOpen((open) => !open)}
                                className="flex min-w-[180px] items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
                            >
                                <span className="truncate">{selectedScopeLabel}</span>
                                <ChevronDown
                                    size={14}
                                    className={`text-zinc-500 transition-transform ${isScopeMenuOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            <AnimatePresence>
                                {isScopeMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute left-0 top-full z-20 mt-2 w-full min-w-[220px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
                                    >
                                        <button
                                            onClick={() => {
                                                setSelectedPortfolioId(null);
                                                setIsScopeMenuOpen(false);
                                            }}
                                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${selectedPortfolioId === null
                                                ? 'bg-zinc-900 text-white'
                                                : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-white'
                                                }`}
                                        >
                                            <span>Consolidado</span>
                                            {selectedPortfolioId === null && (
                                                <span className="text-[10px] uppercase tracking-wide text-amber-500">Atual</span>
                                            )}
                                        </button>

                                        {portfolios.length > 0 && (
                                            <div className="border-t border-zinc-800 py-1">
                                                {portfolios.map((portfolio) => (
                                                    <button
                                                        key={portfolio.id}
                                                        onClick={() => {
                                                            setSelectedPortfolioId(portfolio.id);
                                                            setIsScopeMenuOpen(false);
                                                        }}
                                                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${selectedPortfolioId === portfolio.id
                                                            ? 'bg-zinc-900 text-white'
                                                            : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-white'
                                                            }`}
                                                    >
                                                        <span className="truncate">{portfolio.name}</span>
                                                        {selectedPortfolioId === portfolio.id && (
                                                            <span className="text-[10px] uppercase tracking-wide text-amber-500">Atual</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
                            <button
                                onClick={() => setViewMode('realized')}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'realized' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500'
                                    }`}
                            >
                                Realizado
                            </button>
                            <button
                                onClick={() => setViewMode('both')}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'both' ? 'bg-zinc-800 text-white' : 'text-zinc-500'
                                    }`}
                            >
                                Ambos
                            </button>
                            <button
                                onClick={() => setViewMode('projected')}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'projected' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-500'
                                    }`}
                            >
                                Previsto
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                    <div className="h-[300px] w-full cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={timelineData}
                                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                                onClick={handleMonthClick}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <pattern id="striped-red" patternUnits="userSpaceOnUse" width="4" height="4">
                                        <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{ stroke: '#ef4444', strokeWidth: 1 }} />
                                    </pattern>
                                    <pattern id="striped-green" patternUnits="userSpaceOnUse" width="4" height="4">
                                        <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{ stroke: '#10b981', strokeWidth: 1 }} />
                                    </pattern>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis
                                    dataKey="monthIndex"
                                    type="category"
                                    scale="band"
                                    stroke="#52525b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    dy={10}
                                    padding={{ left: 16, right: 16 }}
                                    tick={<CustomTick />}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#52525b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                    width={40}
                                />
                                <YAxis yAxisId="right" orientation="right" stroke="#52525b" hide={true} />
                                <RechartsTooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)', stroke: 'none', radius: 4 }}
                                />
                                <ReferenceLine y={0} stroke="#52525b" yAxisId="left" />

                                <Bar dataKey="variationRealized" yAxisId="left" radius={[4, 4, 0, 0]} maxBarSize={60} stackId="a">
                                    {timelineData.map((entry, index) => (
                                        <Cell
                                            key={`cell-r-${index}`}
                                            fill={entry.variationRealized >= 0 ? '#10b981' : '#ef4444'}
                                            opacity={selectedMonthIndex === index ? 1 : 0.8}
                                            stroke={selectedMonthIndex === index ? '#f4f4f5' : 'none'}
                                        />
                                    ))}
                                </Bar>

                                <Bar dataKey="variationProjected" yAxisId="left" radius={[4, 4, 0, 0]} maxBarSize={60} stackId="a">
                                    {timelineData.map((entry, index) => (
                                        <Cell
                                            key={`cell-p-${index}`}
                                            fill={entry.variationProjected >= 0 ? 'url(#striped-green)' : 'url(#striped-red)'}
                                            opacity={0.6}
                                        />
                                    ))}
                                </Bar>

                                <Line
                                    type="monotone"
                                    dataKey="netWorthEnd"
                                    yAxisId="right"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#1d4ed8' }}
                                    activeDot={{ r: 6 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {selectedData && selectedMonthInsights && (
                        <motion.div
                            key={selectedData.monthIndex}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
                        >
                            <div className="space-y-6 lg:col-span-1">
                                <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
                                    <div className="relative z-10">
                                        <div className="mb-2 flex items-center gap-3">
                                            <Calendar className="text-amber-500" size={24} />
                                            <h3 className="text-xl font-bold text-white">
                                                {selectedData.label} <span className="text-base font-normal text-zinc-500">/ {selectedYear}</span>
                                            </h3>
                                            {selectedData.isProjected && (
                                                <span className="ml-auto rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-tighter text-amber-500">
                                                    Previsto
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <p className={`text-2xl font-bold font-mono tracking-tight ${selectedData.result >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {selectedData.result > 0 ? '+' : ''}{formatCurrency(selectedData.result, 'BRL')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="relative z-10 mt-6 space-y-2">
                                        <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2 text-xs">
                                            <span className="text-zinc-500">Patrimonio Inicial</span>
                                            {selectedData.noData && selectedData.netWorthStart === 0 ? (
                                                <span className="italic text-zinc-500">Sem dados</span>
                                            ) : (
                                                <span className="font-mono text-zinc-300">{formatCurrency(selectedData.netWorthStart, 'BRL')}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-zinc-500">Patrimonio Final ({selectedData.isProjected ? 'Proj' : 'Real'})</span>
                                            {selectedData.noData && selectedData.netWorthEnd === 0 ? (
                                                <span className="italic text-zinc-500">Sem dados</span>
                                            ) : (
                                                <span className="font-mono font-bold text-white">{formatCurrency(selectedData.netWorthEnd, 'BRL')}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-[80px] ${selectedData.result >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>

                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                                    <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        <Activity size={14} /> Composicao da Variacao
                                    </h4>

                                    <div className="space-y-4">
                                        {(selectedMonthInsights.workIncome > 0 || selectedMonthInsights.passiveIncome > 0) && (
                                            <div className="space-y-2 rounded-lg border border-zinc-800/70 bg-zinc-950/70 p-3">
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="rounded bg-emerald-500/10 p-1.5 text-emerald-500">
                                                            <TrendingUp size={14} />
                                                        </div>
                                                        <span className="text-zinc-300">Receitas do trabalho / orcamento</span>
                                                    </div>
                                                    <span className="font-mono font-medium text-emerald-400">
                                                        +{formatCurrency(selectedMonthInsights.workIncome, 'BRL')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="rounded bg-emerald-500/10 p-1.5 text-emerald-500">
                                                            <TrendingUp size={14} />
                                                        </div>
                                                        <span className="text-zinc-300">Rendas passivas</span>
                                                    </div>
                                                    <span className="font-mono font-medium text-emerald-400">
                                                        +{formatCurrency(selectedMonthInsights.passiveIncome, 'BRL')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded bg-blue-500/10 p-1.5 text-blue-500">
                                                    <ArrowUpRight size={14} />
                                                </div>
                                                <span className="text-sm text-zinc-300">Aportes</span>
                                            </div>
                                            <span className="font-mono font-medium text-blue-400">
                                                +{formatCurrency(selectedData.contributions, 'BRL')}
                                            </span>
                                        </div>

                                        {selectedData.withdrawals > 0 && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="rounded bg-orange-500/10 p-1.5 text-orange-500">
                                                        <ArrowDownRight size={14} />
                                                    </div>
                                                    <span className="text-sm text-zinc-300">Retiradas</span>
                                                </div>
                                                <span className="font-mono font-medium text-orange-400">
                                                    -{formatCurrency(selectedData.withdrawals, 'BRL')}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded bg-red-500/10 p-1.5 text-red-500">
                                                    <ArrowDownRight size={14} />
                                                </div>
                                                <span className="text-sm text-zinc-300">Despesas</span>
                                            </div>
                                            <span className="font-mono font-medium text-red-400">
                                                -{formatCurrency(selectedData.expenses, 'BRL')}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded bg-amber-500/10 p-1.5 text-amber-500">
                                                    <TrendingUp size={14} />
                                                </div>
                                                <span className="text-sm text-zinc-300">Valorizacao patrimonial</span>
                                            </div>
                                            <span className={`font-mono font-medium ${selectedData.valuation >= 0 ? 'text-amber-500' : 'text-red-400'}`}>
                                                {selectedData.valuation > 0 ? '+' : ''}{formatCurrency(selectedData.valuation, 'BRL')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-lg border border-zinc-800/60 bg-zinc-950/70 p-3 text-xs text-zinc-500">
                                        <div className="flex items-center justify-between">
                                            <span>Eventos informativos</span>
                                            <span className="font-medium text-zinc-300">{selectedMonthInsights.informationalCount}</span>
                                        </div>
                                        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                                            Resultado = (Patrimonio Final - Inicial) - (Aportes - Retiradas + Receitas - Despesas)
                                        </p>
                                    </div>
                                </div>

                                {selectedPortfolioId === null && (
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                                        <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            <Target size={14} /> Metas e Objetivos
                                        </h4>
                                        <p className="mb-4 text-[11px] text-zinc-600">
                                            A comparacao usa a configuracao atual de metas, mas o acumulado dos objetivos e recalculado ate este mes.
                                        </p>
                                        {planningContextQuery.isLoading ? (
                                            <div className="text-sm text-zinc-500">Carregando contexto de metas...</div>
                                        ) : (
                                            <div className="space-y-5">
                                                {selectedMonthInsights.goalComparisons.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                                            Planejado x realizado sobre receita ativa do mes
                                                        </p>
                                                        {selectedMonthInsights.goalComparisons.slice(0, 4).map((goal) => {
                                                            const ratio = goal.targetAmount > 0 ? Math.min(100, (goal.actualAmount / goal.targetAmount) * 100) : 0;
                                                            return (
                                                                <div key={goal.id} className="space-y-2 rounded-lg border border-zinc-800/70 bg-zinc-950/70 p-3">
                                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                                        <span className="font-medium text-zinc-200">{goal.category}</span>
                                                                        <span className="text-zinc-500">{goal.percentage}% da receita ativa</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                                        <span className="text-zinc-500">Meta: {formatCurrency(goal.targetAmount, 'BRL')}</span>
                                                                        <span className="font-medium text-zinc-300">Real: {formatCurrency(goal.actualAmount, 'BRL')}</span>
                                                                    </div>
                                                                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                                                                        <div
                                                                            className="h-full rounded-full"
                                                                            style={{
                                                                                width: `${ratio}%`,
                                                                                backgroundColor: goal.color || '#f59e0b'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
                                                        Nenhuma meta percentual aplicavel para este mes.
                                                    </div>
                                                )}

                                                {selectedMonthInsights.objectiveHighlights.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                                            Objetivos ativos com impacto no mes
                                                        </p>
                                                        {selectedMonthInsights.objectiveHighlights.map((objective) => (
                                                            <div key={objective.id} className="space-y-2 rounded-lg border border-zinc-800/70 bg-zinc-950/70 p-3">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-sm font-medium text-zinc-200">{objective.name}</span>
                                                                    <span className="text-[10px] uppercase tracking-wide text-cyan-400">
                                                                        {objective.status === 'paused' ? 'Pausado' : 'Ativo'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-zinc-500">Acumulado: {formatCurrency(objective.currentValue, 'BRL')}</span>
                                                                    <span className="font-medium text-zinc-300">
                                                                        Mes: {formatCurrency(objective.monthContribution, 'BRL')}
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">
                                                                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${objective.progress}%` }} />
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                                                    <span>{objective.progress.toFixed(1)}%</span>
                                                                    <span>Meta: {formatCurrency(objective.totalValue, 'BRL')}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
                                                        Nenhum objetivo com movimentacao relevante neste mes.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex min-h-0 h-full flex-col gap-6 lg:col-span-2">
                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
                                    <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                        <Activity size={14} /> Despesas detalhadas
                                    </h4>

                                    {selectedMonthInsights.expenseCategories.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedMonthInsights.expenseCategories.map((category) => (
                                                <div
                                                    key={category.category}
                                                    className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-950/70 px-4 py-3"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-zinc-200">{category.category}</p>
                                                        <p className="text-[11px] text-zinc-500">{category.count} lancamento(s) no mes</p>
                                                    </div>
                                                    <span className="font-mono font-medium text-red-400">
                                                        -{formatCurrency(category.amount, 'BRL')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                                            Nenhuma despesa detalhada encontrada neste mes.
                                        </div>
                                    )}
                                </div>

                                <div className="flex min-h-0 h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
                                    <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                            <Activity size={14} /> Eventos Financeiros
                                        </h4>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
                                                <span>De</span>
                                                <input
                                                    type="date"
                                                    value={dateRangeFilter.start}
                                                    onChange={(event) => setDateRangeFilter((current) => ({ ...current, start: event.target.value }))}
                                                    className="rounded border-0 bg-transparent p-0 text-xs text-zinc-200 outline-none"
                                                />
                                            </label>

                                            <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
                                                <span>Ate</span>
                                                <input
                                                    type="date"
                                                    value={dateRangeFilter.end}
                                                    min={dateRangeFilter.start || undefined}
                                                    onChange={(event) => setDateRangeFilter((current) => ({ ...current, end: event.target.value }))}
                                                    className="rounded border-0 bg-transparent p-0 text-xs text-zinc-200 outline-none"
                                                />
                                            </label>

                                            <div className="relative" ref={eventTypeMenuRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEventTypeMenuOpen((open) => !open)}
                                                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                                                >
                                                    <span>Tipos</span>
                                                    <span className="normal-case tracking-normal text-zinc-300">{eventTypeSummary}</span>
                                                    <ChevronDown size={12} className={`transition-transform ${isEventTypeMenuOpen ? 'rotate-180' : ''}`} />
                                                </button>

                                                <AnimatePresence>
                                                    {isEventTypeMenuOpen && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -6 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="absolute right-0 top-full z-20 mt-2 min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl"
                                                        >
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Eventos</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedEventTypes(availableEventTypes)}
                                                                    className="text-[10px] uppercase tracking-wide text-zinc-500 transition-colors hover:text-white"
                                                                >
                                                                    Todos
                                                                </button>
                                                            </div>

                                                            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                                                {availableEventTypes.length === 0 ? (
                                                                    <span className="text-xs text-zinc-600">Nenhum tipo disponivel.</span>
                                                                ) : (
                                                                    availableEventTypes.map((type) => (
                                                                        <label key={type} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedEventTypes.includes(type)}
                                                                                onChange={() => handleEventTypeToggle(type)}
                                                                                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500"
                                                                            />
                                                                            <span>{getEventTypeLabel(type)}</span>
                                                                        </label>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedEventTypes(availableEventTypes);
                                                    setDateRangeFilter({ start: '', end: '' });
                                                }}
                                                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                                            >
                                                Limpar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                                        {selectedMonthInsights.visibleEvents.length === 0 ? (
                                            <div className="flex h-full flex-col items-center justify-center py-10 text-zinc-600">
                                                <AlertCircle size={32} className="mb-2 opacity-20" />
                                                <p className="text-sm">Nenhum evento registrado neste mes.</p>
                                            </div>
                                        ) : (
                                            selectedMonthInsights.visibleEvents.map((event) => {
                                                const day = new Date(event.date).getDate();
                                                const source = typeof event.metadata?.source === 'string' ? event.metadata.source : undefined;
                                                const payloadSource = event.metadata?.payload && typeof event.metadata.payload === 'object' && !Array.isArray(event.metadata.payload)
                                                    ? (event.metadata.payload as Record<string, unknown>).source
                                                    : undefined;
                                                const category = typeof event.metadata?.category === 'string' ? event.metadata.category : '';
                                                const sourceRef = typeof event.metadata?.source_ref === 'string' ? event.metadata.source_ref : '';
                                                const installmentCurrent = typeof event.metadata?.installment_current === 'number' ? event.metadata.installment_current : undefined;
                                                const installmentTotal = typeof event.metadata?.installment_total === 'number' ? event.metadata.installment_total : undefined;
                                                const period = typeof event.metadata?.period === 'string' ? event.metadata.period : '';
                                                const periodStart = typeof event.metadata?.period_start === 'string' ? event.metadata.period_start : '';
                                                const periodEnd = typeof event.metadata?.period_end === 'string' ? event.metadata.period_end : '';
                                                const eventStatusLabel = getEventStatusLabel(event.metadata?.event_status);
                                                const objectiveId = typeof event.metadata?.objective_id === 'string' ? event.metadata.objective_id : '';
                                                const objective = objectiveId ? planningContext.objectives.find((entry) => entry.id === objectiveId) : undefined;
                                                const amount = getDisplayAmount(event);
                                                const payloadDetails = getPayloadDetails(event);

                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="group flex gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
                                                    >
                                                        <div className="flex min-w-[40px] flex-col items-center gap-1">
                                                            <span className="text-lg font-bold leading-none text-white">{day}</span>
                                                            <span className="text-[9px] font-bold uppercase text-zinc-600">{selectedData.label}</span>
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div>
                                                                    <h5 className="text-sm font-bold text-zinc-200 transition-colors group-hover:text-white">
                                                                        {getEventTitle(event)}
                                                                    </h5>
                                                                    <p className="mt-1 text-xs text-zinc-500">
                                                                        {event.assetName !== getEventTitle(event) ? event.assetName : (category || event.assetCategory || 'Sem categoria')}
                                                                    </p>
                                                                </div>
                                                                <span className={`text-sm font-medium font-mono ${amount.className}`}>
                                                                    {amount.value}
                                                                </span>
                                                            </div>

                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                                                                    {getEventTypeLabel(event.type)}
                                                                </span>
                                                                <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                                                    {getSourceLabel(source)}
                                                                </span>
                                                                {payloadSource === 'contribution_planner' && (
                                                                    <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-400">
                                                                        Planejador
                                                                    </span>
                                                                )}
                                                                {event.isProjected && (
                                                                    <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-500">
                                                                        Previsto
                                                                    </span>
                                                                )}
                                                                {eventStatusLabel && (
                                                                    <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                                                        {eventStatusLabel}
                                                                    </span>
                                                                )}
                                                                {isInformationalEvent(event) && (
                                                                    <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                                                                        Informativo
                                                                    </span>
                                                                )}
                                                                {category && (
                                                                    <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                                                        {category}
                                                                    </span>
                                                                )}
                                                                {objective && (
                                                                    <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-400">
                                                                        Meta: {objective.name}
                                                                    </span>
                                                                )}
                                                                {installmentCurrent && installmentTotal && (
                                                                    <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                                                        Parcela {installmentCurrent}/{installmentTotal}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {(event.observation || sourceRef || period || periodStart || periodEnd) && (
                                                                <div className="mt-3 space-y-1 text-xs text-zinc-500">
                                                                    {event.observation && <p className="italic text-zinc-600">{event.observation}</p>}
                                                                    {sourceRef && <p>Vinculo: {sourceRef}</p>}
                                                                    {period && <p>Competencia: {period}</p>}
                                                                    {!period && periodStart && periodEnd && <p>Periodo: {periodStart} ate {periodEnd}</p>}
                                                                </div>
                                                            )}

                                                            {payloadDetails.length > 0 && (
                                                                <div className="mt-3 space-y-1 text-xs text-zinc-500">
                                                                    {payloadDetails.map((detail, index) => (
                                                                        <p key={`${event.id}-payload-${index}`}>{detail}</p>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
};
