import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../../ui/Button';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import type { Goal } from '../../../../lib/planningService';
import { CategoryStats } from '../types';

interface InvestmentHeroCardProps {
    investmentGoal: Goal;
    stats: CategoryStats;
    onOpenCategory: (goal: Goal) => void;
    onInvest: () => void;
}

export const InvestmentHeroCard: React.FC<InvestmentHeroCardProps> = ({
    investmentGoal,
    stats,
    onOpenCategory,
    onInvest,
}) => {
    const { planned, realized, remaining } = stats;

    return (
        <motion.div 
            layout
            className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-zinc-950 border border-amber-500/30 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 group"
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none"></div>

            <div className="relative z-10 flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500 rounded-lg text-black shadow-lg shadow-amber-500/20">
                        <TrendingUp size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Investimentos do Mês</h3>
                </div>
                <p className="text-zinc-400 text-sm max-w-md mt-2 leading-relaxed">
                    Meta de <strong>{investmentGoal.percentage}%</strong> da renda. Use este valor para seus aportes estratégicos.
                </p>
                <div className="mt-4 flex gap-4 text-sm">
                    <div>
                        <span className="text-zinc-500 block text-xs uppercase">Planejado</span>
                        <span className="font-mono text-white font-bold">{formatCurrency(planned, 'BRL')}</span>
                    </div>
                    <div className="w-px bg-white/10"></div>
                    <div>
                        <span className="text-zinc-500 block text-xs uppercase">Realizado</span>
                        <span className="font-mono text-amber-500 font-bold">{formatCurrency(realized, 'BRL')}</span>
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex flex-col items-end gap-3">
                <div className="text-right">
                    <span className="text-xs font-medium text-amber-500 uppercase tracking-wider">Disponível para Aporte</span>
                    <div className="text-4xl font-mono font-bold text-white tracking-tight">
                        {formatCurrency(remaining, 'BRL')}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenCategory(investmentGoal)}
                        className="border-amber-500/30 hover:bg-amber-500/10 text-amber-500"
                    >
                        Registrar Saída
                    </Button>
                    <Button 
                        variant="primary" 
                        size="sm" 
                        className="shadow-xl shadow-amber-900/20"
                        onClick={onInvest}
                    >
                        Distribuir <ArrowRight size={14} className="ml-2" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
};

