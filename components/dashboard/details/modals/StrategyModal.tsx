
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Save, AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Portfolio } from '../../../../types';

interface StrategyModalProps {
    portfolio: Portfolio;
    categories: string[];
    onClose: () => void;
    onSave: (targets: Record<string, number>) => void;
}

export const StrategyModal: React.FC<StrategyModalProps> = ({ portfolio, categories, onClose, onSave }) => {
    const [targets, setTargets] = useState<Record<string, number>>(portfolio.categoryTargets || {});

    // Use passed categories strictly (they are pre-filtered by assets in parent)
    const allCategories = categories;

    const handleChange = (cat: string, val: string) => {
        const num = Math.min(100, Math.max(0, Number(val)));
        setTargets(prev => ({
            ...prev,
            [cat]: num
        }));
    };

    // Calculate total based ONLY on visible categories to avoid confusion
    const totalPercentage = allCategories.reduce((acc, cat) => acc + (targets[cat] || 0), 0);
    const isTotalValid = Math.abs(totalPercentage - 100) < 0.1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                    <div>
                        <h3 className="text-white font-bold text-xl flex items-center gap-2">
                            <Target size={20} className="text-amber-500" /> Estratégia de Alocação
                        </h3>
                        <p className="text-zinc-400 text-sm mt-1">Defina a % ideal para cada categoria.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {allCategories.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 italic border-2 border-dashed border-zinc-800 rounded-lg">
                            Adicione ativos com categorias primeiro para definir a estratégia de alocação.
                        </div>
                    ) : (
                        allCategories.map(cat => (
                            <div key={cat} className="flex items-center justify-between group">
                                <span className="text-zinc-300 text-sm font-medium">{cat}</span>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            className="w-20 bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-right text-white focus:border-amber-500 outline-none"
                                            value={targets[cat] || ''}
                                            placeholder="0"
                                            onChange={(e) => handleChange(cat, e.target.value)}
                                        />
                                        <span className="absolute right-3 top-2 text-zinc-600 text-sm">%</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 rounded-b-xl">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-medium text-zinc-400">Total Alocado</span>
                        <div className={`text-xl font-bold font-mono ${isTotalValid ? 'text-green-500' : 'text-amber-500'}`}>
                            {totalPercentage.toFixed(1)}%
                        </div>
                    </div>
                    
                    {!isTotalValid && totalPercentage > 0 && (
                        <div className="flex items-start gap-2 mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-500/90 leading-tight">
                                A soma das metas deve ser idealmente 100%. Atualmente você tem <strong>{totalPercentage}%</strong> definido.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button onClick={() => onSave(targets)} disabled={allCategories.length === 0}>
                            <Save size={16} className="mr-2" /> Salvar Estratégia
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
