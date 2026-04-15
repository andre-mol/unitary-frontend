import React from 'react';
import {
    ComposedChart, Line, Area, ResponsiveContainer, PieChart, Pie, Cell,
    Tooltip, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { PieChart as PieChartIcon, Banknote, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PortfolioInfoCard } from './PortfolioInfoCard';
import { Portfolio, CustomItem } from '../../../../types';
import { calculateCurrentValue, calculateTotalInvested } from '../../../../domain/calculations';
import { rebaseSeries, EvolutionPoint } from '../../../../utils/chartHelpers';

const CHART_COLORS = [
    '#f59e0b', '#3f3f46', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4',
];

export type TimeRange = '6M' | '1A' | 'ALL';

interface CustomPieTooltipProps {
    active?: boolean;
    payload?: any[];
    currency?: string;
}

const CustomPieTooltip: React.FC<CustomPieTooltipProps> = ({ active, payload, currency = 'BRL' }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md min-w-[120px]">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].fill }}></span>
                    <span className="text-zinc-400 font-medium">{data.category}</span>
                </div>
                <p className="text-white font-bold font-mono text-sm">
                    {data.totalValue.toLocaleString('pt-BR', { style: 'currency', currency })}
                </p>
                <p className="text-zinc-500 mt-1">{data.items.length} itens</p>
            </div>
        );
    }
    return null;
};

interface TimeRangeButtonProps {
    label: string;
    value: TimeRange;
    current: TimeRange;
    onChange: (value: TimeRange) => void;
}

const TimeRangeButton: React.FC<TimeRangeButtonProps> = ({ label, value, current, onChange }) => (
    <button
        onClick={() => onChange(value)}
        className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${current === value
            ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
            : 'text-zinc-500 hover:text-white'
            }`}
    >
        {label}
    </button>
);

interface OverviewChartsProps {
    portfolio: Portfolio;
    currency: string;
    evolutionData: any[];
    businessEquitySeries?: any[];
    performanceData?: any[];
    targetTotalReturnPct?: number | null;
    benchmarks?: any[]; // added
    dividendsReceived?: number;
    rentIncomeEvents?: Array<{ date: string; totalValue: number }>;
    groupedItems: any[];
    cashFlowData: any[];
    businessCashFlowData?: any[];
    items: CustomItem[];
    totalUnits: number;
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    onOpenSettings: () => void;
    isRealEstate: boolean;
    isBusiness: boolean;
}

export const OverviewCharts: React.FC<OverviewChartsProps> = ({
    portfolio,
    currency,
    evolutionData,
    businessEquitySeries = [],
    performanceData = [],
    targetTotalReturnPct = null,
    benchmarks = [],
    dividendsReceived = 0,
    rentIncomeEvents = [],
    groupedItems,
    cashFlowData,
    businessCashFlowData = [],
    items,
    totalUnits,
    timeRange,
    onTimeRangeChange,
    onOpenSettings,
    isRealEstate,
    isBusiness
}) => {
    const [isCashFlowHover, setIsCashFlowHover] = React.useState(false);
    const [hoveredCashFlowName, setHoveredCashFlowName] = React.useState<string | null>(null);

    const navDataWithRentIncome = React.useMemo(() => {
        if (!isRealEstate || !evolutionData.length || !rentIncomeEvents.length) return evolutionData;

        const sortedNav = [...evolutionData].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
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
    }, [isRealEstate, evolutionData, rentIncomeEvents]);

    const realEstateFlowRings = React.useMemo(() => {
        const normalized = cashFlowData.map((entry) => {
            const absValue = Math.abs(Number(entry.value) || 0);
            return { ...entry, absValue };
        });

        const maxAbs = Math.max(...normalized.map((entry) => entry.absValue), 0);

        return normalized.map((entry) => ({
            ...entry,
            progress: maxAbs > 0 ? Math.min(1, entry.absValue / maxAbs) : 0,
        }));
    }, [cashFlowData]);

    const cashFlowBadgeMeta = React.useMemo(() => ({
        'Receita Bruta': {
            Icon: ArrowUpRight,
            accent: 'text-emerald-400 border-emerald-500/30',
            offsetX: -140,
            offsetY: -108,
        },
        'Custos Fixos': {
            Icon: ArrowDownRight,
            accent: 'text-rose-400 border-rose-500/30',
            offsetX: 140,
            offsetY: -108,
        },
        'Renda Líquida': {
            Icon: Banknote,
            accent: 'text-amber-400 border-amber-500/30',
            offsetX: 0,
            offsetY: -148,
        },
    }), []);

    // Calculate Profitability (vs cost) FIRST - needed for tooltip
    const { profitability, profitabilityPercentage, totalCost } = React.useMemo(() => {
        const totalValue = items.reduce((acc, item) => acc + calculateCurrentValue(item), 0);
        const totalCost = items.reduce((acc, item) => acc + calculateTotalInvested(item), 0);
        const totalRentIncome = isRealEstate
            ? (rentIncomeEvents || []).reduce((acc, e) => acc + Number(e.totalValue || 0), 0)
            : 0;
        const nonRealEstateIncome = isRealEstate ? 0 : Number(dividendsReceived || 0);
        const profit = totalValue + totalRentIncome + nonRealEstateIncome - totalCost;
        const percent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

        return {
            profitability: profit,
            profitabilityPercentage: percent,
            totalCost
        };
    }, [items, isRealEstate, rentIncomeEvents, dividendsReceived]);

    const portfolioSeriesSource = React.useMemo(
        () => (isBusiness
            ? (businessEquitySeries.length > 0 ? businessEquitySeries : evolutionData)
            : isRealEstate
            ? navDataWithRentIncome
            : performanceData),
        [isBusiness, businessEquitySeries, evolutionData, isRealEstate, navDataWithRentIncome, performanceData, timeRange]
    );

    const indexedMirrorBenchmark = null as null | 'CDI' | 'IPCA';

    const profitabilityChartSeries = React.useMemo(() => {
        if (isRealEstate || isBusiness || performanceData.length === 0) return [] as EvolutionPoint[];

        let merged = performanceData as EvolutionPoint[];

        if (benchmarks.length > 0) {
            const dedupMap = new Map<string, any>();

            for (const row of benchmarks) {
                if (!row?.date) continue;
                const key = String(row.date).split('T')[0];
                const prev = dedupMap.get(key);

                if (!prev) {
                    dedupMap.set(key, { ...row, date: key });
                    continue;
                }

                const mergeField = (field: 'cdi' | 'ipca') => {
                    const a = prev[field];
                    const b = row[field];
                    if (b === undefined || b === null) return a;
                    if (a === undefined || a === null) return b;
                    return Math.abs(Number(b)) > Math.abs(Number(a)) ? b : a;
                };

                dedupMap.set(key, {
                    date: key,
                    cdi: mergeField('cdi'),
                    ipca: mergeField('ipca'),
                });
            }

            const sortedBenchmarks = Array.from(dedupMap.values()).sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

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

                return closest;
            };

            merged = (performanceData as EvolutionPoint[]).map((point) => {
                const dateKey = String(point.fullDate).split('T')[0];
                const bench = findClosestBenchmark(dateKey);
                return {
                    ...point,
                    cdi: bench?.cdi,
                    ipca: bench?.ipca,
                };
            });
        }

        if (merged.length === 0 || timeRange === 'ALL') {
            return merged;
        }

        const startDate = new Date(merged[0].fullDate);
        return rebaseSeries(merged, startDate);
    }, [benchmarks, isBusiness, isRealEstate, performanceData, timeRange]);

    const businessFlowLayeredData = React.useMemo(() => {
        if (!isBusiness || !businessCashFlowData.length) return [];
        return businessCashFlowData.map((row: any, index: number) => {
            const distributions = Number(row.distributions || 0);
            const capitalCalls = Number(row.capitalCalls || 0);
            const netProfit = Number(row.netProfit || 0);
            const totalMovement = Math.max(distributions + capitalCalls, distributions, capitalCalls);
            return {
                idx: index + 1,
                month: row.month,
                layerDark: totalMovement,
                layerOrange: distributions,
                lineValue: netProfit,
            };
        });
    }, [isBusiness, businessCashFlowData]);

    // Merge logic
    const rawEvents = React.useMemo(() => {
        const usingPerformance = !isRealEstate && !isBusiness && timeRange !== 'ALL' && performanceData.length > 0;
        const sortedNav = usingPerformance
            ? [...evolutionData].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
            : [];
        const findClosestNav = (targetDate: string) => {
            if (!sortedNav.length) return undefined;
            const targetTime = new Date(targetDate).getTime();
            let closest = sortedNav[0];
            for (const navPoint of sortedNav) {
                const navTime = new Date(navPoint.fullDate).getTime();
                if (navTime <= targetTime) {
                    closest = navPoint;
                    continue;
                }
                break;
            }
            return Number(closest?.value) || 0;
        };

        if (!benchmarks.length) {
            return portfolioSeriesSource.map((point) => ({
                ...point,
                absoluteValue: usingPerformance ? findClosestNav(point.fullDate) : (Number(point.value) || 0),
            }));
        }

        // Sort benchmarks by date for efficient lookup
        const sortedBenchmarks = [...benchmarks].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Helper to find closest benchmark (LOCF - Last Observation Carried Forward)
        const findClosestBenchmark = (targetDate: string) => {
            const targetTime = new Date(targetDate).getTime();

            // Find the last benchmark that is <= target date
            let closest = null;
            let closestDistance = Infinity;

            for (const bench of sortedBenchmarks) {
                const benchTime = new Date(bench.date).getTime();
                const distance = targetTime - benchTime;

                // Prefer benchmarks on or before target date
                if (distance >= 0 && distance < closestDistance) {
                    closest = bench;
                    closestDistance = distance;
                }

                // If we've passed the target date, stop searching
                if (distance < 0) break;
            }

            // If no benchmark before target, use first available (forward fill)
            if (!closest && sortedBenchmarks.length > 0) {
                closest = sortedBenchmarks[0];
            }

            return closest;
        };

        return portfolioSeriesSource.map(point => {
            const dateKey = point.fullDate.split('T')[0];
            const bench = findClosestBenchmark(dateKey);
            return {
                ...point,
                absoluteValue: usingPerformance ? findClosestNav(dateKey) : (Number(point.value) || 0),
                cdi: bench?.cdi !== undefined && bench?.cdi !== null ? bench.cdi : undefined,
                ipca: bench?.ipca !== undefined && bench?.ipca !== null ? bench.ipca : undefined
            };
        });
    }, [portfolioSeriesSource, benchmarks, isRealEstate, isBusiness, performanceData, evolutionData, timeRange]);

    // AIDEV-FIX: Normalizar usando custo de aquisiÃ§Ã£o como baseline
    // Isso garante que o grÃ¡fico mostre a rentabilidade real vs o que vocÃª pagou
    // Ex: Se comprou a R$1 e agora vale R$3,85, mostra +285% (nÃ£o comparado ao inÃ­cio do perÃ­odo)
    const normalizeBenchmarkDecimal = (raw: number | undefined | null) => {
        if (raw === undefined || raw === null || Number.isNaN(Number(raw))) return undefined;
        const n = Number(raw);
        return Math.abs(n) < 50 ? n : ((n / 100) - 1);
    };

    // Source parity with Rentabilidade page:
    // - prefer performance series when available
    // - fallback to NAV series while performance is unavailable
    const chartData = React.useMemo(() => {
        if (!isRealEstate && !isBusiness && profitabilityChartSeries.length > 0) {
            const sortedNav = [...evolutionData].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

            const findClosestNav = (targetDate: string) => {
                if (!sortedNav.length) return 0;
                const targetTime = new Date(targetDate).getTime();
                let closest = sortedNav[0];

                for (const navPoint of sortedNav) {
                    const navTime = new Date(navPoint.fullDate).getTime();
                    if (navTime <= targetTime) {
                        closest = navPoint;
                        continue;
                    }
                    break;
                }

                return Number(closest?.value) || 0;
            };

            const base = profitabilityChartSeries.map((point) => ({
                ...point,
                absoluteValue: findClosestNav(point.fullDate),
                normalizedValue: (Number(point.value) || 0) * 100,
                normalizedCdi: point.cdi !== undefined ? Number(point.cdi) * 100 : undefined,
                normalizedIpca: point.ipca !== undefined ? Number(point.ipca) * 100 : undefined,
            }));

            return base;
        }

        if (!rawEvents.length) return [];

        const sorted = [...rawEvents].sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
        const usingPerformance = !isRealEstate && !isBusiness && timeRange !== 'ALL' && performanceData.length > 0;
        const firstPortfolio = sorted.find((p) => Number(p.value) > 0) ?? sorted[0];

        const portfolioBase = (timeRange === 'ALL' && totalCost > 0)
            ? totalCost
            : Math.max(Number(firstPortfolio.value) || 0, 1);
        const perfBase = Number(sorted[0]?.value) || 0;

        const cdiBase = normalizeBenchmarkDecimal(sorted.find((p) => normalizeBenchmarkDecimal(p.cdi) !== undefined)?.cdi);
        const ipcaBase = normalizeBenchmarkDecimal(sorted.find((p) => normalizeBenchmarkDecimal(p.ipca) !== undefined)?.ipca);

        const rebaseBenchmark = (curr: number | undefined, base: number | undefined) => {
            if (curr === undefined || base === undefined) return undefined;
            const denom = 1 + base;
            if (denom <= 0) return undefined;
            return (((1 + curr) / denom) - 1) * 100;
        };

        const mapped = sorted.map((point) => {
            const rawPortfolio = Number(point.value) || 0;
            const portfolio = usingPerformance
                ? (timeRange === 'ALL'
                    ? rawPortfolio * 100
                    : (((1 + rawPortfolio) / (1 + perfBase)) - 1) * 100)
                : (portfolioBase > 0
                    ? ((rawPortfolio / portfolioBase) - 1) * 100
                    : 0);
            const cdiCurr = normalizeBenchmarkDecimal(point.cdi);
            const ipcaCurr = normalizeBenchmarkDecimal(point.ipca);

            return {
                ...point,
                normalizedValue: portfolio,
                normalizedCdi: rebaseBenchmark(cdiCurr, cdiBase),
                normalizedIpca: rebaseBenchmark(ipcaCurr, ipcaBase)
            };
        });

        if (usingPerformance || timeRange !== 'ALL' || mapped.length === 0) {
            return mapped;
        }

        return mapped;
    }, [rawEvents, totalCost, timeRange, performanceData, isRealEstate, isBusiness, indexedMirrorBenchmark, profitabilityChartSeries, evolutionData]);

    const displayedPortfolioReturnPct = React.useMemo(() => {
        if (isRealEstate || isBusiness) return profitabilityPercentage;
        const latest = chartData[chartData.length - 1]?.normalizedValue;
        if (Number.isFinite(Number(latest))) return Number(latest);
        if (targetTotalReturnPct !== null && targetTotalReturnPct !== undefined) return Number(targetTotalReturnPct);
        return profitabilityPercentage;
    }, [chartData, isBusiness, isRealEstate, profitabilityPercentage, targetTotalReturnPct]);

    const displayProfitabilityMetrics = React.useMemo(() => {
        if (!isRealEstate && !isBusiness && totalCost > 0) {
            return {
                profitability: totalCost * (displayedPortfolioReturnPct / 100),
                profitabilityPercentage: displayedPortfolioReturnPct,
            };
        }

        return {
            profitability,
            profitabilityPercentage: displayedPortfolioReturnPct,
        };
    }, [displayedPortfolioReturnPct, isBusiness, isRealEstate, profitability, totalCost]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart 1: Evolution */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col h-[400px]">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            {isBusiness ? 'Evolução do Equity (Sua Participação)' : 'Evolução Patrimonial'}
                        </h3>
                        <p className="text-[10px] text-zinc-600">{isBusiness ? 'Valor estimado/informado da sua participação' : 'Histórico de valor de mercado'}</p>
                    </div>
                    <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
                        <TimeRangeButton label="6M" value="6M" current={timeRange} onChange={onTimeRangeChange} />
                        <TimeRangeButton label="1A" value="1A" current={timeRange} onChange={onTimeRangeChange} />
                        <TimeRangeButton label="ALL" value="ALL" current={timeRange} onChange={onTimeRangeChange} />
                    </div>
                </div>

                <div className="flex-1 w-full mt-4 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#27272a" stopOpacity={0.5} />
                                    <stop offset="95%" stopColor="#27272a" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                            <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            {/* Comparison: Percentage Variation */}
                            <YAxis
                                stroke="#52525b"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={['auto', 'auto']}
                                tickFormatter={(val) => `${val}%`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: '12px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    const data = payload[0]?.payload;
                                    return (
                                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs min-w-[180px]">
                                            <p className="text-zinc-400 font-medium mb-2">{label}</p>
                                            <div className="space-y-1.5">
                                                {/* Valor absoluto */}
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Valor:</span>
                                                    <span className="text-white font-mono">
                                                        {(Number(data?.absoluteValue ?? data?.value) || 0).toLocaleString('pt-BR', { style: 'currency', currency })}
                                                    </span>
                                                </div>
                                                {/* Rentabilidade vs custo (linha amarela do grÃ¡fico) */}
                                                <div className="flex justify-between">
                                                    <span className="text-amber-400">Portfólio:</span>
                                                    <span className={`font-mono font-medium ${(data?.normalizedValue || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {(data?.normalizedValue || 0) >= 0 ? '+' : ''}{data?.normalizedValue?.toFixed(2)}%
                                                    </span>
                                                </div>
                                                {/* Benchmarks - variaÃ§Ã£o no perÃ­odo */}
                                                {data?.normalizedCdi !== undefined && (
                                                    <div className="flex justify-between">
                                                        <span className="text-zinc-500">CDI:</span>
                                                        <span className="font-mono text-zinc-400">
                                                            {(data?.normalizedCdi || 0) >= 0 ? '+' : ''}{data?.normalizedCdi?.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                )}
                                                {data?.normalizedIpca !== undefined && (
                                                    <div className="flex justify-between">
                                                        <span className="text-yellow-400">IPCA:</span>
                                                        <span className={`font-mono ${(data?.normalizedIpca || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {(data?.normalizedIpca || 0) >= 0 ? '+' : ''}{data?.normalizedIpca?.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-zinc-600 mt-2 border-t border-zinc-800 pt-2">
                                                {!isRealEstate && !isBusiness
                                                    ? 'Portfólio: rentabilidade acumulada'
                                                    : 'Portfólio: vs. custo de aquisição'}
                                            </p>
                                        </div>
                                    );
                                }}
                            />
                            {/* Portfolio Line (Normalized) */}
                            <Area type="monotone" dataKey="normalizedValue" name="Portfólio" stroke="#fbbf24" fill="url(#colorVal)" strokeWidth={2} />

                            {/* Benchmarks (Normalized) */}
                            <Line type="monotone" dataKey="normalizedCdi" name="CDI" stroke="#3f3f46" strokeDasharray="3 3" dot={false} strokeWidth={1.5} connectNulls />
                            <Line type="monotone" dataKey="normalizedIpca" name="IPCA" stroke="#eab308" dot={false} strokeWidth={1.5} connectNulls />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* ... rest */}


            {/* Chart 2: Distribution or CashFlow */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col h-[400px]">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    {isRealEstate ? 'Fluxo de Caixa Mensal' : isBusiness ? 'Fluxo do Sócio' : 'Distribuição'}
                </h3>
                <p className="text-[10px] text-zinc-600 mb-6">
                    {isRealEstate ? 'Receitas e Despesas Atuais' : isBusiness ? 'Distribuições vs Aportes por mês' : 'Por categoria'}
                </p>

                <div className="flex-1 w-full relative min-h-0">
                    {isRealEstate ? (
                        cashFlowData.some(d => d.value !== 0) ? (
                            <div className="h-full flex flex-col">
                                <div
                                    className="flex-1 relative min-h-[260px]"
                                    onMouseEnter={() => setIsCashFlowHover(true)}
                                    onMouseLeave={() => {
                                        setIsCashFlowHover(false);
                                        setHoveredCashFlowName(null);
                                    }}
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            {realEstateFlowRings.map((ring, idx) => {
                                                const outerRadius = 122 - (idx * 26);
                                                const innerRadius = outerRadius - 14;
                                                const isActive = !hoveredCashFlowName || hoveredCashFlowName === ring.name;

                                                return (
                                                    <React.Fragment key={ring.name}>
                                                        {/* Track */}
                                                        <Pie
                                                            data={[{ name: 'track', value: 1 }]}
                                                            dataKey="value"
                                                            startAngle={180}
                                                            endAngle={0}
                                                            cx="50%"
                                                            cy="82%"
                                                            innerRadius={innerRadius}
                                                            outerRadius={outerRadius}
                                                            stroke="none"
                                                            fill="#18181b"
                                                            isAnimationActive={false}
                                                        />

                                                        {/* Progress */}
                                                        <Pie
                                                            data={[
                                                                { name: ring.name, value: ring.progress },
                                                                { name: 'rest', value: 1 - ring.progress },
                                                            ]}
                                                            dataKey="value"
                                                            startAngle={180}
                                                            endAngle={0}
                                                            cx="50%"
                                                            cy="82%"
                                                            innerRadius={innerRadius}
                                                            outerRadius={outerRadius}
                                                            stroke="none"
                                                            onMouseEnter={(data: any) => {
                                                                if (data?.name && data.name !== 'rest') {
                                                                    setIsCashFlowHover(true);
                                                                    setHoveredCashFlowName(String(data.name));
                                                                }
                                                            }}
                                                        >
                                                            <Cell fill={ring.color} fillOpacity={isActive ? 1 : 0.35} />
                                                            <Cell fill="transparent" />
                                                        </Pie>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className="absolute left-1/2 bottom-2 -translate-x-1/2 text-center pointer-events-none">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Resultado Líquido</p>
                                        <p className={`text-sm font-mono font-bold ${(cashFlowData[2]?.value || 0) >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                            {(cashFlowData[2]?.value || 0).toLocaleString('pt-BR', { style: 'currency', currency })}
                                        </p>
                                    </div>

                                    {realEstateFlowRings.map((entry) => {
                                        const meta = (cashFlowBadgeMeta as any)[entry.name] || {};
                                        const Icon = meta.Icon || Banknote;
                                        const isFocused = !hoveredCashFlowName || hoveredCashFlowName === entry.name;
                                        const offsetX = Number(meta.offsetX || 0);
                                        const offsetY = Number(meta.offsetY || 0);
                                        const animatedX = isCashFlowHover ? offsetX : 0;
                                        const animatedY = isCashFlowHover ? offsetY : 0;
                                        const badgeOpacity = isCashFlowHover ? (isFocused ? 1 : 0.58) : 0;

                                        return (
                                            <div
                                                key={entry.name}
                                                className="absolute z-10 left-1/2 top-[58%] pointer-events-none"
                                                style={{
                                                    opacity: badgeOpacity,
                                                    transform: `translate(calc(-50% + ${animatedX}px), calc(-50% + ${animatedY}px)) scale(${isFocused ? 1 : 0.98})`,
                                                    transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
                                                }}
                                            >
                                                <div className={`bg-zinc-950/95 border rounded-md px-2 py-1.5 backdrop-blur-sm ${meta.accent || 'border-zinc-700 text-zinc-300'}`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <Icon size={12} />
                                                        <span className="text-[9px] uppercase tracking-wide font-semibold">{entry.name}</span>
                                                    </div>
                                                    <p className="text-[10px] font-mono text-zinc-100 mt-1">
                                                        {(entry.value || 0).toLocaleString('pt-BR', { style: 'currency', currency })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                                <Banknote className="mb-2 opacity-50" size={32} />
                                <span className="text-xs">Sem fluxo de caixa</span>
                            </div>
                        )
                    ) : isBusiness ? (
                        businessFlowLayeredData.length > 0 ? (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={businessFlowLayeredData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="bizLayerDark" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#7c2d12" stopOpacity={0.52} />
                                                    <stop offset="100%" stopColor="#3f3f46" stopOpacity={0.08} />
                                                </linearGradient>
                                        <linearGradient id="bizLayerOrange" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.88} />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.08} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                                    <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: '12px', color: '#fff', borderRadius: '12px' }}
                                        formatter={(value: number, name: string, entry: any) => {
                                            const key = String(entry?.dataKey || '');
                                            const label =
                                                key === 'layerDark' || name === 'Movimentação Total'
                                                    ? 'Movimentação Total'
                                                    : key === 'layerOrange' || name === 'Distribuições'
                                                        ? 'Distribuições'
                                                        : 'Lucro Líquido (Informado)';
                                            return [value.toLocaleString('pt-BR', { style: 'currency', currency }), label];
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="layerDark"
                                        name="Movimentação Total"
                                        stroke="#6b7280"
                                        fill="url(#bizLayerDark)"
                                        strokeWidth={1.6}
                                        dot={false}
                                        activeDot={{ r: 3 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="layerOrange"
                                        name="Distribuições"
                                        stroke="#f59e0b"
                                        fill="url(#bizLayerOrange)"
                                        strokeWidth={2.2}
                                        dot={false}
                                        activeDot={{ r: 3 }}
                                    />
                                            <Line
                                                type="monotone"
                                                dataKey="lineValue"
                                                name="Lucro Líquido (Informado)"
                                                stroke="#fb923c"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#fb923c', strokeWidth: 0 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-zinc-500">
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500/80" />Movimentação Total</div>
                                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Distribuições</div>
                                    <div className="flex items-center gap-1.5"><span className="w-4 h-[2px] bg-orange-400" />Lucro Líquido</div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                                <Banknote className="mb-2 opacity-50" size={32} />
                                <span className="text-xs">Sem eventos de fluxo</span>
                            </div>
                        )
                    ) : (
                        items.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={groupedItems} dataKey="totalValue" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                                            {groupedItems.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomPieTooltip currency={currency} />} offset={30} cursor={false} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-mono font-medium text-zinc-400">{groupedItems.length}</span>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                                <PieChartIcon className="mb-2 opacity-50" size={32} />
                                <span className="text-xs">Sem dados</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="h-[400px]">
                <PortfolioInfoCard
                    portfolio={portfolio}
                    itemCount={items.length}
                    categoriesCount={groupedItems.length}
                    totalUnits={totalUnits}
                    profitability={displayProfitabilityMetrics.profitability}
                    profitabilityPercentage={displayProfitabilityMetrics.profitabilityPercentage}
                    className="h-full"
                    onOpenSettings={onOpenSettings}
                />
            </div>
        </div>
    );
};
