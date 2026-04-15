import React, { useEffect, useMemo, useState } from 'react';
import { CustomItem } from '../../../../types';
import { useNavigate } from 'react-router-dom';
import {
    calculateCurrentValue,
    calculateTotalInvested,
    calculateAveragePrice,
    calculateNetIncome,
    calculateAnnualYield,
    calculateVacancyRate,
    getUnitsForVacancy,
    calculateScore
} from '../../../../domain/calculations';
import { RefreshCw, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { AssetRowMenu } from './AssetRowMenu';
import { ColumnKey } from './EditColumnsDialog';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../../../ui/Tooltip';

interface AssetTableProps {
    items: CustomItem[];
    currency: string;
    onEditItem: (item: CustomItem) => void;
    portfolioId: string;
    portfolioType?: string;
    // Data Props
    totalValue: number;
    categoryTotalValue: number;
    categoryPercentage: number;
    dividends: any[];
    reinvestedReturns: Record<string, { total_return_pct: number, final_value: number }>;
    loadingReturns: boolean;
    idealAllocationMap?: Map<string, number>;
    indexedMirrorReturnPct?: number | null;
    displayedReturnPct?: number | null;
    // Visibility
    visibleColumns: Set<ColumnKey>;
}

type SortField = 'name' | 'quantity' | 'totalValue' | 'variation' | 'totalReturn' | 'score' | 'idealPct';
type SortDirection = 'asc' | 'desc';

export const AssetTable: React.FC<AssetTableProps> = ({
    items,
    currency,
    onEditItem,
    portfolioId,
    portfolioType,
    totalValue,
    categoryTotalValue,
    categoryPercentage,
    dividends,
    reinvestedReturns,
    loadingReturns,
    idealAllocationMap,
    indexedMirrorReturnPct = null,
    displayedReturnPct = null,
    visibleColumns
}) => {
    const navigate = useNavigate();
    const [sortField, setSortField] = useState<SortField>('totalValue');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    const isRealEstate = portfolioType === 'real_estate';
    const isBusiness = portfolioType === 'business';
    const mirrorEnabled = indexedMirrorReturnPct !== null && Number.isFinite(indexedMirrorReturnPct);

    // 1. Prepare Data Logic (Derived Metrics)
    // We map to a clean structure for sorting
    const rows = items.map(item => {
        const invested = calculateTotalInvested(item);
        const currentVal = mirrorEnabled
            ? invested * (1 + (Number(indexedMirrorReturnPct) / 100))
            : calculateCurrentValue(item);
        const quantity = item.quantity || 1;
        const avgPrice = calculateAveragePrice(invested, quantity);

        // Variation
        const unitPrice = quantity > 0 ? currentVal / quantity : 0;
        const unitVariation = unitPrice - avgPrice;
        const unitVariationPct = avgPrice > 0 ? (unitVariation / avgPrice) * 100 : 0;

        // Total Return (Cash)
        const assetDividends = dividends.filter(d => {
            const matchesAsset = d.asset_id === item.market_asset_id ||
                (item.name && d.ticker && d.ticker.split('.')[0] === item.name.split('.')[0]);
            if (!matchesAsset) return false;
            // Date filter optional based on requirement, usually >= item.initialDate
            if (item.initialDate) {
                const divDate = d.approved_on || d.payment_date;
                return divDate >= item.initialDate;
            }
            return true;
        });

        const totalDividends = assetDividends.reduce((acc, d) => acc + Number(d.total_amount), 0);
        const totalReturnProfit = (currentVal + totalDividends) - invested;
        const totalReturnProfitPct = invested > 0 ? (totalReturnProfit / invested) * 100 : 0;

        // Score
        const criteriaCount = item.criteriaAnswers?.length || 0;
        const { display: score } = calculateScore(item.criteriaAnswers, criteriaCount);

        // Ideal Pct
        const idealPct = idealAllocationMap?.get(item.id) || 0;

        // Pct of Portfolio
        // item / totalPortfolioValue
        // But user might want % of Category? Usually % Cart. means total.
        // Let's pass totalValue (total portfolio value) from parent.
        const itemPctOfTotal = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;

        // TRI Return (fetched)
        const triReturnPct = mirrorEnabled
            ? Number(indexedMirrorReturnPct)
            : (items.length === 1 && displayedReturnPct !== null && displayedReturnPct !== undefined && Number.isFinite(displayedReturnPct))
                ? Number(displayedReturnPct)
                : (reinvestedReturns[item.id]?.total_return_pct ?? -999); // -999 for null sorting
        const displayReturnPct = mirrorEnabled
            ? Number(indexedMirrorReturnPct)
            : (items.length === 1 && displayedReturnPct !== null && displayedReturnPct !== undefined && Number.isFinite(displayedReturnPct))
                ? Number(displayedReturnPct)
                : reinvestedReturns[item.id]
                    ? Number(reinvestedReturns[item.id].total_return_pct)
                    : totalReturnProfitPct;
        const unitsForVacancy = getUnitsForVacancy(item);
        const vacancyPct = calculateVacancyRate(unitsForVacancy.total, unitsForVacancy.rented);

        return {
            item,
            currentVal,
            quantity,
            avgPrice,
            currentPrice: unitPrice,
            unitVariation,
            unitVariationPct,
            totalReturnProfit,
            totalReturnProfitPct,
            displayReturnPct,
            score,
            idealPct,
            itemPctOfTotal,
            triReturnPct,
            // RE specific
            status: item.customFields?.occupancyStatus,
            propertyType: item.customFields?.propertyType,
            vacancyPct,
            // Business
            role: item.customFields?.role,
            sharePct: item.customFields?.ownershipPercentage,
        };
    });

    // 2. Sorting Logic
    const sortedRows = [...rows].sort((a, b) => {
        let valA, valB;

        switch (sortField) {
            case 'name':
                valA = a.item.name; valB = b.item.name; break;
            case 'quantity':
                valA = a.quantity; valB = b.quantity; break;
            case 'totalValue':
                valA = a.currentVal; valB = b.currentVal; break;
            case 'variation':
                valA = a.unitVariation; valB = b.unitVariation; break;
            case 'totalReturn':
                valA = a.triReturnPct > -100 ? a.triReturnPct : a.totalReturnProfitPct;
                valB = b.triReturnPct > -100 ? b.triReturnPct : b.totalReturnProfitPct;
                break;
            case 'score':
                valA = a.score; valB = b.score; break;
            case 'idealPct':
                valA = a.idealPct; valB = b.idealPct; break;
            default: return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        // numeric
        return sortDir === 'asc' ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowDown size={12} className="opacity-0 group-hover:opacity-30 transition-opacity" />;
        return sortDir === 'asc' ? <ArrowUp size={12} className="text-zinc-200" /> : <ArrowDown size={12} className="text-zinc-200" />;
    };

    const TH = ({ field, label, align = 'right', className = '' }: { field?: SortField, label: React.ReactNode, align?: 'left' | 'right' | 'center', className?: string }) => (
        <th
            className={`py-3 px-2.5 bg-zinc-950/50 border-b border-zinc-800 border-r border-zinc-800/50 last:border-r-0 text-xs font-medium text-zinc-500 uppercase tracking-wider sticky top-0 z-10 
            ${field ? 'cursor-pointer hover:bg-zinc-900 transition-colors group select-none' : ''} 
            ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} 
            ${className}`}
            onClick={() => field && handleSort(field)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                {label}
                {field && <SortIcon field={field} />}
            </div>
        </th>
    );

    const handleOpenNotes = (item: CustomItem) => {
        const params = new URLSearchParams({
            source: 'asset-note',
            portfolioId,
            itemId: item.id,
            openEvaluation: '1'
        });
        navigate(`/dashboard/notas?${params.toString()}`);
    };

    const AssetLogo: React.FC<{ item: CustomItem }> = ({ item }) => {
        const ticker = String(item.name || '').replace(/\.SA$/i, '').trim().toUpperCase();
        const customLogo = String((item.customFields as any)?.logo || '').trim();
        const fallbackLogo = ticker ? `https://icons.brapi.dev/icons/${ticker}.svg` : '';
        const candidates = useMemo(
            () => [customLogo, fallbackLogo].filter((value, index, list) => value && list.indexOf(value) === index),
            [customLogo, fallbackLogo]
        );
        const [logoIndex, setLogoIndex] = useState(0);

        useEffect(() => {
            setLogoIndex(0);
        }, [customLogo, fallbackLogo, item.name]);

        if (candidates[logoIndex]) {
            return (
                <img
                    src={candidates[logoIndex]}
                    alt={`Logo ${item.name}`}
                    className="h-5 w-5 rounded object-contain shrink-0"
                    onError={() => setLogoIndex((current) => current + 1)}
                />
            );
        }

        return (
            <div className="h-5 w-5 rounded bg-zinc-800 text-[10px] text-zinc-400 flex items-center justify-center shrink-0">
                {item.name.slice(0, 1)}
            </div>
        );
    };

    return (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                <thead>
                    <tr>
                        <TH field="name" label="Ativo" align="left" className="pl-5 min-w-[140px]" />

                        {/* BUSINESS VARIANT (Fixed Columns) */}
                        {isBusiness && (
                            <>
                                <TH label="Estrutura" align="center" />
                                <TH label="Partic." align="center" />
                                <TH label="Capital Inv." align="right" />
                                <TH label="Valuation" align="right" />
                                <TH label="Rentab." align="right" />
                            </>
                        )}

                        {/* REAL ESTATE VARIANT (Fixed Columns) */}
                        {isRealEstate && (
                            <>
                                <TH label="Tipo" align="center" />
                                <TH label="Status" align="center" />
                                <TH label="Vacância" align="center" />
                                <TH label="Renda Líq." align="right" />
                                <TH label="Yield (a.a.)" align="right" />
                                <TH label="Valor Mercado" align="right" />
                            </>
                        )}

                        {/* STANDARD VARIANT (Configurable Columns) */}
                        {!isBusiness && !isRealEstate && (
                            <>
                                {visibleColumns.has('quantity') && <TH field="quantity" label="Qtde" align="right" />}
                                {visibleColumns.has('currentPrice') && <TH label="Preco Atual" align="right" />}
                                {visibleColumns.has('avgPrice') && <TH label="Preço Médio" align="right" />}
                                {visibleColumns.has('variation') && <TH field="variation" label="Variação" align="right" />}

                                {visibleColumns.has('totalReturn') && (
                                    <th className="py-3 px-2.5 bg-zinc-950/50 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right border-r border-zinc-800/50 cursor-pointer group hover:bg-zinc-900" onClick={() => handleSort('totalReturn')}>
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Rentabilidade</span>
                                            <SortIcon field="totalReturn" />
                                        </div>
                                    </th>
                                )}

                                {visibleColumns.has('totalValue') && <TH field="totalValue" label="Valor Total" align="right" />}

                                {visibleColumns.has('score') && <TH field="score" label="Nota" align="center" className="text-amber-500/80" />}
                                {visibleColumns.has('idealPct') && <TH field="idealPct" label="% Ideal" align="center" />}
                                {visibleColumns.has('portfolioPct') && <TH label="% Cart." align="center" />}
                            </>
                        )}

                        <th className="py-3 px-2.5 pr-5 bg-zinc-950/50 border-b border-zinc-800 text-right w-[60px]">Opções</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {sortedRows.map(row => {
                        const { item, currentVal, quantity, avgPrice, currentPrice, totalReturnProfit, totalReturnProfitPct, displayReturnPct } = row;

                        return (
                            <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors group">
                                <td className="py-3 px-2.5 pl-5 border-r border-zinc-800/30">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <AssetLogo item={item} />
                                        <div className="font-medium text-zinc-300 group-hover:text-white transition-colors truncate">{item.name}</div>
                                    </div>
                                    {isRealEstate && <div className="text-[10px] text-zinc-500">{item.customFields?.subType}</div>}
                                </td>

                                {/* BUSINESS RENDER */}
                                {isBusiness && (
                                    <>
                                        <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs text-zinc-400">
                                            {item.customFields?.structureType || '—'}
                                        </td>
                                        <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs font-mono text-zinc-300">
                                            {row.sharePct ? `${row.sharePct}%` : '—'}
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-400">
                                            {calculateTotalInvested(item).toLocaleString('pt-BR', { style: 'currency', currency })}
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-white">
                                            {currentVal.toLocaleString('pt-BR', { style: 'currency', currency })}
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30">
                                            <div className={`text-xs font-mono font-bold ${totalReturnProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {totalReturnProfit >= 0 ? '+' : ''}{totalReturnProfitPct.toFixed(2)}%
                                            </div>
                                        </td>
                                    </>
                                )}

                                {/* REAL ESTATE RENDER (Simplified for now, similar to Business logic) */}
                                {isRealEstate && (
                                    <>
                                        <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs text-zinc-400">
                                            {item.customFields?.propertyType}
                                        </td>
                                        <td className="py-3 px-2.5 text-center border-r border-zinc-800/30">
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${row.status === 'Alugado' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                                {row.status || 'ND'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs font-mono text-zinc-300">
                                            {row.vacancyPct.toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-400">
                                            {calculateNetIncome((Number(item.customFields?.monthlyRent) || 0), 0, 0, 0, 0).toLocaleString('pt-BR', { style: 'currency', currency })}
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-300">
                                            {calculateAnnualYield(calculateNetIncome((Number(item.customFields?.monthlyRent) || 0), 0, 0, 0, 0), currentVal).toFixed(2)}%
                                        </td>
                                        <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-white">
                                            {currentVal.toLocaleString('pt-BR', { style: 'currency', currency })}
                                        </td>
                                    </>
                                )}

                                {/* STANDARD RENDER */}
                                {!isBusiness && !isRealEstate && (
                                    <>
                                        {visibleColumns.has('quantity') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-400">
                                                {quantity}
                                            </td>
                                        )}
                                        {visibleColumns.has('currentPrice') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-300">
                                                {currentPrice.toLocaleString('pt-BR', { style: 'currency', currency })}
                                            </td>
                                        )}
                                        {visibleColumns.has('avgPrice') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono text-zinc-500">
                                                {avgPrice.toLocaleString('pt-BR', { style: 'currency', currency })}
                                            </td>
                                        )}
                                        {visibleColumns.has('variation') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30">
                                                <div className={`text-xs font-mono font-bold ${row.unitVariation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {row.unitVariationPct >= 0 ? '+' : ''}{row.unitVariationPct.toFixed(2)}%
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.has('totalReturn') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30">
                                                <div className={`text-xs font-mono font-bold ${displayReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {displayReturnPct >= 0 ? '+' : ''}{displayReturnPct.toFixed(2)}%
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.has('totalValue') && (
                                            <td className="py-3 px-2.5 text-right border-r border-zinc-800/30 text-xs font-mono font-medium text-white">
                                                {currentVal.toLocaleString('pt-BR', { style: 'currency', currency })}
                                            </td>
                                        )}
                                        {visibleColumns.has('score') && (
                                            <td className="py-3 px-2.5 text-center border-r border-zinc-800/30">
                                                {row.score > 0 ? (
                                                    <span className={`font-mono text-xs font-bold ${row.score >= 8 ? 'text-green-500' : row.score >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                                        {row.score.toFixed(1)}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenNotes(item)}
                                                        className="text-zinc-500 hover:text-amber-500 text-xs underline-offset-2 hover:underline transition-colors"
                                                        title="Definir nota deste ativo"
                                                    >
                                                        Definir
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                        {visibleColumns.has('idealPct') && (
                                            <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs font-mono text-zinc-400">
                                                {row.idealPct > 0 ? `${row.idealPct.toFixed(1)}%` : '—'}
                                            </td>
                                        )}
                                        {visibleColumns.has('portfolioPct') && (
                                            <td className="py-3 px-2.5 text-center border-r border-zinc-800/30 text-xs font-mono text-zinc-300">
                                                {row.itemPctOfTotal.toFixed(1)}%
                                            </td>
                                        )}
                                    </>
                                )}

                                {/* ROW MENU */}
                                <td className="py-3 px-2.5 pr-5 text-right">
                                    <AssetRowMenu item={item} onEdit={onEditItem} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

