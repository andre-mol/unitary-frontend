import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    Calculator, TrendingUp, DollarSign, Calendar, 
    RotateCcw, ArrowRight, MinusCircle, Info, Table, Coins, AlertTriangle 
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';
import { RechartsTooltipProps } from '../../../types';

interface CalculationResult {
    month: number;
    interest: number;
    totalInterest: number;
    invested: number;
    accumulated: number;
    withdrawn: number;
}

export const CompoundInterestCalculator: React.FC = () => {
    // --- STATE ---
    const [initialValue, setInitialValue] = useState<number>(10000);
    const [monthlyValue, setMonthlyValue] = useState<number>(1000);
    
    const [interestRate, setInterestRate] = useState<number>(10);
    const [rateType, setRateType] = useState<'monthly' | 'annual'>('annual');
    
    const [period, setPeriod] = useState<number>(30);
    const [periodType, setPeriodType] = useState<'months' | 'years'>('years');

    // Withdrawal Simulation
    const [simulateWithdrawal, setSimulateWithdrawal] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);

    // Results
    const [results, setResults] = useState<CalculationResult[]>([]);
    const [summary, setSummary] = useState({
        totalFinal: 0,
        totalInvested: 0,
        totalInterest: 0,
        totalWithdrawn: 0
    });

    const [isCalculated, setIsCalculated] = useState(false);
    const resultsRef = useRef<HTMLDivElement>(null);

    // --- LOGIC ---

    const calculate = () => {
        // 1. Time Conversion
        const totalMonths = periodType === 'years' ? period * 12 : period;

        // 2. Rate Conversion (Geometric Mean for Annual -> Monthly)
        let rateMonthly = 0;
        if (rateType === 'monthly') {
            rateMonthly = interestRate / 100;
        } else {
            // Formula: (1 + rate)^(1/12) - 1
            rateMonthly = Math.pow(1 + (interestRate / 100), 1 / 12) - 1;
        }

        // 3. Calculation Loop
        let currentBalance = initialValue;
        let totalInvested = initialValue;
        let accumulatedInterest = 0;
        let accumulatedWithdrawn = 0;
        
        const timeSeries: CalculationResult[] = [];

        // Initial state (Month 0)
        timeSeries.push({
            month: 0,
            interest: 0,
            totalInterest: 0,
            invested: initialValue,
            accumulated: initialValue,
            withdrawn: 0
        });

        let bankruptcyMonth = -1;

        for (let m = 1; m <= totalMonths; m++) {
            // A. Apply Interest on current balance
            const interest = currentBalance * rateMonthly;
            currentBalance += interest;
            accumulatedInterest += interest;

            // B. Add Monthly Contribution
            currentBalance += monthlyValue;
            totalInvested += monthlyValue;

            // C. Subtract Withdrawal (if active)
            let withdrawnThisMonth = 0;
            if (simulateWithdrawal) {
                withdrawnThisMonth = withdrawalAmount;
                
                // Logic: Withdrawal occurs AFTER interest and contribution
                currentBalance -= withdrawnThisMonth;
                accumulatedWithdrawn += withdrawnThisMonth;

                // Safety Clamp: Balance cannot be negative
                if (currentBalance < 0) {
                    currentBalance = 0;
                    if (bankruptcyMonth === -1) bankruptcyMonth = m;
                }
            }

            timeSeries.push({
                month: m,
                interest: interest,
                totalInterest: accumulatedInterest,
                invested: totalInvested,
                accumulated: currentBalance,
                withdrawn: withdrawnThisMonth
            });
        }

        // 4. Final Aggregation
        // Formula: valorFinal - totalInvested + totalRetirado
        const calculatedTotalInterest = currentBalance - totalInvested + accumulatedWithdrawn;

        setResults(timeSeries);
        setSummary({
            totalFinal: currentBalance,
            totalInvested: totalInvested,
            totalInterest: calculatedTotalInterest,
            totalWithdrawn: accumulatedWithdrawn
        });
        setIsCalculated(true);

        // Scroll to results
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleClear = () => {
        setInitialValue(0);
        setMonthlyValue(0);
        setInterestRate(0);
        setPeriod(0);
        setWithdrawalAmount(0);
        setIsCalculated(false);
        setResults([]);
    };
    
    const CustomTooltip = ({ active, payload, label }: RechartsTooltipProps) => {
        if (active && payload && payload.length >= 2) {
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md min-w-[180px]">
                    <p className="text-zinc-400 mb-2 font-bold font-mono">Mês {label}</p>
                    <div className="space-y-1.5">
                        <p className="text-amber-500 font-medium flex justify-between">
                            <span>Acumulado:</span>
                            <span className="font-mono font-bold">{formatCurrency(payload[0].value, 'BRL')}</span>
                        </p>
                        <p className="text-zinc-400 flex justify-between">
                            <span>Investido:</span>
                            <span className="font-mono">{formatCurrency(payload[1].value, 'BRL')}</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <DashboardLayout title="Calculadora de Juros Compostos" subtitle="Simule o poder do tempo e dos aportes no seu patrimônio.">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS SECTION --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Calculator className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Parâmetros</h3>
                        </div>

                        <div className="space-y-5">
                            <Input 
                                label="Valor Inicial (C₀)"
                                type="number"
                                icon={<DollarSign size={16} />}
                                value={initialValue}
                                onChange={(e) => setInitialValue(Number(e.target.value))}
                                min={0}
                            />

                            <Input 
                                label="Aporte Mensal"
                                type="number"
                                icon={<TrendingUp size={16} />}
                                value={monthlyValue}
                                onChange={(e) => setMonthlyValue(Number(e.target.value))}
                                min={0}
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <Input 
                                    label="Taxa de Juros (%)"
                                    type="number"
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(Number(e.target.value))}
                                    step="0.01"
                                />
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Período</label>
                                    <select 
                                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-3 focus:outline-none focus:border-amber-500 text-sm"
                                        value={rateType}
                                        onChange={(e) => setRateType(e.target.value as any)}
                                    >
                                        <option value="annual">Anual</option>
                                        <option value="monthly">Mensal</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Input 
                                    label="Tempo"
                                    type="number"
                                    value={period}
                                    onChange={(e) => setPeriod(Number(e.target.value))}
                                    min={1}
                                />
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Unidade</label>
                                    <select 
                                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-3 focus:outline-none focus:border-amber-500 text-sm"
                                        value={periodType}
                                        onChange={(e) => setPeriodType(e.target.value as any)}
                                    >
                                        <option value="years">Anos</option>
                                        <option value="months">Meses</option>
                                    </select>
                                </div>
                            </div>

                            {/* Withdrawal Toggle */}
                            <div className="pt-4 border-t border-zinc-800">
                                <div 
                                    className="flex items-center gap-3 cursor-pointer group mb-4 select-none"
                                    onClick={() => setSimulateWithdrawal(!simulateWithdrawal)}
                                >
                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 ${simulateWithdrawal ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ${simulateWithdrawal ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className={`text-sm font-medium ${simulateWithdrawal ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                                        Simular retiradas mensais
                                    </span>
                                </div>

                                <div className={`transition-all duration-300 overflow-hidden ${simulateWithdrawal ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <Input 
                                        label="Valor da Retirada Mensal"
                                        type="number"
                                        icon={<MinusCircle size={16} />}
                                        value={withdrawalAmount}
                                        onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="border-red-900/30 focus:border-red-500"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1 flex items-center gap-1">
                                        <Info size={10} /> A retirada ocorre após o rendimento.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" onClick={handleClear} className="flex-1">
                                    <RotateCcw size={16} className="mr-2" /> Limpar
                                </Button>
                                <Button onClick={calculate} className="flex-[2]">
                                    Calcular <ArrowRight size={16} className="ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RESULTS SECTION --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {!isCalculated ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <Coins size={48} className="mb-4 opacity-20" />
                            <p>Preencha os dados e clique em Calcular</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* KPI CARDS */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className={`bg-zinc-900/80 border rounded-xl p-5 relative overflow-hidden group ${summary.totalFinal === 0 ? 'border-red-500/50' : 'border-amber-500/30'}`}>
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Valor Total Final</p>
                                    <p className={`text-2xl font-mono font-bold ${summary.totalFinal === 0 ? 'text-red-500' : 'text-white'}`}>
                                        {formatCurrency(summary.totalFinal, 'BRL')}
                                    </p>
                                    {summary.totalFinal > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-amber-500/20 transition-colors"></div>}
                                </div>
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Investido</p>
                                    <p className="text-xl font-mono font-medium text-zinc-300">{formatCurrency(summary.totalInvested, 'BRL')}</p>
                                    <p className="text-[10px] text-zinc-600 mt-1">Aportes + Inicial</p>
                                </div>
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total em Juros</p>
                                    <p className={`text-xl font-mono font-medium ${summary.totalInterest >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(summary.totalInterest, 'BRL')}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        {simulateWithdrawal ? '(Final - Investido + Retirado)' : 'Rendimento bruto'}
                                    </p>
                                </div>
                            </div>

                            {simulateWithdrawal && (
                                <div className={`border rounded-lg p-4 flex items-center gap-3 ${summary.totalFinal === 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                    {summary.totalFinal === 0 ? <AlertTriangle className="text-red-500" size={20} /> : <Info className="text-zinc-500" size={20} />}
                                    <div>
                                        <p className={`text-sm font-medium ${summary.totalFinal === 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                                            {summary.totalFinal === 0 ? "Patrimônio Esgotado" : "Fluxo de Retiradas"}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Você retirou um total de <strong className="text-zinc-300">{formatCurrency(summary.totalWithdrawn, 'BRL')}</strong>.
                                            {summary.totalFinal === 0 && " O montante retirado superou o crescimento do capital."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* CHART */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                                <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-amber-500" /> Evolução Patrimonial
                                </h4>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#52525b" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#52525b" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                            <XAxis 
                                                dataKey="month" 
                                                stroke="#52525b" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(value) => `${value}m`}
                                                minTickGap={30}
                                            />
                                            <YAxis 
                                                stroke="#52525b" 
                                                fontSize={12} 
                                                tickLine={false} 
                                                axisLine={false} 
                                                tickFormatter={(value) => {
                                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                                                    return value;
                                                }}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            
                                            {/* Render Accumulated FIRST so it's behind if opaque, but with opacity 0.7 we see overlaps */}
                                            <Area 
                                                type="monotone" 
                                                dataKey="accumulated" 
                                                name="Total Acumulado"
                                                stroke="#f59e0b" 
                                                strokeWidth={2} 
                                                fillOpacity={0.4} 
                                                fill="url(#colorTotal)" 
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="invested" 
                                                name="Valor Investido"
                                                stroke="#71717a" 
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                fillOpacity={0.1} 
                                                fill="url(#colorInvested)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                                    <h4 className="text-white font-bold flex items-center gap-2">
                                        <Table size={18} className="text-zinc-500" /> Detalhamento Mensal
                                    </h4>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="text-xs uppercase text-zinc-500 font-medium bg-zinc-950 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-3">Mês</th>
                                                <th className="px-6 py-3 text-right">Juros (Mês)</th>
                                                <th className="px-6 py-3 text-right">Total Investido</th>
                                                <th className="px-6 py-3 text-right text-green-500">Juros Acum.</th>
                                                {simulateWithdrawal && <th className="px-6 py-3 text-right text-red-500">Retirada</th>}
                                                <th className="px-6 py-3 text-right text-white">Total Acumulado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/50">
                                            {results.map((row) => (
                                                <tr key={row.month} className="hover:bg-zinc-900/30 transition-colors">
                                                    <td className="px-6 py-3 text-zinc-400 font-mono">{row.month}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-zinc-400">
                                                        {formatCurrency(row.interest, 'BRL')}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono text-zinc-400">
                                                        {formatCurrency(row.invested, 'BRL')}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono text-green-500/80">
                                                        {formatCurrency(row.totalInterest, 'BRL')}
                                                    </td>
                                                    {simulateWithdrawal && (
                                                        <td className="px-6 py-3 text-right font-mono text-red-500/80">
                                                            {row.withdrawn > 0 ? `-${formatCurrency(row.withdrawn, 'BRL')}` : '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-3 text-right font-mono font-bold text-white">
                                                        {formatCurrency(row.accumulated, 'BRL')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-zinc-600 justify-center">
                                <Info size={12} />
                                <p>Cálculo: (Saldo Anterior + Juros + Aporte) - Retirada. Taxa anual convertida via equivalência de taxas.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};