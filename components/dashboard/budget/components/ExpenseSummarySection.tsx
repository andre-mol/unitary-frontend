import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Target, List } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import type { Goal, Expense } from '../../../../lib/planningService';
import { 
    calculateTotalExpenses, 
    calculatePercentageOfTotal, 
} from '../../../../domain/calculations';

interface ExpenseSummarySectionProps {
    expenses: Expense[];
    goals: Goal[];
    onOpenCategory: (goal: Goal) => void;
}

export const ExpenseSummarySection: React.FC<ExpenseSummarySectionProps> = ({ 
    expenses, 
    goals, 
    onOpenCategory 
}) => {
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

    const toggleCategory = (catId: string) => {
        const next = new Set(openCategories);
        if (next.has(catId)) next.delete(catId); else next.add(catId);
        setOpenCategories(next);
    };

    const grandTotalSpent = useMemo(() => calculateTotalExpenses(expenses), [expenses]);

    const groupedData = useMemo(() => {
        return goals.map(goal => {
            const catExpenses = expenses
                .filter(e => e.category === goal.category)
                .sort((a, b) => b.value - a.value);
            
            const catTotal = catExpenses.reduce((acc, e) => acc + e.value, 0);
            
            return {
                goal,
                catExpenses,
                catTotal,
                pctOfTotal: calculatePercentageOfTotal(catTotal, grandTotalSpent)
            };
        }).filter(g => g.catTotal > 0)
          .sort((a, b) => b.catTotal - a.catTotal);
    }, [expenses, goals, grandTotalSpent]);

    if (groupedData.length === 0) return null;

    return (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-4 pl-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Principais Gastos do Mês
                </h3>
                <p className="text-zinc-500 text-xs">Resumo dos gastos que compõem seu orçamento atual.</p>
            </div>

            <div className="space-y-3">
                {groupedData.map(({ goal, catExpenses, catTotal, pctOfTotal }) => {
                    const isOpen = openCategories.has(goal.id);
                    const topExpenses = catExpenses.slice(0, 5);

                    return (
                        <div key={goal.id} className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden">
                            {/* Accordion Header */}
                            <button 
                                onClick={() => toggleCategory(goal.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/50 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: goal.color }}></span>
                                    <span className="font-semibold text-zinc-300 text-sm">{goal.category}</span>
                                    <span className="text-zinc-500 text-xs hidden sm:inline">•</span>
                                    <span className="font-mono font-medium text-white text-sm">{formatCurrency(catTotal, 'BRL')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-zinc-500 font-medium bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                                        {pctOfTotal.toFixed(1)}% do total
                                    </span>
                                    <ChevronDown size={16} className={`text-zinc-600 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Accordion Content */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div 
                                        initial={{ height: 0 }} 
                                        animate={{ height: 'auto' }} 
                                        exit={{ height: 0 }} 
                                        className="overflow-hidden border-t border-zinc-800/50 bg-zinc-900/10"
                                    >
                                        <div className="px-4 pb-4 pt-2">
                                            {/* Columns Header */}
                                            <div className="flex text-[10px] uppercase text-zinc-600 font-bold tracking-wider mb-2 px-2 pt-2">
                                                <div className="flex-1">Gasto</div>
                                                <div className="w-24 text-right">Valor</div>
                                                <div className="w-20 text-right hidden sm:block">% Categ.</div>
                                                <div className="w-20 text-right hidden sm:block">% Mês</div>
                                            </div>

                                            <div className="space-y-1">
                                                {topExpenses.map(expense => {
                                                    const pctCat = catTotal > 0 ? (expense.value / catTotal) * 100 : 0;
                                                    const pctMonth = grandTotalSpent > 0 ? (expense.value / grandTotalSpent) * 100 : 0;
                                                    
                                                    const isHighImpactCat = pctCat >= 20;
                                                    const isHighImpactTotal = pctMonth >= 10;
                                                    const highlightClass = (isHighImpactCat || isHighImpactTotal) ? 'text-amber-100' : 'text-zinc-400';
                                                    const dotClass = isHighImpactTotal ? 'bg-amber-500' : isHighImpactCat ? 'bg-zinc-600' : 'bg-zinc-800';

                                                    return (
                                                        <div key={expense.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900 transition-colors text-sm">
                                                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} title={isHighImpactTotal ? '>10% do Total' : isHighImpactCat ? '>20% da Categoria' : ''}></div>
                                                                <span className={`${highlightClass} truncate`}>{expense.name}</span>
                                                                {expense.installment && (
                                                                    <span className="text-[9px] text-zinc-600 bg-zinc-900 px-1.5 rounded border border-zinc-700 shrink-0">
                                                                        {expense.installment.current}/{expense.installment.total}
                                                                    </span>
                                                                )}
                                                                {expense.objectiveId && (
                                                                    <Target size={12} className="text-cyan-500 shrink-0" title="Vinculado a Objetivo" />
                                                                )}
                                                            </div>
                                                            <div className="w-24 text-right font-mono text-zinc-200 font-medium">
                                                                {formatCurrency(expense.value, 'BRL')}
                                                            </div>
                                                            <div className="w-20 text-right font-mono text-xs text-zinc-500 hidden sm:block">
                                                                {pctCat.toFixed(0)}%
                                                            </div>
                                                            <div className="w-20 text-right font-mono text-xs text-zinc-500 hidden sm:block">
                                                                {pctMonth.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {catExpenses.length > 5 && (
                                                <div className="mt-3 pt-2 border-t border-zinc-800/30 text-center">
                                                    <button 
                                                        onClick={() => onOpenCategory(goal)}
                                                        className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-1 w-full py-1"
                                                    >
                                                        <List size={12} />
                                                        Ver todos os {catExpenses.length} gastos desta categoria
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

