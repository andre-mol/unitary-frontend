
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import {
    ArrowLeft, Info, AlertCircle,
    BarChart2, Percent, Activity, Table, TrendingUp, Globe
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { rebaseSeries, EvolutionPoint } from '../../utils/chartHelpers';
import { fetchBenchmarkData, fetchPerformanceData } from '../../lib/queries/portfolios';
import { useConsolidation } from '../../hooks/useConsolidation';

// --- CONFIGURATION ---

type IndexType = 'portfolio' | 'cdi' | 'ipca' | 'ibov' | 'spx' | 'ifix' | 'ivvb11';
type PeriodType = '6M' | '1A' | 'ALL';

const INDICES_CONFIG: Record<IndexType, { label: string; color: string; disabled?: boolean }> = {
    portfolio: { label: 'Retorno Global', color: '#f59e0b' }, // Amber-500
    cdi: { label: 'CDI', color: '#10b981' },      // Emerald-500
    ipca: { label: 'IPCA', color: '#eab308' },    // Yellow-500
    ibov: { label: 'IBOV', color: '#8b5cf6' },    // Violet-500
    spx: { label: 'S&P 500', color: '#64748b' },  // Slate-500
    ifix: { label: 'IFIX', color: '#06b6d4' },    // Cyan-500
    ivvb11: { label: 'IVVB11', color: '#d946ef' } // Fuchsia-500
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const GlobalProfitabilityPage: React.FC = () => {
    const { consolidate, forceConsolidate } = useConsolidation();
    const [evolutionData, setEvolutionData] = useState<EvolutionPoint[]>([]);
    const [benchmarkData, setBenchmarkData] = useState<Array<{
        date: string;
        cdi?: number;
        ipca?: number;
        ibov?: number;
        spx?: number;
        ifix?: number;
        ivvb11?: number;
    }>>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [period, setPeriod] = useState<PeriodType>('ALL');
    const [visibleIndices, setVisibleIndices] = useState<Set<IndexType>>(new Set(['portfolio', 'cdi']));
    const [comparisonIndex, setComparisonIndex] = useState<IndexType>('cdi');
    const [isInitialConsolidationDone, setIsInitialConsolidationDone] = useState(false);
    const hasForcedRetryRef = useRef(false);

    // Ensure daily consolidation runs before loading global profitability.
    useEffect(() => {
        let cancelled = false;

        void consolidate().finally(() => {
            if (!cancelled) {
                setIsInitialConsolidationDone(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [consolidate]);

    // Load evolution data when period changes
    useEffect(() => {
        if (!isInitialConsolidationDone) return;

        const loadEvolutionData = async () => {
            setLoading(true);
            try {
                // Convert period to range format
                const range: '6M' | '1A' | 'ALL' = period === '6M' ? '6M' : period === '1A' ? '1A' : 'ALL';

                let perfData = await fetchPerformanceData(undefined, range);

                // Recovery path: if global performance is empty, force one consolidation
                // and retry once to bypass stale local daily cache.
                if (perfData.length === 0 && !hasForcedRetryRef.current) {
                    hasForcedRetryRef.current = true;
                    const forceResult = await forceConsolidate();
                    if (forceResult.status !== 'error') {
                        perfData = await fetchPerformanceData(undefined, range);
                    }
                }
                const customBenchmarkStartDate =
                    range === 'ALL' && perfData.length > 0
                        ? [...perfData]
                            .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())[0]
                            .fullDate
                            .split('T')[0]
                        : undefined;
                const benchData = await fetchBenchmarkData(range, customBenchmarkStartDate);

                setEvolutionData(perfData);
                setBenchmarkData(benchData);
            } catch (err) {
                console.error('Error loading evolution data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadEvolutionData();
    }, [period, isInitialConsolidationDone, forceConsolidate]);

    // --- DATA PROCESSING LAYER ---

    // Merge performance series with benchmarks (LOCF) and rebase only for short windows.
    const processedEvents = useMemo(() => {
        if (!benchmarkData.length && !evolutionData.length) return [];
        const sortedEvolution = [...evolutionData].sort(
            (a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
        );
        let merged = sortedEvolution;

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
                    ivvb11: mergeField('ivvb11')
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

            merged = sortedEvolution.map(point => {
                const dateKey = point.fullDate.split('T')[0];
                const bench = findClosestBenchmark(dateKey);
                return {
                    ...point,
                    ibov: bench?.ibov,
                    cdi: bench?.cdi,
                    ipca: bench?.ipca,
                    spx: bench?.spx,
                    ifix: bench?.ifix,
                    ivvb11: bench?.ivvb11
                };
            });
        }

        if (merged.length === 0) return [];
        if (period === 'ALL') return merged;
        return rebaseSeries(merged, new Date(merged[0].fullDate));
    }, [evolutionData, benchmarkData, period]);

    // 2. Chart Data
    const chartData = useMemo(() => {
        if (processedEvents.length === 0) return [];

        return processedEvents.map(point => ({
            date: point.fullDate.split('T')[0],
            displayDate: new Date(point.fullDate).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),
            portfolio: point.value * 100,
            cdi: point.cdi !== undefined ? point.cdi * 100 : undefined,
            ipca: point.ipca !== undefined ? point.ipca * 100 : undefined,
            ibov: point.ibov !== undefined ? point.ibov * 100 : undefined,
            spx: point.spx !== undefined ? point.spx * 100 : undefined,
            ifix: point.ifix !== undefined ? point.ifix * 100 : undefined,
            ivvb11: point.ivvb11 !== undefined ? point.ivvb11 * 100 : undefined
        }));
    }, [processedEvents]);

    // 3. Table Data (Monthly Returns) based on cumulative decimal returns.
    const monthlyReturnsTable = useMemo(() => {
        if (evolutionData.length === 0) return [];

        const getValueAt = (d: Date) => {
            const targetTime = d.getTime();
            let lastPoint = null;
            for (const point of evolutionData) {
                const pointTime = new Date(point.fullDate).getTime();
                if (pointTime <= targetTime) {
                    lastPoint = point;
                } else {
                    break;
                }
            }
            return lastPoint?.value ?? null;
        };

        const initialDate = new Date(evolutionData[0].fullDate);
        const startYear = initialDate.getFullYear();
        const currentYear = new Date().getFullYear();
        const years = [];

        // Generate rows for each year
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

                const startValue = getValueAt(monthStart);
                const endValue = getValueAt(monthEnd);

                if (endValue !== null) {
                    if (startValue !== null) {
                        row[month] = ((1 + endValue) / (1 + startValue) - 1) * 100;
                    } else {
                        row[month] = endValue * 100;
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

            if (yEnd !== null) {
                row.accumulated = yEnd * 100;
            } else {
                row.accumulated = null;
            }

            years.push(row);
        }

        return years;
    }, [evolutionData]);

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

    const renderCell = (value: number | null) => {
        if (value === null) return <span className="text-zinc-600 font-light">-</span>;
        const color = value >= 0 ? 'text-green-500' : 'text-red-500';
        return <span className={`text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>;
    };

    return (
        <DashboardLayout title="Rentabilidade Global" subtitle="Visão consolidada de todos os portfólios">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header / Nav */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-6">
                    <div>
                        <Link to={`/dashboard/portfolios`} className="inline-flex items-center text-xs text-zinc-500 hover:text-white mb-2 transition-colors">
                            <ArrowLeft size={12} className="mr-1" /> Voltar aos Portfólios
                        </Link>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Globe className="text-amber-500" size={24} />
                            Desempenho Consolidado
                        </h2>
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

                {/* 1. KPIs Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Rentabilidade Total</span>
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
                                {kpiData.diff !== null ? (kpiData.diff > 0 ? `+${kpiData.diff.toFixed(2)}%` : `${kpiData.diff.toFixed(2)}%`) : '-'}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1 font-medium">
                                {kpiData.diff !== null ? (kpiData.diff > 0 ? `acima do benchmark` : `abaixo do benchmark`) : 'Sem dados'}
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between h-28">
                        <div className="flex justify-between items-start">
                            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Desempenho Relativo</span>
                            <TrendingUp size={14} className="text-zinc-600" />
                        </div>
                        <div>
                            <div className={`text-xl font-medium ${getKPIColor(kpiData.relative)}`}>
                                {kpiData.relative !== null
                                    ? `${kpiData.relative.toFixed(1)}% ${kpiData.relative > 0 ? 'melhor' : 'pior'}`
                                    : '-'}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                que o Índice selecionado
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
                                    disabled={isPortfolio}
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
                                            value !== undefined ? `${value.toFixed(2)}%` : '-',
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
                                {loading ? (
                                    <>
                                        <p className="text-sm font-medium">Carregando dados de rentabilidade global.</p>
                                        <p className="text-xs mt-1">Aguarde enquanto processamos os dados.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium">Ainda nao ha dados de rentabilidade no sistema.</p>
                                        <p className="text-xs mt-1">Assim que houver historico suficiente, o grafico sera exibido.</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Monthly Returns Table */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Table size={16} className="text-zinc-500" />
                            Rentabilidade Mensal (Global)
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
            </div>
        </DashboardLayout>
    );
};

