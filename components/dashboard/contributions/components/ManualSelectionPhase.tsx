import React from 'react';
import { DashboardLayout } from '../../DashboardLayout';
import { Portfolio } from '../../../../types';
import { TrendingUp, Building2, Briefcase, Layers, ArrowLeft } from 'lucide-react';
import { FlowStep } from '../types';

interface ManualSelectionPhaseProps {
    portfolios: Portfolio[];
    setFlowStep: (step: FlowStep) => void;
    startManualExecution: (portfolio: Portfolio) => void;
}

const getIcon = (type: string) => {
    switch (type) {
        case 'investments': return <TrendingUp size={24} />;
        case 'real_estate': return <Building2 size={24} />;
        case 'business': return <Briefcase size={24} />;
        default: return <Layers size={24} />;
    }
};

export const ManualSelectionPhase: React.FC<ManualSelectionPhaseProps> = ({
    portfolios,
    setFlowStep,
    startManualExecution,
}) => {
    return (
        <DashboardLayout title="Seleção Manual" subtitle="Escolha onde deseja aportar hoje.">
            <div className="max-w-4xl mx-auto space-y-6">
                <button 
                    onClick={() => setFlowStep('input')} 
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 text-sm"
                >
                    <ArrowLeft size={16} /> Voltar para modo automático
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {portfolios.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => startManualExecution(p)}
                            className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl cursor-pointer hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-zinc-950 p-3 rounded-lg text-amber-500 border border-zinc-800 group-hover:border-amber-500/20">
                                    {getIcon(p.type)}
                                </div>
                                <span className="text-xs text-zinc-500 uppercase tracking-wider">{p.currency}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
                            <p className="text-sm text-zinc-500">
                                {p.type === 'custom' ? 'Personalizado' : p.type === 'investments' ? 'Investimentos' : p.type === 'real_estate' ? 'Imóveis' : 'Empresas'}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
};

