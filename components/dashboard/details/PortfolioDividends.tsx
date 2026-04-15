
import React, { useMemo } from 'react';
import { Portfolio, PortfolioEvent, CustomItem } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import {
    TrendingUp, Calendar, DollarSign, PieChart as PieIcon,
    BarChart2, List, CheckCircle2, Clock, Filter
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface PortfolioDividendsProps {
    portfolio: Portfolio;
    items: CustomItem[];
    events: PortfolioEvent[];
    dividends?: any[]; // The RPC result
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];
type DividendRange = '6M' | '12M' | 'ALL';

export const PortfolioDividends: React.FC<PortfolioDividendsProps> = ({ portfolio, items, events, dividends = [] }) => {
    const [selectedRange, setSelectedRange] = React.useState<DividendRange>('12M');

    // --- DATA PREPARATION ---

    // 1. Use RPC Data (prefer dividends prop) or fallback (but existing fallback was filtering events)
    // We will proceed mapping the RPC data to a strictly typed internal structure for the charts

    const processedEvents = useMemo(() => {
        return dividends.filter(d => {
            // Find matching asset to check initialDate
            const asset = items.find(i =>
                i.market_asset_id === d.asset_id ||
                (i.name && d.ticker && d.ticker.startsWith(i.name.split('.')[0]))
            );

            // If asset exists and has start date, filter out older dividends
            if (asset && asset.initialDate) {
                const divDate = d.payment_date;
                if (divDate && divDate < asset.initialDate) return false;
            }

            return true;
        }).map(d => ({
            id: d.id,
            date: d.payment_date,
            totalValue: d.total_amount,
            assetName: d.ticker,
            type: d.type.toLowerCase(),
            status: d.status, // received | provisioned
            rate: d.rate,
            quantity: d.quantity_held
        }));
    }, [dividends, items]);

    const now = new Date();

    const rangeMeta = useMemo(() => {
        if (selectedRange === '6M') {
            return {
                start: new Date(now.getFullYear(), now.getMonth() - 5, 1),
                months: 6,
                shortLabel: '6M',
                fullLabel: 'Últimos 6 meses'
            };
        }

        if (selectedRange === 'ALL') {
            return {
                start: null as Date | null,
                months: 0,
                shortLabel: 'ALL',
                fullLabel: 'Todo o período'
            };
        }

        return {
            start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
            months: 12,
            shortLabel: '12M',
            fullLabel: 'Últimos 12 meses'
        };
    }, [selectedRange, now]);

    const isWithinSelectedRange = React.useCallback((dateValue: string) => {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return false;
        if (!rangeMeta.start) return true;
        return date >= rangeMeta.start;
    }, [rangeMeta.start]);

    // 2. Metrics Calculation
    const metrics = useMemo(() => {
        let totalReceived = 0;
        let totalFuture = 0;

        processedEvents.forEach(e => {
            if (e.status === 'received' && isWithinSelectedRange(e.date)) {
                totalReceived += e.totalValue;
            }

            if (e.status === 'provisioned') {
                totalFuture += e.totalValue;
            }
        });

        const monthCount = selectedRange === 'ALL'
            ? (() => {
                const eventDates = processedEvents
                    .filter(e => e.status === 'received')
                    .map(e => new Date(e.date))
                    .filter(d => !Number.isNaN(d.getTime()))
                    .sort((a, b) => a.getTime() - b.getTime());

                if (eventDates.length === 0) return 1;

                const first = eventDates[0];
                const last = eventDates[eventDates.length - 1];
                return Math.max(
                    ((last.getFullYear() - first.getFullYear()) * 12) + (last.getMonth() - first.getMonth()) + 1,
                    1
                );
            })()
            : rangeMeta.months;

        const monthlyAvg = totalReceived / Math.max(monthCount, 1);

        const currentPortfolioValue = items.reduce((acc, i) => acc + (i.value || 0), 0);
        const dy = currentPortfolioValue > 0 ? (totalReceived / currentPortfolioValue) * 100 : 0;

        return { totalReceived, monthlyAvg, totalFuture, dy };
    }, [processedEvents, items, isWithinSelectedRange, selectedRange, rangeMeta.months]);

    // 3. Chart Data (Evolution)
    const evolutionData = useMemo(() => {
        const data: Record<string, { name: string, received: number, expected: number }> = {};

        const validDates = processedEvents
            .map(e => new Date(e.date))
            .filter(d => !Number.isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        const firstBucket = selectedRange === 'ALL'
            ? (validDates[0] ? new Date(validDates[0].getFullYear(), validDates[0].getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 1))
            : new Date(rangeMeta.start || new Date(now.getFullYear(), now.getMonth(), 1));
        const lastBucket = selectedRange === 'ALL'
            ? (validDates[validDates.length - 1] ? new Date(validDates[validDates.length - 1].getFullYear(), validDates[validDates.length - 1].getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 1))
            : new Date(now.getFullYear(), now.getMonth(), 1);

        const cursor = new Date(firstBucket);
        while (cursor <= lastBucket) {
            const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
            data[key] = {
                name: `${MONTHS[cursor.getMonth()]}/${cursor.getFullYear().toString().slice(2)}`,
                received: 0,
                expected: 0
            };
            cursor.setMonth(cursor.getMonth() + 1);
        }

        processedEvents.forEach(e => {
            const d = new Date(e.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;

            if (data[key] && isWithinSelectedRange(e.date)) {
                if (e.status === 'provisioned') {
                    data[key].expected += e.totalValue;
                } else {
                    data[key].received += e.totalValue;
                }
            }
        });

        return Object.values(data);
    }, [processedEvents, selectedRange, rangeMeta.start, isWithinSelectedRange, now]);

    // 4. Distribution Data (Pie)
    const distributionData = useMemo(() => {
        const map: Record<string, number> = {};
        processedEvents.forEach(e => {
            if (e.status === 'received' && isWithinSelectedRange(e.date)) {
                const name = e.assetName;
                map[name] = (map[name] || 0) + e.totalValue;
            }
        });

        return Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [processedEvents, isWithinSelectedRange]);

    // 5. Matrix Data
    const matrixData = useMemo(() => {
        const years: Record<number, number[]> = {}; // Year -> Array[12]

        processedEvents.forEach(e => {
            // Usually we show Received in matrix, maybe distinct style for provisioned?
            // For now, let's sum everything but maybe highlight provisioned?
            // Standard practice: Matrix shows accounting (competence) or cash flow. This is cash flow.

            const d = new Date(e.date);
            const year = d.getFullYear();
            const month = d.getMonth();

            if (!years[year]) years[year] = new Array(12).fill(0);
            years[year][month] += e.totalValue;
        });

        return Object.entries(years)
            .sort((a, b) => Number(b[0]) - Number(a[0])) // Descending Years
            .map(([year, months]) => {
                const total = months.reduce((a, b) => a + b, 0);
                const avg = total / 12;
                return { year: Number(year), months, total, avg };
            });
    }, [processedEvents]);

    // 6. Upcoming List
    const upcomingEvents = processedEvents
        .filter(e => e.status === 'provisioned')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ascending

    // 7. Full History List
    const historyList = processedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- RENDER HELPERS ---

    const CustomBarTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md">
                    <p className="text-zinc-400 font-bold mb-2">{label}</p>
                    {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-zinc-300 capitalize">{entry.name}:</span>
                            <span className="font-mono font-bold text-white">{formatCurrency(entry.value, portfolio.currency)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-end">
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
                    {([
                        { id: '6M', label: '6M' },
                        { id: '12M', label: '12M' },
                        { id: 'ALL', label: 'ALL' },
                    ] as Array<{ id: DividendRange; label: string }>).map((option) => (
                        <button
                            key={option.id}
                            onClick={() => setSelectedRange(option.id)}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${selectedRange === option.id
                                ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
                                : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* BLOCO 1: RESUMO DE PROVENTOS (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{`Média Mensal (${rangeMeta.shortLabel})`}</span>
                        <Calendar size={14} className="text-zinc-600" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white tracking-tight">
                        {formatCurrency(metrics.monthlyAvg, portfolio.currency)}
                    </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{`Total Recebido (${rangeMeta.shortLabel})`}</span>
                        <DollarSign size={14} className="text-green-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-green-500 tracking-tight">
                        {formatCurrency(metrics.totalReceived, portfolio.currency)}
                    </div>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total a Receber</span>
                        <Clock size={14} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-amber-500 tracking-tight">
                        {formatCurrency(metrics.totalFuture, portfolio.currency)}
                    </div>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{`Dividend Yield (${rangeMeta.shortLabel})`}</span>
                        <TrendingUp size={14} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white tracking-tight">
                        {metrics.dy.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* BLOCO 2 & 3: GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Evolution Chart */}
                <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <BarChart2 size={16} className="text-zinc-500" /> Evolução de Proventos
                        </h3>
                        {/* Placeholder controls - Visual Only for MVP */}
                        <div className="flex gap-2">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-400 font-medium">{rangeMeta.fullLabel}</div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                <Bar dataKey="received" name="Recebido" stackId="a" fill="#10b981" radius={[4, 4, 4, 4]} barSize={32} />
                                <Bar dataKey="expected" name="A Receber" stackId="a" fill="#f59e0b" radius={[4, 4, 4, 4]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Pie */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                        <PieIcon size={16} className="text-zinc-500" /> Distribuição (Top 10)
                    </h3>
                    <div className="flex-1 min-h-[250px] relative">
                        {distributionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: number) => formatCurrency(value, portfolio.currency)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
                                Sem dados
                            </div>
                        )}
                    </div>
                    {/* Simplified Legend List */}
                    <div className="mt-2 space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                        {distributionData.map((entry, index) => (
                            <div key={index} className="flex justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-zinc-400 truncate max-w-[100px]">{entry.name}</span>
                                </div>
                                <span className="font-mono text-zinc-300">{formatCurrency(entry.value, portfolio.currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* BLOCO 4: HISTÓRICO MENSAL (MATRIZ) */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <List size={16} className="text-zinc-500" /> Histórico Mensal
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs whitespace-nowrap">
                        <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                            <tr>
                                <th className="p-3 text-left pl-6 w-16 bg-zinc-950 sticky left-0 z-10 border-r border-zinc-800">Ano</th>
                                {MONTHS.map(m => (
                                    <th key={m} className="p-3 w-20">{m}</th>
                                ))}
                                <th className="p-3 w-24 font-bold bg-zinc-900/80 border-l border-zinc-800">Total</th>
                                <th className="p-3 w-24 font-bold bg-zinc-900/80">Média</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {matrixData.map((row) => (
                                <tr key={row.year} className="hover:bg-zinc-900/30 transition-colors">
                                    <td className="p-3 text-left pl-6 font-bold text-white bg-zinc-950 sticky left-0 z-10 border-r border-zinc-800">{row.year}</td>
                                    {row.months.map((val, idx) => {
                                        const isHighest = val === Math.max(...row.months) && val > 0;
                                        return (
                                            <td key={idx} className={`p-3 font-mono ${val > 0 ? 'text-zinc-300' : 'text-zinc-700'} ${isHighest ? 'bg-amber-500/10 text-amber-500 font-bold' : ''}`}>
                                                {val > 0 ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                        );
                                    })}
                                    <td className="p-3 bg-zinc-900/30 font-bold border-l border-zinc-800 text-green-500 font-mono">
                                        {formatCurrency(row.total, portfolio.currency)}
                                    </td>
                                    <td className="p-3 bg-zinc-900/30 font-bold text-zinc-400 font-mono">
                                        {formatCurrency(row.avg, portfolio.currency)}
                                    </td>
                                </tr>
                            ))}
                            {matrixData.length === 0 && (
                                <tr>
                                    <td colSpan={15} className="p-8 text-center text-zinc-600">Sem histórico de proventos.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BLOCO 5: PROVENTOS A RECEBER */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <Clock size={16} className="text-amber-500" /> Proventos a Receber
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    {upcomingEvents.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-xs">
                            Nenhum provento futuro previsto.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-900/50 text-zinc-500 font-medium border-b border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3">Data Pagamento</th>
                                    <th className="px-6 py-3">Evento</th>
                                    <th className="px-6 py-3">Ativo</th>
                                    <th className="px-6 py-3 text-right">Valor Líquido</th>
                                    <th className="px-6 py-3 text-right">Qtd.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {upcomingEvents.map((evt) => (
                                    <tr key={evt.id} className="hover:bg-zinc-900/30">
                                        <td className="px-6 py-3 font-mono text-amber-500">
                                            {new Date(evt.date).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${evt.type === 'dividend' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>
                                                {evt.type === 'dividend' ? 'Dividendo' : evt.type === 'jcp' ? 'JCP' : 'Rendimento'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-bold text-white">{evt.assetName}</td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-white">
                                            {formatCurrency(evt.totalValue, portfolio.currency)}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-zinc-400">
                                            {evt.quantity || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* BLOCO 6: HISTÓRICO DETALHADO */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <List size={16} className="text-zinc-500" /> Meus Proventos (Histórico Completo)
                    </h3>
                    {/* Placeholder filter */}
                    <div className="flex gap-2">
                        <button className="p-1.5 text-zinc-500 hover:text-white bg-zinc-900 rounded border border-zinc-800">
                            <Filter size={14} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-zinc-900/50 text-zinc-500 font-medium border-b border-zinc-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Ativo</th>
                                <th className="px-6 py-3">Evento</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3">Data Com</th>
                                <th className="px-6 py-3">Data Pagamento</th>
                                <th className="px-6 py-3 text-right">Qtd.</th>
                                <th className="px-6 py-3 text-right">Valor Unit.</th>
                                <th className="px-6 py-3 text-right">Total Líquido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {historyList.map((evt) => {
                                return (
                                    <tr key={evt.id} className="hover:bg-zinc-900/30">
                                        <td className="px-6 py-3 font-medium text-zinc-300">{evt.assetName}</td>
                                        <td className="px-6 py-3 text-zinc-400 capitalize">
                                            {evt.type === 'profit_distribution' ? 'Rendimento' : evt.type}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {evt.status === 'received' ? (
                                                <span className="text-green-500 flex items-center justify-center gap-1">
                                                    <CheckCircle2 size={12} /> Recebido
                                                </span>
                                            ) : (
                                                <span className="text-amber-500 flex items-center justify-center gap-1">
                                                    <Clock size={12} /> A Receber
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-zinc-500 font-mono">-</td>
                                        <td className="px-6 py-3 font-mono text-zinc-300">
                                            {new Date(evt.date).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-zinc-500">{evt.quantity || '-'}</td>
                                        <td className="px-6 py-3 text-right font-mono text-zinc-500">
                                            {evt.quantity ? formatCurrency(evt.totalValue / evt.quantity, portfolio.currency) : '-'}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-mono font-bold ${evt.status === 'received' ? 'text-green-500' : 'text-amber-500'}`}>
                                            {formatCurrency(evt.totalValue, portfolio.currency)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {historyList.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-zinc-600">Nenhum registro encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};
