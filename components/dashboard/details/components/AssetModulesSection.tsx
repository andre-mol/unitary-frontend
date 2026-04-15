import React from 'react';
import { Layers } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { AssetModuleCard } from './AssetModuleCard';
import { Portfolio, CustomItem } from '../../../../types';

interface GroupedItem {
    category: string;
    totalValue: number;
    items: CustomItem[];
}

interface AssetModulesSectionProps {
    portfolio: Portfolio;
    groupedItems: GroupedItem[];
    items: CustomItem[];
    totalValue: number;
    currency: string;
    idealAllocationMap: Map<string, number>;
    isRealEstate: boolean;
    indexedMirrorReturnPct?: number | null;
    displayedPortfolioReturnPct?: number | null;
    onEditItem: (item: CustomItem) => void;
    onOpenAddModal: () => void;
    dividends?: any[];
}

export const AssetModulesSection: React.FC<AssetModulesSectionProps> = ({
    portfolio,
    groupedItems,
    items,
    totalValue,
    currency,
    idealAllocationMap,
    isRealEstate,
    indexedMirrorReturnPct = null,
    displayedPortfolioReturnPct = null,
    onEditItem,
    onOpenAddModal,
    dividends = []
}) => {
    const getDisplayCategoryTotal = (group: GroupedItem): number => {
        if (indexedMirrorReturnPct === null || !Number.isFinite(indexedMirrorReturnPct)) {
            return group.totalValue;
        }
        const factor = 1 + (indexedMirrorReturnPct / 100);
        return group.items.reduce((acc, item) => acc + (Number(item.initialValue || 0) * factor), 0);
    };

    return (
        <div className="mb-12 animate-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-2">
                <h3 className="text-white font-bold text-sm uppercase tracking-wide">Módulos de Ativos</h3>
                <span className="text-xs text-zinc-500">{items.length} ativo(s) em {groupedItems.length} {isRealEstate ? 'tipo(s)' : 'categoria(s)'}</span>
            </div>

            {groupedItems.length === 0 ? (
                <div className="text-center py-16 border border-zinc-900 rounded-xl bg-zinc-950/50">
                    <Layers className="mx-auto text-zinc-700 mb-4" size={32} />
                    <h3 className="text-zinc-300 font-medium text-sm">Inventário Vazio</h3>
                    <p className="text-zinc-600 text-xs mb-6 mt-1">Este portfólio ainda não possui registros manuais.</p>
                    <Button variant="outline" size="sm" onClick={onOpenAddModal}>Criar Registro</Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedItems.map((group) => {
                        const displayCategoryTotal = getDisplayCategoryTotal(group);
                        const currentPct = totalValue > 0 ? (displayCategoryTotal / totalValue) * 100 : 0;

                        return (
                            <AssetModuleCard
                                key={group.category}
                                category={group.category}
                                totalValue={displayCategoryTotal}
                                portfolioTotalValue={totalValue}
                                items={group.items}
                                currency={currency}
                                percentage={currentPct}
                                portfolio={portfolio}
                                indexedMirrorReturnPct={indexedMirrorReturnPct}
                                displayedReturnPct={group.items.length === items.length ? displayedPortfolioReturnPct : null}
                                onEditItem={onEditItem}
                                onOpenAddModal={onOpenAddModal}
                                dividends={dividends}
                                idealAllocationMap={idealAllocationMap}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

