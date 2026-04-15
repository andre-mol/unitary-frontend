/**
 * PortfolioHeader - Header section with portfolio info and action buttons
 */

import React from 'react';
import { Button } from '../../../ui/Button';
import { Plus, Target } from 'lucide-react';
import { Portfolio } from '../../../../types';
import { getSafeCurrency } from '../../../../utils/formatters';

interface PortfolioHeaderProps {
    portfolio: Portfolio;
    onOpenStrategy: () => void;
    onOpenTransaction: () => void;
    onOpenAddItem: () => void;
    onOpenSmartAction: () => void;
}

export const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
    portfolio,
    onOpenStrategy,
    onOpenTransaction,
    onOpenAddItem,
    onOpenSmartAction
}) => {
    const currency = getSafeCurrency(portfolio.currency);
    const isRealEstate = portfolio.type === 'real_estate';
    const isBusiness = portfolio.type === 'business';
    const isInvestments = portfolio.type === 'investments';

    return (
        <div className="flex flex-col xl:flex-row justify-between items-start gap-6 mb-8 border-b border-zinc-900 pb-6">
            <div className="flex-1 min-w-0 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {portfolio.customClass || (portfolio.type === 'investments' ? 'Investimentos Financeiros' : portfolio.type === 'real_estate' ? 'Imóveis' : portfolio.type === 'business' ? 'Empresas' : 'Portfólio Personalizado')}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
                        {currency}
                    </span>
                </div>
                <h2 className="text-zinc-500 text-sm mt-2 leading-relaxed break-words">
                    {portfolio.description
                        ? (portfolio.description.length > 130
                            ? `${portfolio.description.slice(0, 130)}...`
                            : portfolio.description)
                        : ""}
                </h2>
            </div>

            <div className="flex flex-wrap gap-3 w-full xl:w-auto flex-shrink-0 items-center justify-start xl:justify-end">
                {!isRealEstate && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 xl:flex-none bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]"
                        title="Definir Estratégia"
                        onClick={onOpenStrategy}
                    >
                        <Target size={16} className="mr-2" /> Estratégia
                    </Button>
                )}

                <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 xl:flex-none"
                    onClick={onOpenSmartAction}
                >
                    <Plus size={14} className="mr-2" /> Adicionar
                </Button>
            </div>
        </div>
    );
};

