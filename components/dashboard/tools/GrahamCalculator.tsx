import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    Calculator, RotateCcw, ArrowRight, DollarSign, 
    Info, AlertTriangle, BookOpen, Scale, TrendingUp, Briefcase
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

export const GrahamCalculator: React.FC = () => {
    const [mode, setMode] = useState<'value' | 'growth'>('value');
    
    // Inputs
    const [lpa, setLpa] = useState<number>(0);
    const [vpa, setVpa] = useState<number>(0);
    const [growthRate, setGrowthRate] = useState<number>(0); // g
    const [interestRate, setInterestRate] = useState<number>(6); // Y (Default to something reasonable like 6% for Brazil or kept flexible)

    const [result, setResult] = useState<number | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const handleCalculate = () => {
        let calculated = 0;
        
        if (mode === 'value') {
            // Formula: sqrt(22.5 * LPA * VPA)
            // 22.5 comes from P/E < 15 and P/B < 1.5 => 15 * 1.5 = 22.5
            if (lpa <= 0 || vpa <= 0) return;
            const product = 22.5 * lpa * vpa;
            if (product < 0) {
                // If product is negative (negative earnings or equity), classic Graham doesn't apply directly or returns 0/undefined
                setResult(0); 
                return;
            }
            calculated = Math.sqrt(product);
        } else {
            // Formula: (LPA * (8.5 + 2g)) * 4.4 / Y
            if (lpa <= 0 || interestRate <= 0) return;
            
            // Assume growthRate is passed as number (e.g. 10 for 10%)
            const innerTerm = 8.5 + (2 * growthRate);
            calculated = (lpa * innerTerm * 4.4) / interestRate;
        }
        
        setResult(calculated);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleClear = () => {
        setLpa(0);
        setVpa(0);
        setGrowthRate(0);
        setInterestRate(6);
        setResult(null);
    };

    return (
        <DashboardLayout 
            title="Fórmula Graham" 
            subtitle="Cálculo do valor intrínseco com base em fundamentos."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Calculator className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Parâmetros</h3>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex bg-zinc-950 p-1 rounded-lg mb-6 border border-zinc-800">
                            <button 
                                onClick={() => { setMode('value'); setResult(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'value' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Ações de Valor
                            </button>
                            <button 
                                onClick={() => { setMode('growth'); setResult(null); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'growth' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Crescimento
                            </button>
                        </div>

                        <div className="space-y-5">
                            <Input 
                                label="LPA (Lucro por Ação)"
                                placeholder="0,00"
                                type="number"
                                icon={<DollarSign size={16} />}
                                value={lpa || ''}
                                onChange={(e) => setLpa(Number(e.target.value))}
                                step="0.01"
                            />

                            {mode === 'value' ? (
                                <div>
                                    <Input 
                                        label="VPA (Valor Patrimonial p/ Ação)"
                                        placeholder="0,00"
                                        type="number"
                                        icon={<Briefcase size={16} />}
                                        value={vpa || ''}
                                        onChange={(e) => setVpa(Number(e.target.value))}
                                        step="0.01"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                        Patrimônio Líquido dividido pelo número de ações.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <Input 
                                            label="Taxa de Crescimento Esperada (g) %"
                                            placeholder="Ex: 5, 10"
                                            type="number"
                                            icon={<TrendingUp size={16} />}
                                            value={growthRate || ''}
                                            onChange={(e) => setGrowthRate(Number(e.target.value))}
                                            step="0.1"
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                            Projeção conservadora de crescimento anual dos lucros (7-10 anos).
                                        </p>
                                    </div>
                                    <div>
                                        <Input 
                                            label="Taxa de Juros Longo Prazo (Y) %"
                                            placeholder="Ex: 6.0"
                                            type="number"
                                            value={interestRate}
                                            onChange={(e) => setInterestRate(Number(e.target.value))}
                                            step="0.1"
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                            Rendimento de títulos corporativos AAA ou títulos públicos de longo prazo.
                                        </p>
                                    </div>
                                </>
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

                    {/* Educational Note */}
                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
                        <h4 className="text-zinc-400 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                            <BookOpen size={14} /> Sobre o Método
                        </h4>
                        <ul className="space-y-2 text-sm text-zinc-500">
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                                <span>Busca determinar o <strong>valor intrínseco</strong> de empresas sólidas.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                                <span>Foca na <strong>margem de segurança</strong> entre preço e valor.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                                <span>Mais indicado para empresas industriais e com <strong>ativos tangíveis</strong>.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* --- RESULTS --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {result === null ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <Scale size={48} className="mb-4 opacity-20" />
                            <p>Preencha os fundamentos para estimar o valor justo.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Main Result Card */}
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-500/30 rounded-xl p-8 relative overflow-hidden group text-center">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                                
                                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">
                                    Valor Justo Estimado
                                </p>
                                
                                <div className="text-5xl md:text-6xl font-mono font-bold text-white tracking-tight mb-2">
                                    {formatCurrency(result || 0, 'BRL')}
                                </div>
                                
                                <p className="text-zinc-500 text-sm mt-6 max-w-md mx-auto">
                                    Este valor representa uma estimativa teórica baseada nos parâmetros informados e nos critérios de Benjamin Graham.
                                </p>
                            </div>

                            {/* Limitations Block */}
                            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                                <div className="flex items-center gap-2 mb-4 text-amber-500">
                                    <AlertTriangle size={20} />
                                    <h3 className="font-bold">Limitações Importantes</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-zinc-300 font-medium mb-2">Menos eficaz para:</p>
                                        <ul className="space-y-1 text-sm text-zinc-500">
                                            <li>• Bancos e Seguradoras (VPA contábil diferente)</li>
                                            <li>• Empresas de Tecnologia (Ativos intangíveis)</li>
                                            <li>• Empresas Asset-light (Pouco imobilizado)</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-sm text-zinc-300 font-medium mb-2">Como utilizar:</p>
                                        <p className="text-sm text-zinc-500 leading-relaxed">
                                            Use como ferramenta de <strong>triagem inicial</strong>. Se o preço de mercado estiver muito abaixo do valor calculado, investigue o motivo (pode ser uma oportunidade ou uma "armadilha de valor").
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Mandatory Disclaimer */}
                            <div className="flex items-start gap-3 p-4 border border-zinc-800 bg-zinc-950/80 rounded-xl">
                                <Info className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Esta ferramenta é estritamente educacional. O resultado é matemático e <strong>não representa recomendação de compra ou venda</strong> de ativos. A análise fundamentalista requer estudo aprofundado do negócio, governança e cenário macroeconômico.
                                </p>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};
