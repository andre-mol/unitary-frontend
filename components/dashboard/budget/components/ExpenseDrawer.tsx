import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { X, Trash2, Wallet, Target, Plus, CheckCircle2, Repeat } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import { planningService } from '../../../../lib/planningService';
import type { Goal, Expense, Objective } from '../../../../lib/planningService';

interface ExpenseDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    goal: Goal;
    monthKey: string;
    budgetSalary: number;
    allExpenses: Expense[];
}

export const ExpenseDrawer: React.FC<ExpenseDrawerProps> = ({ 
    isOpen, 
    onClose, 
    goal, 
    monthKey, 
    budgetSalary, 
    allExpenses 
}) => {
    const [view, setView] = useState<'list' | 'add'>('list');
    
    // Form State
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState('variavel');
    const [repeatMonths, setRepeatMonths] = useState(1);
    const [obs, setObs] = useState('');
    
    // Objective Linking
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('');

    const plannedAmount = budgetSalary * (goal.percentage / 100);
    const categoryExpenses = allExpenses.filter(e => e.category === goal.category);
    const totalSpent = categoryExpenses.reduce((acc, e) => acc + e.value, 0);
    const remaining = plannedAmount - totalSpent;

    useEffect(() => {
        const loadObjectives = async () => {
            if (isOpen && goal.category === 'Metas') {
                const allObjectives = await planningService.getObjectives();
                const activeObjectives = allObjectives.filter(o => o.status !== 'completed');
                setObjectives(activeObjectives);
            }
        };
        loadObjectives();
    }, [isOpen, goal.category]);

    const handleAdd = async () => {
        const numValue = parseFloat(value);
        if (!name || !numValue) return;

        const months = (type === 'fixo' || type === 'recorrente') ? repeatMonths : 1;

        try {
            await planningService.addExpense({
                month: monthKey,
                category: goal.category,
                name,
                value: numValue,
                type: type as any,
                observation: obs,
                objectiveId: goal.category === 'Metas' && selectedObjectiveId ? selectedObjectiveId : undefined
            }, months);

            setName('');
            setValue('');
            setObs('');
            setSelectedObjectiveId('');
            setRepeatMonths(1);
            setView('list');
            onClose();
        } catch (err) {
            console.error('ExpenseDrawer handleAdd error:', err);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await planningService.deleteExpense(id, monthKey);
            onClose(); 
        } catch (err) {
            console.error('ExpenseDrawer handleDelete error:', err);
        }
    };

    useEffect(() => {
        if (type === 'variavel') setRepeatMonths(1);
    }, [type]);

    useEffect(() => {
        if (selectedObjectiveId) {
            const obj = objectives.find(o => o.id === selectedObjectiveId);
            if (obj && !name) setName(`Aporte: ${obj.name}`);
        }
    }, [selectedObjectiveId]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
                    />
                    <motion.div 
                        initial={{ x: '100%' }} 
                        animate={{ x: 0 }} 
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-zinc-950 border-l border-zinc-800 z-[70] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }}></span>
                                    {goal.category}
                                </h3>
                                <p className="text-zinc-500 text-sm mt-1">{monthKey}</p>
                            </div>
                            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Summary Card */}
                        <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs text-zinc-500 uppercase font-bold">Saldo Restante</span>
                                <span className={`text-2xl font-mono font-bold ${remaining < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {formatCurrency(remaining, 'BRL')}
                                </span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-2">
                                <div 
                                    className={`h-full ${remaining < 0 ? 'bg-red-500' : 'bg-green-500'}`} 
                                    style={{ width: `${Math.min(100, (totalSpent/plannedAmount)*100)}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-zinc-400">
                                <span>Gasto: {formatCurrency(totalSpent, 'BRL')}</span>
                                <span>Meta: {formatCurrency(plannedAmount, 'BRL')}</span>
                            </div>
                        </div>

                        {/* OBJECTIVES LINKED SECTION */}
                        {view === 'list' && goal.category === 'Metas' && (
                            <div className="p-4 bg-cyan-900/10 border-b border-cyan-900/30">
                                <p className="text-xs font-bold text-cyan-500 uppercase mb-2">Objetivos Vinculados</p>
                                <div className="space-y-2">
                                    {objectives.slice(0, 3).map(obj => (
                                        <div key={obj.id} className="flex justify-between text-xs">
                                            <span className="text-zinc-300">{obj.name}</span>
                                            <span className="text-zinc-500 font-mono">
                                                {formatCurrency(obj.currentValue, 'BRL')} / {formatCurrency(obj.totalValue, 'BRL')}
                                            </span>
                                        </div>
                                    ))}
                                    {objectives.length === 0 && (
                                        <p className="text-zinc-500 text-xs italic">Nenhum objetivo ativo.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {view === 'list' ? (
                                <div className="space-y-4">
                                    {categoryExpenses.length === 0 ? (
                                        <div className="text-center py-10 text-zinc-500">
                                            <Wallet size={40} className="mx-auto mb-4 opacity-20" />
                                            <p>Nenhum gasto registrado nesta categoria.</p>
                                        </div>
                                    ) : (
                                        categoryExpenses.map(expense => (
                                            <div key={expense.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex justify-between items-center group">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-white">{expense.name}</p>
                                                        {expense.objectiveId && (
                                                            <Target size={12} className="text-cyan-500" title="Vinculado a Objetivo" />
                                                        )}
                                                        {expense.installment && (
                                                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full border border-zinc-700">
                                                                {expense.installment.current}/{expense.installment.total}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                        <span className="capitalize bg-zinc-950 px-1.5 rounded border border-zinc-800">{expense.type}</span>
                                                        {expense.observation && <span>• {expense.observation}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-mono font-bold text-white">{formatCurrency(expense.value, 'BRL')}</span>
                                                    <button 
                                                        onClick={() => handleDelete(expense.id)}
                                                        className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                /* ADD FORM */
                                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                                    <h4 className="font-bold text-white">Novo Gasto</h4>
                                    
                                    {/* OBJECTIVE SELECTOR (ONLY FOR 'METAS') */}
                                    {goal.category === 'Metas' && (
                                        <div className="bg-cyan-900/10 p-3 rounded-lg border border-cyan-900/30">
                                            <label className="block text-xs font-bold text-cyan-500 mb-1.5 ml-1">Vincular a Objetivo (Opcional)</label>
                                            <select
                                                className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer text-sm"
                                                value={selectedObjectiveId}
                                                onChange={(e) => setSelectedObjectiveId(e.target.value)}
                                            >
                                                <option value="">-- Aporte Avulso --</option>
                                                {objectives.map(obj => (
                                                    <option key={obj.id} value={obj.id}>{obj.name} (Falta {formatCurrency(obj.totalValue - obj.currentValue, 'BRL')})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <Input 
                                        label="Nome do Gasto" 
                                        placeholder="Ex: Netflix, Supermercado" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)}
                                        autoFocus
                                    />
                                    <Input 
                                        label="Valor (R$)" 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={value} 
                                        onChange={e => setValue(e.target.value)}
                                    />
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Tipo</label>
                                        <select 
                                            className="w-full bg-zinc-950 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                            value={type}
                                            onChange={e => setType(e.target.value)}
                                        >
                                            <option value="variavel">Variável (Pontual)</option>
                                            <option value="fixo">Fixo (Obrigatório)</option>
                                            <option value="recorrente">Recorrente (Assinatura)</option>
                                        </select>
                                    </div>

                                    {(type === 'fixo' || type === 'recorrente') && (
                                        <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                                            <Input 
                                                label="Repetir por (meses)" 
                                                type="number"
                                                icon={<Repeat size={16} />} 
                                                value={repeatMonths} 
                                                onChange={e => setRepeatMonths(Math.max(1, parseInt(e.target.value) || 1))}
                                                min={1}
                                                max={120}
                                            />
                                            <p className="text-[10px] text-zinc-500 mt-2 ml-1">
                                                Isso criará automaticamente este gasto para os próximos <strong>{repeatMonths - 1}</strong> meses.
                                            </p>
                                        </div>
                                    )}

                                    <Input 
                                        label="Observação (Opcional)" 
                                        placeholder="Ex: Parcela 2/10" 
                                        value={obs} 
                                        onChange={e => setObs(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
                            {view === 'list' ? (
                                <Button className="w-full" onClick={() => setView('add')}>
                                    <Plus size={18} className="mr-2" /> Adicionar Gasto
                                </Button>
                            ) : (
                                <div className="flex gap-3">
                                    <Button variant="secondary" className="flex-1" onClick={() => setView('list')}>
                                        Cancelar
                                    </Button>
                                    <Button className="flex-[2]" onClick={handleAdd} disabled={!name || !value}>
                                        <CheckCircle2 size={18} className="mr-2" /> Salvar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

