import React from 'react';
import { Eye, Plus } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import type { Goal } from '../../../../lib/planningService';
import { CategoryStats } from '../types';

interface ExpenseCardProps {
    goal: Goal;
    stats: CategoryStats;
    onOpenCategory: (goal: Goal) => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
    goal,
    stats,
    onOpenCategory,
}) => {
    const isOverBudget = stats.realized > stats.planned && stats.planned > 0;
    const barColor = isOverBudget ? 'bg-red-500' : 'bg-green-500';
    const percentageColor = isOverBudget ? 'text-red-500' : 'text-zinc-400';

    return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors flex flex-col justify-between relative overflow-hidden group min-h-[360px] xl:flex-1 xl:min-w-0">
            
            {/* Header (Category & Meta) */}
            <div className="relative z-10 flex flex-col gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                        style={{ backgroundColor: goal.color, color: goal.color }}
                    />
                    <h4 className="text-white font-bold text-lg truncate leading-tight" title={goal.category}>{goal.category}</h4>
                </div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded w-fit">
                    Meta: {goal.percentage}%
                </span>
            </div>

            {/* Main Hero Metric (Remaining) */}
            <div className="relative z-10 mb-4 py-2 border-y border-dashed border-zinc-900/50">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Disponível</p>
                <span className={`text-2xl font-mono font-bold block tracking-tight ${stats.remaining < 0 ? 'text-red-500' : 'text-white'}`}>
                    {formatCurrency(stats.remaining, 'BRL')}
                </span>
            </div>

            {/* Detailed Stats Stacked - Vertical Layout */}
            <div className="relative z-10 flex flex-col gap-4 mb-4 bg-zinc-900/30 p-4 rounded-lg border border-zinc-900/50">
                <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Planejado</p>
                    <p className="text-lg text-zinc-300 font-mono font-medium leading-none tracking-tight">
                        {formatCurrency(stats.planned, 'BRL')}
                    </p>
                </div>
                <div className="w-full h-px bg-zinc-800/30"></div>
                <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Gasto</p>
                    <p className={`text-lg font-mono font-medium leading-none tracking-tight ${isOverBudget ? 'text-red-400' : 'text-white'}`}>
                        {formatCurrency(stats.realized, 'BRL')}
                    </p>
                </div>
            </div>

            {/* Footer Section */}
            <div className="relative z-10 mt-auto">
                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] mb-1.5 uppercase font-bold tracking-wider">
                        <span className="text-zinc-500">Consumo</span>
                        <span className={percentageColor}>{stats.planned > 0 ? stats.percentUsed.toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                        <div 
                            className={`h-full transition-all duration-500 ${barColor}`} 
                            style={{ width: `${Math.min(100, stats.percentUsed)}%` }} 
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button 
                        onClick={() => onOpenCategory(goal)}
                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium py-2.5 rounded-lg transition-colors border border-zinc-800 hover:border-zinc-600"
                    >
                        <Eye size={14} /> Detalhes
                    </button>
                    <button 
                        onClick={() => onOpenCategory(goal)}
                        className="flex-shrink-0 bg-zinc-900 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/50 text-zinc-400 p-2.5 rounded-lg transition-colors border border-zinc-800"
                        title="Adicionar Gasto"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Decorative faint background bar */}
            <div 
                className="absolute bottom-0 left-0 h-1 opacity-20 pointer-events-none transition-all group-hover:h-full group-hover:opacity-5" 
                style={{ width: '100%', backgroundColor: goal.color }} 
            />
        </div>
    );
};

