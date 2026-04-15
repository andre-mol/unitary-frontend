import React, { useState, useRef } from 'react';
import { DashboardLayout } from '../DashboardLayout';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { 
    Calculator, RotateCcw, ArrowRight, DollarSign, 
    Info, AlertTriangle, TrendingUp, Target, BookOpen, BarChart3, CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

type CalculationStatus = "INSERIR_DADOS" | "EXCEDE_MARGEM" | "OPORTUNIDADE" | "ACIMA_TETO";

export const BazinCalculator: React.FC = () => {
    // State Inputs
    const [ticker, setTicker] = useState('');
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [dividend12m, setDividend12m] = useState<number>(0);
    const [dividend5yAvg, setDividend5yAvg] = useState<number>(0);
    const [desiredYield, setDesiredYield] = useState<number>(6); // Default 6%

    // State Results
    const [theoreticalCeiling, setTheoreticalCeiling] = useState<number | null>(null);
    const [currentCeiling, setCurrentCeiling] = useState<number | null>(null);
    const [status, setStatus] = useState<CalculationStatus>("INSERIR_DADOS");
    const [isCalculated, setIsCalculated] = useState(false);
    
    const resultsRef = useRef<HTMLDivElement>(null);

    // Logic
    const handleCalculate = () => {
        // Validação básica
        if (desiredYield <= 0) return;

        // Função de arredondamento comercial (2 casas)
        // Equivalente ao ARRED do Excel/Sheets
        const roundToTwo = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

        // 1. Cálculos com Arredondamento
        // Preço-Teto Teórico = Round(Média 5 Anos / (Taxa / 100), 2)
        const rawTheoretical = dividend5yAvg / (desiredYield / 100);
        const calcTheoretical = roundToTwo(rawTheoretical);
        
        // Preço-Teto Atual = Round(Dividendos 12m / (Taxa / 100), 2)
        const rawCurrent = dividend12m / (desiredYield / 100);
        const calcCurrent = roundToTwo(rawCurrent);

        setTheoreticalCeiling(calcTheoretical);
        setCurrentCeiling(calcCurrent);

        // 2. Lógica de Status (Estrita conforme Planilha)
        // Regra: Igualdade ou superioridade ao teto anula a oportunidade.
        // Apenas 'menor que' (<) valida a margem.
        
        let newStatus: CalculationStatus = "INSERIR_DADOS";

        if (dividend12m === 0) {
            newStatus = "INSERIR_DADOS";
        } else if (currentPrice > 0 && currentPrice < calcTheoretical) {
            // Se preço menor que o teto teórico (mais conservador ou base histórica)
            newStatus = "EXCEDE_MARGEM";
        } else if (
            currentPrice > 0 && 
            currentPrice > calcTheoretical && 
            currentPrice < calcCurrent
        ) {
            // Se preço está no "limbo": Acima do histórico, mas abaixo do atual.
            // Só acontece se o teto atual for maior que o histórico.
            newStatus = "OPORTUNIDADE";
        } else {
            // Qualquer outro caso: Preço >= Teto Teórico (e não enquadrado na oportunidade) ou >= Teto Atual
            newStatus = "ACIMA_TETO";
        }

        setStatus(newStatus);
        setIsCalculated(true);

        // Scroll to results on mobile
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleClear = () => {
        setTicker('');
        setCurrentPrice(0);
        setDividend12m(0);
        setDividend5yAvg(0);
        setDesiredYield(6);
        setTheoreticalCeiling(null);
        setCurrentCeiling(null);
        setStatus("INSERIR_DADOS");
        setIsCalculated(false);
    };

    // Helpers para renderização do Status
    const renderStatusBadge = () => {
        switch (status) {
            case "EXCEDE_MARGEM":
                return (
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 animate-in fade-in text-center">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-1">
                            <CheckCircle2 size={20} /> EXCEDE A MARGEM DE SEGURANÇA
                        </div>
                        <p className="text-[10px] opacity-80">Preço abaixo do teto teórico histórico.</p>
                    </div>
                );
            case "OPORTUNIDADE":
                return (
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 animate-in fade-in text-center">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-1">
                            <AlertTriangle size={20} /> INDICA POSSÍVEL OPORTUNIDADE
                        </div>
                        <p className="text-[10px] opacity-80">Preço suportado apenas pelos dividendos recentes.</p>
                    </div>
                );
            case "ACIMA_TETO":
                return (
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 animate-in fade-in text-center">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-1">
                            <TrendingUp size={20} /> ACIMA DO PREÇO-TETO
                        </div>
                        <p className="text-[10px] opacity-80">
                            Sem margem de segurança baseada nos parâmetros informados.
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <DashboardLayout 
            title="Fórmula Bazin" 
            subtitle="Cálculo do preço-teto com foco em renda passiva por dividendos."
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- INPUTS --- */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                            <Calculator className="text-amber-500" size={20} />
                            <h3 className="font-bold text-white">Dados do Ativo</h3>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Ticker (Opcional)"
                                    placeholder="Ex: BBAS3"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                    maxLength={6}
                                />
                                <Input 
                                    label="Cotação Atual (R$)"
                                    placeholder="0,00"
                                    type="number"
                                    value={currentPrice || ''}
                                    onChange={(e) => setCurrentPrice(Number(e.target.value))}
                                />
                            </div>

                            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-4">
                                <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                    <BarChart3 size={16} />
                                    <span className="text-xs font-bold uppercase">Histórico de Proventos</span>
                                </div>
                                
                                <div>
                                    <Input 
                                        label="Média Dividendos (5 Anos) R$"
                                        placeholder="0,00"
                                        type="number"
                                        value={dividend5yAvg || ''}
                                        onChange={(e) => setDividend5yAvg(Number(e.target.value))}
                                        step="0.01"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                        Média da soma anual dos últimos 5 anos.
                                    </p>
                                </div>

                                <div>
                                    <Input 
                                        label="Dividendos (12 Meses) R$"
                                        placeholder="0,00"
                                        type="number"
                                        value={dividend12m || ''}
                                        onChange={(e) => setDividend12m(Number(e.target.value))}
                                        step="0.01"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                        Soma dos proventos pagos no último ano.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Input 
                                    label="Taxa de Retorno Mínima (%)"
                                    type="number"
                                    value={desiredYield}
                                    onChange={(e) => setDesiredYield(Number(e.target.value))}
                                    step="0.5"
                                />
                                <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                    Décio Bazin utilizava 6% como referência histórica.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" onClick={handleClear} className="flex-1">
                                    <RotateCcw size={16} className="mr-2" /> Limpar
                                </Button>
                                <Button onClick={handleCalculate} className="flex-[2]" disabled={dividend12m <= 0 || dividend5yAvg <= 0 || desiredYield <= 0 || currentPrice <= 0}>
                                    Calcular <ArrowRight size={16} className="ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RESULTS --- */}
                <div className="lg:col-span-2 space-y-6" ref={resultsRef}>
                    {!isCalculated ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-zinc-500">
                            <Target size={48} className="mb-4 opacity-20" />
                            <p>Preencha os dados completos para análise.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* STATUS BADGE */}
                            {renderStatusBadge()}

                            {/* WARNING TEXT (MANDATORY) */}
                            <div className="text-center px-4">
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    O método Bazin exige <strong>margem de segurança</strong>.<br/>
                                    Preços iguais ou superiores ao preço-teto não representam oportunidade.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Main Result Card: Theoretical */}
                                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-500/30 rounded-xl p-8 relative overflow-hidden group flex flex-col justify-between h-full">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">
                                            Preço-Teto Teórico {ticker && `(${ticker})`}
                                        </p>
                                        <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-tight mb-2">
                                            {formatCurrency(theoreticalCeiling || 0, 'BRL')}
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-2 py-1 bg-zinc-900 rounded border border-zinc-800 text-[10px] text-zinc-400 mt-2">
                                            <span>Base: Média 5 Anos ({formatCurrency(dividend5yAvg, 'BRL')})</span>
                                        </div>
                                    </div>
                                    <p className="text-zinc-500 text-xs mt-6 leading-relaxed">
                                        Considerado o valor mais conservador, pois dilui eventos atípicos ocorridos nos últimos anos.
                                    </p>
                                </div>

                                {/* Secondary Result Card: Current */}
                                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 relative overflow-hidden flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">
                                            Preço-Teto Atual
                                        </p>
                                        <div className="text-3xl md:text-4xl font-mono font-bold text-zinc-300 tracking-tight mb-2">
                                            {formatCurrency(currentCeiling || 0, 'BRL')}
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-2 py-1 bg-zinc-900 rounded border border-zinc-800 text-[10px] text-zinc-500 mt-2">
                                            <span>Base: Últimos 12 Meses ({formatCurrency(dividend12m, 'BRL')})</span>
                                        </div>
                                    </div>
                                    <p className="text-zinc-600 text-xs mt-6 leading-relaxed">
                                        Reflete a capacidade de pagamento mais recente da empresa, mas pode estar distorcida por não recorrentes.
                                    </p>
                                </div>
                            </div>

                            {/* Educational Note */}
                            <div className="flex items-start gap-4 p-5 border border-zinc-800 bg-zinc-900/30 rounded-xl">
                                <BookOpen className="text-amber-500 shrink-0 mt-1" size={20} />
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-white">Entenda a Análise</h4>
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        O <strong>preço-teto teórico</strong> utiliza a média histórica para filtrar ruídos de curto prazo. 
                                        O <strong>preço-teto atual</strong> mostra a realidade imediata. 
                                        A melhor margem de segurança ocorre quando a cotação atual está estritamente abaixo destes valores.
                                    </p>
                                </div>
                            </div>

                            {/* Mandatory Disclaimer */}
                            <div className="flex items-start gap-3 p-4 border border-zinc-800 bg-zinc-950/80 rounded-xl">
                                <Info className="text-zinc-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    Esta ferramenta é estritamente <strong>educacional e analítica</strong>. O resultado é matemático (com arredondamento em 2 casas) e não representa recomendação de compra ou venda.
                                </p>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};
