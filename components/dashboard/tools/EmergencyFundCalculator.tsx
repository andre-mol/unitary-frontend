import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    ShieldCheck, DollarSign, RotateCcw, ArrowRight, 
    Briefcase, Wallet, Hourglass, Info, AlertTriangle 
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

type EmploymentType = 'CLT' | 'PUBLICO' | 'AUTONOMO';

interface CalculationResult {
    monthsCoverage: number;
    idealReserve: number;
    monthlySaving: number;
    monthsToAchieve: number;
    employmentLabel: string;
    description: string;
}

const EMPLOYMENT_OPTIONS = [
    { value: 'CLT', label: 'CLT / Carteira Assinada', months: 6 },
    { value: 'PUBLICO', label: 'Funcionário Público (Estatutário)', months: 3 },
    { value: 'AUTONOMO', label: 'Autônomo / Empresário / MEI', months: 12 },
];

export const EmergencyFundCalculator: React.FC = () => {
    // --- STATE ---
    const [employmentType, setEmploymentType] = useState<EmploymentType>('CLT');
    const [monthlyCost, setMonthlyCost] = useState<number>(0);
    const [monthlySalary, setMonthlySalary] = useState<number>(0);
    const [savePercentage, setSavePercentage] = useState<number>(10); // Default 10%

    const [result, setResult] = useState<CalculationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const resultsRef = useRef<HTMLDivElement>(null);

    // --- HELPERS ---
    const getExplanation = (type: EmploymentType) => {
        switch (type) {
            case 'CLT':
                return "Para trabalhadores da modalidade CLT, o ideal é que a reserva de emergência contemple 6 meses dos custos fixos essenciais. Isso cobre o período médio de recolocação no mercado, considerando o apoio temporário de FGTS e seguro-desemprego.";
            case 'PUBLICO':
                return "Devido à estabilidade empregatícia estatutária, funcionários públicos podem manter uma reserva menor, de 3 meses dos custos fixos, focada principalmente em imprevistos de saúde ou manutenção de bens, já que o risco de perda de renda é baixo.";
            case 'AUTONOMO':
                return "Para empreendedores e autônomos, a volatilidade de renda exige proteção máxima. O ideal são 12 meses de custos fixos guardados para garantir tranquilidade em períodos de baixa demanda ou crises de mercado.";
            default: return "";
        }
    };

    // --- LOGIC ---
    const handleCalculate = () => {
        setError(null);

        // Validations
        if (monthlyCost <= 0) {
            setError("O custo fixo mensal deve ser maior que zero.");
            return;
        }
        if (monthlySalary <= 0) {
            setError("O salário mensal deve ser maior que zero.");
            return;
        }
        if (savePercentage <= 0 || savePercentage > 100) {
            setError("O percentual guardado deve ser entre 1% e 100%.");
            return;
        }

        const selectedOption = EMPLOYMENT_OPTIONS.find(o => o.value === employmentType)!;
        const monthsCoverage = selectedOption.months;
        
        // 1. Ideal Reserve
        const idealReserve = monthlyCost * monthsCoverage;

        // 2. Monthly Saving Amount
        const monthlySaving = monthlySalary * (savePercentage / 100);

        // 3. Time to Achieve
        // Math.ceil ensures we count partial months as a full month needed
        const monthsToAchieve = Math.ceil(idealReserve / monthlySaving);

        setResult({
            monthsCoverage,
            idealReserve,
            monthlySaving,
            monthsToAchieve,
            employmentLabel: selectedOption.label,
            description: getExplanation(employmentType)
        });

        // Scroll to results on mobile
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleClear = () => {
        setMonthlyCost(0);
        setMonthlySalary(0);
        setSavePercentage(10);
        setResult(null);
        setError(null);
    };

    return (
        <DashboardLayout title="Reserva de Emergência" subtitle="Descubra o tamanho ideal da sua proteção financeira baseada no seu perfil de risco.">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <ShieldCheck className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Seus Dados</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Modalidade de Trabalho</label>
                                <select 
                                    className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-3 focus:outline-none focus:border-amber-500 text-sm appearance-none cursor-pointer"
                                    value={employmentType}
                                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                                >
                                    {EMPLOYMENT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-zinc-500 mt-1 ml-1">Define os meses de cobertura necessários.</p>
                            </div>

                            <Input 
                                label="Custo Fixo Mensal"
                                placeholder="0,00"
                                type="number"
                                icon={<DollarSign size={16} />}
                                value={monthlyCost || ''}
                                onChange={(e) => setMonthlyCost(Number(e.target.value))}
                            />

                            <Input 
                                label="Salário Líquido Mensal"
                                placeholder="0,00"
                                type="number"
                                icon={<Briefcase size={16} />}
                                value={monthlySalary || ''}
                                onChange={(e) => setMonthlySalary(Number(e.target.value))}
                            />

                            <div>
                                <Input 
                                    label="Quanto você guarda por mês? (%)"
                                    type="number"
                                    value={savePercentage}
                                    onChange={(e) => setSavePercentage(Number(e.target.value))}
                                    max={100}
                                />
                                {monthlySalary > 0 && savePercentage > 0 && (
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                        Isso equivale a <strong>{formatCurrency(monthlySalary * (savePercentage / 100), 'BRL')}</strong> por mês.
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={14} />
                                    <span className="text-xs text-red-400">{error}</span>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" onClick={handleClear} className="flex-1">
                                    <RotateCcw size={16} className="mr-2" /> Limpar
                                </Button>
                                <Button onClick={handleCalculate} className="flex-[2]">
                                    Calcular <ArrowRight size={16} className="ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RESULTS --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {!result ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <ShieldCheck size={48} className="mb-4 opacity-20" />
                            <p>Preencha os dados e clique em Calcular</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Explanation Card */}
                            <div className="bg-zinc-900/30 border-l-4 border-amber-500 rounded-r-xl p-6">
                                <h4 className="text-amber-500 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Info size={16} /> Análise de Perfil: {employmentType === 'PUBLICO' ? 'Estatutário' : employmentType === 'AUTONOMO' ? 'Empreendedor' : 'CLT'}
                                </h4>
                                <p className="text-zinc-300 text-sm leading-relaxed">
                                    {result.description}
                                </p>
                            </div>

                            {/* Main Result: Ideal Amount */}
                            <div className="bg-zinc-950 border border-zinc-800 p-8 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-32 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                                <div className="relative z-10 text-center">
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">Sua Reserva Ideal ({result.monthsCoverage} meses)</p>
                                    <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-tight">
                                        {formatCurrency(result.idealReserve, 'BRL')}
                                    </div>
                                    <p className="text-zinc-500 text-sm mt-4">
                                        Este valor blinda seu custo de vida contra imprevistos do seu perfil.
                                    </p>
                                </div>
                            </div>

                            {/* Secondary Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex items-start gap-4">
                                    <div className="bg-zinc-800 p-3 rounded-lg text-zinc-400">
                                        <Wallet size={24} />
                                    </div>
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Capacidade de Aporte</p>
                                        <p className="text-xl font-mono font-bold text-white">
                                            {formatCurrency(result.monthlySaving, 'BRL')}
                                            <span className="text-sm text-zinc-500 font-normal"> /mês</span>
                                        </p>
                                        <p className="text-xs text-zinc-600 mt-1">
                                            Considerando {savePercentage}% do salário líquido.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex items-start gap-4">
                                    <div className="bg-zinc-800 p-3 rounded-lg text-amber-500">
                                        <Hourglass size={24} />
                                    </div>
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">Tempo de Construção</p>
                                        <p className="text-xl font-bold text-white">
                                            {result.monthsToAchieve} meses
                                        </p>
                                        <p className="text-xs text-zinc-600 mt-1">
                                            {result.monthsToAchieve > 12 
                                                ? `Aprox. ${(result.monthsToAchieve / 12).toFixed(1)} anos para concluir.` 
                                                : "Menos de 1 ano para concluir."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Advice */}
                            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 py-4 border-t border-zinc-900 mt-4">
                                <ShieldCheck size={12} />
                                <p>A reserva deve ser alocada em ativos de liquidez imediata (D+0 ou D+1) e baixo risco (Selic/CDI).</p>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};
