import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Edit2, TrendingUp, History, Coins, Save, ArrowRight, Link2 } from 'lucide-react';
import { ValuationMethod, ValuationHistory } from '../../../../types';

type Frequency = 'monthly' | 'yearly';

type IndexedBenchmark = {
    id: NonNullable<ValuationMethod['indexBenchmark']>;
    label: string;
};
type BenchmarkRate = { monthly: number; yearly: number };

const INDEX_BENCHMARKS: IndexedBenchmark[] = [
    { id: 'CDI', label: 'CDI' },
    { id: 'IPCA', label: 'IPCA' },
    { id: 'IBOV', label: 'IBOV' },
    { id: 'S&P500', label: 'S&P 500' },
    { id: 'IFIX', label: 'IFIX' },
    { id: 'IDIV', label: 'IDIV' },
    { id: 'SMLL', label: 'SMLL' },
    { id: 'IVVB11', label: 'IVVB11' },
];
const BENCHMARK_RETURN_KEY_MAP: Record<NonNullable<ValuationMethod['indexBenchmark']>, string> = {
    CDI: 'cdi',
    IPCA: 'ipca',
    IBOV: 'ibov',
    'S&P500': 'spx',
    IFIX: 'ifix',
    IDIV: 'idiv',
    SMLL: 'smll',
    IVVB11: 'ivvb11',
};

const percentToDecimal = (pct: number) => pct / 100;
const decimalToPercent = (dec: number) => dec * 100;

const convertRate = (ratePct: number, from: Frequency, to: Frequency): number => {
    if (from === to) return ratePct;

    const dec = percentToDecimal(ratePct);

    if (from === 'yearly' && to === 'monthly') {
        return decimalToPercent(Math.pow(1 + dec, 1 / 12) - 1);
    }

    if (from === 'monthly' && to === 'yearly') {
        return decimalToPercent(Math.pow(1 + dec, 12) - 1);
    }

    return ratePct;
};

const formatPct = (value: number, digits = 3) => {
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const EPSILON_RATE = 0.000001;

const resolveBenchmarkRate = (
    benchmark: BenchmarkRate | undefined,
    targetFrequency: Frequency
): number => {
    if (!benchmark) return 0;

    const monthly = Number(benchmark.monthly || 0);
    const yearly = Number(benchmark.yearly || 0);

    if (targetFrequency === 'monthly') {
        if (Math.abs(monthly) > EPSILON_RATE) return monthly;
        if (Math.abs(yearly) > EPSILON_RATE) return convertRate(yearly, 'yearly', 'monthly');
        return 0;
    }

    if (Math.abs(yearly) > EPSILON_RATE) return yearly;
    if (Math.abs(monthly) > EPSILON_RATE) return convertRate(monthly, 'monthly', 'yearly');
    return 0;
};

const normalizeValuationMethod = (method: ValuationMethod): ValuationMethod => {
    if (method.type) return method;

    const hasPeriodicSignal =
        method.periodicRate !== undefined ||
        method.periodicFrequency !== undefined ||
        method.growthMode !== undefined ||
        method.indexBenchmark !== undefined ||
        method.indexBenchmarkBaseRate !== undefined ||
        method.indexSpreadRate !== undefined ||
        method.indexSpreadFrequency !== undefined;

    return {
        ...method,
        type: hasPeriodicSignal ? 'periodic' : 'manual',
    };
};

export const ValuationConfigurator = ({
    method,
    onChange,
    initialValue,
    currency,
    initialDate,
    currentValue,
    onManualUpdate,
    history = [],
    quantity = 1,
}: {
    method: ValuationMethod;
    onChange: (m: ValuationMethod) => void;
    initialValue: number;
    currency: string;
    initialDate?: string;
    currentValue?: number;
    onManualUpdate?: (val: number, date: string) => void;
    history?: ValuationHistory[];
    quantity?: number;
}) => {
    const resolvedMethod = useMemo(() => normalizeValuationMethod(method), [method]);
    const activeType = resolvedMethod.type;
    const [benchmarkRates, setBenchmarkRates] = useState<Record<string, BenchmarkRate>>({});

    const [newManualValue, setNewManualValue] = useState<string>(currentValue ? String(currentValue) : '');
    const [newManualDate, setNewManualDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (currentValue !== undefined) {
            setNewManualValue(String(currentValue));
        }
    }, [currentValue]);

    useEffect(() => {
        if (!method.type && resolvedMethod.type !== method.type) {
            onChange(resolvedMethod);
        }
    }, [method.type, resolvedMethod.type]);

    useEffect(() => {
        let cancelled = false;

        const fetchBenchmarkRates = async () => {
            try {
                const { portfolioService } = await import('../../../../lib/portfolioService');

                const now = new Date();
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                const monthStart = oneMonthAgo.toISOString().split('T')[0];
                const yearStart = oneYearAgo.toISOString().split('T')[0];

                const [monthSeries, yearSeries] = await Promise.all([
                    portfolioService.getBenchmarkData('ALL', monthStart),
                    portfolioService.getBenchmarkData('ALL', yearStart),
                ]);

                const lastMonth = monthSeries?.[monthSeries.length - 1];
                const lastYear = yearSeries?.[yearSeries.length - 1];
                if (!lastMonth || !lastYear) return;

                const nextRates: Record<string, BenchmarkRate> = {};

                for (const benchmark of INDEX_BENCHMARKS) {
                    const key = BENCHMARK_RETURN_KEY_MAP[benchmark.id];
                    const monthlyReturnDecimal = Number((lastMonth as any)[key]);
                    const yearlyReturnDecimal = Number((lastYear as any)[key]);
                    if (!Number.isFinite(monthlyReturnDecimal) || !Number.isFinite(yearlyReturnDecimal)) continue;

                    nextRates[benchmark.id] = {
                        monthly: monthlyReturnDecimal * 100,
                        yearly: yearlyReturnDecimal * 100,
                    };
                }

                if (!cancelled) setBenchmarkRates(nextRates);
            } catch {
                // Silent fallback: configurator keeps working without base rates.
            }
        };

        fetchBenchmarkRates();
        return () => { cancelled = true; };
    }, []);

    const simulatedValue = useMemo(() => {
        if (activeType === 'periodic' && resolvedMethod.periodicRate) {
            const dateStr = initialDate?.includes('T') ? initialDate.split('T')[0] : initialDate;
            const start = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
            const now = new Date();

            const diffTime = Math.abs(now.getTime() - start.getTime());
            const daysPassed = diffTime / (1000 * 60 * 60 * 24);
            const rate = Number(resolvedMethod.periodicRate) / 100;
            let periods = 0;

            const frequency = resolvedMethod.periodicFrequency || 'monthly';

            if (frequency === 'monthly') {
                periods = daysPassed / 30.4375;
            } else {
                periods = daysPassed / 365.25;
            }

            return initialValue * Math.pow(1 + rate, periods);
        }
        return null;
    }, [activeType, resolvedMethod, quantity, initialValue, initialDate]);

    const applyIndexedMethod = (patch: Partial<ValuationMethod>) => {
        const base: ValuationMethod = {
            ...resolvedMethod,
            ...patch,
            type: 'periodic',
            growthMode: 'indexed',
        };

        const periodicFrequency = (base.periodicFrequency || 'monthly') as Frequency;
        const spreadFrequency = (base.indexSpreadFrequency || periodicFrequency) as Frequency;
        const benchmarkBaseAnnualRate = Number(base.indexBenchmarkBaseRate || 0);
        const spreadRate = Number(base.indexSpreadRate || 0);
        const benchmarkId = (base.indexBenchmark || 'IPCA') as NonNullable<ValuationMethod['indexBenchmark']>;
        const benchmarkRate = benchmarkRates[benchmarkId];

        // Prefer real benchmark rate from DB on selected frequency (monthly/yearly).
        // Fallback to annual->target conversion only if live rates are unavailable.
        const benchmarkRateOnTargetFrequency = benchmarkRate
            ? resolveBenchmarkRate(benchmarkRate, periodicFrequency)
            : convertRate(benchmarkBaseAnnualRate, 'yearly', periodicFrequency);
        const spreadRateOnTargetFrequency = convertRate(spreadRate, spreadFrequency, periodicFrequency);

        const effectiveRate = benchmarkRateOnTargetFrequency + spreadRateOnTargetFrequency;

        onChange({
            ...base,
            periodicRate: Number(effectiveRate.toFixed(6)),
        });
    };

    const periodicFrequency = (resolvedMethod.periodicFrequency || 'monthly') as Frequency;
    const spreadFrequency = (resolvedMethod.indexSpreadFrequency || periodicFrequency) as Frequency;
    const indexedBenchmark = resolvedMethod.indexBenchmark || 'IPCA';
    const growthMode = resolvedMethod.growthMode || 'fixed';
    const selectedBenchmarkRate = benchmarkRates[indexedBenchmark];

    useEffect(() => {
        if (activeType !== 'periodic' || growthMode !== 'indexed') return;
        if (!selectedBenchmarkRate) return;
        const currentBase = Number(resolvedMethod.indexBenchmarkBaseRate || 0);
        if (Math.abs(currentBase - selectedBenchmarkRate.yearly) < 0.0001) return;

        applyIndexedMethod({ indexBenchmarkBaseRate: selectedBenchmarkRate.yearly });
    }, [activeType, growthMode, indexedBenchmark, selectedBenchmarkRate?.yearly]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                    { id: 'periodic', label: 'Valorizacao', icon: TrendingUp, desc: 'Taxa fixa ou indexada' },
                    { id: 'manual', label: 'Manual', icon: Edit2, desc: 'Eu edito o valor' },
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => {
                            if (type.id === 'manual') {
                                onChange({ ...resolvedMethod, type: 'manual' });
                                return;
                            }

                            const nextFrequency = (resolvedMethod.periodicFrequency || 'monthly') as Frequency;
                            const nextGrowthMode = resolvedMethod.growthMode || 'fixed';

                            if (nextGrowthMode === 'indexed') {
                                applyIndexedMethod({
                                    periodicFrequency: nextFrequency,
                                    indexBenchmark: resolvedMethod.indexBenchmark || 'IPCA',
                                    indexSpreadRate: resolvedMethod.indexSpreadRate || 0,
                                    indexSpreadFrequency: resolvedMethod.indexSpreadFrequency || nextFrequency,
                                });
                            } else {
                                onChange({
                                    ...resolvedMethod,
                                    type: 'periodic',
                                    growthMode: 'fixed',
                                    periodicFrequency: nextFrequency,
                                    periodicRate: resolvedMethod.periodicRate || 0,
                                });
                            }
                        }}
                        className={`p-3 rounded-lg border text-left transition-all relative ${
                            activeType === type.id
                                ? 'bg-amber-500/10 border-amber-500 text-white shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/80'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            {type.icon && <type.icon size={16} className={activeType === type.id ? 'text-amber-500' : 'text-zinc-500'} />}
                            <span className="font-bold text-sm">{type.label}</span>
                        </div>
                        <div className="text-[10px] opacity-70">{type.desc}</div>
                    </button>
                ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Configuracao de valorizacao</span>
                </div>

                {activeType === 'manual' && (
                    <div className="space-y-4">
                        {onManualUpdate && initialDate && currentValue !== undefined ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 opacity-70">
                                        <div className="flex items-center gap-2 mb-3 text-zinc-500">
                                            <History size={14} />
                                            <span className="text-xs font-bold uppercase">Registro inicial</span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-lg font-mono text-zinc-300">
                                                {initialValue.toLocaleString('pt-BR', { style: 'currency', currency })}
                                            </div>
                                            <div className="text-xs text-zinc-600">
                                                em {new Date(initialDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-950 border border-amber-500/30 rounded-lg p-4 relative">
                                        <div className="flex items-center gap-2 mb-3 text-amber-500">
                                            <Coins size={14} />
                                            <span className="text-xs font-bold uppercase">Valor atual</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1 block">Novo valor</label>
                                                <input
                                                    type="number"
                                                    value={newManualValue}
                                                    onChange={(e) => setNewManualValue(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-white focus:border-amber-500 outline-none font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-zinc-500 mb-1 block">Data de referencia</label>
                                                <input
                                                    type="date"
                                                    value={newManualDate}
                                                    onChange={(e) => setNewManualDate(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-amber-500 outline-none"
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-500 text-black border-none font-semibold"
                                                onClick={() => onManualUpdate(Number(newManualValue), newManualDate)}
                                            >
                                                <Save size={12} className="mr-2" /> Atualizar manualmente
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 border-t border-zinc-800 pt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <History size={14} className="text-zinc-500" />
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Historico de registros</span>
                                    </div>
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-zinc-900/50 text-zinc-500 font-medium sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-2">Data</th>
                                                        <th className="px-4 py-2">Valor</th>
                                                        <th className="px-4 py-2">Tipo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800/50">
                                                    {[...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, idx) => (
                                                        <tr key={idx} className="hover:bg-zinc-900/30">
                                                            <td className="px-4 py-2 text-zinc-400">{new Date(entry.date).toLocaleDateString()}</td>
                                                            <td className="px-4 py-2 text-zinc-200 font-mono">{entry.value.toLocaleString('pt-BR', { style: 'currency', currency })}</td>
                                                            <td className="px-4 py-2 text-zinc-500 capitalize">{entry.type === 'initial' ? 'Inicial' : 'Manual'}</td>
                                                        </tr>
                                                    ))}
                                                    {history.length === 0 && (
                                                        <tr>
                                                            <td colSpan={3} className="px-4 py-4 text-center text-zinc-600 italic">Sem historico registrado.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-4 space-y-2">
                                <p className="text-sm text-zinc-300">Neste modo, o valor do ativo e estatico.</p>
                                <p className="text-xs text-zinc-500">Voce podera atualizar o valor manualmente quando quiser.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeType === 'periodic' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Frequencia de capitalizacao</label>
                                <select
                                    className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none"
                                    value={periodicFrequency}
                                    onChange={(e) => {
                                        const nextFrequency = e.target.value as Frequency;
                                        if (growthMode === 'indexed') {
                                            applyIndexedMethod({ periodicFrequency: nextFrequency });
                                        } else {
                                            onChange({ ...resolvedMethod, periodicFrequency: nextFrequency });
                                        }
                                    }}
                                >
                                    <option value="monthly">Mensal</option>
                                    <option value="yearly">Anual</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => onChange({ ...resolvedMethod, type: 'periodic', growthMode: 'fixed' })}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    growthMode === 'fixed'
                                        ? 'bg-amber-500/10 border-amber-500 text-white'
                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                            >
                                <p className="text-sm font-semibold">Taxa fixa</p>
                                <p className="text-[10px] opacity-70">Define uma taxa unica de crescimento</p>
                            </button>

                            <button
                                onClick={() => {
                                    applyIndexedMethod({
                                        indexBenchmark: indexedBenchmark,
                                        indexSpreadRate: method.indexSpreadRate || 0,
                                        indexSpreadFrequency: method.indexSpreadFrequency || periodicFrequency,
                                    });
                                }}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    growthMode === 'indexed'
                                        ? 'bg-blue-500/10 border-blue-500 text-white'
                                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Link2 size={14} />
                                    <p className="text-sm font-semibold">Indexado</p>
                                </div>
                                <p className="text-[10px] opacity-70">Indice + spread configuravel</p>
                            </button>
                        </div>

                        {growthMode === 'fixed' ? (
                                <Input
                                    label={`Taxa de crescimento (% ao ${periodicFrequency === 'monthly' ? 'mes' : 'ano'})`}
                                    type="number"
                                    placeholder="0.5"
                                    value={resolvedMethod.periodicRate ?? ''}
                                    onChange={(e) => onChange({ ...resolvedMethod, periodicRate: Number(e.target.value) })}
                                />
                        ) : (
                            <div className="space-y-4 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Indice base</label>
                                        <select
                                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none"
                                            value={indexedBenchmark}
                                            onChange={(e) => {
                                                const nextBenchmark = e.target.value as ValuationMethod['indexBenchmark'];
                                                applyIndexedMethod({
                                                    indexBenchmark: nextBenchmark,
                                                    indexBenchmarkBaseRate: benchmarkRates[nextBenchmark || 'IPCA']?.yearly || 0,
                                                });
                                            }}
                                        >
                                            {INDEX_BENCHMARKS.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.label}{benchmarkRates[b.id] ? ` (${formatPct(benchmarkRates[b.id].yearly, 2)}% a.a)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Spread</label>
                                        <Input
                                            type="number"
                                            placeholder="0.50"
                                            value={resolvedMethod.indexSpreadRate ?? ''}
                                            onChange={(e) => applyIndexedMethod({ indexSpreadRate: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Taxa base mensal</p>
                                        <p className="text-sm font-mono font-bold text-zinc-200">
                                            {selectedBenchmarkRate ? `${formatPct(resolveBenchmarkRate(selectedBenchmarkRate, 'monthly'), 3)}%` : '--'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Taxa base anual</p>
                                        <p className="text-sm font-mono font-bold text-zinc-200">
                                            {selectedBenchmarkRate ? `${formatPct(selectedBenchmarkRate.yearly, 3)}%` : '--'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Spread aplicado por</label>
                                        <select
                                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none"
                                            value={spreadFrequency}
                                            onChange={(e) => applyIndexedMethod({ indexSpreadFrequency: e.target.value as Frequency })}
                                        >
                                            <option value="monthly">Mes</option>
                                            <option value="yearly">Ano</option>
                                        </select>
                                    </div>

                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Taxa efetiva usada no calculo</p>
                                        <p className="text-sm font-mono font-bold text-amber-400">
                                            {formatPct(Number(resolvedMethod.periodicRate || 0))}% ao {periodicFrequency === 'monthly' ? 'mes' : 'ano'}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
                                    <p className="text-xs text-zinc-300">
                                        Formula configurada: <span className="text-white font-medium">{indexedBenchmark}</span> +{' '}
                                        <span className="text-white font-medium">{formatPct(Number(resolvedMethod.indexSpreadRate || 0), 2)}%</span> ao{' '}
                                        <span className="text-white font-medium">{spreadFrequency === 'monthly' ? 'mes' : 'ano'}</span>.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeType === 'periodic' && simulatedValue !== null && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500 uppercase font-medium">Valor projetado (hoje)</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-600 line-through">
                                    {initialValue.toLocaleString('pt-BR', { style: 'currency', currency })}
                                </span>
                                <ArrowRight size={14} className="text-zinc-600" />
                                <span className="text-sm font-bold text-amber-500 font-mono">
                                    {simulatedValue.toLocaleString('pt-BR', { style: 'currency', currency })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
