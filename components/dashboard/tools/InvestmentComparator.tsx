import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    RotateCcw, ArrowRight, Coins, Scale,
    Plus, Trash2, TrendingUp, AlertTriangle, Info,
    Percent, Receipt
} from 'lucide-react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';
import { RechartsTooltipProps, RechartsTooltipPayloadEntry } from '../../../types';

interface CustomInvestment {
    id: string;
    name: string;
    rate: number; // Annual Rate (%)
    taxRegime: "isento" | "regressivo" | "acao" | "fii" | "bruto";
}

interface SimulationResult {
    name: string;
    finalValue: number;
    totalInvested: number;
    netProfit: number;
    diffVsSelic: number;
    color: string;
    isBenchmark?: boolean;
    warning?: string;
}

interface ChartDataPoint {
    month: number;
    [key: string]: number;
}

const COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4']; // Colors for custom investments

export const InvestmentComparator: React.FC = () => {
    // --- STATE ---
    
    // Global Parameters
    const [initialValue, setInitialValue] = useState<number>(10000);
    const [monthlyContribution, setMonthlyContribution] = useState<number>(1000);
    const [years, setYears] = useState<number>(5);
    const [selicRate, setSelicRate] = useState<number>(10.75); // Current Approx Selic

    // Custom Investments
    const [customInvestments, setCustomInvestments] = useState<CustomInvestment[]>([]);
    
    // Results
    const [results, setResults] = useState<SimulationResult[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isCalculated, setIsCalculated] = useState(false);
    
    const resultsRef = useRef<HTMLDivElement>(null);

    // --- HELPERS ---

    // Generate Unique ID
    const uuid = () => Math.random().toString(36).substring(2, 9);

    // Add Custom Investment
    const addInvestment = () => {
        if (customInvestments.length >= 5) return;
        // Default to 'regressivo' for fair comparison (Standard Adult behavior)
        setCustomInvestments([...customInvestments, { id: uuid(), name: '', rate: 0, taxRegime: 'regressivo' }]);
    };

    // Remove Custom Investment
    const removeInvestment = (id: string) => {
        setCustomInvestments(customInvestments.filter(i => i.id !== id));
    };

    // Update Custom Investment
    const updateInvestment = (id: string, field: keyof CustomInvestment, value: string | number) => {
        setCustomInvestments(customInvestments.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    // IR Regressive Table (For Selic and Custom Fixed Income)
    const getTaxRate = (periodYears: number) => {
        const days = periodYears * 365;
        if (days <= 180) return 0.225; // 22.5%
        if (days <= 360) return 0.20;  // 20%
        if (days <= 720) return 0.175; // 17.5%
        return 0.15;   // 15%
    };

    // IOF Logic (Only for < 30 days)
    const getIOF = (periodYears: number) => {
        // Simple check: if less than 1 month, apply huge IOF (simplification: assume 30 days cutoff)
        if (periodYears * 12 < 1) return 0.96; // Worst case approximation
        return 0;
    };

    // Pure Function for Taxation Logic
    const aplicarTributacao = (valorBruto: number, totalInvested: number, regime: string, prazoDias: number) => {
        const lucro = valorBruto - totalInvested;
        if (lucro <= 0) return valorBruto;

        let imposto = 0;

        switch (regime) {
            case 'isento':
            case 'bruto':
                imposto = 0;
                break;
            case 'acao':
                imposto = lucro * 0.15;
                break;
            case 'fii':
                imposto = lucro * 0.20;
                break;
            case 'regressivo':
                let aliquota = 0.15;
                if (prazoDias <= 180) aliquota = 0.225;
                else if (prazoDias <= 360) aliquota = 0.20;
                else if (prazoDias <= 720) aliquota = 0.175;
                
                imposto = lucro * aliquota;
                break;
            default:
                imposto = 0;
        }

        return valorBruto - imposto;
    };

    // --- CALCULATION ENGINE ---
    const calculate = () => {
        const totalMonths = years * 12;
        const totalDays = years * 365;
        const taxRateSelic = getTaxRate(years);
        const iofRateSelic = getIOF(years);

        // 1. Prepare Scenarios
        const scenarios = [
            { id: 'poupanca', name: 'Poupança (Ref.)', type: 'fixed', color: '#10b981' },
            { id: 'selic', name: 'Tesouro Selic (Ref.)', type: 'fixed', color: '#f59e0b' },
            ...customInvestments.map((inv, idx) => ({ 
                id: inv.id, 
                name: inv.name || `Inv. ${idx + 1}`, 
                rate: inv.rate, 
                type: 'custom',
                color: COLORS[idx % COLORS.length]
            }))
        ];

        // 2. Calculation Loop
        const monthlyData: ChartDataPoint[] = [];
        
        // Initial State
        let balances = scenarios.map(() => initialValue);
        let totalInvested = initialValue;

        // Rates Conversion (Annual -> Monthly)
        // Poupança Logic: If Selic > 8.5% -> 0.5% + TR (0). Else 70% Selic.
        const poupancaMonthly = selicRate > 8.5 
            ? 0.005 
            : (Math.pow(1 + (selicRate * 0.70 / 100), 1/12) - 1);
        
        const selicMonthly = Math.pow(1 + (selicRate / 100), 1/12) - 1;

        // Push Month 0
        const startPoint: ChartDataPoint = { month: 0 };
        scenarios.forEach((s, i) => startPoint[s.id] = balances[i]);
        monthlyData.push(startPoint);

        for (let m = 1; m <= totalMonths; m++) {
            totalInvested += monthlyContribution;
            const currentMonthPoint: ChartDataPoint = { month: m };

            // Update each scenario
            balances = balances.map((balance, idx) => {
                const scenario = scenarios[idx];
                let monthlyRate = 0;

                if (scenario.id === 'poupanca') monthlyRate = poupancaMonthly;
                else if (scenario.id === 'selic') monthlyRate = selicMonthly;
                else {
                    // Custom
                    const customInv = customInvestments.find(c => c.id === scenario.id);
                    const annual = customInv ? customInv.rate : 0;
                    monthlyRate = Math.pow(1 + (annual / 100), 1/12) - 1;
                }

                // Compound Interest
                const interest = balance * monthlyRate;
                return balance + interest + monthlyContribution;
            });

            // Store point
            scenarios.forEach((s, i) => currentMonthPoint[s.id] = balances[i]);
            monthlyData.push(currentMonthPoint);
        }

        // 3. Final Adjustments (Taxation)
        
        // Find Selic Result first for comparison (Net)
        const selicGross = balances[1]; // Index 1 is Selic
        const selicProfit = selicGross - totalInvested;
        const selicTax = selicProfit > 0 ? selicProfit * taxRateSelic : 0;
        const selicIOF = selicProfit > 0 ? selicProfit * iofRateSelic : 0;
        const selicNet = selicGross - selicTax - selicIOF;
        
        const finalResults: SimulationResult[] = scenarios.map((s, idx) => {
            const grossBalance = balances[idx];
            let netBalance = grossBalance;
            let warning = undefined;

            if (s.id === 'poupanca') {
                netBalance = grossBalance;
            } else if (s.id === 'selic') {
                netBalance = grossBalance - (selicProfit > 0 ? selicProfit * taxRateSelic : 0) - (selicProfit > 0 ? selicProfit * iofRateSelic : 0);
            } else {
                // Custom Investments
                const customInv = customInvestments.find(c => c.id === s.id);
                // Default to 'regressivo' if missing (legacy compatibility)
                const regime = customInv?.taxRegime || 'regressivo';
                
                netBalance = aplicarTributacao(grossBalance, totalInvested, regime, totalDays);
                
                if (regime === 'bruto') {
                    warning = "Valor bruto (sem impostos)";
                }
            }

            return {
                name: s.name,
                totalInvested,
                finalValue: netBalance,
                netProfit: netBalance - totalInvested,
                diffVsSelic: netBalance - selicNet,
                color: s.color,
                isBenchmark: s.id === 'selic',
                warning
            };
        });

        // 4. Update State
        setResults(finalResults);
        setChartData(monthlyData);
        setIsCalculated(true);

        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleClear = () => {
        setIsCalculated(false);
        setCustomInvestments([]);
        setResults([]);
        setChartData([]);
    };

    const CustomTooltip = ({ active, payload, label }: RechartsTooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md min-w-[150px]">
                    <p className="text-zinc-400 mb-2 font-bold font-mono">Mês {label}</p>
                    <div className="space-y-1">
                        {payload.map((p: RechartsTooltipPayloadEntry) => (
                            <p key={p.name} style={{ color: p.color }} className="font-medium flex justify-between gap-4">
                                <span>{p.name}:</span>
                                <span className="font-mono">{formatCurrency(p.value, 'BRL')}</span>
                            </p>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <DashboardLayout title="Comparador de Investimentos" subtitle="Compare diferentes investimentos utilizando as mesmas premissas e veja como eles se comportam em relação à Selic e à Poupança.">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Scale className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Premissas Gerais</h3>
                        </div>
                        <div className="space-y-4">
                            <Input label="Valor Inicial" icon={<Coins size={16}/>} type="number" value={initialValue} onChange={e => setInitialValue(Number(e.target.value))} />
                            <Input label="Aporte Mensal" icon={<TrendingUp size={16}/>} type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} />
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Prazo (Anos)" type="number" value={years} onChange={e => setYears(Number(e.target.value))} min={1} />
                                <Input label="Selic Atual (%)" type="number" value={selicRate} onChange={e => setSelicRate(Number(e.target.value))} step="0.1" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <div className="flex items-center gap-2">
                                <Plus className="text-blue-500" size={20} />
                                <h3 className="font-bold text-white">Adicionar Investimento</h3>
                            </div>
                            <span className="text-xs text-zinc-500">{customInvestments.length}/5</span>
                        </div>
                        
                        <div className="space-y-4">
                            {customInvestments.map((inv, idx) => (
                                <div key={inv.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-zinc-500 font-bold uppercase">Opção {idx + 1}</span>
                                        <button onClick={() => removeInvestment(inv.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <Input 
                                            placeholder="Nome (Ex: CDB)" 
                                            value={inv.name} 
                                            onChange={e => updateInvestment(inv.id, 'name', e.target.value)} 
                                            className="text-sm"
                                        />
                                        <div className="relative">
                                            <Input 
                                                placeholder="Taxa % a.a." 
                                                type="number" 
                                                value={inv.rate || ''} 
                                                onChange={e => updateInvestment(inv.id, 'rate', Number(e.target.value))} 
                                                className="text-sm"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <Percent size={12} className="text-zinc-500" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Tax Regime Selector */}
                                    <div className="pt-3 border-t border-zinc-800/50">
                                        <label className="text-[10px] text-zinc-500 font-medium mb-1.5 flex items-center gap-1">
                                            <Receipt size={10} /> Regime de Tributação
                                        </label>
                                        <select
                                            value={inv.taxRegime || 'regressivo'}
                                            onChange={(e) => updateInvestment(inv.id, 'taxRegime', e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer hover:bg-zinc-900"
                                        >
                                            <option value="regressivo">Regressiva (Renda Fixa / Tesouro)</option>
                                            <option value="isento">Isento (LCI / LCA / CRI / CRA)</option>
                                            <option value="acao">Ações / ETFs de Ações (15%)</option>
                                            <option value="fii">FIIs / Fiagros (20%)</option>
                                            <option value="bruto">Bruto (Sem desconto)</option>
                                        </select>
                                    </div>
                                </div>
                            ))}

                            {customInvestments.length < 5 ? (
                                <Button variant="outline" onClick={addInvestment} className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500">
                                    <Plus size={16} className="mr-2" /> Adicionar Comparativo
                                </Button>
                            ) : (
                                <p className="text-xs text-center text-zinc-500">Limite de 5 investimentos atingido.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={handleClear} className="flex-1">
                            <RotateCcw size={16} className="mr-2" /> Limpar
                        </Button>
                        <Button onClick={calculate} className="flex-[2]">
                            Comparar <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </div>
                </div>

                {/* --- RESULTS --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {!isCalculated ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <Scale size={48} className="mb-4 opacity-20" />
                            <p>Preencha as taxas e clique em Comparar</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* CARDS GRID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {results.map((res) => (
                                    <div 
                                        key={res.name} 
                                        className={`p-5 rounded-xl border relative overflow-hidden group ${res.isBenchmark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-950 border-zinc-800'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{res.name}</h4>
                                                {res.isBenchmark && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Benchmark</span>}
                                            </div>
                                            <div className={`text-xs font-mono font-bold px-2 py-1 rounded ${res.diffVsSelic >= 0 ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                                {res.diffVsSelic >= 0 ? '+' : ''}{formatCurrency(res.diffVsSelic, 'BRL')} vs Selic
                                            </div>
                                        </div>

                                        <div className="space-y-1 mb-4">
                                            <p className="text-3xl font-mono font-bold text-white tracking-tight">
                                                {formatCurrency(res.finalValue, 'BRL')}
                                            </p>
                                            <p className="text-xs text-zinc-500">Valor Líquido Final</p>
                                        </div>

                                        <div className="pt-4 border-t border-zinc-800/50 flex justify-between items-center text-xs">
                                            <span className="text-zinc-400">Lucro Líquido: <strong className="text-zinc-200">{formatCurrency(res.netProfit, 'BRL')}</strong></span>
                                            {res.warning && (
                                                <span className="flex items-center gap-1 text-amber-500/80" title={res.warning}>
                                                    <AlertTriangle size={12} /> {res.warning}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Color Strip */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: res.color }}></div>
                                    </div>
                                ))}
                            </div>

                            {/* CHART */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                                <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-amber-500" /> Evolução Comparativa
                                </h4>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                stroke="#52525b" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(val) => `${(val/12).toFixed(0)}a`}
                                                minTickGap={30}
                                            />
                                            <YAxis 
                                                stroke="#52525b" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(val) => {
                                                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                                    return val;
                                                }}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1 }} />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            
                                            {/* Benchmarks */}
                                            <Line type="monotone" dataKey="poupanca" name="Poupança" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                            <Line type="monotone" dataKey="selic" name="Tesouro Selic (Bruto)" stroke="#f59e0b" strokeWidth={2} dot={false} />

                                            {/* Custom Lines */}
                                            {customInvestments.map((inv, idx) => (
                                                <Line 
                                                    key={inv.id}
                                                    type="monotone" 
                                                    dataKey={inv.id} 
                                                    name={inv.name || `Inv. ${idx+1}`} 
                                                    stroke={COLORS[idx % COLORS.length]} 
                                                    strokeWidth={2} 
                                                    dot={false}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
                                    <Info size={12} />
                                    <p>O gráfico exibe a evolução bruta mês a mês. A tributação do Tesouro Selic é calculada apenas no resultado final.</p>
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                                    <h4 className="text-white font-bold text-sm">Resumo da Simulação</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="text-xs uppercase text-zinc-500 font-medium bg-zinc-950">
                                            <tr>
                                                <th className="px-6 py-3">Investimento</th>
                                                <th className="px-6 py-3 text-right">Total Investido</th>
                                                <th className="px-6 py-3 text-right">Bruto Final</th>
                                                <th className="px-6 py-3 text-right text-red-400">Impostos Est.</th>
                                                <th className="px-6 py-3 text-right text-green-500 font-bold">Líquido Final</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/50">
                                            {results.map((row) => {
                                                // Reverse calc taxes for display since we stored Net
                                                // Not perfect but good for display
                                                // For Selic: Final Value stored is Net.
                                                // Gross is in chart data last point.
                                                // Let's use simple logic: 
                                                const gross = chartData.length > 0 ? chartData[chartData.length - 1][row.isBenchmark ? 'selic' : row.name === 'Poupança (Ref.)' ? 'poupanca' : customInvestments.find(c => c.name === row.name)?.id || ''] : 0;
                                                const tax = gross ? gross - row.finalValue : 0;

                                                return (
                                                    <tr key={row.name} className="hover:bg-zinc-900/30 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-white">{row.name}</td>
                                                        <td className="px-6 py-3 text-right text-zinc-400">{formatCurrency(row.totalInvested, 'BRL')}</td>
                                                        <td className="px-6 py-3 text-right text-zinc-300">{formatCurrency(gross || row.finalValue, 'BRL')}</td>
                                                        <td className="px-6 py-3 text-right text-red-400/80">{tax > 0 ? `-${formatCurrency(tax, 'BRL')}` : '-'}</td>
                                                        <td className="px-6 py-3 text-right font-mono font-bold text-green-500">{formatCurrency(row.finalValue, 'BRL')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};