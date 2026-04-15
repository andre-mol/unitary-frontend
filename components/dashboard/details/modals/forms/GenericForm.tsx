/**
 * GenericForm - Form for custom/generic portfolio items
 */

import React from 'react';
import { Calculator } from 'lucide-react';
import { Input } from '../../../../ui/Input';
import { CustomItem } from '../../../../../types';
import { ValuationConfigurator } from '../../components/ValuationConfigurator';
import { CategorySelector } from '../../components/CategorySelector';
import { formatCurrency } from '../../../../../utils/formatters';

interface GenericFormProps {
    newItem: Partial<CustomItem>;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    portfolioCurrency: string;
    categories: string[];
    onAddCategory: (cat: string) => void;
    // State
    unitPrice: string;
    quantityInput: string;
    // Handlers
    handleCurrencyChange: (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => void;
    setUnitPrice: React.Dispatch<React.SetStateAction<string>>;
    setQuantityInput: React.Dispatch<React.SetStateAction<string>>;
}

export const GenericForm: React.FC<GenericFormProps> = ({
    newItem,
    setNewItem,
    portfolioCurrency,
    categories,
    onAddCategory,
    unitPrice,
    quantityInput,
    handleCurrencyChange,
    setUnitPrice,
    setQuantityInput,
}) => {
    const formatBRL = (value: string | number) => {
        if (!value) return '';
        const stringVal = typeof value === 'number' ? value.toFixed(2) : value;
        const digits = stringVal.replace(/\D/g, '');
        const amount = Number(digits) / 100;
        return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const parseBRL = (value: string) => {
        if (!value) return 0;
        return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Input
                    label="Nome do Ativo"
                    placeholder="Ex: Colecao de Vinhos"
                    value={newItem.name || ''}
                    onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                />

                <CategorySelector
                    value={newItem.category || ''}
                    onChange={val => setNewItem(prev => ({ ...prev, category: val }))}
                    categories={categories}
                    onAddCategory={onAddCategory}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Input
                        label={`Valor de Aquisicao (${portfolioCurrency})`}
                        type="text"
                        placeholder="0,00"
                        value={unitPrice}
                        onChange={e => {
                            handleCurrencyChange(e.target.value, setUnitPrice);
                            const price = parseBRL(formatBRL(e.target.value));
                            const qty = parseFloat(quantityInput) || 1;
                            const total = price * qty;
                            setNewItem(prev => ({ ...prev, initialValue: total, value: total, quantity: qty }));
                        }}
                    />
                </div>
                <Input
                    label="Data de Aquisicao"
                    type="date"
                    value={newItem.initialDate ? newItem.initialDate.split('T')[0] : ''}
                    onChange={e => setNewItem(prev => ({ ...prev, initialDate: e.target.value }))}
                />
            </div>

            <div>
                <Input
                    label="Quantidade"
                    type="number"
                    step="any"
                    placeholder="1"
                    value={quantityInput}
                    onChange={e => {
                        setQuantityInput(e.target.value);
                        const qty = parseFloat(e.target.value) || 0;
                        const price = parseBRL(unitPrice);
                        const total = price * qty;
                        setNewItem(prev => ({ ...prev, initialValue: total, value: total, quantity: qty }));
                    }}
                />
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 text-zinc-400">
                    <Calculator size={14} />
                    <span className="text-xs font-medium uppercase">Custo de Aquisicao</span>
                </div>
                <span className="text-amber-500 font-mono font-bold">
                    {formatCurrency(newItem.initialValue || 0, portfolioCurrency)}
                </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Valorizacao do Ativo</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        Configure crescimento fixo ou indexado (CDI, IPCA, IBOV, S&P500, IFIX, IDIV, SMLL, IVVB11).
                    </p>
                </div>
                <ValuationConfigurator
                    method={newItem.valuationMethod || { type: 'manual' }}
                    onChange={m => setNewItem(prev => ({ ...prev, valuationMethod: m }))}
                    initialValue={newItem.initialValue || 0}
                    currency={portfolioCurrency}
                    initialDate={newItem.initialDate}
                    quantity={newItem.quantity || 1}
                />
            </div>
        </div>
    );
};
