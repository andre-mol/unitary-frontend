import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CustomItem } from '../../../../types';
import { calculateCurrentValue, calculateTotalInvested } from '../../../../domain/calculations';
import { formatCurrency } from '../../../../utils/formatters';

interface AssetGraphicAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: string;
    items: CustomItem[];
    currency: string;
}

const PIE_COLORS = [
    '#38BDF8',
    '#0EA5E9',
    '#2563EB',
    '#14B8A6',
    '#22C55E',
    '#F59E0B',
    '#F97316',
    '#EF4444',
    '#A855F7',
    '#6366F1'
];

export const AssetGraphicAnalysisModal: React.FC<AssetGraphicAnalysisModalProps> = ({
    isOpen,
    onClose,
    category,
    items,
    currency
}) => {
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const chartData = useMemo(() => {
        const base = items
            .map((item, index) => ({
                name: item.name,
                value: calculateCurrentValue(item),
                color: PIE_COLORS[index % PIE_COLORS.length]
            }))
            .filter((entry) => entry.value > 0)
            .sort((a, b) => b.value - a.value);

        const total = base.reduce((sum, entry) => sum + entry.value, 0);

        return {
            total,
            rows: base.map((entry) => ({
                ...entry,
                percentage: total > 0 ? (entry.value / total) * 100 : 0
            }))
        };
    }, [items]);

    const summary = useMemo(() => {
        const totalValue = chartData.total;
        const totalInvested = items.reduce((sum, item) => sum + calculateTotalInvested(item), 0);
        const profit = totalValue - totalInvested;
        const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        return {
            totalValue,
            totalInvested,
            itemsCount: chartData.rows.length,
            profit,
            profitPct
        };
    }, [items, chartData.total, chartData.rows.length]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const row = payload[0].payload as { name: string; value: number; percentage: number };

        return (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                <p className="text-sm font-semibold text-white">{row.name}</p>
                <p className="text-sm text-zinc-400">{row.percentage.toFixed(2)}%</p>
                <p className="text-sm font-semibold text-zinc-100">{formatCurrency(row.value, currency)}</p>
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                    >
                        <div
                            className="w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">Ativos na Carteira</h3>
                                    <p className="text-sm text-zinc-500">{category}</p>
                                </div>
                                <button
                                    type="button"
                                    className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
                                    onClick={onClose}
                                    aria-label="Fechar modal de analise grafica"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-5 p-6">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Valor Total</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(summary.totalValue, currency)}</p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Custo de Aquisição</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(summary.totalInvested, currency)}</p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Itens no Módulo</p>
                                        <p className="mt-1 text-2xl font-bold text-white">{summary.itemsCount}</p>
                                    </div>
                                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Rentabilidade</p>
                                        <p className={`mt-1 text-2xl font-bold ${summary.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {formatCurrency(summary.profit, currency)}
                                        </p>
                                        <p className={`text-xs font-medium ${summary.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {summary.profit >= 0 ? '+' : ''}{summary.profitPct.toFixed(2)}% vs custo
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Distribuição por Ativo</p>
                                        <div className="h-[300px] w-full">
                                            {chartData.rows.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={chartData.rows}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={75}
                                                            outerRadius={115}
                                                            stroke="none"
                                                        >
                                                            {chartData.rows.map((entry) => (
                                                                <Cell key={entry.name} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltip />} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="flex h-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-zinc-500">
                                                    Nenhum ativo com valor para exibir no grafico.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                            <span className="text-xl font-semibold text-white">Ativos</span>
                                            <span className="text-lg font-bold text-emerald-500">
                                                {formatCurrency(chartData.total, currency)}
                                            </span>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {chartData.rows.map((row) => (
                                                <div key={row.name} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span
                                                            className="h-3 w-3 flex-shrink-0 rounded-sm"
                                                            style={{ backgroundColor: row.color }}
                                                        />
                                                        <span className="truncate text-sm text-zinc-300">{row.name}</span>
                                                    </div>
                                                    <span className="text-sm font-semibold text-zinc-100">
                                                        {row.percentage.toFixed(2)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
