import React from 'react';
import { DashboardLayout } from '../../DashboardLayout';
import { Button } from '../../../ui/Button';
import { DollarSign, Calculator, Play } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import { PortfolioQueueItem, FlowStep } from '../types';

interface PreviewPhaseProps {
    globalBudget: string;
    portfolioQueue: PortfolioQueueItem[];
    setFlowStep: (step: FlowStep) => void;
    startExecution: () => void;
}

export const PreviewPhase: React.FC<PreviewPhaseProps> = ({
    globalBudget,
    portfolioQueue,
    setFlowStep,
    startExecution,
}) => {
    return (
        <DashboardLayout title="Plano de Aporte" subtitle="Revisão da estratégia macro.">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20">
                            <DollarSign size={24} className="text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-400 uppercase font-bold tracking-wide">Valor Total</p>
                            <p className="text-3xl font-mono text-white font-bold">{formatCurrency(Number(globalBudget), 'BRL')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-black/20 px-3 py-2 rounded-lg border border-zinc-800/50">
                        <Calculator size={14} />
                        <span>Algoritmo: (Nota Portfólio / Soma Notas) × Total</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white pl-1">Ordem de Execução</h3>
                    {portfolioQueue.map((item, idx) => (
                        <div key={item.portfolio.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex items-center justify-between hover:border-zinc-700 transition-colors">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 font-mono text-sm border border-zinc-700">
                                    {idx + 1}
                                </span>
                                <div>
                                    <h4 className="font-bold text-white text-lg">{item.portfolio.name}</h4>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded">Nota {item.score.toFixed(1)}</span>
                                        <span className="text-zinc-500">{item.portfolio.type === 'custom' ? 'Personalizado' : item.portfolio.type}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-zinc-500 uppercase font-medium">Sugerido</p>
                                <p className="text-xl font-mono text-green-400 font-bold">
                                    {formatCurrency(item.allocatedAmount, 'BRL')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-zinc-950 border-t border-zinc-900 p-6 z-20 flex justify-between items-center">
                    <button onClick={() => setFlowStep('input')} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">
                        ← Ajustar Valor
                    </button>
                    <Button onClick={startExecution} size="lg" className="px-8">
                        <Play size={18} className="mr-2 fill-current" /> Iniciar Sequência
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    );
};

