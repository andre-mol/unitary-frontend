
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { portfolioService } from '../../lib/portfolioService';
import { calculateTotalInvested } from '../../domain/calculations/asset';
import { Portfolio } from '../../types';
import {
    ArrowLeft, Info, AlertCircle,
    BarChart2, Percent, Activity, Table, TrendingUp
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { rebaseSeries, EvolutionPoint } from '../../utils/chartHelpers';
import { fetchPerformanceData, fetchBenchmarkData } from '../../lib/queries/portfolios';

// --- CONFIGURATION ---

type IndexType = 'portfolio' | 'portfolioPrice' | 'cdi' | 'ipca' | 'ibov' | 'spx' | 'ifix' | 'idiv' | 'smll' | 'ivvb11';
type PeriodType = '6M' | '1A' | 'ALL';

const INDICES_CONFIG: Record<IndexType, { label: string; color: string; disabled?: boolean }> = {
    portfolio: { label: 'Retorno Total', color: '#f59e0b' }, // Amber-500
    portfolioPrice: { label: 'Valorização', color: '#3b82f6' }, // Blue-500
    cdi: { label: 'CDI', color: '#10b981' },      // Emerald-500
    ipca: { label: 'IPCA', color: '#eab308' },    // Yellow-500
    ibov: { label: 'IBOV', color: '#8b5cf6' },    // Violet-500
    spx: { label: 'S&P 500', color: '#64748b' },  // Slate-500
    ifix: { label: 'IFIX', color: '#06b6d4' },    // Cyan-500
    idiv: { label: 'IDIV', color: '#ec4899' },    // Pink-500
    smll: { label: 'SMLL', color: '#84cc16' },    // Lime-500
    ivvb11: { label: 'IVVB11', color: '#d946ef' } // Fuchsia-500
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function parseFlexibleDate(value?: string | null): Date | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const isoCandidate = raw.includes('T') ? raw : raw.replace(/\//g, '-');
    const iso = new Date(isoCandidate);
    if (!Number.isNaN(iso.getTime())) return iso;

    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        const [, dd, mm, yyyy] = br;
        const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

export const PortfolioProfitabilityPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [evolutionData, setEvolutionData] = useState<EvolutionPoint[]>([]);
    const [benchmarkData, setBenchmarkData] = useState<Array<{
        date: string;
        cdi?: number;
        ipca?: number;
        ibov?: number;
        spx?: number;
        ifix?: number;
        idiv?: number;
        smll?: number;
        ivvb11?: number;
    }>>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [period, setPeriod] = useState<PeriodType>('ALL');
    const [viewMode, setViewMode] = useState<'TOTAL' | 'PRICE'>('TOTAL');
    const [visibleIndices, setVisibleIndices] = useState<Set<IndexType>>(new Set(['portfolio', 'portfolioPrice', 'cdi']));
    const [comparisonIndex, setComparisonIndex] = useState<IndexType>('cdi');

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;

            setLoading(true);
            try {
                const p = await portfolioService.getPortfolioById(id);
                if (p) {
                    setPortfolio(p);
                    const portfolioItems = await portfolioService.getCustomItems(id);
                    setItems(portfolioItems);
                } else {
                    navigate('/dashboard/portfolios');
                }
            } catch (err) {
                console.error('Error loading portfolio:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, navigate]);

    // Load evolution data when period changes
    useEffect(() => {
        const loadEvolutionData = async () => {
            if (!id || !portfolio) return;

            try {
                // Calculate custom start date for ALL period
                let customStartDate: string | undefined;
                if (period === 'ALL' && items.length > 0) {
                    let oldestDate = new Date();
                    for (const item of items) {
                        const itemDate = parseFlexibleDate(item.initialDate);
                        if (itemDate && itemDate < oldestDate) oldestDate = itemDate;
                    }
                    customStartDate = oldestDate.toISOString().split('T')[0];
                }

                // Convert period to range format
                const range: '6M' | '1A' | 'ALL' = period === '6M' ? '6M' : period === '1A' ? '1A' : 'ALL';

                const [evoData, benchData] = await Promise.all([
                    fetchPerformanceData(id, range),
                    fetchBenchmarkData(range, customStartDate)
                ]);

                setEvolutionData(evoData);
                setBenchmarkData(benchData);
            } catch (err) {
                console.error('Error loading evolution data:', err);
            }
        };

        loadEvolutionData();
    }, [id, portfolio, period, items]);

    // --- DATA PROCESSING LAYER ---

    // Calculate total cost (acquisition cost) for normalization
    const totalCost = useMemo(() => {
        return items.reduce((acc, item) => acc + calculateTotalInvested(item), 0);
    }, [items]);

    // Merge evolution data with benchmarks (LOCF - Last Observation Carried Forward)
    // Merge evolution data with benchmarks (LOCF) & Rebase
    const processedEvents = useMemo(() => {
        if (!benchmarkData.length && !evolutionData.length) return [];
        let merged = evolutionData;

        // 1. Merge Benchmarks if available
        if (benchmarkData.length > 0) {
            const dedupMap = new Map<string, any>();
            for (const row of benchmarkData) {
                if (!row?.date) continue;
                const key = String(row.date).split('T')[0];
                const prev = dedupMap.get(key);
                if (!prev) {
                    dedupMap.set(key, { ...row, date: key });
                    continue;
                }
                const mergeField = (field: keyof typeof row) => {
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
                    ibov: mergeField('ibov'),
                    spx: mergeField('spx'),
                    ifix: mergeField('ifix'),
                    idiv: mergeField('idiv'),
                    smll: mergeField('smll'),
                    ivvb11: mergeField('ivvb11')
                });
            }

            // Sort benchmarks
            const sortedBenchmarks = Array.from(dedupMap.values()).sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            // Forward Fill Helper
            const findClosestBenchmark = (targetDate: string) => {
                const targetTime = new Date(targetDate).getTime();
                let closest = null;
                // Simple approximate find since both are daily
                // Optimization: Assume sorted, could use binary search or pointer
                // MVP: existing LOCF array find
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

            merged = evolutionData.map(point => {
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
        }

        // 2. Keep ALL as true accumulated return; rebase only shorter windows.
        if (merged.length === 0) return [];
        if (period === 'ALL') return merged;

        const startDate = new Date(merged[0].fullDate);
        return rebaseSeries(merged, startDate);
    }, [evolutionData, benchmarkData, period]);

    // 2. Chart Data (using processed/rebased data)
    const chartData = useMemo(() => {
        if (processedEvents.length === 0) return [];

        return processedEvents.map(point => ({
            date: point.fullDate.split('T')[0],
            displayDate: new Date(point.fullDate).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),

            // BIND TO VIEW MODE
            // rebaseSeries already returns decimal values (0.10 for 10%)
            // We multiply by 100 for display
            portfolio: viewMode === 'TOTAL' ? point.value * 100 : (point.valuePrice || 0) * 100,

            // Benchmarks (already rebased to decimal returns in chartHelpers)
            cdi: point.cdi !== undefined ? point.cdi * 100 : undefined,
            ipca: point.ipca !== undefined ? point.ipca * 100 : undefined,
            ibov: point.ibov !== undefined ? point.ibov * 100 : undefined,
            spx: point.spx !== undefined ? point.spx * 100 : undefined,
            ifix: point.ifix !== undefined ? point.ifix * 100 : undefined,
            idiv: point.idiv !== undefined ? point.idiv * 100 : undefined,
            smll: point.smll !== undefined ? point.smll * 100 : undefined,
            ivvb11: point.ivvb11 !== undefined ? point.ivvb11 * 100 : undefined
        }));
    }, [processedEvents, viewMode]);

    // 3. Table Data (Monthly Returns) - Calculate from processed (rebased) data?
    // Actually, table should show monthly variations, which are independent of the rebase start point.
    // So we should use `evolutionData` (cumulative returns) to calculate monthly deltas.
    // Delta_Month = (1 + Cum_End) / (1 + Cum_Start) - 1

    const monthlyReturnsTable = useMemo(() => {
        if (evolutionData.length === 0) return [];

        // Helper to find raw cumulative value at a specific date
        // Note: we use `evolutionData` which has the absolute cumulative return series
        // This ensures the table values are consistent regardless of the chart view period (1Y/6M).
        // BUT, the Plan says "Range Selector must rebase the chart".
        // The table usually shows HISTORY. So it should probably just show history derived from the full series available.
        // However, `evolutionData` ONLY contains data for the selected period if fetching is limited.
        // If fetch limited to 6M, table only shows 6M. That's acceptable.

        const getValueAt = (d: Date) => {
            const targetTime = d.getTime();
            let lastPoint = null;
            for (const point of evolutionData) {
                const pointTime = new Date(point.fullDate).getTime();
                if (pointTime <= targetTime) lastPoint = point;
                else break;
            }
            if (!lastPoint) return null;
            return viewMode === 'TOTAL' ? lastPoint.value : (lastPoint.valuePrice || 0);
        };

        const initialDate = new Date(evolutionData[0].fullDate);
        const startYear = initialDate.getFullYear();
        const currentYear = new Date().getFullYear();
        const years = [];

        for (let year = currentYear; year >= startYear; year--) {
            const row: Record<string | number, number | null> = { year };

            for (let month = 0; month < 12; month++) {
                const monthEnd = new Date(year, month + 1, 0);
                const monthStart = new Date(year, month, 0);

                if (monthEnd > new Date()) {
                    row[month] = null;
                    continue;
                }
                if (monthEnd < initialDate) {
                    row[month] = null;
                    continue;
                }

                const startVal = getValueAt(monthStart);
                const endVal = getValueAt(monthEnd);

                if (endVal !== null) {
                    if (startVal !== null) {
                        // Geometric Difference: (1+End)/(1+Start) - 1
                        row[month] = ((1 + endVal) / (1 + startVal) - 1) * 100;
                    } else {
                        // First month: (1+End)/(1+0) - 1 => End
                        row[month] = endVal * 100;
                    }
                } else {
                    row[month] = null;
                }
            }

            // Year Total
            const yearStartDate = new Date(year, 0, 0);
            const yearEndDate = year === currentYear ? new Date() : new Date(year, 11, 31);

            const yStart = getValueAt(yearStartDate);
            const yEnd = getValueAt(yearEndDate);

            if (yEnd !== null) {
                if (yStart !== null) {
                    row.total = ((1 + yEnd) / (1 + yStart) - 1) * 100;
                } else {
                    row.total = yEnd * 100;
                }
            } else {
                row.total = null;
            }

            // Accumulated (Since Inception of DATA)
            // Just use the latest value of the year? No, that's cumulative since inception.
            if (yEnd !== null) {
                row.accumulated = yEnd * 100;
            } else {
                row.accumulated = null;
            }

            years.push(row);
        }
        return years;
    }, [evolutionData, viewMode]);

    // --- KPI CALCULATION LAYER ---

    const kpiData = useMemo(() => {
        if (chartData.length < 1) return {
            portfolioReturn: null,
            indexReturn: null,
            diff: null,
            relative: null
        };

        const lastPoint = chartData[chartData.length - 1];
        const portfolioReturn = lastPoint.portfolio ?? 0;
        const indexReturn = lastPoint[comparisonIndex as keyof typeof lastPoint] as number | undefined;
        const diff = indexReturn !== undefined ? portfolioReturn - indexReturn : null;
        const relative = indexReturn !== undefined
            ? (((1 + portfolioReturn / 100) / (1 + indexReturn / 100)) - 1) * 100
            : null;

        return { portfolioReturn, indexReturn, diff, relative };
    }, [chartData, comparisonIndex]);

    // --- HANDLERS ---

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

    // --- RENDER HELPERS ---

    const formatPct = (val: number | null | undefined) => {
        if (val === null || val === undefined) return '—';
        return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
    };

    const getKPIColor = (val: number | null | undefined, invert = false) => {
        if (val === null || val === undefined) return 'text-zinc-500';
        if (Math.abs(val) < 0.01) return 'text-zinc-400';
        const isPositive = val > 0;
        if (invert) return isPositive ? 'text-red-500' : 'text-green-500';
        return isPositive ? 'text-green-500' : 'text-red-500';
    };

    // Helper for table cells
    const renderCell = (value: number | null) => {
        if (value === null) return <span className="text-zinc-600 font-light">-</span>;
        const color = value >= 0 ? 'text-green-500' : 'text-red-500';
        return <span className={`text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>;
    };

    if (!portfolio || loading) {
        return (
            <DashboardLayout title="Carregando..." subtitle="Análise de Rentabilidade">
                <div className="flex items-center justify-center h-64">
                    <div className="text-zinc-500">Carregando dados...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title={portfolio.name} subtitle="Análise de Rentabilidade">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header / Nav */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-6">
                    <div>
                        <Link to={`/dashboard/portfolio/${portfolio.id}`} className="inline-flex items-center text-xs text-zinc-500 hover:text-white mb-2 transition-colors">
                            <ArrowLeft size={12} className="mr-1" /> Voltar ao Dashboard
                        </Link>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Rentabilidade Histórica
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {/* Toggle Mode */}
                        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 mr-2">
                            <button
                                onClick={() => setViewMode('TOTAL')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'TOTAL' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Retorno Total
                            </button>
                            <button
                                onClick={() => setViewMode('PRICE')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'PRICE' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Valorização
                            </button>
                        </div>

                        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                            {[
                                { id: 'ALL', label: 'Tudo' },
                                { id: '1A', label: '1 Ano' },
                                { id: '6M', label: '6 Meses' }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setPeriod(opt.id as PeriodType)}
                                    className={`
                                        px-4 py-1.5 rounded-md text-xs font-medium transition-colors
                                        ${period === opt.id
                                            ? 'bg-zinc-800 text-white shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }
                                    `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 1. KPIs Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Rentabilidade</span>
                            <Percent size={14} className="text-zinc-600" />
                        </div>
                        <div className={`text-3xl font-mono font-bold tracking-tight ${getKPIColor(kpiData.portfolioReturn)}`}>
                            {formatPct(kpiData.portfolioReturn)}
                        </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28 relative overflow-hidden group">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{INDICES_CONFIG[comparisonIndex].label}</span>
                            <Activity size={14} className="text-zinc-600" />
                        </div>
                        <div className={`text-3xl font-mono font-bold tracking-tight z-10 ${getKPIColor(kpiData.indexReturn)}`}>
                            {formatPct(kpiData.indexReturn)}
                        </div>
                        <div
                            className="absolute right-0 top-0 w-24 h-full opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none blur-xl"
                            style={{ backgroundColor: INDICES_CONFIG[comparisonIndex].color }}
                        />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Diferença vs {INDICES_CONFIG[comparisonIndex].label}</span>
                            <BarChart2 size={14} className="text-zinc-600" />
                        </div>
                        <div>
                            <div className={`text-2xl font-mono font-bold ${getKPIColor(kpiData.diff)}`}>
                                {kpiData.diff !== null ? (kpiData.diff > 0 ? `+${kpiData.diff.toFixed(2)}%` : `${kpiData.diff.toFixed(2)}%`) : '—'}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 font-medium">
                                {kpiData.diff !== null ? (kpiData.diff > 0 ? `acima do benchmark` : `abaixo do benchmark`) : 'Sem dados'}
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">% do {INDICES_CONFIG[comparisonIndex].label}</span>
                            <TrendingUp size={14} className="text-zinc-600" />
                        </div>
                        <div>
                            <div className={`text-xl font-medium ${getKPIColor(kpiData.relative)}`}>
                                {kpiData.relative !== null
                                    ? `${kpiData.relative.toFixed(0)}%`
                                    : '—'}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                de performance
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Chart Section */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                    <div className="flex flex-wrap gap-2 mb-8">
                        {Object.entries(INDICES_CONFIG).map(([key, config]) => {
                            const id = key as IndexType;
                            const isVisible = visibleIndices.has(id);
                            const isPortfolio = id === 'portfolio';
                            const isComparing = comparisonIndex === id;

                            return (
                                <button
                                    key={id}
                                    onClick={() => toggleIndex(id)}
                                    // disabled={isPortfolio} // AIDEV: Enable toggle for portfolio lines too
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                        ${isVisible
                                            ? 'bg-zinc-900 border-zinc-700 text-white shadow-sm'
                                            : 'bg-transparent border-zinc-800 text-zinc-600 hover:border-zinc-700'
                                        }
                                        ${isPortfolio ? 'cursor-default opacity-100 ring-1 ring-amber-500/20' : 'cursor-pointer'}
                                        ${isComparing && !isPortfolio ? 'ring-1 ring-zinc-500/30' : ''}
                                    `}
                                    style={isVisible ? { borderColor: config.color } : {}}
                                >
                                    <div
                                        className={`w-2 h-2 rounded-full transition-colors ${isVisible ? '' : 'bg-zinc-700'}`}
                                        style={isVisible ? { backgroundColor: config.color } : {}}
                                    />
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-[400px] w-full relative">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                    <XAxis
                                        dataKey="displayDate"
                                        stroke="#52525b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                        minTickGap={40}
                                    />
                                    <YAxis
                                        stroke="#52525b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `${val.toFixed(0)}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                        itemStyle={{ paddingBottom: '2px' }}
                                        formatter={(value: number, name: string) => [
                                            value !== undefined ? `${value.toFixed(2)}%` : '—',
                                            INDICES_CONFIG[name as IndexType]?.label || name
                                        ]}
                                        labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                                        cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    {Object.entries(INDICES_CONFIG).map(([key, config]) => {
                                        const id = key as IndexType;
                                        if (!visibleIndices.has(id)) return null;
                                        return (
                                            <Line
                                                key={id}
                                                type="monotone"
                                                dataKey={id}
                                                stroke={config.color}
                                                strokeWidth={id === 'portfolio' ? 3 : 2}
                                                dot={false}
                                                activeDot={{ r: 4, strokeWidth: 0, fill: config.color }}
                                                strokeOpacity={id === 'portfolio' ? 1 : 0.7}
                                                connectNulls
                                            />
                                        );
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                                <AlertCircle size={32} className="mb-2 opacity-50" />
                                <p className="text-sm font-medium">Rentabilidade indisponível — API de preços ainda não conectada.</p>
                                <p className="text-xs mt-1">Adicione históricos ou altere o filtro de data.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Monthly Returns Table */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Table size={16} className="text-zinc-500" />
                            Rentabilidade Mensal
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse text-xs whitespace-nowrap">
                            <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                                <tr>
                                    <th className="p-3 text-left pl-6 w-16">Ano</th>
                                    {MONTHS.map(m => (
                                        <th key={m} className="p-3 w-16">{m}</th>
                                    ))}
                                    <th className="p-3 w-20 font-bold bg-zinc-900/80">Ano</th>
                                    <th className="p-3 w-24 font-bold bg-zinc-900/80 pr-6">Acumulado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {monthlyReturnsTable.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="p-8 text-zinc-600 text-center italic">
                                            Sem dados para exibir.
                                        </td>
                                    </tr>
                                ) : (
                                    monthlyReturnsTable.map((row) => (
                                        <tr key={row.year} className="hover:bg-zinc-900/30 transition-colors">
                                            <td className="p-3 text-left pl-6 font-bold text-white">{row.year}</td>
                                            {MONTHS.map((_, idx) => (
                                                <td key={idx} className="p-3">
                                                    {renderCell(row[idx])}
                                                </td>
                                            ))}
                                            <td className="p-3 bg-zinc-900/30 font-bold border-l border-zinc-800/50">
                                                {renderCell(row.total)}
                                            </td>
                                            <td className="p-3 bg-zinc-900/30 font-bold border-l border-zinc-800/50 pr-6">
                                                {renderCell(row.accumulated)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Disclaimer */}
                <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 py-4 border-t border-zinc-900">
                    <Info size={12} />
                    <p>Comparações com índices têm caráter informativo e não representam recomendação de investimento. A rentabilidade passada não é garantia de rentabilidade futura.</p>
                </div>

                {/* 5. Asset Snapshot (Current Variation) */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden mt-8">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Activity size={16} className="text-zinc-500" />
                            Variação Atual por Ativo
                        </h3>
                        <span className="text-xs text-zinc-500">Baseado no custo médio</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                                <tr>
                                    <th className="p-3 pl-6">Ativo</th>
                                    <th className="p-3 text-right">Qtd</th>
                                    <th className="p-3 text-right">Preço Médio</th>
                                    <th className="p-3 text-right">Preço Atual</th>
                                    <th className="p-3 text-right">Saldo Atual</th>
                                    <th className="p-3 text-right pr-6">Variação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {items.map((item) => {
                                    const qty = item.quantity || 0;
                                    const currentVal = item.value || 0; // calculated in service
                                    const invested = calculateTotalInvested(item);

                                    const avgPrice = qty > 0 ? invested / qty : 0;
                                    const currentPrice = qty > 0 ? currentVal / qty : 0;

                                    const variation = invested > 0 ? ((currentVal / invested) - 1) * 100 : 0;

                                    return (
                                        <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors">
                                            <td className="p-3 pl-6 font-medium text-white shadow-sm flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${variation >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                {item.name}
                                            </td>
                                            <td className="p-3 text-right text-zinc-400">{qty.toLocaleString('pt-BR')}</td>
                                            <td className="p-3 text-right text-zinc-400">R$ {avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right text-white font-medium">R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right text-zinc-300">R$ {currentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-3 text-right pr-6">
                                                <span className={`font-bold ${variation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {variation > 0 ? '+' : ''}{variation.toFixed(2)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};
