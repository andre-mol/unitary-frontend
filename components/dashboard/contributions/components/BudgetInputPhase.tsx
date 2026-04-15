import React from 'react';
import { DashboardLayout } from '../../DashboardLayout';
import { Button } from '../../../ui/Button';
import { Wallet, DollarSign, ArrowRight, MousePointer2 } from 'lucide-react';
import { FlowStep } from '../types';

interface BudgetInputPhaseProps {
    globalBudget: string;
    setGlobalBudget: (value: string) => void;
    onSubmit: () => void;
    setFlowStep: (step: FlowStep) => void;
}

export const BudgetInputPhase: React.FC<BudgetInputPhaseProps> = ({
    globalBudget,
    setGlobalBudget,
    onSubmit,
    setFlowStep,
}) => {
    return (
        <DashboardLayout title="Planejar Aportes" subtitle="Inicie o fluxo de distribuição inteligente.">
            <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto text-center px-4">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full shadow-2xl">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wallet className="text-amber-500" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Qual o valor do aporte?</h2>
                    <p className="text-zinc-400 mb-8">
                        Defina o montante total disponível. O sistema irá sugerir a distribuição ideal entre seus portfólios.
                    </p>
                    
                    <div className="relative mb-6">
                        <DollarSign size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input 
                            type="number"
                            autoFocus
                            value={globalBudget}
                            onChange={(e) => setGlobalBudget(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            placeholder="0,00"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-2xl text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                    </div>

                    <Button onClick={onSubmit} disabled={!globalBudget || parseFloat(globalBudget) <= 0} className="w-full py-4 text-lg">
                        Calcular Distribuição <ArrowRight className="ml-2" />
                    </Button>

                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <button 
                            onClick={() => setFlowStep('manual_selection')}
                            className="text-sm text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2 w-full"
                        >
                            <MousePointer2 size={16} /> Selecionar portfólio manualmente
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

