import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../ui/Button';
import { Lock } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';
import { Portfolio } from '../../../../types';
import { Suggestion } from '../types';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPortfolio: Portfolio;
    assetSuggestions: Suggestion[];
    confirmedAssets: Set<string>;
    toggleConfirmAsset: (id: string) => void;
    executeCommit: () => void;
    isCommitting: boolean;
    usesWholeUnits: boolean;
    isLast: boolean;
    isManualMode: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    selectedPortfolio,
    assetSuggestions,
    confirmedAssets,
    toggleConfirmAsset,
    executeCommit,
    isCommitting,
    usesWholeUnits,
    isLast,
    isManualMode,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Lock size={20} className="text-amber-500" /> Confirmar Execução
                                </h3>
                                <p className="text-zinc-400 text-sm mt-1">
                                    Portfólio: <strong>{selectedPortfolio.name}</strong>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-zinc-500 uppercase">Total Selecionado</p>
                                <p className="text-lg font-mono text-amber-500 font-bold">
                                    {formatCurrency(
                                        assetSuggestions
                                            .filter(s => confirmedAssets.has(s.assetId))
                                            .reduce((acc, s) => acc + (s.manualAmount !== undefined ? s.manualAmount : s.suggestedAmount), 0),
                                        selectedPortfolio.currency
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 w-10"></th>
                                        <th className="px-6 py-3">Ativo</th>
                                        <th className="px-6 py-3 text-right">Valor Unit.</th>
                                        <th className="px-6 py-3 text-right">Total</th>
                                        {usesWholeUnits && <th className="px-6 py-3 text-right">Qtd.</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {assetSuggestions
                                        .filter(s => (s.manualAmount !== undefined ? s.manualAmount : s.suggestedAmount) > 0)
                                        .map(s => {
                                            const amount = s.manualAmount !== undefined ? s.manualAmount : s.suggestedAmount;
                                            const isChecked = confirmedAssets.has(s.assetId);
                                            const qty = s.currentPrice > 0 ? amount / s.currentPrice : 0;

                                            return (
                                                <tr key={s.assetId} className={`${isChecked ? 'bg-zinc-900/30' : 'opacity-50 grayscale'}`}>
                                                    <td className="px-6 py-4">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            disabled={isCommitting}
                                                            onChange={() => toggleConfirmAsset(s.assetId)}
                                                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-white">{s.assetName}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-zinc-400">{formatCurrency(s.currentPrice, selectedPortfolio.currency)}</td>
                                                    <td className="px-6 py-4 text-right font-mono font-bold text-white">{formatCurrency(amount, selectedPortfolio.currency)}</td>
                                                    {usesWholeUnits && (
                                                        <td className="px-6 py-4 text-right font-mono text-amber-500">{qty.toFixed(0)}</td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-zinc-800 bg-zinc-950 rounded-b-xl flex justify-end gap-3">
                            <Button variant="secondary" onClick={onClose} disabled={isCommitting}>Cancelar</Button>
                            <Button onClick={executeCommit} disabled={confirmedAssets.size === 0 || isCommitting}>
                                {isCommitting ? "Processando..." : (isLast || isManualMode ? "Concluir" : "Confirmar e Ir para Próximo")}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

