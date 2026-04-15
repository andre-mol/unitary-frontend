import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { portfolioService, calculateCurrentValue } from '../../../../lib/portfolioService';
import { Portfolio, CustomItem } from '../../../../types';
import { FlowStep, PortfolioQueueItem, Suggestion, CategoryAnalysisItem } from '../types';
import { useAuth } from '../../../auth/AuthProvider';
import { queryKeys } from '../../../../lib/queryKeys';

export function useContributions() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user, loading: authLoading } = useAuth();
    
    // --- GLOBAL STATE ---
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Flow State
    const [flowStep, setFlowStep] = useState<FlowStep>('input');
    
    // Data State
    const [globalBudget, setGlobalBudget] = useState<string>('');
    const [portfolioQueue, setPortfolioQueue] = useState<PortfolioQueueItem[]>([]);
    const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
    const [contributionDate, setContributionDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // --- EXECUTION CONTEXT STATE ---
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
    const [items, setItems] = useState<CustomItem[]>([]);
    const [totalContribution, setTotalContribution] = useState<string>('0');
    
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
    
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmedAssets, setConfirmedAssets] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [isCommitting, setIsCommitting] = useState(false);
    const [isSavingStrategy, setIsSavingStrategy] = useState(false);
    const commitLockRef = useRef(false);

    // --- INITIALIZATION - SÓ quando usuário estiver autenticado ---
    useEffect(() => {
        // Não carregar se auth ainda está carregando ou usuário não existe
        if (authLoading || !user) {
            return;
        }
        
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const all = await portfolioService.getPortfolios();
                setPortfolios(all);

                if (location.state?.budget) {
                    setGlobalBudget(String(location.state.budget));
                    await calculateQueue(all, Number(location.state.budget));
                    setFlowStep('preview');
                }
            } catch (err) {
                // Ignorar erros de autenticação silenciosamente
                const message = err instanceof Error ? err.message : 'Erro ao carregar portfólios';
                const isAuthError = message.includes('NOT_AUTHENTICATED') || 
                                    message.includes('não autenticado') ||
                                    message.includes('AUTH_NOT_READY');
                
                if (!isAuthError) {
                    console.error('ContributionsPage loadData error:', err);
                    setError(message);
                }
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user, authLoading]);

    // --- MACRO CALCULATION LOGIC ---
    const calculateQueue = async (portfolioList: Portfolio[], budget: number) => {
        try {
            const scoredPromises = portfolioList.map(async p => ({
                portfolio: p,
                score: await portfolioService.getPortfolioScore(p.id)
            }));
            const scoredAll = await Promise.all(scoredPromises);
            const scored = scoredAll.filter(p => p.score > 0).sort((a, b) => b.score - a.score);

            const totalScore = scored.reduce((acc, curr) => acc + curr.score, 0);

            const queue: PortfolioQueueItem[] = scored.map(item => {
                const weight = totalScore > 0 ? item.score / totalScore : 0;
                const amount = Math.floor((budget * weight) * 100) / 100;
                
                return {
                    portfolio: item.portfolio,
                    score: item.score,
                    allocatedAmount: amount,
                    status: 'pending'
                };
            });

            setPortfolioQueue(queue);
        } catch (err) {
            console.error('ContributionsPage calculateQueue error:', err);
        }
    };

    const handleBudgetSubmit = async () => {
        const budget = parseFloat(globalBudget);
        if (budget > 0) {
            await calculateQueue(portfolios, budget);
            setFlowStep('preview');
        }
    };

    const startExecution = async () => {
        if (portfolioQueue.length > 0) {
            setFlowStep('execution');
            setCurrentQueueIndex(0);
            await loadPortfolioContext(portfolioQueue[0]);
        }
    };

    // --- MANUAL MODE LOGIC ---
    const startManualExecution = async (portfolio: Portfolio) => {
        const manualQueueItem: PortfolioQueueItem = {
            portfolio: portfolio,
            score: 0, 
            allocatedAmount: 0, 
            status: 'pending'
        };

        setPortfolioQueue([manualQueueItem]);
        setCurrentQueueIndex(0);
        setFlowStep('execution');
        await loadPortfolioContext(manualQueueItem);
    };

    const loadPortfolioContext = async (queueItem: PortfolioQueueItem) => {
        try {
            setSelectedPortfolioId(queueItem.portfolio.id);
            setTotalContribution(queueItem.allocatedAmount > 0 ? queueItem.allocatedAmount.toFixed(2) : '');
            setItems(await portfolioService.getCustomItems(queueItem.portfolio.id));
            
            setOverrides({});
            setPriceOverrides({});
            setConfirmedAssets(new Set());
            setExpandedCategories(new Set());
        } catch (err) {
            console.error('ContributionsPage loadPortfolioContext error:', err);
        }
    };

    const skipCurrentPortfolio = async () => {
        const nextIndex = currentQueueIndex + 1;
        if (nextIndex < portfolioQueue.length) {
            setCurrentQueueIndex(nextIndex);
            await loadPortfolioContext(portfolioQueue[nextIndex]);
        } else {
            navigate('/dashboard/global-history');
        }
    };

    // --- COMPUTED VALUES ---
    const selectedPortfolio = useMemo(() => 
        portfolios.find(p => p.id === selectedPortfolioId), 
    [portfolios, selectedPortfolioId]);
    const usesWholeUnits = selectedPortfolio?.type !== 'real_estate' && selectedPortfolio?.type !== 'business';

    const normalizeContribution = (amount: number, unitPrice: number) => {
        if (!Number.isFinite(amount) || amount <= 0) {
            return { amount: 0, quantity: 0 };
        }

        if (!usesWholeUnits) {
            return {
                amount: Number(amount.toFixed(2)),
                quantity: 0,
            };
        }

        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
            return { amount: 0, quantity: 0 };
        }

        const quantity = Math.floor(amount / unitPrice);
        const normalizedAmount = Number((quantity * unitPrice).toFixed(2));

        return {
            amount: normalizedAmount,
            quantity,
        };
    };

    const currentTotalValue = useMemo(() => items.reduce((acc, i) => acc + calculateCurrentValue(i), 0), [items]);
    const numericContribution = parseFloat(totalContribution) || 0;
    const projectedTotalValue = currentTotalValue + numericContribution;

    const categoryAnalysis: CategoryAnalysisItem[] = useMemo(() => {
        if (!selectedPortfolio) return [];
        const categories = portfolioService.getItemsByCategory(items);
        const targets = selectedPortfolio.categoryTargets || {};
        let totalDeficit = 0;
        const analysis = categories.map(cat => {
            const currentVal = cat.totalValue;
            const targetPct = targets[cat.category] || 0;
            const targetVal = projectedTotalValue * (targetPct / 100);
            const deficit = Math.max(0, targetVal - currentVal);
            totalDeficit += deficit;
            return { category: cat.category, currentVal, currentPct: currentTotalValue > 0 ? (currentVal / currentTotalValue) * 100 : 0, targetPct, targetVal, deficit, items: cat.items };
        });
        return analysis.map(cat => {
            let suggestedAmount = 0;
            if (totalDeficit > 0) {
                suggestedAmount = (cat.deficit / totalDeficit) * numericContribution;
            } else if (numericContribution > 0) {
                suggestedAmount = numericContribution * (cat.targetPct / 100);
            }
            return { ...cat, suggestedAmount };
        });
    }, [items, selectedPortfolio, currentTotalValue, projectedTotalValue, numericContribution]);

    const assetSuggestions: Suggestion[] = useMemo(() => {
        const suggestions: Suggestion[] = [];
        categoryAnalysis.forEach(cat => {
            let sumRawWeights = 0;
            const assetMetrics = cat.items.map(item => {
                const criteriaCount = selectedPortfolio?.criteria?.length || 0;
                const { display: score } = portfolioService.calculateScore(item, criteriaCount);
                const finalScore = item.criteriaAnswers?.length ? score : 5;
                let rawWeight = 0.5 + (finalScore / 10);
                // AIDEV-NOTE: Check for percentIdealRaw in customFields (type-safe)
                const percentIdealRaw = item.customFields?.percentIdealRaw;
                if (typeof percentIdealRaw === 'number') {
                    rawWeight = percentIdealRaw;
                }
                sumRawWeights += rawWeight;
                const currentVal = calculateCurrentValue(item);
                const qty = item.quantity || 0;
                let currentPrice = 0;
                if (priceOverrides[item.id] !== undefined) currentPrice = priceOverrides[item.id];
                else currentPrice = qty > 0 ? currentVal / qty : (item.initialValue / (item.quantity || 1));
                return { item, rawWeight, score: finalScore, currentVal, currentPrice, qty };
            });
            const assetDeficits = assetMetrics.map(m => {
                const weightNorm = sumRawWeights > 0 ? m.rawWeight / sumRawWeights : 0;
                const assetIdealPctGlobal = (cat.targetPct / 100) * weightNorm;
                const targetValue = projectedTotalValue * assetIdealPctGlobal;
                const rawDeficit = targetValue - m.currentVal;
                const currentPct = currentTotalValue > 0 ? (m.currentVal / currentTotalValue) * 100 : 0;
                return { ...m, rawDeficit, assetIdealPctGlobal, currentPct };
            });
            const hasTrueDeficit = assetDeficits.some(a => a.rawDeficit > 0);
            let finalDeficits = [];
            if (hasTrueDeficit) {
                finalDeficits = assetDeficits.map(a => ({ ...a, effectiveDeficit: Math.max(0, a.rawDeficit) }));
            } else {
                const minDeficit = Math.min(...assetDeficits.map(a => a.rawDeficit));
                finalDeficits = assetDeficits.map(a => ({ ...a, effectiveDeficit: a.rawDeficit - minDeficit }));
            }
            const sumEffectiveDeficits = finalDeficits.reduce((acc, curr) => acc + curr.effectiveDeficit, 0);
            finalDeficits.sort((a, b) => b.effectiveDeficit - a.effectiveDeficit);
            let distributedSoFar = 0;
            const categoryBudget = cat.suggestedAmount;
            finalDeficits.forEach((d, index) => {
                let suggestedAmount = 0;
                if (sumEffectiveDeficits > 0) suggestedAmount = categoryBudget * (d.effectiveDeficit / sumEffectiveDeficits);
                else if (categoryBudget > 0) {
                    const weightNorm = sumRawWeights > 0 ? d.rawWeight / sumRawWeights : 0;
                    suggestedAmount = categoryBudget * weightNorm;
                }
                let finalizedAmount = Math.floor(suggestedAmount * 100) / 100;
                if (index === finalDeficits.length - 1) {
                    const remainder = categoryBudget - distributedSoFar;
                    if (Math.abs(remainder - finalizedAmount) < 1.0 && remainder > 0) finalizedAmount = Number(remainder.toFixed(2));
                }
                distributedSoFar += finalizedAmount;
                const normalizedSuggested = normalizeContribution(finalizedAmount, d.currentPrice);
                const manualVal = overrides[d.item.id];
                const normalizedManual = manualVal !== undefined
                    ? normalizeContribution(manualVal, d.currentPrice)
                    : null;
                const finalAmount = normalizedManual?.amount ?? normalizedSuggested.amount;
                const qty = normalizedManual?.quantity ?? normalizedSuggested.quantity;
                const projectedVal = d.currentVal + finalAmount;
                const projectedPct = projectedTotalValue > 0 ? (projectedVal / projectedTotalValue) * 100 : 0;
                suggestions.push({
                    assetId: d.item.id, assetName: d.item.name, categoryId: cat.category, currentPrice: d.currentPrice, weight: d.rawWeight, score: d.score,
                    suggestedAmount: normalizedSuggested.amount, suggestedQty: normalizedSuggested.quantity, manualAmount: normalizedManual?.amount, currentQty: d.qty, currentTotalValue: d.currentVal, currentPct: d.currentPct, idealPct: d.assetIdealPctGlobal * 100, projectedPct: projectedPct
                });
            });
        });
        return suggestions;
    }, [categoryAnalysis, selectedPortfolio, currentTotalValue, projectedTotalValue, overrides, priceOverrides, usesWholeUnits]);

    // --- HANDLERS ---
    const handleOverride = (assetId: string, valueStr: string) => {
        const val = parseFloat(valueStr);
        const currentPrice = assetSuggestions.find((suggestion) => suggestion.assetId === assetId)?.currentPrice || 0;
        setOverrides(prev => {
            const next = { ...prev };
            if (isNaN(val)) {
                delete next[assetId];
            } else {
                next[assetId] = normalizeContribution(val, currentPrice).amount;
            }
            return next;
        });
    };

    const handlePriceOverride = (assetId: string, valueStr: string) => {
        const val = parseFloat(valueStr);
        setPriceOverrides(prev => {
            const next = { ...prev };
            if (isNaN(val)) delete next[assetId]; else next[assetId] = val;
            return next;
        });
    };

    const handleQuantityOverride = (assetId: string, valueStr: string) => {
        if (!usesWholeUnits) return;

        const rawQty = parseFloat(valueStr);
        const quantity = Number.isFinite(rawQty) ? Math.max(0, Math.floor(rawQty)) : NaN;
        const currentPrice = assetSuggestions.find((suggestion) => suggestion.assetId === assetId)?.currentPrice || 0;

        setOverrides((prev) => {
            const next = { ...prev };
            if (isNaN(quantity) || quantity <= 0 || currentPrice <= 0) {
                delete next[assetId];
            } else {
                next[assetId] = Number((quantity * currentPrice).toFixed(2));
            }
            return next;
        });
    };

    const toggleCategory = (cat: string) => {
        const next = new Set(expandedCategories);
        if (next.has(cat)) next.delete(cat); else next.add(cat);
        setExpandedCategories(next);
    };

    const handleConfirm = () => {
        if (isCommitting) return;

        const toConfirm = new Set<string>();
        assetSuggestions.forEach(s => {
            const val = s.manualAmount !== undefined ? s.manualAmount : s.suggestedAmount;
            if (val > 0.01) toConfirm.add(s.assetId);
        });
        setConfirmedAssets(toConfirm);
        setIsConfirmModalOpen(true);
    };

    const toggleConfirmAsset = (id: string) => {
        if (isCommitting) return;

        const next = new Set(confirmedAssets);
        if (next.has(id)) next.delete(id); else next.add(id);
        setConfirmedAssets(next);
    };

    const executeCommit = async () => {
        if (!selectedPortfolio || commitLockRef.current) return;

        commitLockRef.current = true;
        setIsCommitting(true);
        try {
            const currentQueueItem = portfolioQueue[currentQueueIndex];
            const plannerBudget = parseFloat(globalBudget);

            for (const suggestion of assetSuggestions) {
                if (!confirmedAssets.has(suggestion.assetId)) continue;
                const requestedAmount = suggestion.manualAmount !== undefined ? suggestion.manualAmount : suggestion.suggestedAmount;
                const normalizedContribution = normalizeContribution(requestedAmount, suggestion.currentPrice);
                const finalAmount = normalizedContribution.amount;
                const finalQty = normalizedContribution.quantity;
                if (finalAmount <= 0) continue;

                const item = items.find(i => i.id === suggestion.assetId);
                if (!item) continue;

                const currentItems = await portfolioService.getCustomItems(selectedPortfolio.id);
                const targetItemIndex = currentItems.findIndex(i => i.id === suggestion.assetId);
                
                if (targetItemIndex !== -1) {
                    const targetItem = currentItems[targetItemIndex];
                    const newTransaction = {
                        id: crypto.randomUUID(),
                        type: 'buy' as const,
                        date: contributionDate,
                        quantity: finalQty,
                        unitPrice: usesWholeUnits ? suggestion.currentPrice : finalAmount,
                        totalValue: finalAmount,
                        observation: usesWholeUnits ? 'Aporte Planejado' : 'Aporte Monetario Planejado',
                        createdAt: new Date().toISOString(), valuationMethod: { ...targetItem.valuationMethod }
                    };
                    const newTotalQuantity = usesWholeUnits
                        ? (targetItem.quantity || 0) + finalQty
                        : targetItem.quantity;
                    const historyEntry = {
                        date: contributionDate,
                        value: 0,
                        type: 'event' as const,
                        note: usesWholeUnits
                            ? `Aporte: ${finalQty} un.`
                            : `Aporte monetario: ${finalAmount.toFixed(2)}`
                    };
                    let nextValue = Number(targetItem.value || 0);
                    if (targetItem.valuationMethod?.type === 'automatic' && Number(targetItem.quantity || 0) > 0) {
                        const currentUnitPrice = Number(targetItem.value || 0) / Number(targetItem.quantity || 1);
                        nextValue = Math.round(newTotalQuantity * currentUnitPrice * 100) / 100;
                    } else {
                        nextValue = Math.round((nextValue + finalAmount) * 100) / 100;
                    }

                    const updatedItem = {
                        ...targetItem,
                        quantity: newTotalQuantity,
                        value: nextValue,
                        history: [...(targetItem.history || []), historyEntry],
                        transactions: [...(targetItem.transactions || []), newTransaction],
                        updatedAt: new Date().toISOString()
                    };
                    currentItems[targetItemIndex] = updatedItem;
                }
                await portfolioService.saveCustomItems(selectedPortfolio.id, currentItems);
                await portfolioService.addHistoryEvent(selectedPortfolio.id, {
                    assetId: suggestion.assetId,
                    assetName: suggestion.assetName,
                    assetCategory: suggestion.categoryId,
                    date: contributionDate,
                    type: 'buy',
                    quantity: finalQty,
                    unitPrice: usesWholeUnits ? suggestion.currentPrice : finalAmount,
                    totalValue: finalAmount,
                    observation: usesWholeUnits ? 'Aporte (Baixa Sequencial)' : 'Aporte Monetario (Baixa Sequencial)',
                    payload: {
                        source: 'contribution_planner',
                        planner_budget: Number.isFinite(plannerBudget) ? plannerBudget : null,
                        portfolio_score: currentQueueItem?.score ?? null,
                        allocated_amount: currentQueueItem?.allocatedAmount ?? null,
                        queue_position: currentQueueIndex + 1,
                        queue_total: portfolioQueue.length,
                        suggested_amount: suggestion.suggestedAmount,
                        manual_amount: suggestion.manualAmount ?? null,
                        final_amount: finalAmount,
                        suggested_qty: suggestion.suggestedQty,
                        final_qty: finalQty,
                        current_price: suggestion.currentPrice,
                        override_applied: suggestion.manualAmount !== undefined,
                        price_override_applied: priceOverrides[suggestion.assetId] !== undefined,
                        category_id: suggestion.categoryId,
                        weight: suggestion.weight,
                        score: suggestion.score,
                        ideal_pct: suggestion.idealPct,
                        projected_pct: suggestion.projectedPct,
                        flow_step: flowStep,
                    }
                });
            }

            const affectedMonth = contributionDate.slice(0, 7);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['timeline'] }),
                queryClient.invalidateQueries({ queryKey: ['budget-investment-events'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.budget(user?.id, affectedMonth) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.expenses(user?.id, affectedMonth) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.portfolios(user?.id) }),
                queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
                queryClient.invalidateQueries({ queryKey: ['items'] }),
            ]);

            setIsConfirmModalOpen(false);
            await skipCurrentPortfolio();
        } catch (err) {
            console.error('ContributionsPage executeCommit error:', err);
        } finally {
            commitLockRef.current = false;
            setIsCommitting(false);
        }
    };

    const handleSaveStrategy = async (targets: Record<string, number>) => {
        if (!selectedPortfolio || isSavingStrategy) return;

        setIsSavingStrategy(true);
        try {
            const updatedPortfolio = await portfolioService.updatePortfolio(selectedPortfolio.id, { categoryTargets: targets });
            const nextPortfolio = updatedPortfolio ?? { ...selectedPortfolio, categoryTargets: targets };

            setPortfolios((prev) => prev.map((portfolio) => (
                portfolio.id === selectedPortfolio.id ? nextPortfolio : portfolio
            )));
            setPortfolioQueue((prev) => prev.map((queueItem) => (
                queueItem.portfolio.id === selectedPortfolio.id
                    ? { ...queueItem, portfolio: nextPortfolio }
                    : queueItem
            )));
            setExpandedCategories(new Set(items.map((item) => item.category).filter(Boolean)));

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.portfolios(user?.id) }),
                queryClient.invalidateQueries({ queryKey: ['portfolio', selectedPortfolio.id] }),
            ]);
        } finally {
            setIsSavingStrategy(false);
        }
    };

    return {
        // State
        portfolios,
        loading,
        error,
        flowStep,
        setFlowStep,
        globalBudget,
        setGlobalBudget,
        portfolioQueue,
        currentQueueIndex,
        contributionDate,
        selectedPortfolio,
        items,
        totalContribution,
        setTotalContribution,
        overrides,
        priceOverrides,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        confirmedAssets,
        expandedCategories,
        isCommitting,
        isSavingStrategy,
        
        // Computed
        currentTotalValue,
        numericContribution,
        projectedTotalValue,
        categoryAnalysis,
        assetSuggestions,
        
        // Handlers
        handleBudgetSubmit,
        startExecution,
        startManualExecution,
        skipCurrentPortfolio,
        handleOverride,
        handlePriceOverride,
        handleQuantityOverride,
        toggleCategory,
        handleConfirm,
        toggleConfirmAsset,
        executeCommit,
        handleSaveStrategy,
    };
}

