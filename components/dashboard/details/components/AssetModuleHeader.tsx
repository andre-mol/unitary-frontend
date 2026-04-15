import React from 'react';
import { Layers, Package, Briefcase, TrendingUp, Home, ChevronDown } from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../ui/Tooltip';

interface AssetModuleHeaderProps {
    category: string;
    itemsCount: number;
    totalValue: number;
    currency: string;
    percentage: number;
    // Standard Asset Metrics
    variation?: number;
    variationPct?: number;
    totalReturnPct?: number;
    // Real Estate / Business variants might have different metrics, 
    // but for the header summary, we focus on the primary financial ones.
    isOpen: boolean;
    onToggle: () => void;
    portfolioType?: string;
}

export const AssetModuleHeader: React.FC<AssetModuleHeaderProps> = ({
    category,
    itemsCount,
    totalValue,
    currency,
    percentage,
    variation,
    variationPct,
    totalReturnPct,
    isOpen,
    onToggle,
    portfolioType
}) => {
    // Icon logic
    const isRealEstate = portfolioType === 'real_estate';
    const isBusiness = portfolioType === 'business';

    const renderIcon = () => {
        if (category === 'Arte' || category === 'Veículos') return <Package size={20} />;
        if (isBusiness) return <Briefcase size={20} />;
        if (category === 'Investimentos') return <TrendingUp size={20} />;
        if (isRealEstate) return <Home size={20} />;
        return <Layers size={20} />;
    };

    return (
        <div
            onClick={onToggle}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-900/40 transition-colors group select-none rounded-t-xl"
        >
            {/* LEFT: Icon & Name */}
            <div className="flex items-center gap-4 w-1/3">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-white transition-colors">
                    {renderIcon()}
                </div>
                <div>
                    <h3 className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors uppercase tracking-wide">
                        {category}
                    </h3>
                    <div className="text-xs text-zinc-500 mt-0.5">
                        {itemsCount} {itemsCount === 1 ? 'ativo' : 'ativos'}
                    </div>
                </div>
            </div>

            {/* CENTER/RIGHT: Metrics Grid */}
            <div className="flex  items-center justify-end gap-8 flex-1 mr-8">

                {/* 1. VARIATION (Price Only) - Standard Only */}
                {!isRealEstate && !isBusiness && variationPct !== undefined && (
                    <div className="hidden md:flex flex-col items-end min-w-[100px]">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-medium cursor-help">
                                        Variação <HelpCircle size={10} />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-900 border-zinc-800 text-xs max-w-[200px]">
                                    <p><span className="font-bold text-white">Variação de Preço:</span></p>
                                    <p className="text-zinc-400">Diferença entre custo médio e preço atual. Não inclui dividendos.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className={`text-sm font-mono font-bold ${variationPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {variationPct >= 0 ? '+' : ''}{variationPct.toFixed(2)}%
                        </div>
                    </div>
                )}

                {/* 2. RENTABILITY (Price + Divs) - Standard Only */}
                {!isRealEstate && !isBusiness && totalReturnPct !== undefined && (
                    <div className="hidden md:flex flex-col items-end min-w-[100px]">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-medium cursor-help">
                                        Rentabilidade <HelpCircle size={10} />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-900 border-zinc-800 text-xs max-w-[200px]">
                                    <p><span className="font-bold text-white">Retorno Total (Estimado):</span></p>
                                    <p className="text-zinc-400">Variação de cotação + Proventos recebidos. Média ponderada dos ativos desta categoria.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className={`text-sm font-mono font-bold ${totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalReturnPct >= 0 ? '+' : ''}{totalReturnProfitPctFormatted(totalReturnPct)}
                        </div>
                    </div>
                )}

                {/* 3. TOTAL VALUE */}
                <div className="text-right min-w-[120px]">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium mb-0.5">Valor Total</div>
                    <div className="text-base font-mono font-medium text-white">
                        {totalValue.toLocaleString('pt-BR', { style: 'currency', currency })}
                    </div>
                </div>

                {/* 4. % CARTEIRA */}
                <div className="text-right min-w-[60px]">
                    <div className="text-[10px] text-zinc-500 uppercase font-medium mb-0.5">% Cart.</div>
                    <div className="text-sm font-mono font-bold text-zinc-300">
                        {percentage.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* EXPAND ICON */}
            <div className={`transform transition-transform duration-300 text-zinc-500 ${isOpen ? 'rotate-180 text-white' : ''}`}>
                <ChevronDown size={20} />
            </div>
        </div>
    );
};

// Helper for formatting
function totalReturnProfitPctFormatted(val: number) {
    return val.toFixed(2) + '%';
}
