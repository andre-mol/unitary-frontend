/**
 * Hook: useAddItemForm
 * Encapsulates all state and logic for AddItemModal
 */

import { useState, useEffect, useCallback } from 'react';
import { CustomItem } from '../../../../types';
import { portfolioService } from '../../../../lib/portfolioService';

// Currency Helpers
export const formatBRL = (value: string | number) => {
    if (!value) return '';
    const stringVal = typeof value === 'number' ? value.toFixed(2) : value;
    const digits = stringVal.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const parseBRL = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
};

interface UseAddItemFormProps {
    newItem: Partial<CustomItem>;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    type: string;
}

export function useAddItemForm({ newItem, setNewItem, type }: UseAddItemFormProps) {
    // Local state
    const [tagsInput, setTagsInput] = useState(newItem.tags?.join(', ') || '');

    // Standard inputs
    const [unitPrice, setUnitPrice] = useState<string>('');
    const [quantityInput, setQuantityInput] = useState<string>('1');
    const [otherCosts, setOtherCosts] = useState<string>('');

    // Fixed Income specific inputs
    const [fiValue, setFiValue] = useState<string>('');

    // Real Estate specific inputs
    const [monthlyRent, setMonthlyRent] = useState<string>('');
    const [condoFee, setCondoFee] = useState<string>('');
    const [maintenance, setMaintenance] = useState<string>('');
    const [propertyTax, setPropertyTax] = useState<string>('');
    const [insurance, setInsurance] = useState<string>('');

    // UI States (used by investments form)
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);


    // Logic Helpers
    const isInvestment = type === 'investments';
    const isRealEstate = type === 'real_estate';
    const isBusiness = type === 'business';
    const selectedAssetType = newItem.category || '';
    const isFixedIncome = selectedAssetType === 'Renda Fixa';
    const isInternational = ['Stock', 'Reit', 'EFTs Internacionais'].includes(selectedAssetType);
    const isFund = selectedAssetType === 'Fundos de Investimentos';
    const propertyType = newItem.customFields?.propertyType || '';
    const structureType = newItem.customFields?.structureType || '';

    // Handler for inputs that need currency mask
    const handleCurrencyChange = useCallback((val: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
        setter(formatBRL(val));
    }, []);

    // Initialization
    useEffect(() => {
        if (newItem.initialValue && newItem.quantity) {
            const calculatedUnitPrice = newItem.initialValue / newItem.quantity;
            setUnitPrice(formatBRL(calculatedUnitPrice));

            const isFund = newItem.category === 'Fundos de Investimentos';
            if (isFund) {
                setQuantityInput(formatBRL(newItem.quantity));
            } else {
                setQuantityInput(String(newItem.quantity));
            }
        }
    }, []);

    // Handlers
    const handleTagsChange = useCallback((val: string) => {
        setTagsInput(val);
        const tagsArray = val.split(',').map(t => t.trim()).filter(Boolean);
        setNewItem(prev => ({ ...prev, tags: tagsArray }));
    }, [newItem, setNewItem]);

    const handleCustomFieldChange = useCallback((key: string, value: any) => {
        if (isRealEstate && key === 'propertyType') {
            setNewItem(prev => ({
                ...prev,
                category: value,
                customFields: {
                    ...(prev.customFields || {}),
                    [key]: value
                }
            }));
        }
        else if (isBusiness && key === 'structureType') {
            setNewItem(prev => ({
                ...prev,
                category: value,
                customFields: {
                    ...(prev.customFields || {}),
                    [key]: value
                }
            }));
        }
        else {
            setNewItem(prev => ({
                ...prev,
                customFields: {
                    ...(prev.customFields || {}),
                    [key]: value
                }
            }));
        }
    }, [newItem, setNewItem, isRealEstate, isBusiness]);

    const handleTickerBlur = useCallback(async (ticker: string) => {
        if (!ticker || ticker.length < 3) return;

        // Only auto-fill if unitPrice is empty or zero
        const currentPrice = parseBRL(unitPrice);
        if (currentPrice > 0) return;

        // AIDEV-FIX: Buscar market_asset_id junto com o preço
        const { getSupabaseClient } = await import('../../../../config/supabase');
        const supabase = getSupabaseClient();

        // Buscar o ativo de mercado pelo ticker
        const { data: marketAsset } = await supabase
            .from('market_quotes')
            .select('id, ticker')
            .ilike('ticker', ticker)
            .limit(1)
            .single();

        const price = await portfolioService.getLatestMarketPrice(ticker);
        if (price !== null && price > 0) {
            setUnitPrice(formatBRL(price));
            setNewItem(prev => ({
                ...prev,
                name: ticker.toUpperCase(),
                valuationMethod: { type: 'automatic' },
                // AIDEV-FIX: Vincular market_asset_id automaticamente
                market_asset_id: marketAsset?.id || undefined
            }));
        } else if (marketAsset) {
            // Se encontrou o ativo mas não tem preço, ainda vincular
            setNewItem(prev => ({
                ...prev,
                name: ticker.toUpperCase(),
                valuationMethod: { type: 'automatic' },
                market_asset_id: marketAsset.id
            }));
        }
    }, [unitPrice, newItem, setNewItem, setUnitPrice]);

    // Auto-generate Name for Fixed Income
    useEffect(() => {
        if (isFixedIncome) {
            const fields = newItem.customFields || {};
            const bondType = fields.bondType || 'Renda Fixa';
            const issuer = fields.issuer ? ` ${fields.issuer}` : '';
            const rate = fields.rate ? ` - ${fields.rate}%` : '';
            const indexer = fields.indexer ? ` ${fields.indexer}` : '';

            const autoName = `${bondType}${issuer}${rate}${indexer}`;

            if (newItem.name !== autoName) {
                setNewItem(prev => ({ ...prev, name: autoName }));
            }
        }
    }, [isFixedIncome, newItem.customFields, setNewItem, newItem.name]);

    // Calculation Sync for Variable Income
    useEffect(() => {
        if (isBusiness) {
            const cost = parseBRL(unitPrice);
            const informedCurrent = Number(newItem.customFields?.companyCurrentValue || 0);
            const initialValue = cost;
            const currentValue = informedCurrent > 0 ? informedCurrent : cost;
            setNewItem(prev => ({
                ...prev,
                quantity: 1,
                initialValue,
                value: currentValue,
                history: [{
                    date: prev.initialDate || new Date().toISOString(),
                    value: currentValue,
                    type: 'initial'
                }]
            }));
            return;
        }

        if (!isInvestment || isFixedIncome) return;

        const price = parseBRL(unitPrice);
        const costs = parseBRL(otherCosts);

        if (isFund) {
            const totalInvested = parseBRL(quantityInput);
            const quotaPrice = price;

            const derivedQty = quotaPrice > 0 ? totalInvested / quotaPrice : 0;
            const finalTotal = totalInvested + costs;

            setNewItem(prev => ({
                ...prev,
                quantity: derivedQty,
                initialValue: finalTotal,
                value: finalTotal,
                history: [{
                    date: prev.initialDate || new Date().toISOString(),
                    value: finalTotal,
                    type: 'initial'
                }]
            }));
        } else {
            const qty = parseFloat(quantityInput) || 0;
            const price = parseBRL(unitPrice);
            const costs = parseBRL(otherCosts);
            const baseTotal = price * qty;
            const acquisitionCost = baseTotal + costs;

            // For automatic valuation, 'value' will be synced with market price,
            // but we initialize it with acquisitionCost so balance starts correct if sync takes a moment.
            // IMPORTANT: 'initialValue' MUST be the acquisition cost for growth/profit calculation.
            setNewItem(prev => ({
                ...prev,
                quantity: qty,
                initialValue: acquisitionCost,
                value: prev.valuationMethod?.type === 'automatic' ? (prev.value || acquisitionCost) : acquisitionCost,
                history: [{
                    date: prev.initialDate || new Date().toISOString(),
                    value: acquisitionCost,
                    type: 'initial'
                }]
            }));
        }
    }, [unitPrice, quantityInput, otherCosts, isInvestment, isFixedIncome, isBusiness, isFund, newItem.initialDate, newItem.valuationMethod?.type, newItem.value]);

    // Calculation Sync for Fixed Income
    useEffect(() => {
        if (isFixedIncome) {
            const val = parseBRL(fiValue);
            setNewItem(prev => ({
                ...prev,
                quantity: 1,
                initialValue: val,
                value: val,
                history: [{
                    date: prev.initialDate || new Date().toISOString(),
                    value: val,
                    type: 'initial'
                }]
            }));
        }
    }, [fiValue, isFixedIncome, newItem.initialDate]);

    // Update Real Estate specific numeric fields
    useEffect(() => {
        if (isRealEstate) {
            const rentVal = parseBRL(monthlyRent);

            const condoVal = parseBRL(condoFee);
            const maintVal = parseBRL(maintenance);
            const taxVal = parseBRL(propertyTax);
            const insVal = parseBRL(insurance);

            const monthlyEquivalent = condoVal + maintVal + (taxVal / 12) + (insVal / 12);

            setNewItem(prev => ({
                ...prev,
                customFields: {
                    ...prev.customFields,
                    monthlyRent: rentVal,
                    condoFee: condoVal,
                    maintenance: maintVal,
                    propertyTax: taxVal,
                    insurance: insVal,
                    monthlyCosts: monthlyEquivalent
                }
            }));
        }
    }, [monthlyRent, condoFee, propertyTax, insurance, maintenance, isRealEstate]);

    // Rate Config Helper
    const getRateConfig = useCallback((indexer: string) => {
        switch (indexer) {
            case 'CDI':
                return { label: 'Percentual do CDI (%)', placeholder: 'Ex: 100 (para 100% do CDI)' };
            case 'CDI +':
                return { label: 'Taxa Adicional (% sobre CDI)', placeholder: 'Ex: 2.0 (para CDI + 2.0%)' };
            case 'IPCA +':
                return { label: 'Taxa Real (% + IPCA)', placeholder: 'Ex: 6.0 (para IPCA + 6.0%)' };
            default:
                return { label: 'Taxa (% ao ano)', placeholder: 'Ex: 10.5' };
        }
    }, []);

    return {
        // State
        tagsInput,
        unitPrice,
        quantityInput,
        otherCosts,
        fiValue,
        monthlyRent,
        condoFee,
        maintenance,
        propertyTax,
        insurance,
        isAdvancedOpen,

        // Setters
        setTagsInput,
        setUnitPrice,
        setQuantityInput,
        setOtherCosts,
        setFiValue,
        setMonthlyRent,
        setCondoFee,
        setMaintenance,
        setPropertyTax,
        setInsurance,
        setIsAdvancedOpen,

        // Derived
        isInvestment,
        isRealEstate,
        isBusiness,
        selectedAssetType,
        isFixedIncome,
        isInternational,
        isFund,
        propertyType,
        structureType,

        // Handlers
        handleCurrencyChange,
        handleTagsChange,
        handleCustomFieldChange,
        handleTickerBlur,
        getRateConfig,
        parseBRL,
        formatBRL,
    };
}
