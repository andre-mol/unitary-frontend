import React from 'react';
import { DashboardLayout } from '../../DashboardLayout';
import { Button } from '../../../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../../../utils/formatters';
import { 
    Target, DollarSign, Calculator, ChevronDown, ArrowLeft, ArrowRight, StopCircle, AlertTriangle
} from 'lucide-react';
import { Portfolio, CustomItem } from '../../../../types';
import { PortfolioQueueItem, CategoryAnalysisItem, Suggestion, FlowStep } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { StrategyModal } from '../../details/modals/StrategyModal';

interface ExecutionPhaseProps {
    selectedPortfolio: Portfolio;
    portfolioQueue: PortfolioQueueItem[];
    currentQueueIndex: number;
    totalContribution: string;
    setTotalContribution: (value: string) => void;
    categoryAnalysis: CategoryAnalysisItem[];
    assetSuggestions: Suggestion[];
    expandedCategories: Set<string>;
    toggleCategory: (category: string) => void;
    overrides: Record<string, number>;
    priceOverrides: Record<string, number>;
    handleOverride: (assetId: string, value: string) => void;
    handlePriceOverride: (assetId: string, value: string) => void;
    handleQuantityOverride: (assetId: string, value: string) => void;
    numericContribution: number;
    handleConfirm: () => void;
    skipCurrentPortfolio: () => void;
    setFlowStep: (step: FlowStep) => void;
    isConfirmModalOpen: boolean;
    setIsConfirmModalOpen: (open: boolean) => void;
    confirmedAssets: Set<string>;
    toggleConfirmAsset: (id: string) => void;
    executeCommit: () => void;
    isCommitting: boolean;
    isSavingStrategy: boolean;
    handleSaveStrategy: (targets: Record<string, number>) => void | Promise<void>;
    items: CustomItem[];
}

export const ExecutionPhase: React.FC<ExecutionPhaseProps> = ({
    selectedPortfolio,
    portfolioQueue,
    currentQueueIndex,
    totalContribution,
    setTotalContribution,
    categoryAnalysis,
    assetSuggestions,
    expandedCategories,
    toggleCategory,
    overrides,
    priceOverrides,
    handleOverride,
    handlePriceOverride,
    handleQuantityOverride,
    numericContribution,
    handleConfirm,
    skipCurrentPortfolio,
    setFlowStep,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    confirmedAssets,
    toggleConfirmAsset,
    executeCommit,
    isCommitting,
    isSavingStrategy,
    handleSaveStrategy,
    items,
}) => {
    const [isStrategyModalOpen, setIsStrategyModalOpen] = React.useState(false);
    const currentQueueItem = portfolioQueue[currentQueueIndex];
    const isLast = currentQueueIndex === portfolioQueue.length - 1;
    const isManualMode = portfolioQueue.length === 1 && currentQueueItem.score === 0;
    const usesWholeUnits = selectedPortfolio.type !== 'real_estate' && selectedPortfolio.type !== 'business';
    const categories = React.useMemo(
        () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
        [items]
    );
    const hasDefinedStrategy = categoryAnalysis.some((cat) => cat.targetPct > 0);
    const totalPlannedSpend = React.useMemo(
        () => assetSuggestions.reduce(
            (sum, suggestion) => sum + (suggestion.manualAmount !== undefined ? suggestion.manualAmount : suggestion.suggestedAmount),
            0
        ),
        [assetSuggestions]
    );

    return (
        <DashboardLayout title="Execução de Aporte" subtitle={isManualMode ? `Modo Manual: ${selectedPortfolio.name}` : `Passo ${currentQueueIndex + 1} de ${portfolioQueue.length}: ${selectedPortfolio.name}`}>
            
            {/* WIZARD PROGRESS BAR (Hide in manual mode) */}
            {!isManualMode && (
                <div className="fixed top-16 left-0 md:left-64 right-0 h-1 bg-zinc-900 z-30">
                    <motion.div 
                        className="h-full bg-amber-500" 
                        initial={{ width: `${((currentQueueIndex) / portfolioQueue.length) * 100}%` }}
                        animate={{ width: `${((currentQueueIndex + 1) / portfolioQueue.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            )}

            {/* CONTEXT BANNER */}
            <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500 text-black p-2 rounded-lg">
                        <Calculator size={20} />
                    </div>
                    <div>
                        <p className="text-amber-500 font-bold text-sm uppercase tracking-wide">
                            {isManualMode ? 'Aporte Manual' : 'Valor Calculado'}
                        </p>
                        <p className="text-zinc-300 text-xs">
                            {isManualMode ? 'Defina o valor abaixo para ver sugestões.' : `Baseado na nota ${currentQueueItem.score.toFixed(1)} deste portfólio.`}
                        </p>
                        <p className="mt-1 text-xs font-medium text-white">
                            Portfólio atual: <span className="text-amber-500">{selectedPortfolio.name}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-500 uppercase">Limite do portfólio</p>
                        <p className="text-2xl font-mono font-bold text-white">{formatCurrency(Number(totalContribution), selectedPortfolio.currency)}</p>
                    </div>
                    <div className="h-10 w-px bg-white/10" />
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-500 uppercase">Alocado agora</p>
                        <p className="text-2xl font-mono font-bold text-amber-500">
                            {formatCurrency(totalPlannedSpend, selectedPortfolio.currency)}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
                
                {/* LEFT: Context */}
                <div className="space-y-6">
                    {/* Strategy Block */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                <Target size={16} className="text-amber-500" /> Metas
                            </h3>
                            {!hasDefinedStrategy && (
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => setIsStrategyModalOpen(true)}
                                    disabled={isSavingStrategy}
                                >
                                    {isSavingStrategy ? 'Salvando...' : 'Definir Estratégia'}
                                </Button>
                            )}
                        </div>
                        {!hasDefinedStrategy ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-white">
                                            Este portfólio ainda não tem estratégia de alocação definida.
                                        </p>
                                        <p className="text-xs leading-relaxed text-zinc-400">
                                            Defina as metas por categoria para liberar as sugestões automáticas deste aporte.
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => setIsStrategyModalOpen(true)}
                                            disabled={isSavingStrategy}
                                        >
                                            {isSavingStrategy ? 'Salvando...' : 'Definir Estratégia'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {categoryAnalysis.map(cat => (
                                    <div key={cat.category} className="flex flex-col gap-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-zinc-300">{cat.category}</span>
                                            <span className={cat.currentPct < cat.targetPct ? "text-green-500 font-bold" : "text-zinc-500"}>
                                                Meta: {cat.targetPct.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-zinc-600" style={{ width: `${Math.min(100, cat.currentPct)}%` }}></div>
                                            <div className="h-full w-0.5 bg-amber-500 z-10" style={{ left: `${cat.targetPct}%`, position: 'relative' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Adjust Input */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ajustar Valor Deste Aporte</label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input 
                                type="number" 
                                value={totalContribution}
                                onChange={(e) => setTotalContribution(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-black border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-white font-mono focus:border-amber-500 outline-none transition-colors text-sm"
                                autoFocus={isManualMode}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT: Suggestions Table */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Ativos Sugeridos</h2>
                    </div>

                    {!hasDefinedStrategy ? (
                        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center">
                            <div className="max-w-md space-y-4">
                                <p className="text-lg font-semibold text-white">Sem estratégia definida para este portfólio</p>
                                <p className="text-sm leading-relaxed text-zinc-400">
                                    Configure as metas por categoria para gerar a distribuição automática deste aporte sem sair desta tela.
                                </p>
                                <Button
                                    variant="primary"
                                    onClick={() => setIsStrategyModalOpen(true)}
                                    disabled={isSavingStrategy}
                                >
                                    {isSavingStrategy ? 'Salvando...' : 'Definir Estratégia Agora'}
                                </Button>
                            </div>
                        </div>
                    ) : categoryAnalysis.map(cat => {
                        const isExpanded = expandedCategories.has(cat.category);
                        const catPlannedAmount = cat.items.reduce((acc, item) => {
                            const sugg = assetSuggestions.find(s => s.assetId === item.id)?.suggestedAmount || 0;
                            const manual = overrides[item.id];
                            return acc + (manual !== undefined ? manual : sugg);
                        }, 0);

                        return (
                            <div key={cat.category} className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-900 transition-colors"
                                    onClick={() => toggleCategory(cat.category)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400`}>
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronDown size={16} className="-rotate-90" />}
                                        </div>
                                        <h4 className="font-bold text-white text-sm">{cat.category}</h4>
                                    </div>
                                    <p className={`font-mono text-sm font-bold ${catPlannedAmount > 0 ? 'text-white' : 'text-zinc-600'}`}>
                                        {formatCurrency(catPlannedAmount, selectedPortfolio.currency)}
                                    </p>
                                </div>

                                <AnimatePresence>
                                    {(isExpanded || catPlannedAmount > 0) && (
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: 'auto' }} 
                                            exit={{ height: 0 }} 
                                            className="border-t border-zinc-800 bg-zinc-950/50"
                                        >
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-950 border-b border-zinc-800 font-medium">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">Ativo</th>
                                                            <th className="px-2 py-2 text-center text-amber-500">Nota</th>
                                                            <th className="px-2 py-2 text-right">Preço</th>
                                                            {usesWholeUnits && <th className="px-2 py-2 text-right">Qtd. Atual</th>}
                                                            <th className="px-2 py-2 text-right">Total Atual</th>
                                                            <th className="px-2 py-2 text-right text-blue-400">% Atual</th>
                                                            <th className="px-2 py-2 text-right text-blue-400">% Ideal</th>
                                                            <th className="px-2 py-2 text-right text-amber-500 min-w-[120px]">Aporte (R$)</th>
                                                            {usesWholeUnits && <th className="px-2 py-2 text-right text-zinc-400">Qtd. Aportar</th>}
                                                            <th className="px-2 py-2 text-right pr-4">% Proj.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-800/50">
                                                        {cat.items.map(item => {
                                                            const suggestion = assetSuggestions.find(s => s.assetId === item.id);
                                                            if (!suggestion) return null;
                                                            const isOverridden = suggestion.manualAmount !== undefined;
                                                            const displayAmount = isOverridden ? suggestion.manualAmount! : suggestion.suggestedAmount;
                                                            const displayQty = suggestion.currentPrice > 0 ? Math.floor(displayAmount / suggestion.currentPrice) : 0;
                                                            const isPriceOverridden = priceOverrides[item.id] !== undefined;

                                                            const scoreColor = suggestion.score >= 8 ? 'text-green-500' : suggestion.score >= 5 ? 'text-amber-500' : 'text-red-500';

                                                            return (
                                                                <tr key={item.id} className="hover:bg-zinc-900/30">
                                                                    <td className="px-4 py-2 font-medium text-white text-xs">{item.name}</td>
                                                                    <td className={`px-2 py-2 text-center font-mono font-bold text-xs ${scoreColor}`}>{suggestion.score.toFixed(1)}</td>
                                                                    <td className="px-2 py-2 text-right">
                                                                        <input 
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={isPriceOverridden ? suggestion.currentPrice : suggestion.currentPrice.toFixed(2)}
                                                                            onChange={(e) => handlePriceOverride(item.id, e.target.value)}
                                                                            className={`w-20 bg-zinc-900/50 border rounded px-1.5 py-1 text-right font-mono text-[10px] focus:outline-none focus:border-zinc-500 ${isPriceOverridden ? 'border-zinc-500 text-white' : 'border-transparent text-zinc-400'}`}
                                                                        />
                                                                    </td>
                                                                    {usesWholeUnits && (
                                                                        <td className="px-2 py-2 text-right font-mono text-zinc-400 text-xs">{suggestion.currentQty.toFixed(0)}</td>
                                                                    )}
                                                                    <td className="px-2 py-2 text-right font-mono text-zinc-400 text-xs">{formatCurrency(suggestion.currentTotalValue, selectedPortfolio.currency)}</td>
                                                                    <td className="px-2 py-2 text-right font-mono text-zinc-500 text-xs">{suggestion.currentPct.toFixed(1)}%</td>
                                                                    <td className="px-2 py-2 text-right font-mono text-blue-400 text-xs font-bold">{suggestion.idealPct.toFixed(1)}%</td>
                                                                    <td className="px-2 py-2 text-right">
                                                                        <input 
                                                                            type="number"
                                                                            value={isOverridden ? displayAmount : displayAmount.toFixed(2)}
                                                                            onChange={(e) => handleOverride(item.id, e.target.value)}
                                                                            className={`w-24 bg-zinc-900 border rounded-md py-1 px-2 text-right font-mono text-xs focus:outline-none focus:border-amber-500 ${isOverridden ? 'border-amber-500/50 text-amber-500' : 'border-zinc-800 text-zinc-300'}`}
                                                                        />
                                                                    </td>
                                                                    {usesWholeUnits && (
                                                                        <td className="px-2 py-2 text-right">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="1"
                                                                                value={displayQty > 0 ? String(displayQty) : ''}
                                                                                onChange={(e) => handleQuantityOverride(item.id, e.target.value)}
                                                                                className={`w-20 bg-zinc-900 border rounded-md py-1 px-2 text-right font-mono text-xs focus:outline-none focus:border-amber-500 ${isOverridden ? 'border-amber-500/50 text-amber-500' : 'border-zinc-800 text-zinc-300'}`}
                                                                            />
                                                                        </td>
                                                                    )}
                                                                    <td className="px-2 py-2 text-right pr-4 font-mono text-white text-xs">{suggestion.projectedPct.toFixed(1)}%</td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BOTTOM BAR: ACTION */}
            <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-zinc-950 border-t border-zinc-900 p-4 md:px-8 z-30 flex justify-between items-center gap-4">
                {isManualMode ? (
                    <button onClick={() => setFlowStep('manual_selection')} className="text-zinc-500 hover:text-white text-sm font-medium flex items-center gap-2">
                        <ArrowLeft size={16} /> Voltar
                    </button>
                ) : (
                    <button onClick={skipCurrentPortfolio} className="text-zinc-500 hover:text-white text-sm font-medium flex items-center gap-2">
                        <StopCircle size={16} /> Pular este portfólio
                    </button>
                )}
                
                <Button 
                    variant="primary" 
                    onClick={handleConfirm} 
                    disabled={numericContribution <= 0 || isCommitting || isConfirmModalOpen || !hasDefinedStrategy}
                    className="w-full md:w-auto min-w-[200px]"
                >
                    {isLast || isManualMode ? "Finalizar" : "Confirmar & Próximo"} <ArrowRight size={18} className="ml-2" />
                </Button>
            </div>

            {/* CONFIRMATION MODAL */}
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                selectedPortfolio={selectedPortfolio}
                assetSuggestions={assetSuggestions}
                confirmedAssets={confirmedAssets}
                toggleConfirmAsset={toggleConfirmAsset}
                executeCommit={executeCommit}
                isCommitting={isCommitting}
                usesWholeUnits={usesWholeUnits}
                isLast={isLast}
                isManualMode={isManualMode}
            />
            {isStrategyModalOpen && (
                <StrategyModal
                    portfolio={selectedPortfolio}
                    categories={categories}
                    onClose={() => setIsStrategyModalOpen(false)}
                    onSave={async (targets) => {
                        await handleSaveStrategy(targets);
                        setIsStrategyModalOpen(false);
                    }}
                />
            )}
        </DashboardLayout>
    );
};

