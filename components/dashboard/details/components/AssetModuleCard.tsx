import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Portfolio, CustomItem } from '../../../../types';
import { AssetModuleHeader } from './AssetModuleHeader';
import { AssetTable } from './AssetTable';
import { EditColumnsDialog, ColumnKey } from './EditColumnsDialog';
import { AssetGraphicAnalysisModal } from './AssetGraphicAnalysisModal';
import { Button } from '../../../ui/Button';
import { BarChart2, Plus, Settings2 } from 'lucide-react';
import { portfolioService } from '../../../../lib/portfolioService';
import { calculateTotalInvested, calculateCurrentValue, calculateAveragePrice } from '../../../../domain/calculations';

interface AssetModuleCardProps {
    category: string;
    totalValue: number;
    portfolioTotalValue: number;
    items: CustomItem[];
    currency: string;
    percentage: number;
    portfolio: Portfolio; // Access ID and Type
    onEditItem: (item: CustomItem) => void;
    onOpenAddModal: () => void; // For "Adicionar Lançamento"
    dividends?: any[];
    idealAllocationMap?: Map<string, number>;
    indexedMirrorReturnPct?: number | null;
    displayedReturnPct?: number | null;
}

export const AssetModuleCard: React.FC<AssetModuleCardProps> = ({
    category,
    totalValue,
    portfolioTotalValue,
    items,
    currency,
    percentage,
    portfolio,
    onEditItem,
    onOpenAddModal,
    dividends = [],
    idealAllocationMap,
    indexedMirrorReturnPct = null,
    displayedReturnPct = null
}) => {
    const REQUIRED_STANDARD_COLUMNS: ColumnKey[] = ['score', 'idealPct'];
    const [isOpen, setIsOpen] = useState(false);
    const [isEditColumnsOpen, setIsEditColumnsOpen] = useState(false);
    const [isGraphicModalOpen, setIsGraphicModalOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set([
        'quantity', 'avgPrice', 'currentPrice', 'variation', 'totalReturn', 'totalValue', 'score', 'idealPct', 'portfolioPct'
    ]));

    // TRI State
    const [reinvestedReturns, setReinvestedReturns] = useState<Record<string, any>>({});
    const [loadingReturns, setLoadingReturns] = useState(false);

    // Initial Load of Columns from LocalStorage (Sync with Dialog)
    useEffect(() => {
        const key = `user_prefs_columns_${portfolio.id}_${category}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const next = new Set(parsed as ColumnKey[]);
                    for (const requiredColumn of REQUIRED_STANDARD_COLUMNS) {
                        next.add(requiredColumn);
                    }
                    setVisibleColumns(next);
                }
            } catch { }
        }
    }, [portfolio.id, category]);

    // Data Fetching for TRI (On Expand)
    useEffect(() => {
        // AIDEV-FIX: Fetch immediately to ensure Header shows correct Rentability (TRI) without needing expansion
        // Optimization: Don't refetch if already loaded? 
        // Or refetch if items changed? 
        // Let's refetch if we have missing keys for current items.
        // For simplicity and matching current logic, fetch on open if empty or items length changed.

        const marketItems = items.filter(i => !!i.market_asset_id);
        if (marketItems.length === 0) return;

        const needsFetch = marketItems.some(i => !reinvestedReturns[i.id]);

        if (needsFetch && !loadingReturns) {
            setLoadingReturns(true);
            const results: Record<string, any> = { ...reinvestedReturns };

            Promise.all(marketItems.map(async (item) => {
                if (results[item.id]) return; // Skip if exists

                const invested = calculateTotalInvested(item);
                const quantity = item.quantity || 1;
                const avgPrice = invested / quantity;
                const currentUnitPrice = calculateCurrentValue(item) / quantity;

                try {
                    const itemDividends = dividends.filter((d: any) =>
                        d.asset_id === item.market_asset_id ||
                        (item.name && d.ticker && String(d.ticker).startsWith(item.name.split('.')[0]))
                    );
                    const data = await portfolioService.calculateReinvestedReturnFromHistory(
                        item.market_asset_id!,
                        item.initialDate,
                        avgPrice,
                        currentUnitPrice,
                        itemDividends
                    );
                    results[item.id] = data;
                } catch (e) {
                    console.error('Failed TRI fetch', item.name);
                }
            })).then(() => {
                setReinvestedReturns(results);
                setLoadingReturns(false);
            });
        }
    }, [isOpen, items, dividends]);

    // Calculate Summary Metrics for Header
    // 1. Variation (Price)
    // 2. Total Return (Price + Divs) - This is tricky for Header aggregation.
    // For Header, Investidor10 usually shows "Rentabilidade" of the CATEGORY.
    // That means: (Total Current Value + Total Divs Received) / Total Invested.

    // Total Invested
    const totalInvested = items.reduce((acc, item) => acc + calculateTotalInvested(item), 0);
    const mirrorEnabled = indexedMirrorReturnPct !== null && Number.isFinite(indexedMirrorReturnPct);
    const effectiveTotalValue = mirrorEnabled
        ? items.reduce((acc, item) => acc + (calculateTotalInvested(item) * (1 + (Number(indexedMirrorReturnPct) / 100))), 0)
        : totalValue;

    // Variation (Current Value - Total Invested)
    const variationAmt = effectiveTotalValue - totalInvested;
    const variationPct = totalInvested > 0 ? (variationAmt / totalInvested) * 100 : 0;

    // Total Dividends (Naive Sum)
    // Filter dividends for items in this category
    const categoryDividends = dividends.filter(d =>
        items.some(i => i.market_asset_id === d.asset_id || (i.name && d.ticker && d.ticker.startsWith(i.name.split('.')[0])))
    );
    const totalDividendsAmt = categoryDividends.reduce((acc, d) => acc + Number(d.total_amount), 0);

    // Rentabilidade Logic - Attempting to match Table TRI logic
    // We calculate a weighted average of the returns if available.
    // If not all items have TRI loaded, we fall back to the simple calculation.
    let totalReturnPct = 0;

    // Check if we have valid items to look at
    const validItems = items.filter(i => calculateCurrentValue(i) > 0);

    // Check coverage: Do we have TRI data for all market items?
    const allMarketItemsHaveTri = items
        .filter(i => !!i.market_asset_id && calculateCurrentValue(i) > 0)
        .every(i => reinvestedReturns[i.id]);

    if (displayedReturnPct !== null && displayedReturnPct !== undefined && Number.isFinite(displayedReturnPct)) {
        totalReturnPct = Number(displayedReturnPct);
    } else if (allMarketItemsHaveTri && validItems.length > 0 && effectiveTotalValue > 0 && !mirrorEnabled) {
        let weightedReturnSum = 0;
        let usedWeight = 0;

        items.forEach(item => {
            const currentVal = calculateCurrentValue(item);
            if (currentVal <= 0) return;

            let itemReturnPct = 0;

            if (item.market_asset_id && reinvestedReturns[item.id]) {
                // Use TRI
                itemReturnPct = reinvestedReturns[item.id].total_return_pct;
            } else {
                // Fallback to simple Return for manual items
                const invested = calculateTotalInvested(item);
                const itemDivs = dividends
                    .filter(d => d.asset_id === item.market_asset_id || (item.name && d.ticker && d.ticker.startsWith(item.name.split('.')[0])))
                    .reduce((acc, d) => acc + Number(d.total_amount), 0);

                itemReturnPct = invested > 0 ? ((currentVal + itemDivs - invested) / invested) * 100 : 0;
            }

            weightedReturnSum += itemReturnPct * currentVal;
            usedWeight += currentVal;
        });

        totalReturnPct = usedWeight > 0 ? weightedReturnSum / usedWeight : 0;
    } else if (mirrorEnabled) {
        totalReturnPct = Number(indexedMirrorReturnPct);
    } else {
        // Fallback: Simple Aggregate Return
        // (Cur + Divs - Inv) / Inv
        const totalReturnAmt = (effectiveTotalValue + totalDividendsAmt) - totalInvested;
        totalReturnPct = totalInvested > 0 ? (totalReturnAmt / totalInvested) * 100 : 0;
    }

    return (
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl mb-4 transition-all hover:border-zinc-700 shadow-sm relative">

            <AssetModuleHeader
                category={category}
                itemsCount={items.length}
                totalValue={effectiveTotalValue}
                currency={currency}
                percentage={percentage}
                isOpen={isOpen}
                onToggle={() => setIsOpen(!isOpen)}
                portfolioType={portfolio.type}
                // Metrics
                variation={variationAmt}
                variationPct={variationPct}
                totalReturnPct={totalReturnPct}
            />

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-zinc-800 bg-zinc-900/10 overflow-hidden"
                    >
                        {/* AIDEV-NOTE: overflow-hidden moved here to inner motion container for smooth height animation */}

                        {/* TABLE */}
                        <div className="p-0">
                            <AssetTable
                                items={items}
                                currency={currency}
                                onEditItem={onEditItem}
                                portfolioId={portfolio.id}
                                portfolioType={portfolio.type}
                                totalValue={portfolioTotalValue}
                                categoryTotalValue={effectiveTotalValue}
                                categoryPercentage={percentage}
                                dividends={categoryDividends}
                                reinvestedReturns={reinvestedReturns}
                                loadingReturns={loadingReturns}
                                idealAllocationMap={idealAllocationMap}
                                visibleColumns={visibleColumns}
                                indexedMirrorReturnPct={indexedMirrorReturnPct}
                                displayedReturnPct={items.length === 1 ? displayedReturnPct : null}
                            />
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="flex items-center justify-between p-4 border-t border-zinc-800/50 bg-zinc-950/30 rounded-b-xl gap-4">
                            <div className="flex gap-3 flex-1">
                                {/* Only standard assets have flexible columns */}
                                {portfolio.type !== 'real_estate' && portfolio.type !== 'business' && (
                                    <button
                                        className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium px-4 py-2 rounded-lg border border-zinc-800 transition-colors h-9"
                                        onClick={() => setIsEditColumnsOpen(true)}
                                    >
                                        <Settings2 size={14} />
                                        Editar Colunas
                                    </button>
                                )}

                                <button
                                    className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium px-4 py-2 rounded-lg border border-zinc-800 transition-colors h-9"
                                    onClick={() => setIsGraphicModalOpen(true)}
                                >
                                    <BarChart2 size={14} />
                                    Análise Gráfica
                                </button>
                            </div>

                            <Button
                                variant="primary"
                                size="sm"
                                className="h-9 px-4"
                                onClick={onOpenAddModal}
                            >
                                <Plus size={14} className="mr-2" />
                                Adicionar Lançamento
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <EditColumnsDialog
                isOpen={isEditColumnsOpen}
                onClose={() => setIsEditColumnsOpen(false)}
                portfolioId={portfolio.id}
                category={category}
                onSave={setVisibleColumns}
            />
            <AssetGraphicAnalysisModal
                isOpen={isGraphicModalOpen}
                onClose={() => setIsGraphicModalOpen(false)}
                category={category}
                items={items}
                currency={currency}
            />
        </div>
    );
};
