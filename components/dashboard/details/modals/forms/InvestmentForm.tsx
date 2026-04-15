/**
 * InvestmentForm - Form for investment portfolio items
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Building2, X, ChevronDown, Calculator } from 'lucide-react';
import { Input } from '../../../../ui/Input';
import { MarketAssetSelect } from '../../../../ui/MarketAssetSelect';
import { CustomItem } from '../../../../../types';
import { ValuationConfigurator } from '../../components/ValuationConfigurator';
import { formatCurrency } from '../../../../../utils/formatters';

const INVESTMENT_CATEGORIES = [
    "Ações", "Fundos de Investimentos", "FIIs", "Criptomoedas",
    "Stock", "Reit", "BDRs", "EFTs", "EFTs Internacionais",
    "Tesouro Direto", "Renda Fixa"
];

const FIXED_INCOME_TYPES = ["CDB", "LCI", "LCA", "LC", "LF", "RDB", "Debênture", "CRI", "CRA", "CCB", "Tesouro Direto"];
const FIXED_INCOME_INDEXERS = ["CDI", "CDI +", "IPCA +"];
const FIXED_INCOME_MODES = ["Pré-Fixado", "Pós-Fixado"];

interface InvestmentFormProps {
    newItem: Partial<CustomItem>;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    portfolioCurrency: string;
    // State
    unitPrice: string;
    quantityInput: string;
    otherCosts: string;
    fiValue: string;
    isAdvancedOpen: boolean;
    // Derived
    selectedAssetType: string;
    isFixedIncome: boolean;
    isInternational: boolean;
    isFund: boolean;
    displayCurrency: string;
    // Handlers
    handleCurrencyChange: (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => void;
    handleCustomFieldChange: (key: string, value: any) => void;
    handleTickerBlur: (ticker: string) => void;
    getRateConfig: (indexer: string) => { label: string; placeholder: string };
    setUnitPrice: React.Dispatch<React.SetStateAction<string>>;
    setQuantityInput: React.Dispatch<React.SetStateAction<string>>;
    setOtherCosts: React.Dispatch<React.SetStateAction<string>>;
    setFiValue: React.Dispatch<React.SetStateAction<string>>;
    setIsAdvancedOpen: React.Dispatch<React.SetStateAction<boolean>>;
    validationErrors?: Record<string, string[]> | null;
}

export const InvestmentForm: React.FC<InvestmentFormProps> = ({
    newItem,
    setNewItem,
    portfolioCurrency,
    unitPrice,
    quantityInput,
    otherCosts,
    fiValue,
    isAdvancedOpen,
    selectedAssetType,
    isFixedIncome,
    isInternational,
    isFund,
    displayCurrency,
    handleCurrencyChange,
    handleCustomFieldChange,
    handleTickerBlur,
    getRateConfig,
    setUnitPrice,
    setQuantityInput,
    setOtherCosts,
    setFiValue,
    setIsAdvancedOpen,
    validationErrors,
}) => {
    const { label: rateLabel, placeholder: ratePlaceholder } = getRateConfig(String(newItem.customFields?.indexer ?? ''));

    // Formats "123456" into "1.234,56"
    const formatBRL = (value: string | number) => {
        if (!value) return '';
        const stringVal = typeof value === 'number' ? value.toFixed(2) : value;
        const digits = stringVal.replace(/\D/g, "");
        const amount = Number(digits) / 100;
        return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const parseBRL = (value: string) => {
        if (!value) return 0;
        return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
    };

    return (
        <div className="space-y-6">
            {/* 1. Asset Type Selector */}
            <div className={`transition-all duration-300 rounded-lg ${validationErrors?.['category'] ? 'p-1 bg-red-500/10' : ''}`}>
                <label className={`block text-xs font-medium mb-1.5 ml-1 ${validationErrors?.['category'] ? 'text-red-400' : 'text-zinc-400'}`}>
                    Tipo de Ativo {validationErrors?.['category'] && '*'}
                </label>
                <select
                    className={`w-full bg-zinc-900/50 text-white border rounded-lg py-3 px-4 focus:outline-none transition-all appearance-none cursor-pointer
                        ${validationErrors?.['category']
                            ? 'border-red-500 focus:border-red-500 placeholder-red-400/50'
                            : 'border-zinc-800 focus:border-amber-500'}`}
                    value={selectedAssetType}
                    onChange={(e) => {
                        setNewItem(prev => ({ ...prev, category: e.target.value, name: '' }));
                        if (e.target.value === 'Renda Fixa') setFiValue('');
                    }}
                >
                    <option value="" disabled>Selecione o tipo...</option>
                    {INVESTMENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                {validationErrors?.['category'] && (
                    <p className="text-red-400 text-xs mt-1 ml-1">{validationErrors['category'][0]}</p>
                )}
            </div>

            {/* 2. Asset Name (Hidden for Fixed Income) */}
            {!isFixedIncome && (
                <MarketAssetSelect
                    value={newItem.name || ''}
                    onChange={(val) => setNewItem(prev => ({ ...prev, name: val }))}
                    onBlur={handleTickerBlur}
                    error={validationErrors?.['name']?.[0]}
                    onSelectAttribute={(asset) => {
                        const updates: any = {
                            name: asset.ticker,
                            market_asset_id: asset.id
                        };

                        // Auto-fill price if available
                        if (asset.last_close) {
                            handleCurrencyChange(asset.last_close.toFixed(2), setUnitPrice);
                            updates.valuationMethod = { type: 'automatic' }; // Set to automatic valuation
                        }

                        setNewItem(prev => ({ ...prev, ...updates }));
                    }}
                />
            )}

            {/* --- FIXED INCOME LAYOUT --- */}
            {isFixedIncome && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-zinc-800 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Tipo de Título</label>
                            <select
                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-amber-500"
                                value={String(newItem.customFields?.bondType ?? '')}
                                onChange={(e) => handleCustomFieldChange('bondType', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {FIXED_INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <Input
                            label="Emissor"
                            placeholder="Ex: Banco XP"
                            icon={<Building2 size={14} />}
                            value={String(newItem.customFields?.issuer ?? '')}
                            onChange={(e) => handleCustomFieldChange('issuer', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Indexador</label>
                            <select
                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-amber-500"
                                value={String(newItem.customFields?.indexer ?? '')}
                                onChange={(e) => handleCustomFieldChange('indexer', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {FIXED_INCOME_INDEXERS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Forma</label>
                            <select
                                className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-amber-500"
                                value={String(newItem.customFields?.mode ?? '')}
                                onChange={(e) => handleCustomFieldChange('mode', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {FIXED_INCOME_MODES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <Input
                            label={rateLabel}
                            type="number"
                            placeholder={ratePlaceholder}
                            value={String(newItem.customFields?.rate ?? '')}
                            onChange={(e) => handleCustomFieldChange('rate', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Valor em R$"
                            type="text"
                            placeholder="0,00"
                            icon={<DollarSign size={14} />}
                            value={fiValue}
                            onChange={(e) => handleCurrencyChange(e.target.value, setFiValue)}
                        />
                        <Input
                            label="Data de Compra"
                            type="date"
                            value={newItem.initialDate ? newItem.initialDate.split('T')[0] : ''}
                            onChange={e => setNewItem(prev => ({ ...prev, initialDate: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Vencimento"
                            type="date"
                            value={String(newItem.customFields?.maturityDate ?? '')}
                            onChange={(e) => handleCustomFieldChange('maturityDate', e.target.value)}
                        />
                        <div className="flex items-center h-full pt-6">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newItem.customFields?.liquidity ? 'bg-amber-500 border-amber-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                                    {newItem.customFields?.liquidity && <X size={14} className="text-black rotate-45" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={Boolean(newItem.customFields?.liquidity)}
                                    onChange={(e) => handleCustomFieldChange('liquidity', e.target.checked)}
                                />
                                <span className="text-sm text-zinc-300">Possui Liquidez Diária?</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VARIABLE INCOME LAYOUT --- */}
            {!isFixedIncome && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-zinc-800 pt-4 mt-2">
                    <Input
                        label="Corretora / Custódia (Opcional)"
                        placeholder="Ex: XP, Binance, Avenue"
                        icon={<Building2 size={14} />}
                        value={String(newItem.customFields?.institution ?? '')}
                        onChange={(e) => handleCustomFieldChange('institution', e.target.value)}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={isFund ? `Preço da Cota (${displayCurrency})` : `Valor Unitário (${displayCurrency})`}
                            type="text"
                            placeholder="0,00"
                            value={unitPrice}
                            onChange={e => handleCurrencyChange(e.target.value, setUnitPrice)}
                        />

                        <Input
                            label={isFund ? `Valor Investido (${displayCurrency})` : "Quantidade"}
                            type={isFund ? "text" : "number"}
                            step="any"
                            placeholder={isFund ? "0,00" : "1"}
                            value={quantityInput}
                            onChange={e => isFund ? handleCurrencyChange(e.target.value, setQuantityInput) : setQuantityInput(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data de Aquisição"
                            type="date"
                            value={newItem.initialDate ? newItem.initialDate.split('T')[0] : ''}
                            onChange={e => setNewItem(prev => ({ ...prev, initialDate: e.target.value }))}
                        />
                        <Input
                            label={`Outros Custos (${displayCurrency})`}
                            type="text"
                            placeholder="0,00"
                            value={otherCosts}
                            onChange={e => handleCurrencyChange(e.target.value, setOtherCosts)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Calculator size={14} />
                            <span className="text-xs font-medium uppercase">
                                Total Calculado {parseBRL(otherCosts) > 0 ? '(com custos)' : ''}
                            </span>
                        </div>
                        <span className="text-amber-500 font-mono font-bold">
                            {formatCurrency(newItem.initialValue || 0, displayCurrency)}
                        </span>
                    </div>
                </div>
            )}

            {/* Valuation Section - Removed for Financial Investments as requested */}
            {/* 
            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-6">
                 ... (Removed) ... 
            </div> 
            */ }
        </div>
    );
};

