import React, { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    TrendingUp, DollarSign, Home, 
    ArrowRight, RotateCcw, Building2, Coins, Info,
    CheckCircle2, AlertTriangle, HelpCircle
} from 'lucide-react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';
import { RechartsTooltipProps, RechartsTooltipPayloadEntry } from '../../../types';

interface MonthlyData {
    month: number;
    year: number;
    // Finance Data
    outstandingBalance: number;
    installment: number; // Prestação (PMT)
    interest: number; // Juros
    
    // Scenario 2 (Finance + Invest)
    propertyValue: number;
    investedBuyScenario: number; // Aportes from (Rent - Installment)
    totalWealthBuy: number; // Property + Invested
    
    // Scenario 3 (Rent + Invest)
    rentValue: number;
    investedRentScenario: number; // Aportes from (Installment - Rent)
    totalWealthRent: number; // Just Investments
}

export const RentVsBuyCalculator: React.FC = () => {
    // --- STATE ---
    
    // Property
    const [propertyValue, setPropertyValue] = useState<number>(500000);
    const [appreciationRate, setAppreciationRate] = useState<number>(4); // % a.a.
    const [rentValue, setRentValue] = useState<number>(2000); 
    const [igpm, setIgpm] = useState<number>(8.63); // % a.a.

    // Financing (SAC)
    const [downPayment, setDownPayment] = useState<number>(100000); // 20%
    const [costs, setCosts] = useState<number>(15000); // ITBI + Cartório ~3-5%
    const [termMonths, setTermMonths] = useState<number>(360);
    const [interestRate, setInterestRate] = useState<number>(7); // % a.a. CET

    // Investment
    const [investmentYield, setInvestmentYield] = useState<number>(11); // % a.a.

    // Results
    const [results, setResults] = useState<MonthlyData[]>([]);
    const [summary, setSummary] = useState({
        // Scenario 1: Only Finance
        s1_wealth: 0,
        s1_propertyValue: 0,
        s1_totalPaid: 0,

        // Scenario 2: Finance + Invest
        s2_wealth: 0,
        s2_totalInvested: 0, 
        
        // Scenario 3: Rent + Invest
        s3_wealth: 0,
        s3_totalPaidRent: 0,
        s3_totalInvested: 0 
    });

    const [isCalculated, setIsCalculated] = useState(false);
    const resultsRef = useRef<HTMLDivElement>(null);

    // --- HELPERS ---
    // Rule: Monthly Rate = (1 + Annual)^(1/12) - 1
    const annualToMonthly = (rate: number) => Math.pow(1 + rate / 100, 1 / 12) - 1;

    // --- CALCULATION ENGINE ---
    const calculate = () => {
        // 1. Convert Rates
        const i_fin_mo = annualToMonthly(interestRate);
        const i_inv_mo = annualToMonthly(investmentYield);
        const i_appr_mo = annualToMonthly(appreciationRate);
        
        // Sardinha Rule: Use FLOOR IGP-M for calculations (8.63 -> 8.0)
        const igpmApplied = Math.floor(igpm);
        const igpmMultiplier = 1 + (igpmApplied / 100);

        // 2. Initial Setup
        const loanAmount = propertyValue - downPayment;
        const amortization = loanAmount / termMonths; // Constant Amortization (SAC)
        
        // Scenario Variables
        let currentBalanceDue = loanAmount;
        let currentPropertyValue = propertyValue;
        let currentRent = rentValue;
        
        // Investments Accumulators
        let investBuyBalance = 0; // Scenario 2: Surplus when Buying
        
        // Sardinha Rule: Rent scenario invests DownPayment AND Costs (since they are not spent)
        let investRentBalance = downPayment + costs; 
        
        // Totals for Summary
        let totalInstallmentsPaid = 0;
        let totalPaidRent = 0;
        let totalInvestedS2 = 0;
        let totalInvestedS3 = downPayment + costs;

        const timeSeries: MonthlyData[] = [];

        // Month 0 (Start)
        timeSeries.push({
            month: 0,
            year: 0,
            outstandingBalance: loanAmount,
            installment: 0,
            interest: 0,
            propertyValue: propertyValue,
            investedBuyScenario: 0,
            totalWealthBuy: propertyValue - loanAmount, 
            rentValue: rentValue,
            investedRentScenario: investRentBalance,
            totalWealthRent: investRentBalance
        });

        for (let m = 1; m <= termMonths; m++) {
            // --- A. RENT ADJUSTMENT ---
            // Sardinha Pattern Logic: Adjustment applies on the 12th month of the cycle (12, 24, 360...)
            // rather than starting fresh on the 13th. This explains the higher total rent paid.
            if (m > 0 && m % 12 === 0) {
                currentRent *= igpmMultiplier;
            }
            totalPaidRent += currentRent;

            // --- B. FINANCING (SAC) ---
            const interest = currentBalanceDue * i_fin_mo;
            const installment = amortization + interest;
            
            // --- C. DEFINE CONTRIBUTIONS (Sardinha Rule: Installment vs Rent) ---
            
            // Scenario 2 (Finance + Invest): 
            // Logic: If Rent > Installment, the buyer invests the difference.
            let contributionBuy = currentRent - installment;
            if (contributionBuy < 0) contributionBuy = 0;

            // Scenario 3 (Rent + Invest):
            // Logic: If Installment > Rent, the renter invests the difference.
            let contributionRent = installment - currentRent;
            if (contributionRent < 0) contributionRent = 0;

            // --- D. APPLY CONTRIBUTIONS & YIELD ---
            // Rule: Add contribution, THEN yield (Investment yields in the same month it is added)
            
            // S2
            investBuyBalance += contributionBuy;
            investBuyBalance *= (1 + i_inv_mo);
            totalInvestedS2 += contributionBuy;

            // S3
            investRentBalance += contributionRent;
            investRentBalance *= (1 + i_inv_mo);
            totalInvestedS3 += contributionRent;

            // --- E. UPDATE BALANCES ---
            currentBalanceDue = Math.max(0, currentBalanceDue - amortization);
            totalInstallmentsPaid += installment;
            currentPropertyValue *= (1 + i_appr_mo);

            // --- DATA POINT ---
            timeSeries.push({
                month: m,
                year: Math.floor(m / 12),
                outstandingBalance: currentBalanceDue,
                installment: installment,
                interest: interest,
                propertyValue: currentPropertyValue,
                investedBuyScenario: investBuyBalance,
                // Patrimony S2 = Property + Investments
                totalWealthBuy: currentPropertyValue + investBuyBalance, 
                rentValue: currentRent,
                investedRentScenario: investRentBalance,
                // Patrimony S3 = Investments
                totalWealthRent: investRentBalance
            });
        }

        // Summary Calculation
        const totalPaidFinancing = totalInstallmentsPaid + downPayment + costs;
        const last = timeSeries[timeSeries.length - 1];

        setResults(timeSeries);
        setSummary({
            s1_wealth: last.propertyValue,
            s1_propertyValue: last.propertyValue,
            s1_totalPaid: totalPaidFinancing,

            s2_wealth: last.totalWealthBuy, 
            s2_totalInvested: totalInvestedS2,

            s3_wealth: last.totalWealthRent,
            s3_totalPaidRent: totalPaidRent,
            s3_totalInvested: totalInvestedS3
        });

        setIsCalculated(true);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleClear = () => {
        setIsCalculated(false);
        setResults([]);
    };

    const CustomTooltip = ({ active, payload, label }: RechartsTooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md">
                    <p className="text-zinc-400 mb-2 font-bold font-mono">Mês {label}</p>
                    <div className="space-y-1">
                        {payload.map((p: RechartsTooltipPayloadEntry) => (
                            <p key={p.name} style={{ color: p.color }} className="font-medium">
                                {p.name}: {formatCurrency(p.value, 'BRL')}
                            </p>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    const winner = summary.s3_wealth > summary.s2_wealth ? 'rent' : 'buy';

    return (
        <DashboardLayout title="Calculadora Alugar vs Financiar" subtitle="Descubra matematicamente qual decisão constrói mais patrimônio.">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Home className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Dados do Imóvel</h3>
                        </div>
                        <div className="space-y-4">
                            <Input label="Valor do Imóvel" icon={<DollarSign size={16}/>} type="number" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} />
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Input 
                                        label="Valorização Anual (%)" 
                                        type="number" 
                                        value={appreciationRate} 
                                        onChange={e => setAppreciationRate(Number(e.target.value))} 
                                        step="0.1" 
                                        placeholder="Ex: 4"
                                    />
                                    {appreciationRate < 0.5 && appreciationRate > 0 && (
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
                                            <AlertTriangle size={10} />
                                            <span>Valor baixo. Quis dizer {appreciationRate * 100}%?</span>
                                        </div>
                                    )}
                                </div>
                                <Input label="IGP-M Anual (%)" type="number" value={igpm} onChange={e => setIgpm(Number(e.target.value))} step="0.01" />
                            </div>
                            
                            <Input label="Valor do Aluguel Mensal" icon={<DollarSign size={16}/>} type="number" value={rentValue} onChange={e => setRentValue(Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Building2 className="text-blue-500" size={20} />
                            <h3 className="font-bold text-white">Financiamento (SAC)</h3>
                        </div>
                        <div className="space-y-4">
                            <Input label="Valor da Entrada" icon={<DollarSign size={16}/>} type="number" value={downPayment} onChange={e => setDownPayment(Number(e.target.value))} />
                            <Input label="Custos (ITBI, Cartório)" icon={<DollarSign size={16}/>} type="number" value={costs} onChange={e => setCosts(Number(e.target.value))} />
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Prazo (Meses)" type="number" value={termMonths} onChange={e => setTermMonths(Number(e.target.value))} />
                                <Input label="Juros Anuais (%)" type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} step="0.1" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <TrendingUp className="text-green-500" size={20} />
                            <h3 className="font-bold text-white">Investimentos</h3>
                        </div>
                        <div className="space-y-4">
                            <Input label="Rentabilidade Anual (%)" type="number" value={investmentYield} onChange={e => setInvestmentYield(Number(e.target.value))} step="0.1" />
                            <p className="text-[10px] text-zinc-500 leading-tight">
                                Taxa usada para remunerar a entrada (no cenário de aluguel) e a diferença entre prestação e aluguel.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={handleClear} className="flex-1">
                            <RotateCcw size={16} className="mr-2" /> Limpar
                        </Button>
                        <Button onClick={calculate} className="flex-[2]">
                            Calcular <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </div>
                </div>

                {/* --- RESULTS --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {!isCalculated ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <Coins size={48} className="mb-4 opacity-20" />
                            <p>Preencha os dados e clique em Calcular</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* VERDICT */}
                            <div className={`p-6 rounded-xl border ${winner === 'rent' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'} flex items-start gap-4`}>
                                {winner === 'rent' ? <CheckCircle2 className="text-amber-500 shrink-0" size={24} /> : <CheckCircle2 className="text-green-500 shrink-0" size={24} />}
                                <div>
                                    <h3 className={`font-bold text-lg ${winner === 'rent' ? 'text-amber-500' : 'text-green-500'}`}>
                                        {winner === 'rent' ? 'Alugar e Investir venceu' : 'Financiar e Investir venceu'}
                                    </h3>
                                    <p className="text-zinc-300 text-sm mt-1">
                                        Ao final de <strong>{termMonths} meses</strong>, a estratégia de {winner === 'rent' ? 'alugar' : 'financiar'} gerou um patrimônio líquido 
                                        <strong> {formatCurrency(Math.abs(summary.s3_wealth - summary.s2_wealth), 'BRL')} maior</strong>.
                                    </p>
                                </div>
                            </div>

                            {/* CARDS */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* C1: Only Finance */}
                                <div className="bg-zinc-950 border border-red-900/30 p-5 rounded-xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-800"></div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Só Financiar</p>
                                    <div className="flex items-center gap-1 mb-4">
                                        <p className="text-2xl font-mono font-bold text-white">{formatCurrency(summary.s1_wealth, 'BRL')}</p>
                                        <div className="group relative">
                                            <HelpCircle size={14} className="text-zinc-600 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-zinc-800 text-[10px] text-white rounded hidden group-hover:block z-10 text-center">
                                                Valor final do imóvel corrigido
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-xs text-zinc-400">
                                        <div className="flex justify-between"><span>Valor do Imóvel:</span> <span className="text-white">{formatCurrency(summary.s1_propertyValue, 'BRL')}</span></div>
                                        <div className="flex justify-between group/tp relative">
                                            <span className="border-b border-dashed border-zinc-700 cursor-help">Total Pago:</span> 
                                            <span className="text-zinc-500">{formatCurrency(summary.s1_totalPaid, 'BRL')}</span>
                                            {/* Tooltip for Total Paid */}
                                            <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-zinc-800 text-[10px] text-white rounded hidden group-hover/tp:block z-20 shadow-xl border border-zinc-700">
                                                Inclui Entrada + Custos + Parcelas
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* C2: Finance + Invest */}
                                <div className="bg-zinc-950 border border-green-900/30 p-5 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
                                    <p className="text-xs text-green-500 font-bold uppercase mb-2">Financiar + Investir</p>
                                    <p className="text-2xl font-mono font-bold text-green-400 mb-4">{formatCurrency(summary.s2_wealth, 'BRL')}</p>
                                    <div className="space-y-1 text-xs text-zinc-400">
                                        <div className="flex justify-between"><span>Imóvel:</span> <span className="text-white">{formatCurrency(summary.s1_propertyValue, 'BRL')}</span></div>
                                        <div className="flex justify-between"><span>Investimentos:</span> <span className="text-white">{formatCurrency(summary.s2_wealth - summary.s1_propertyValue, 'BRL')}</span></div>
                                    </div>
                                </div>

                                {/* C3: Rent + Invest */}
                                <div className="bg-zinc-950 border border-amber-900/30 p-5 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                    <p className="text-xs text-amber-500 font-bold uppercase mb-2">Alugar + Investir</p>
                                    <p className="text-2xl font-mono font-bold text-amber-400 mb-4">{formatCurrency(summary.s3_wealth, 'BRL')}</p>
                                    <div className="space-y-1 text-xs text-zinc-400">
                                        <div className="flex justify-between"><span>Investimentos:</span> <span className="text-white">{formatCurrency(summary.s3_wealth, 'BRL')}</span></div>
                                        <div className="flex justify-between"><span>Total Aluguel:</span> <span className="text-red-900/60">{formatCurrency(summary.s3_totalPaidRent, 'BRL')}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* CHART */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                                <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-amber-500" /> Evolução Patrimonial Comparativa
                                </h4>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1 }} />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            
                                            <Line 
                                                type="monotone" 
                                                dataKey="totalWealthBuy" 
                                                name="Financiar + Investir"
                                                stroke="#10b981" 
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="totalWealthRent" 
                                                name="Alugar + Investir"
                                                stroke="#f59e0b" 
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="outstandingBalance" 
                                                name="Saldo Devedor"
                                                stroke="#ef4444" 
                                                strokeWidth={1}
                                                strokeDasharray="5 5"
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                                    <h4 className="text-white font-bold flex items-center gap-2">
                                        <Info size={18} className="text-zinc-500" /> Fluxo Detalhado
                                    </h4>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="text-xs uppercase text-zinc-500 font-medium bg-zinc-950 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3">Mês</th>
                                                <th className="px-4 py-3 text-right text-red-400">Prestação</th>
                                                <th className="px-4 py-3 text-right text-red-400">Juros (Custo)</th>
                                                <th className="px-4 py-3 text-right text-red-400">Aluguel</th>
                                                <th className="px-4 py-3 text-right text-zinc-400">Saldo Devedor</th>
                                                <th className="px-4 py-3 text-right text-green-500">Patrim. Financiando</th>
                                                <th className="px-4 py-3 text-right text-amber-500">Patrim. Alugando</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/50">
                                            {results.map((row) => (
                                                <tr key={row.month} className="hover:bg-zinc-900/30 transition-colors">
                                                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{row.month}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-red-400/80 text-xs">
                                                        {formatCurrency(row.installment, 'BRL')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-red-400/60 text-xs">
                                                        {formatCurrency(row.interest, 'BRL')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-red-400/80 text-xs">
                                                        {formatCurrency(row.rentValue, 'BRL')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-zinc-500 text-xs">
                                                        {formatCurrency(row.outstandingBalance, 'BRL')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-medium text-green-500/90 text-xs">
                                                        {formatCurrency(row.totalWealthBuy, 'BRL')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-medium text-amber-500/90 text-xs">
                                                        {formatCurrency(row.totalWealthRent, 'BRL')}
                                                    </td>
                                                </tr>
                                            ))}
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