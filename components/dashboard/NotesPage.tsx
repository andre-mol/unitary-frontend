
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { portfolioService } from '../../lib/portfolioService';
import { Portfolio, CustomItem } from '../../types';
import { Button } from '../ui/Button';
import { Star, Settings, CheckCircle2, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, Layers, TrendingUp, Building2, Briefcase, Plus, Trash2, X, PieChart, Calculator, User, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

// Helper to match icons (duplicated from PortfoliosPage to keep this self-contained or could be shared)
const getIcon = (type: string) => {
    switch (type) {
        case 'investments': return <TrendingUp size={20} />;
        case 'real_estate': return <Building2 size={20} />;
        case 'business': return <Briefcase size={20} />;
        default: return <Layers size={20} />;
    }
};

const getLabel = (type: string) => {
    const labels: Record<string, string> = {
        'investments': 'Investimentos',
        'real_estate': 'Imóveis',
        'business': 'Empresas',
        'custom': 'Personalizado'
    };
    return labels[type] || 'Outros';
};

export const NotesPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    // Map of portfolio ID -> Items, to avoid fetching inside loops
    const [portfolioItemsMap, setPortfolioItemsMap] = useState<Record<string, CustomItem[]>>({});
    
    // UI State
    const [expandedPortfolioId, setExpandedPortfolioId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modals
    const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
    
    // Selection for Modals
    const [selectedPortfolioForCriteria, setSelectedPortfolioForCriteria] = useState<Portfolio | null>(null);
    const [selectedItemForEvaluation, setSelectedItemForEvaluation] = useState<{ item: CustomItem, portfolio: Portfolio } | null>(null);

    // 1. Load Portfolios & Items
    useEffect(() => {
        const loadData = async () => {
            const allPortfolios = await portfolioService.getPortfolios();
            setPortfolios(allPortfolios);

            const itemsMap: Record<string, CustomItem[]> = {};
            for (const p of allPortfolios) {
                itemsMap[p.id] = await portfolioService.getCustomItems(p.id);
            }
            setPortfolioItemsMap(itemsMap);
        };
        loadData();
    }, [refreshTrigger]);

    // Deep-link support: open specific portfolio and item evaluation
    useEffect(() => {
        if (!location.search || portfolios.length === 0) return;

        const params = new URLSearchParams(location.search);
        if (params.get('source') !== 'asset-note') return;

        const targetPortfolioId = params.get('portfolioId');
        const targetItemId = params.get('itemId');
        const openEvaluation = params.get('openEvaluation') === '1';

        if (!targetPortfolioId) return;

        const portfolio = portfolios.find((p) => p.id === targetPortfolioId);
        if (!portfolio) return;

        setExpandedPortfolioId(targetPortfolioId);

        if (openEvaluation && targetItemId) {
            const items = portfolioItemsMap[targetPortfolioId] || [];
            const item = items.find((i) => i.id === targetItemId);
            if (item) {
                setSelectedItemForEvaluation({ item, portfolio });
                setIsEvaluationModalOpen(true);
            }
        }

        navigate('/dashboard/notas', { replace: true });
    }, [location.search, portfolios, portfolioItemsMap, navigate]);

    // Handlers
    const toggleAccordion = (id: string) => {
        setExpandedPortfolioId(prev => prev === id ? null : id);
    };

    const openCriteriaModal = (e: React.MouseEvent, p: Portfolio) => {
        e.stopPropagation(); // Prevent accordion toggle
        setSelectedPortfolioForCriteria(p);
        setIsCriteriaModalOpen(true);
    };

    const openEvaluationModal = (item: CustomItem, portfolio: Portfolio) => {
        setSelectedItemForEvaluation({ item, portfolio });
        setIsEvaluationModalOpen(true);
    };

    const handleSaveCriteria = async (newCriteria: string[]) => {
        if (selectedPortfolioForCriteria) {
            await portfolioService.updatePortfolio(selectedPortfolioForCriteria.id, { criteria: newCriteria });
            setRefreshTrigger(prev => prev + 1);
            setIsCriteriaModalOpen(false);
            setSelectedPortfolioForCriteria(null);
        }
    };

    const handleSaveEvaluation = async (item: CustomItem, answers: boolean[]) => {
        if (selectedItemForEvaluation) {
            const pid = selectedItemForEvaluation.portfolio.id;
            const currentItems = portfolioItemsMap[pid] || [];
            
            const updatedItem = { ...item, criteriaAnswers: answers };
            const newItems = currentItems.map(i => i.id === item.id ? updatedItem : i);
            
            await portfolioService.saveCustomItems(pid, newItems);
            
            // Update local state to reflect changes immediately
            setPortfolioItemsMap(prev => ({
                ...prev,
                [pid]: newItems
            }));
            
            // Refresh to ensure all components update with new score
            setRefreshTrigger(prev => prev + 1);
            
            setIsEvaluationModalOpen(false);
            setSelectedItemForEvaluation(null);
        }
    };

    const handleUpdateUserScore = async (portfolioId: string, val: string) => {
        // Round to integer since database schema expects INTEGER
        const score = Math.round(Math.max(0, Math.min(10, Number(val) || 0)));
        // Optimistic update
        setPortfolios(prev => prev.map(p => p.id === portfolioId ? { ...p, userConvictionScore: score } : p));
        // Save to database
        await portfolioService.updatePortfolio(portfolioId, { userConvictionScore: score });
        // Refresh to ensure consistency
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <DashboardLayout title="Sistema de Notas" subtitle="Defina sua convicção e estratégia.">
            
            {/* Context Block */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 flex gap-4">
                <div className="text-amber-500 shrink-0 mt-1">
                    <Star size={24} />
                </div>
                <div>
                    <h3 className="text-amber-500 font-bold text-sm uppercase tracking-wide mb-2">Convicção Pessoal</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                        As notas representam convicção pessoal e não são recomendações de investimento. 
                        Adapte os critérios de acordo com sua visão de vida, mercado e estratégia.
                    </p>
                </div>
            </div>

            {portfolios.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-xl">
                    Nenhum portfólio encontrado. Crie um portfólio primeiro.
                </div>
            ) : (
                <div className="space-y-6">
                    {portfolios.map(portfolio => {
                        const items = portfolioItemsMap[portfolio.id] || [];
                        const totalAssets = items.length;
                        
                        // --- CALCULATION LOGIC ---
                        let totalAssetScore = 0;
                        let countEvaluated = 0;
                        items.forEach(item => {
                            if (item.criteriaAnswers && item.criteriaAnswers.length > 0) {
                                const { display } = portfolioService.calculateScore(item, portfolio.criteria?.length || 0);
                                totalAssetScore += display;
                                countEvaluated++;
                            }
                        });
                        const avgAssetScore = countEvaluated > 0 ? totalAssetScore / countEvaluated : 0;
                        const userScore = portfolio.userConvictionScore ?? 5; // Default 5 neutral
                        const finalScore = (avgAssetScore * 0.7) + (userScore * 0.3);

                        const isExpanded = expandedPortfolioId === portfolio.id;
                        
                        // Progress calculation
                        const progress = totalAssets > 0 ? (countEvaluated / totalAssets) * 100 : 0;

                        // Color Logic
                        const getScoreColor = (s: number) => s >= 8 ? 'text-green-500' : s >= 5 ? 'text-amber-500' : 'text-red-500';

                        return (
                            <motion.div 
                                key={portfolio.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700' : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'}`}
                            >
                                {/* CARD HEADER / TRIGGER */}
                                <div 
                                    onClick={() => toggleAccordion(portfolio.id)}
                                    className="p-6 cursor-pointer group"
                                >
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        
                                        {/* Left: Icon & Info */}
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-amber-500 transition-colors ${isExpanded ? 'bg-amber-500/10 border-amber-500/20' : ''}`}>
                                                {getIcon(portfolio.type)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">{portfolio.name}</h3>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/50">
                                                        {getLabel(portfolio.type)}
                                                    </span>
                                                    {!isExpanded && (
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getScoreColor(finalScore).replace('text-', 'border-').replace('500', '500/30')} ${getScoreColor(finalScore)}`}>
                                                            Nota Final: {finalScore.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center: Stats */}
                                        <div className="flex-1 flex items-center justify-start md:justify-center gap-8 w-full md:w-auto pl-2 md:pl-0">
                                            <div>
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Total de Ativos</p>
                                                <p className="text-xl font-mono text-white">{totalAssets}</p>
                                            </div>
                                            <div className="relative">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Avaliados</p>
                                                <div className="flex items-baseline gap-1">
                                                    <p className={`text-xl font-mono ${countEvaluated === totalAssets && totalAssets > 0 ? 'text-green-500' : 'text-amber-500'}`}>
                                                        {countEvaluated}
                                                    </p>
                                                    <span className="text-zinc-600 text-sm">/ {totalAssets}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="bg-transparent border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                                onClick={(e) => openCriteriaModal(e, portfolio)}
                                            >
                                                <Settings size={14} className="mr-2" />
                                                Critérios
                                            </Button>
                                            
                                            <div className={`p-2 rounded-full transition-transform duration-300 text-zinc-500 ${isExpanded ? 'rotate-180 text-white' : ''}`}>
                                                <ChevronDown size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Progress Bar (Visual Hint) */}
                                    <div className="mt-6 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-amber-500'}`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* EXPANDED CONTENT: SCORING MATRIX & ASSET TABLE */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-zinc-800 bg-zinc-950/30"
                                        >
                                            {/* --- PORTFOLIO SCORING HEADER --- */}
                                            <div className="p-6 bg-zinc-950/50 border-b border-zinc-800">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                                                    
                                                    {/* 1. Avg Asset Score */}
                                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-zinc-700 transition-all">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2 text-zinc-400">
                                                                <Calculator size={16} />
                                                                <span className="text-xs font-bold uppercase tracking-wider">Média dos Ativos</span>
                                                            </div>
                                                            <span className="text-[10px] text-zinc-600 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">Peso: 70%</span>
                                                        </div>
                                                        <div>
                                                            <div className="text-3xl font-mono font-bold text-zinc-300">{avgAssetScore.toFixed(1)}</div>
                                                            <div className="text-[10px] text-zinc-500 mt-1">Baseado em {countEvaluated} ativos avaliados</div>
                                                        </div>
                                                    </div>

                                                    {/* 2. User Conviction Input */}
                                                    <div className="bg-zinc-900 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between group hover:border-amber-500/40 transition-all shadow-[0_0_20px_-10px_rgba(245,158,11,0.1)]">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2 text-amber-500">
                                                                <User size={16} />
                                                                <span className="text-xs font-bold uppercase tracking-wider">Minha Convicção</span>
                                                            </div>
                                                            <span className="text-[10px] text-amber-500/60 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">Peso: 30%</span>
                                                        </div>
                                                        <div className="flex items-end gap-3">
                                                            <div className="relative flex-1">
                                                                <input 
                                                                    type="number" 
                                                                    min="0" max="10" step="1"
                                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xl font-mono text-white focus:border-amber-500 outline-none transition-all"
                                                                    value={portfolio.userConvictionScore ?? 5}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => handleUpdateUserScore(portfolio.id, e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 pb-2">/ 10</div>
                                                        </div>
                                                    </div>

                                                    {/* 3. Final Score */}
                                                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2 text-zinc-300">
                                                                <Star size={16} className={getScoreColor(finalScore)} fill="currentColor" />
                                                                <span className="text-xs font-bold uppercase tracking-wider">Nota Final</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className={`text-4xl font-mono font-bold tracking-tight ${getScoreColor(finalScore)}`}>
                                                                {finalScore.toFixed(1)}
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 mt-1">Usada para priorização de aportes</div>
                                                        </div>
                                                        {/* Glow */}
                                                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-[50px] opacity-10 ${finalScore >= 8 ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                                                    </div>

                                                </div>
                                                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
                                                    <Info size={12} />
                                                    <p>Cálculo: (Média Ativos × 0.7) + (Convicção Usuário × 0.3). Ativos não avaliados não entram na média.</p>
                                                </div>
                                            </div>

                                            {/* ASSET LIST */}
                                            <div className="p-0 overflow-x-auto">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500 font-medium border-b border-zinc-800">
                                                        <tr>
                                                            <th className="px-6 py-4 pl-8">Ativo</th>
                                                            <th className="px-6 py-4">Categoria</th>
                                                            <th className="px-6 py-4 text-center">Nota de Convicção</th>
                                                            <th className="px-6 py-4 text-center">Status</th>
                                                            <th className="px-6 py-4 text-right pr-8">Ação</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-800/50">
                                                        {items.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                                        <PieChart className="text-zinc-700" size={32} />
                                                                        <p>Este portfólio não possui ativos cadastrados.</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            items.map(item => {
                                                                const { display } = portfolioService.calculateScore(item, portfolio.criteria?.length || 0);
                                                                const hasEvaluation = item.criteriaAnswers && item.criteriaAnswers.length > 0;
                                                                
                                                                let scoreColor = 'text-zinc-500';
                                                                if (hasEvaluation) {
                                                                    if (display >= 8) scoreColor = 'text-green-500';
                                                                    else if (display >= 5) scoreColor = 'text-amber-500';
                                                                    else scoreColor = 'text-red-500';
                                                                }

                                                                return (
                                                                    <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors">
                                                                        <td className="px-6 py-4 pl-8 font-medium text-white">{item.name}</td>
                                                                        <td className="px-6 py-4 text-zinc-400">
                                                                            <span className="bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-xs">{item.category}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-center">
                                                                            {hasEvaluation ? (
                                                                                <span className={`font-mono font-bold text-lg ${scoreColor}`}>
                                                                                    {display.toFixed(1)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-zinc-700">—</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-center">
                                                                            {hasEvaluation ? (
                                                                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                                                                    <CheckCircle2 size={12} /> Avaliado
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                                                                                    Pendente
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right pr-8">
                                                                            <Button variant="secondary" size="sm" onClick={() => openEvaluationModal(item, portfolio)}>
                                                                                {hasEvaluation ? 'Reavaliar' : 'Avaliar'} <ChevronRight size={14} className="ml-1" />
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* --- MODALS --- */}
            
            {/* Criteria Editor */}
            {selectedPortfolioForCriteria && isCriteriaModalOpen && (
                <CriteriaEditorModal 
                    initialCriteria={selectedPortfolioForCriteria.criteria || []}
                    onClose={() => setIsCriteriaModalOpen(false)}
                    onSave={handleSaveCriteria}
                />
            )}

            {/* Evaluation Modal */}
            {selectedItemForEvaluation && isEvaluationModalOpen && (
                <EvaluationModal 
                    item={selectedItemForEvaluation.item}
                    criteria={selectedItemForEvaluation.portfolio.criteria || []}
                    onClose={() => setIsEvaluationModalOpen(false)}
                    onSave={handleSaveEvaluation}
                />
            )}

        </DashboardLayout>
    );
};

// --- SUB-COMPONENTS ---

const CriteriaEditorModal: React.FC<{ 
    initialCriteria: string[]; 
    onClose: () => void; 
    onSave: (c: string[]) => void; 
}> = ({ initialCriteria, onClose, onSave }) => {
    const [criteria, setCriteria] = useState<string[]>([...initialCriteria]);
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            setCriteria([...criteria, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleRemove = (index: number) => {
        const next = [...criteria];
        next.splice(index, 1);
        setCriteria(next);
    };

    const handleEdit = (index: number, val: string) => {
        const next = [...criteria];
        next[index] = val;
        setCriteria(next);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-white font-bold text-lg">Critérios de Avaliação</h3>
                        <p className="text-zinc-500 text-xs mt-1">Defina as perguntas que compõem a nota deste portfólio.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 space-y-3 p-1">
                    {criteria.map((c, idx) => (
                        <div key={idx} className="flex gap-2 items-center group">
                            <span className="text-zinc-600 text-xs font-mono w-4">{idx + 1}.</span>
                            <input 
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                                value={c}
                                onChange={(e) => handleEdit(idx, e.target.value)}
                            />
                            <button onClick={() => handleRemove(idx)} className="text-zinc-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {criteria.length === 0 && (
                        <div className="text-center py-8 text-zinc-600 italic border-2 border-dashed border-zinc-800 rounded-lg">
                            Nenhum critério definido.
                        </div>
                    )}
                </div>

                <div className="flex gap-2 mb-6">
                    <input 
                        className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white focus:border-amber-500 outline-none placeholder-zinc-500"
                        placeholder="Novo critério (ex: O ativo possui liquidez?)"
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <Button variant="secondary" onClick={handleAdd} disabled={!newItem.trim()}>
                        <Plus size={16} />
                    </Button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => onSave(criteria)}>Salvar Critérios</Button>
                </div>
            </motion.div>
        </div>
    );
};

const EvaluationModal: React.FC<{
    item: CustomItem;
    criteria: string[];
    onClose: () => void;
    onSave: (item: CustomItem, answers: boolean[]) => void;
}> = ({ item, criteria, onClose, onSave }) => {
    const [answers, setAnswers] = useState<boolean[]>(() => {
        if (item.criteriaAnswers && item.criteriaAnswers.length === criteria.length) {
            return item.criteriaAnswers;
        }
        return new Array(criteria.length).fill(false);
    });

    const toggleAnswer = (idx: number, val: boolean) => {
        const next = [...answers];
        next[idx] = val;
        setAnswers(next);
    };

    const calculateLiveScore = () => {
        let raw = 0;
        answers.forEach(a => raw += (a ? 1 : -1));
        const max = criteria.length;
        if (max === 0) return 0;
        const normalized = ((raw + max) / (2 * max)) * 10;
        return normalized;
    };

    const currentScore = calculateLiveScore();
    let scoreColor = 'text-zinc-500';
    if (currentScore >= 8) scoreColor = 'text-green-500';
    else if (currentScore >= 5) scoreColor = 'text-amber-500';
    else scoreColor = 'text-red-500';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl p-0 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                    <div>
                        <h3 className="text-white font-bold text-xl">Avaliação do Ativo</h3>
                        <p className="text-zinc-400 text-sm mt-1">{item.name}</p>
                    </div>
                    
                    <div className="text-right">
                        <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Nota de Convicção</div>
                        <div className={`text-4xl font-mono font-bold ${scoreColor}`}>
                            {currentScore.toFixed(1)} <span className="text-lg text-zinc-600">/ 10</span>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/5 px-6 py-3 border-b border-amber-500/10 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <p className="text-xs text-amber-500/80">Esses critérios são subjetivos. Seja honesto para ter uma estratégia sólida.</p>
                </div>

                {/* Questions List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {criteria.length === 0 ? (
                        <div className="text-center text-zinc-500 py-10">
                            Este portfólio não tem critérios definidos.
                        </div>
                    ) : (
                        criteria.map((question, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                                <p className="text-sm text-zinc-300 pr-4">{question}</p>
                                <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 shrink-0">
                                    <button
                                        onClick={() => toggleAnswer(idx, false)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                            !answers[idx] 
                                            ? 'bg-red-500/20 text-red-500 shadow-sm' 
                                            : 'text-zinc-600 hover:text-zinc-400'
                                        }`}
                                    >
                                        NÃO
                                    </button>
                                    <button
                                        onClick={() => toggleAnswer(idx, true)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                            answers[idx] 
                                            ? 'bg-green-500/20 text-green-500 shadow-sm' 
                                            : 'text-zinc-600 hover:text-zinc-400'
                                        }`}
                                    >
                                        SIM
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900 rounded-b-xl">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => onSave(item, answers)} disabled={criteria.length === 0}>
                        <CheckCircle2 size={16} className="mr-2" /> Salvar Avaliação
                    </Button>
                </div>

            </motion.div>
        </div>
    );
};
