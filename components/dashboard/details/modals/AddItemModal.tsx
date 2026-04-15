/**
 * AddItemModal - Refactored
 * Modal for adding new items to a portfolio
 * Uses extracted hook and form subcomponents
 */

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { CustomItem } from '../../../../types';

// Hook
import { useAddItemForm, parseBRL } from '../hooks/useAddItemForm';

// Form Components
import { InvestmentForm } from './forms/InvestmentForm';
import { RealEstateForm } from './forms/RealEstateForm';
import { BusinessForm } from './forms/BusinessForm';
import { GenericForm } from './forms/GenericForm';

interface AddItemModalProps {
    newItem: Partial<CustomItem>;
    type: string;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    onClose: () => void;
    onSave: (draft?: Partial<CustomItem>) => void;
    currency: string;
    categories: string[];
    onAddCategory: (cat: string) => void;
    validationErrors?: Record<string, string[]> | null;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
    newItem, type, setNewItem, onClose, onSave, currency: portfolioCurrency, categories, onAddCategory, validationErrors
}) => {
    const {
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
        formatBRL,
    } = useAddItemForm({ newItem, setNewItem, type });

    // Auto-scroll to top on validation errors
    const modalRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (validationErrors && Object.keys(validationErrors).length > 0 && modalRef.current) {
            modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [validationErrors]);

    const displayCurrency = isInternational ? 'USD' : portfolioCurrency;

    const buildFinalDraft = (): Partial<CustomItem> => {
        const baseDraft: Partial<CustomItem> = { ...newItem };

        if (isBusiness) {
            const cost = parseBRL(unitPrice);
            const informedCurrent = Number(newItem.customFields?.companyCurrentValue || 0);
            const currentValue = informedCurrent > 0 ? informedCurrent : cost;
            return {
                ...baseDraft,
                quantity: 1,
                initialValue: cost,
                value: currentValue,
                history: [{
                    date: newItem.initialDate || new Date().toISOString(),
                    value: currentValue,
                    type: 'initial'
                }]
            };
        }

        if (isInvestment && !isFixedIncome) {
            const price = parseBRL(unitPrice);
            const costs = parseBRL(otherCosts);

            if (isFund) {
                const totalInvested = parseBRL(quantityInput);
                const derivedQty = price > 0 ? totalInvested / price : 0;
                const finalTotal = totalInvested + costs;

                return {
                    ...baseDraft,
                    quantity: derivedQty,
                    initialValue: finalTotal,
                    value: finalTotal,
                    history: [{
                        date: newItem.initialDate || new Date().toISOString(),
                        value: finalTotal,
                        type: 'initial'
                    }]
                };
            }

            const qty = parseFloat(quantityInput) || 0;
            const acquisitionCost = (price * qty) + costs;

            return {
                ...baseDraft,
                quantity: qty,
                initialValue: acquisitionCost,
                value: acquisitionCost,
                history: [{
                    date: newItem.initialDate || new Date().toISOString(),
                    value: acquisitionCost,
                    type: 'initial'
                }]
            };
        }

        if (isInvestment && isFixedIncome) {
            const val = parseBRL(fiValue);
            return {
                ...baseDraft,
                quantity: 1,
                initialValue: val,
                value: val,
                history: [{
                    date: newItem.initialDate || new Date().toISOString(),
                    value: val,
                    type: 'initial'
                }]
            };
        }

        if (!isInvestment && !isRealEstate && !isBusiness) {
            const price = parseBRL(unitPrice);
            const qty = parseFloat(quantityInput) || 0;
            const total = price * qty;
            return {
                ...baseDraft,
                quantity: qty,
                initialValue: total,
                value: total,
            };
        }

        return baseDraft;
    };

    // Validation
    const isValid = newItem.name &&
        (!isInvestment || newItem.category) &&
        (!isRealEstate || propertyType) &&
        (!isBusiness || structureType);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                ref={modalRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="flex justify-between mb-6 border-b border-zinc-800 pb-4">
                    <div>
                        <h3 className="text-white font-bold text-lg">
                            {isBusiness ? "Adicionar Empresa / Participação" : "Adicionar Novo Ativo"}
                        </h3>
                        <p className="text-zinc-500 text-xs mt-1">
                            {isInvestment ? "Cadastro de investimento financeiro." :
                                isRealEstate ? "Cadastro de imóvel físico." :
                                    isBusiness ? "Cadastro de empresa ou participação societária." :
                                        "Insira os dados do ativo manualmente."}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white h-fit">
                        <X size={20} />
                    </button>
                </div>

                {/* Validation Errors */}
                {validationErrors && Object.keys(validationErrors).length > 0 && (
                    <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        <p className="font-semibold mb-1">Por favor, corrija os seguintes erros:</p>
                        <ul className="list-disc list-inside space-y-0.5 opacity-90">
                            {Object.entries(validationErrors).map(([field, errors]) => (
                                <li key={field}>{errors[0]}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Form Content Based on Type */}
                {isInvestment ? (
                    <InvestmentForm
                        newItem={newItem}
                        setNewItem={setNewItem}
                        portfolioCurrency={portfolioCurrency}
                        unitPrice={unitPrice}
                        quantityInput={quantityInput}
                        otherCosts={otherCosts}
                        fiValue={fiValue}
                        isAdvancedOpen={isAdvancedOpen}
                        selectedAssetType={selectedAssetType}
                        isFixedIncome={isFixedIncome}
                        isInternational={isInternational}
                        isFund={isFund}
                        displayCurrency={displayCurrency}
                        handleCurrencyChange={handleCurrencyChange}
                        handleCustomFieldChange={handleCustomFieldChange}
                        handleTickerBlur={handleTickerBlur}
                        getRateConfig={getRateConfig}
                        setUnitPrice={setUnitPrice}
                        setQuantityInput={setQuantityInput}
                        setOtherCosts={setOtherCosts}
                        setFiValue={setFiValue}
                        setIsAdvancedOpen={setIsAdvancedOpen}
                        validationErrors={validationErrors}
                    />
                ) : isRealEstate ? (
                    <RealEstateForm
                        newItem={newItem}
                        setNewItem={setNewItem}
                        portfolioCurrency={portfolioCurrency}
                        unitPrice={unitPrice}
                        monthlyRent={monthlyRent}
                        condoFee={condoFee}
                        maintenance={maintenance}
                        propertyTax={propertyTax}
                        insurance={insurance}
                        propertyType={String(propertyType ?? '')}
                        handleCurrencyChange={handleCurrencyChange}
                        handleCustomFieldChange={handleCustomFieldChange}
                        setUnitPrice={setUnitPrice}
                        setMonthlyRent={setMonthlyRent}
                        setCondoFee={setCondoFee}
                        setMaintenance={setMaintenance}
                        setPropertyTax={setPropertyTax}
                        setInsurance={setInsurance}
                    />
                ) : isBusiness ? (
                    <BusinessForm
                        newItem={newItem}
                        setNewItem={setNewItem}
                        portfolioCurrency={portfolioCurrency}
                        unitPrice={unitPrice}
                        structureType={String(structureType ?? '')}
                        handleCurrencyChange={handleCurrencyChange}
                        handleCustomFieldChange={handleCustomFieldChange}
                        setUnitPrice={setUnitPrice}
                        parseBRL={parseBRL}
                    />
                ) : (
                    <GenericForm
                        newItem={newItem}
                        setNewItem={setNewItem}
                        portfolioCurrency={portfolioCurrency}
                        categories={categories}
                        onAddCategory={onAddCategory}
                        unitPrice={unitPrice}
                        quantityInput={quantityInput}
                        handleCurrencyChange={handleCurrencyChange}
                        setUnitPrice={setUnitPrice}
                        setQuantityInput={setQuantityInput}
                    />
                )}

                {/* Common Fields */}
                <div className="space-y-6 mt-6 border-t border-zinc-800 pt-6">
                    <Input
                        label="Tags"
                        placeholder="Ex: longo prazo, oportunidade (separadas por vírgula)"
                        value={tagsInput}
                        onChange={e => handleTagsChange(e.target.value)}
                    />

                    <div className="relative group">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Descrição</label>
                        <textarea
                            className="w-full bg-zinc-900/50 text-white placeholder-zinc-600 border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:bg-zinc-900 transition-all duration-300 min-h-[80px] resize-none"
                            placeholder="Detalhes adicionais sobre este ativo..."
                            value={newItem.description || ''}
                            onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button onClick={() => onSave(buildFinalDraft())}>
                            <Save size={16} className="mr-2" /> {isBusiness ? 'Salvar Empresa' : 'Salvar Ativo'}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
