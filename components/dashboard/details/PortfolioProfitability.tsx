
import React, { useState, useMemo } from 'react';
import { Portfolio, CustomItem } from '../../../types';
import {
    AlertCircle, BarChart2, Percent, Activity, Table, TrendingUp, Info
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { normalizeEvolutionData, rebaseSeries, EvolutionPoint } from '../../../utils/chartHelpers';

interface PortfolioProfitabilityProps {
    portfolio: Portfolio;
    items?: CustomItem[];
    evolutionData: EvolutionPoint[]; // Performance series (return-based)
    navData?: EvolutionPoint[]; // NAV/evolution series (value-based)
    businessMetrics?: {
        totalReturnPct: number;
        equityReturnPct: number;
        cashReturnPct: number;
        netProfit12m?: number;
        performanceMonthly?: Array<{ month: string; totalReturnPct: number; equityReturnPct: number; cashReturnPct: number }>;
    };
    rentIncomeEvents?: Array<{ date: string; totalValue: number }>;
    acquisitionCost?: number;
    performanceLoading?: boolean;
    targetTotalReturnPct?: number | null;
    benchmarks: Array<{
        date: string;
        cdi?: number;
        ipca?: number;
        ibov?: number;
        spx?: number;
        ifix?: number;
        idiv?: number;
        smll?: number;
        ivvb11?: number;
    }>;
    timeRange: '6M' | '1A' | 'ALL';
    onTimeRangeChange: (range: '6M' | '1A' | 'ALL') => void;
}

type IndexType = 'portfolio' | 'cdi' | 'ipca' | 'ibov' | 'spx' | 'ifix' | 'idiv' | 'smll' | 'ivvb11';
type BenchmarkField = Exclude<IndexType, 'portfolio'>;
type BenchmarkRow = PortfolioProfitabilityProps['benchmarks'][number];

// Row type for monthly profitability table
interface MonthlyProfitabilityRow {
    year: number;
    0?: number | null;
    1?: number | null;
    2?: number | null;
    3?: number | null;
    4?: number | null;
    5?: number | null;
    6?: number | null;
    7?: number | null;
    8?: number | null;
    9?: number | null;
    10?: number | null;
    11?: number | null;
    total?: number | null;
    accumulated?: number | null;
    [key: number]: number | null | undefined;
}

const INDICES_CONFIG: Record<IndexType, { label: string; color: string; disabled?: boolean }> = {
    portfolio: { label: 'Portfólio', color: '#f59e0b' },
    cdi: { label: 'CDI', color: '#10b981' },
    ipca: { label: 'IPCA', color: '#eab308' },
    ibov: { label: 'IBOV', color: '#8b5cf6' },
    spx: { label: 'S&P 500', color: '#64748b' },
    ifix: { label: 'IFIX', color: '#06b6d4' },
    idiv: { label: 'IDIV', color: '#ec4899' },
    smll: { label: 'SMLL', color: '#84cc16' },
    ivvb11: { label: 'IVVB11', color: '#d946ef' }
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const PortfolioProfitability: React.FC<PortfolioProfitabilityProps> = ({
    portfolio,
    items = [],
    evolutionData,
    navData = [],
    businessMetrics,
    rentIncomeEvents = [],
    acquisitionCost,
    performanceLoading = false,
    targetTotalReturnPct = null,
    benchmarks,
    timeRange,
    onTimeRangeChange
}) => {
    const [visibleIndices, setVisibleIndices] = useState<Set<IndexType>>(new Set(['portfolio', 'cdi']));
    const [comparisonIndex, setComparisonIndex] = useState<IndexType>('cdi');
    const isRealEstate = portfolio.type === 'real_estate';
    const isBusiness = portfolio.type === 'business';
    const isUsingNavFallback = false;
    const hasOnlyNavData = evolutionData.length === 0 && navData.length > 0;
    const shouldHoldChartUntilAccuratePerformance =
        timeRange === 'ALL' &&
        hasOnlyNavData &&
        !isRealEstate &&
        !isBusiness;
    const indexedMirrorBenchmark = useMemo<NonNullable<CustomItem['valuationMethod']['indexBenchmark']> | null>(() => {
        if (!items.length) return null;
        let benchmark: NonNullable<CustomItem['valuationMethod']['indexBenchmark']> | null = null;
        for (const item of items) {
            const method = item.valuationMethod;
            if (!method) return null;
            const looksPeriodic = method.type === 'periodic' || method.periodicRate !== undefined || method.indexBenchmark !== undefined;
            const looksIndexed = method.growthMode === 'indexed' || method.indexBenchmark !== undefined;
            if (!looksPeriodic || !looksIndexed) return null;
            const spread = Number(method.indexSpreadRate ?? 0);
            if (Math.abs(spread) > 0.000001) return null;
            const currentBenchmark = (method.indexBenchmark || 'IPCA') as NonNullable<CustomItem['valuationMethod']['indexBenchmark']>;
            if (!benchmark) benchmark = currentBenchmark;
            if (benchmark !== currentBenchmark) return null;
        }
        return benchmark;
    }, [items]);

    const businessPerformanceSource = useMemo(() => {
        if (!isBusiness || !businessMetrics?.performanceMonthly?.length) return [] as EvolutionPoint[];
        return businessMetrics.performanceMonthly.map((row, idx) => {
            const fullDate = `${row.month}-01`;
            return {
                name: `${idx + 1}`,
                fullDate,
                value: Number(row.totalReturnPct || 0) / 100, // decimal return series
            };
        });
    }, [isBusiness, businessMetrics?.performanceMonthly]);

    // If business has very few financial-event points, fall back to full NAV history
    // so the chart/table keep the full timeline from asset inception.
    const isBusinessUsingNavFallback = isBusiness && businessPerformanceSource.length < 3;

    const navDataWithRentIncome = useMemo(() => {
        if (!isRealEstate || navData.length === 0) return navData;
        if (!rentIncomeEvents.length) return navData;

        const sortedNav = [...navData].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
        const incomes = rentIncomeEvents
            .filter((e) => e && e.date && Number.isFinite(Number(e.totalValue)))
            .map((e) => ({ ts: new Date(e.date).getTime(), value: Number(e.totalValue) }))
            .filter((e) => !Number.isNaN(e.ts))
            .sort((a, b) => a.ts - b.ts);

        let incomeIdx = 0;
        let cumulativeIncome = 0;

        return sortedNav.map((point) => {
            const pointTs = new Date(point.fullDate).getTime();
            while (incomeIdx < incomes.length && incomes[incomeIdx].ts <= pointTs) {
                cumulativeIncome += incomes[incomeIdx].value;
                incomeIdx += 1;
            }

            return {
                ...point,
                value: (Number(point.value) || 0) + cumulativeIncome,
            };
        });
    }, [isRealEstate, navData, rentIncomeEvents]);

    const portfolioSourceData = isBusiness
        ? (isBusinessUsingNavFallback
            ? (navData.length > 0 ? navData : evolutionData)
            : businessPerformanceSource)
        : isRealEstate
        ? (navDataWithRentIncome.length > 0 ? navDataWithRentIncome : evolutionData)
        : evolutionData;

    const dedupedBenchmarks = useMemo(() => {
        const map = new Map<string, BenchmarkRow>();
        for (const row of benchmarks || []) {
            if (!row?.date) continue;
            const key = row.date.split('T')[0];
            const prev = map.get(key);
            if (!prev) {
                map.set(key, { ...row, date: key });
                continue;
            }
            const mergeField = (field: BenchmarkField) => {
                const prevVal = prev[field];
                const currVal = row[field];
                if (currVal === undefined || currVal === null) return prevVal;
                if (prevVal === undefined || prevVal === null) return currVal;
                return Math.abs(currVal) > Math.abs(prevVal) ? currVal : prevVal;
            };
            map.set(key, {
                date: key,
                cdi: mergeField('cdi'),
                ipca: mergeField('ipca'),
                ibov: mergeField('ibov'),
                spx: mergeField('spx'),
                ifix: mergeField('ifix'),
                idiv: mergeField('idiv'),
                smll: mergeField('smll'),
                ivvb11: mergeField('ivvb11')
            });
        }
        return Array.from(map.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [benchmarks]);

    // Merge evolution data with benchmarks (LOCF - Last Observation Carried Forward)
    const rawEvents = useMemo(() => {
        if (!dedupedBenchmarks.length) return portfolioSourceData;

        // Sort benchmarks by date for efficient lookup
        const sortedBenchmarks = [...dedupedBenchmarks].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Helper to find closest benchmark (LOCF)
        const findClosestBenchmark = (targetDate: string) => {
            const targetTime = new Date(targetDate).getTime();

            let closest = null;
            let closestDistance = Infinity;

            for (const bench of sortedBenchmarks) {
                const benchTime = new Date(bench.date).getTime();
                const distance = targetTime - benchTime;

                if (distance >= 0 && distance < closestDistance) {
                    closest = bench;
                    closestDistance = distance;
                }

                if (distance < 0) break;
            }

            if (!closest && sortedBenchmarks.length > 0) {
                closest = sortedBenchmarks[0];
            }

            return closest;
        };

        return portfolioSourceData.map(point => {
            const dateKey = point.fullDate.split('T')[0];
            const bench = findClosestBenchmark(dateKey);
            return {
                ...point,
                ibov: bench?.ibov,
                cdi: bench?.cdi,
                ipca: bench?.ipca,
                spx: bench?.spx,
                ifix: bench?.ifix,
                idiv: bench?.idiv,
                smll: bench?.smll,
                ivvb11: bench?.ivvb11
            };
        });
    }, [portfolioSourceData, dedupedBenchmarks]);

    // Normalize performance data (return_total decimal -> %)
    const normalizedData = useMemo(() => {
        if (rawEvents.length === 0) return [];
        const sorted = [...rawEvents].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

        // In ALL/MAX with NAV fallback (or real estate), use NAV vs acquisition cost.
        if (timeRange === 'ALL' && (isUsingNavFallback || isRealEstate || isBusinessUsingNavFallback) && acquisitionCost && acquisitionCost > 0) {
            return normalizeEvolutionData(sorted, acquisitionCost);
        }

        // ALL for investment portfolios: use the dedicated performance series shape
        // without re-scaling the curve to another metric.
        if (timeRange === 'ALL' && !isRealEstate && !isBusinessUsingNavFallback) {
            return normalizeEvolutionData(sorted);
        }

        const rebased = rebaseSeries(sorted, new Date(sorted[0].fullDate));
        return normalizeEvolutionData(rebased);
    }, [rawEvents, timeRange, isUsingNavFallback, isRealEstate, isBusinessUsingNavFallback, acquisitionCost]);

    const normalizedDataEffective = useMemo(() => {
        if (!indexedMirrorBenchmark) return normalizedData;

        const keyByBenchmark: Record<NonNullable<CustomItem['valuationMethod']['indexBenchmark']>, keyof typeof normalizedData[number]> = {
            CDI: 'normalizedCdi',
            IPCA: 'normalizedIpca',
            IBOV: 'normalizedIbov',
            'S&P500': 'normalizedSpx',
            IFIX: 'normalizedIfix',
            IDIV: 'normalizedIdiv',
            SMLL: 'normalizedSmll',
            IVVB11: 'normalizedIvvb11'
        };

        const key = keyByBenchmark[indexedMirrorBenchmark];
        return normalizedData.map((point) => ({
            ...point,
            normalizedValue: Number((point as any)[key] ?? point.normalizedValue),
        }));
    }, [normalizedData, indexedMirrorBenchmark]);

    // Chart Data (using normalized data)
    const chartData = useMemo(() => {
        if (normalizedDataEffective.length === 0) return [];
        const mapped = normalizedDataEffective.map(point => ({
            date: point.fullDate.split('T')[0],
            displayDate: new Date(point.fullDate).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),
            portfolio: point.normalizedValue,
            cdi: point.normalizedCdi,
            ipca: point.normalizedIpca,
            ibov: point.normalizedIbov,
            spx: point.normalizedSpx,
            ifix: point.normalizedIfix,
            idiv: point.normalizedIdiv,
            smll: point.normalizedSmll,
            ivvb11: point.normalizedIvvb11
        }));

        const mirrorKeyByBenchmark: Record<NonNullable<CustomItem['valuationMethod']['indexBenchmark']>, keyof typeof mapped[number]> = {
            CDI: 'cdi',
            IPCA: 'ipca',
            IBOV: 'ibov',
            'S&P500': 'spx',
            IFIX: 'ifix',
            IDIV: 'idiv',
            SMLL: 'smll',
            IVVB11: 'ivvb11'
        };

        const mappedWithMirror = indexedMirrorBenchmark
            ? mapped.map((row) => ({
                ...row,
                portfolio: Number((row as any)[mirrorKeyByBenchmark[indexedMirrorBenchmark]] ?? row.portfolio)
            }))
            : mapped;

        // Heavy optimization for MAX range: render only month-end points.
        if (timeRange !== 'ALL') return mappedWithMirror;
        const byMonth = new Map<string, any>();
        for (const p of mappedWithMirror) {
            const key = String(p.date).slice(0, 7); // YYYY-MM
            byMonth.set(key, p); // keeps last point of the month
        }
        return Array.from(byMonth.values());
    }, [normalizedDataEffective, timeRange, indexedMirrorBenchmark]);

    // Table Data (Monthly Returns) - Calculate from normalized data
    const monthlyReturnsTable = useMemo(() => {
        if (normalizedDataEffective.length === 0) return [];

        // Helper to find normalized value at a specific date (LOCF)
        const getNormalizedValueAt = (d: Date) => {
            const targetTime = d.getTime();
            let lastPoint = null;

            for (const point of normalizedDataEffective) {
                const pointTime = new Date(point.fullDate).getTime();
                if (pointTime <= targetTime) {
                    lastPoint = point;
                } else {
                    break;
                }
            }
            return lastPoint?.normalizedValue ?? null;
        };

        const initialDate = new Date(normalizedDataEffective[0].fullDate);
        const lastDate = new Date(normalizedDataEffective[normalizedDataEffective.length - 1].fullDate);
        const startYear = initialDate.getFullYear();
        const endYear = lastDate.getFullYear();
        const years = [];

        // Generate rows for each year
        for (let year = endYear; year >= startYear; year--) {
            const row: MonthlyProfitabilityRow = { year };

            // Calculate monthly returns using normalized values
            for (let month = 0; month < 12; month++) {
                const monthEnd = new Date(year, month + 1, 0);
                const monthStart = new Date(year, month, 0);

                if (monthEnd > lastDate) {
                    row[month] = null;
                    continue;
                }

                if (monthEnd < initialDate) {
                    row[month] = null;
                    continue;
                }

                const startNorm = getNormalizedValueAt(monthStart);
                const endNorm = getNormalizedValueAt(monthEnd);

                if (endNorm !== null) {
                    if (startNorm !== null) {
                        row[month] = endNorm - startNorm;
                    } else {
                        row[month] = endNorm;
                    }
                } else {
                    row[month] = null;
                }
            }

            // Year Total
            const yearStartDate = new Date(year, 0, 0);
            const yearEndDate = year === endYear ? lastDate : new Date(year, 11, 31);

            const yStartNorm = getNormalizedValueAt(yearStartDate);
            const yEndNorm = getNormalizedValueAt(yearEndDate);

            if (yEndNorm !== null) {
                if (yStartNorm !== null) {
                    row.total = yEndNorm - yStartNorm;
                } else {
                    row.total = yEndNorm;
                }
            } else {
                row.total = null;
            }

            // Accumulated (from 0% baseline)
            if (yEndNorm !== null) {
                row.accumulated = yEndNorm;
            } else {
                row.accumulated = null;
            }

            years.push(row);
        }

        return years;
    }, [normalizedDataEffective]);

    const kpiData = useMemo(() => {
        if (isBusiness && businessMetrics) {
            return {
                portfolioReturn: Number(businessMetrics.totalReturnPct || 0),
                indexReturn: Number(businessMetrics.equityReturnPct || 0),
                diff: Number(businessMetrics.cashReturnPct || 0),
                relative: null
            };
        }
        if (chartData.length < 1) {
            return {
                portfolioReturn: targetTotalReturnPct !== null && targetTotalReturnPct !== undefined
                    ? Number(targetTotalReturnPct)
                    : null,
                indexReturn: null,
                diff: null,
                relative: null
            };
        }
        const lastPoint = chartData[chartData.length - 1];
        const portfolioReturn = lastPoint.portfolio ?? 0;
        const indexReturn = lastPoint[comparisonIndex as keyof typeof lastPoint] as number | undefined;
        const diff = indexReturn !== undefined ? portfolioReturn - indexReturn : null;
        const relative = indexReturn !== undefined ? (((1 + portfolioReturn / 100) / (1 + indexReturn / 100)) - 1) * 100 : null;
        return { portfolioReturn, indexReturn, diff, relative };
    }, [chartData, comparisonIndex, isBusiness, businessMetrics, targetTotalReturnPct]);

    const toggleIndex = (id: IndexType) => {
        if (id === 'portfolio') return;
        const next = new Set(visibleIndices);
        if (next.has(id)) {
            next.delete(id);
            if (comparisonIndex === id) {
                const fallback = Array.from(next).find(i => i !== 'portfolio') as IndexType;
                if (fallback) setComparisonIndex(fallback);
            }
        } else {
            next.add(id);
            if (visibleIndices.size === 1) setComparisonIndex(id);
        }
        setVisibleIndices(next);
    };

    const formatPct = (val: number | null | undefined) => val !== null && val !== undefined ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%` : '-';
    const getKPIColor = (val: number | null | undefined) => val === null || val === undefined ? 'text-zinc-500' : Math.abs(val) < 0.01 ? 'text-zinc-400' : val > 0 ? 'text-green-500' : 'text-red-500';
    const renderCell = (value: number | null | undefined) => value === null || value === undefined ? <span className="text-zinc-600 font-light">-</span> : <span className={`text-xs font-medium ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>{value.toFixed(2)}%</span>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Controls */}
            <div className="flex justify-end">
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    {[ 
                        { id: 'ALL', label: 'Máximo' },
                        { id: '1A', label: '1 Ano' },
                        { id: '6M', label: '6 Meses' }
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => onTimeRangeChange(opt.id as '6M' | '1A' | 'ALL')}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${timeRange === opt.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-start"><span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{isBusiness ? 'Retorno Total' : 'Rentabilidade'}</span><Percent size={14} className="text-zinc-600" /></div>
                    <div className={`text-3xl font-mono font-bold tracking-tight ${getKPIColor(kpiData.portfolioReturn)}`}>{formatPct(kpiData.portfolioReturn)}</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28 relative overflow-hidden group">
                    <div className="flex justify-between items-start z-10"><span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{isBusiness ? 'Só Equity (Papel)' : INDICES_CONFIG[comparisonIndex].label}</span><Activity size={14} className="text-zinc-600" /></div>
                    <div className={`text-3xl font-mono font-bold tracking-tight z-10 ${getKPIColor(kpiData.indexReturn)}`}>{formatPct(kpiData.indexReturn)}</div>
                    <div className="absolute right-0 top-0 w-24 h-full opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none blur-xl" style={{ backgroundColor: INDICES_CONFIG[comparisonIndex].color }} />
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-start"><span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{isBusiness ? 'Só Distribuições (Bolso)' : `Diferença vs ${INDICES_CONFIG[comparisonIndex].label}`}</span><BarChart2 size={14} className="text-zinc-600" /></div>
                    <div>
                        <div className={`text-2xl font-mono font-bold ${getKPIColor(kpiData.diff)}`}>{kpiData.diff !== null ? (kpiData.diff > 0 ? `+${kpiData.diff.toFixed(2)}%` : `${kpiData.diff.toFixed(2)}%`) : '-'}</div>
                        <div className="text-[10px] text-zinc-500 mt-1 font-medium">{isBusiness ? 'retorno realizado em caixa' : (kpiData.diff !== null ? (kpiData.diff > 0 ? `acima do benchmark` : `abaixo do benchmark`) : 'Sem dados')}</div>
                    </div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-start"><span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Desempenho Relativo</span><TrendingUp size={14} className="text-zinc-600" /></div>
                    <div>
                        <div className={`text-xl font-medium ${isBusiness ? getKPIColor(Number(businessMetrics?.netProfit12m || 0)) : getKPIColor(kpiData.relative)}`}>
                            {isBusiness
                                ? (Number(businessMetrics?.netProfit12m || 0)).toLocaleString('pt-BR', { style: 'currency', currency: portfolio.currency || 'BRL' })
                                : (kpiData.relative !== null ? `${kpiData.relative.toFixed(1)}% ${kpiData.relative > 0 ? 'melhor' : 'pior'}` : '-')}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">{isBusiness ? 'lucro líquido informado (12m)' : 'que o índice selecionado'}</div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                <div className="flex flex-wrap gap-2 mb-8">
                    {Object.entries(INDICES_CONFIG).map(([key, config]) => {
                        const id = key as IndexType;
                        const isVisible = visibleIndices.has(id);
                        return (
                            <button key={id} onClick={() => toggleIndex(id)} disabled={id === 'portfolio'} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${isVisible ? 'bg-zinc-900 border-zinc-700 text-white shadow-sm' : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700'} ${id === 'portfolio' ? 'cursor-default opacity-100 ring-1 ring-amber-500/20' : 'cursor-pointer'} ${comparisonIndex === id && id !== 'portfolio' ? 'ring-1 ring-zinc-500/30' : ''}`} style={isVisible ? { borderColor: config.color } : {}}>
                                <div className={`w-2 h-2 rounded-full transition-colors ${isVisible ? '' : 'bg-zinc-700'}`} style={isVisible ? { backgroundColor: config.color } : {}} />
                                {config.label}
                            </button>
                        );
                    })}
                </div>
                <div className="h-[400px] w-full relative">
                    {!shouldHoldChartUntilAccuratePerformance && chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="displayDate" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} minTickGap={40} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} itemStyle={{ paddingBottom: '2px' }} formatter={(value: number, name: string) => [value !== undefined ? `${value.toFixed(2)}%` : '-', INDICES_CONFIG[name as IndexType]?.label || name]} labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                {Object.entries(INDICES_CONFIG).map(([key, config]) => {
                                    const id = key as IndexType;
                                    if (!visibleIndices.has(id)) return null;
                                    return <Line key={id} type="monotone" dataKey={id} stroke={config.color} strokeWidth={id === 'portfolio' ? 3 : 2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: config.color }} strokeOpacity={id === 'portfolio' ? 1 : 0.7} connectNulls />;
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                            <AlertCircle size={32} className="mb-2 opacity-50" />
                            <p className="text-sm font-medium">{performanceLoading ? 'Carregando rentabilidade...' : 'Rentabilidade indisponível.'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800"><h3 className="text-white font-bold text-sm flex items-center gap-2"><Table size={16} className="text-zinc-500" /> Rentabilidade Mensal</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs whitespace-nowrap">
                        <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                            <tr>
                                <th className="p-3 text-left pl-6 w-16">Ano</th>
                                {MONTHS.map(m => <th key={m} className="p-3 w-16">{m}</th>)}
                                <th className="p-3 w-20 font-bold bg-zinc-900/80">Ano</th>
                                <th className="p-3 w-24 font-bold bg-zinc-900/80 pr-6">Acumulado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {monthlyReturnsTable.length === 0 ? <tr><td colSpan={15} className="p-8 text-zinc-600 text-center italic">Sem dados.</td></tr> : monthlyReturnsTable.map((row) => (
                                <tr key={row.year} className="hover:bg-zinc-900/30 transition-colors">
                                    <td className="p-3 text-left pl-6 font-bold text-white">{row.year}</td>
                                    {MONTHS.map((_, idx) => <td key={idx} className="p-3">{renderCell(row[idx])}</td>)}
                                    <td className="p-3 bg-zinc-900/30 font-bold border-l border-zinc-800/50">{renderCell(row.total)}</td>
                                    <td className="p-3 bg-zinc-900/30 font-bold border-l border-zinc-800/50 pr-6">{renderCell(row.accumulated)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 py-4 border-t border-zinc-900">
                <Info size={12} />
                <p>Comparações com índices têm caráter informativo. Rentabilidade passada não garante futura.</p>
            </div>
        </div>
    );
};

