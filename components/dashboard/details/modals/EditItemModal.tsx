import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Info, Calendar, DollarSign, PenTool, Save } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { CustomItem } from '../../../../types';
import { formatCurrency } from '../../../../utils/formatters';
import { ValuationConfigurator } from '../components/ValuationConfigurator';

interface EditItemModalProps {
    item: CustomItem; // The item being edited
    type: string;     // Portfolio type (e.g., 'investments', 'custom')
    onClose: () => void;
    onSave: (item: CustomItem) => void;
    onDeleteRequest: () => void;
    setItem: (item: CustomItem) => void;
    onManualUpdate?: (val: number, date: string) => void; // Optional, kept for compatibility
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
    item, type, onClose, onSave, onDeleteRequest, setItem
}) => {
    // -------------------------------------------------------------------------
    // 1. CALCULATE BASE LOT (The specific "Entry" we want to edit)
    // -------------------------------------------------------------------------
    // The 'item' represents the aggregated asset.
    // 'item.quantity' is TOTAL quantity.
    // We want to edit the INITIAL (Base) quantity.
    // Base Qty = Total Qty - Sum(Transaction Deltas)

    const transactionNetQty = useMemo(() => {
        return (item.transactions || []).reduce((acc, t) => {
            return acc + (t.type === 'buy' ? t.quantity : -t.quantity);
        }, 0);
    }, [item.transactions]);

    const baseQuantityRaw = Math.max(0, (item.quantity || 0) - transactionNetQty);

    // -------------------------------------------------------------------------
    // 2. FORM STATE
    // -------------------------------------------------------------------------
    // We pre-fill with the "Base" values.
    const displayTicker = String(item.name || item.customFields?.ticker || 'Sem ticker');
    const customLogoUrl = String((item.customFields as any)?.logo || '').trim();
    const tickerForLogo = displayTicker.replace(/\.SA$/i, '').trim().toUpperCase();
    const fallbackLogoUrl = tickerForLogo ? `https://icons.brapi.dev/icons/${tickerForLogo}.svg` : '';
    const logoCandidates = [customLogoUrl, fallbackLogoUrl].filter((value, index, list) => value && list.indexOf(value) === index);
    const [logoIndex, setLogoIndex] = useState(0);

    useEffect(() => {
        setLogoIndex(0);
    }, [customLogoUrl, fallbackLogoUrl, displayTicker]);

    // Date (Initial Date)
    const [date, setDate] = useState(item.initialDate ? item.initialDate.split('T')[0] : new Date().toISOString().split('T')[0]);

    // Quantity (Base)
    const [quantity, setQuantity] = useState<string>(String(baseQuantityRaw));

    // Unit Price (Base)
    // If baseQty > 0, InitialVal / BaseQty. Else 0.
    const initialUnitPrice = baseQuantityRaw > 0 ? (item.initialValue / baseQuantityRaw) : 0;
    const [unitPrice, setUnitPrice] = useState<string>(initialUnitPrice > 0 ? initialUnitPrice.toFixed(2) : '');

    // Total Value (Derived for Display)
    const [totalValue, setTotalValue] = useState<string>(String(item.initialValue.toFixed(2)));
    const isRealEstate = type === 'real_estate';
    const isBusiness = type === 'business';
    const isCustom = type === 'custom';
    const showValuationEditor = isRealEstate || isBusiness || isCustom;
    const [occupancyStatus, setOccupancyStatus] = useState<string>(String(item.customFields?.occupancyStatus || 'Vago'));
    const [monthlyRent, setMonthlyRent] = useState<string>(String(item.customFields?.monthlyRent || ''));
    const [condoFee, setCondoFee] = useState<string>(String(item.customFields?.condoFee || ''));
    const [maintenance, setMaintenance] = useState<string>(String(item.customFields?.maintenance || ''));
    const [propertyTax, setPropertyTax] = useState<string>(String(item.customFields?.propertyTax || ''));
    const [insurance, setInsurance] = useState<string>(String(item.customFields?.insurance || ''));
    const [valuationMethod, setValuationMethod] = useState(item.valuationMethod || { type: 'manual' as const });

    useEffect(() => {
        setValuationMethod(item.valuationMethod || { type: 'manual' });
    }, [item.id, item.valuationMethod]);

    // -------------------------------------------------------------------------
    // 3. EFFECTS
    // -------------------------------------------------------------------------

    // Auto-calculate Total Value when Price or Qty changes
    useEffect(() => {
        const q = parseFloat(quantity) || 0;
        const p = parseFloat(unitPrice) || 0;
        setTotalValue((q * p).toFixed(2));
    }, [quantity, unitPrice]);

    // -------------------------------------------------------------------------
    // 4. HANDLERS
    // -------------------------------------------------------------------------

    const handleSave = () => {
        const finalBaseQty = parseFloat(quantity) || 0;
        const finalUnitPrice = parseFloat(unitPrice) || 0;
        const finalTotalValue = finalBaseQty * finalUnitPrice;

        // Reconstruct the item with updated Base properties
        const newItem: CustomItem = {
            ...item,
            initialDate: date,
            initialValue: finalTotalValue,
            valuationMethod,
            // Recalculate TOTAL Quantity
            quantity: finalBaseQty + transactionNetQty,
            customFields: {
                ...item.customFields,
                ...(isRealEstate ? {
                    occupancyStatus,
                    monthlyRent: ['Alugado', 'Parcialmente alugado'].includes(occupancyStatus) ? (parseFloat(monthlyRent) || 0) : 0,
                    condoFee: parseFloat(condoFee) || 0,
                    maintenance: parseFloat(maintenance) || 0,
                    propertyTax: parseFloat(propertyTax) || 0,
                    insurance: parseFloat(insurance) || 0,
                } : {})
            }
        };

        // For manual assets, usually Value matches Initial Value if no market data
        // We update 'value' to keep it consistent if it's not a market asset
        if (!item.market_asset_id) {
            newItem.value = finalTotalValue;
        }

        onSave(newItem);
        onClose();
    };

    const isFormValid = date && quantity && unitPrice;

    // -------------------------------------------------------------------------
    // 5. RENDER
    // -------------------------------------------------------------------------
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[90vh] shadow-2xl p-6 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500">
                            <PenTool size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">{isRealEstate ? 'Editar Ativo' : 'Editar Lançamento'}</h3>
                            <p className="text-zinc-500 text-xs">
                                {isRealEstate ? 'Ajuste dados base e parâmetros de aluguel do imóvel.' : 'Ajuste os dados da entrada original (Lote Base).'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                    {/* Identification */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                        <div className="grid grid-cols-[64px_1fr] gap-4">
                            <div className="h-16 w-16 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 flex items-center justify-center overflow-hidden">
                                {logoCandidates[logoIndex] ? (
                                    <img
                                        src={logoCandidates[logoIndex]}
                                        alt={`Logo ${displayTicker}`}
                                        className="h-10 w-10 rounded-md object-contain"
                                        onError={() => setLogoIndex((current) => current + 1)}
                                    />
                                ) : (
                                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">Logo</span>
                                )}
                            </div>

                            <div>
                                <p className="mb-1.5 ml-1 text-xs font-medium text-zinc-400">Ticker / Código</p>
                                <div className="h-[42px] rounded-lg border border-zinc-800 bg-zinc-900 px-3 flex items-center text-zinc-100 font-medium">
                                    {displayTicker}
                                </div>
                            </div>
                        </div>
                    </div>

                    {isRealEstate && (
                        <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                <Calendar size={14} /> Aluguel e Custos
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Status de Ocupação</label>
                                <select
                                    className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500"
                                    value={occupancyStatus}
                                    onChange={(e) => setOccupancyStatus(e.target.value)}
                                >
                                    <option value="Alugado">Alugado</option>
                                    <option value="Parcialmente alugado">Parcialmente alugado</option>
                                    <option value="Vago">Vago</option>
                                    <option value="Uso Próprio">Uso Próprio</option>
                                    <option value="Reformando">Em Reforma</option>
                                    <option value="Em negociação">Em Negociação</option>
                                </select>
                            </div>

                            <Input
                                label={`Aluguel Mensal (${item.currency})`}
                                type="number"
                                step="any"
                                value={monthlyRent}
                                onChange={(e) => setMonthlyRent(e.target.value)}
                                disabled={!['Alugado', 'Parcialmente alugado'].includes(occupancyStatus)}
                                className={!['Alugado', 'Parcialmente alugado'].includes(occupancyStatus) ? 'opacity-50' : ''}
                                icon={<DollarSign size={14} />}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Condomínio (Mensal)"
                                    type="number"
                                    step="any"
                                    value={condoFee}
                                    onChange={(e) => setCondoFee(e.target.value)}
                                />
                                <Input
                                    label="Manutenção (Mensal)"
                                    type="number"
                                    step="any"
                                    value={maintenance}
                                    onChange={(e) => setMaintenance(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="IPTU (Anual)"
                                    type="number"
                                    step="any"
                                    value={propertyTax}
                                    onChange={(e) => setPropertyTax(e.target.value)}
                                />
                                <Input
                                    label="Seguro (Anual)"
                                    type="number"
                                    step="any"
                                    value={insurance}
                                    onChange={(e) => setInsurance(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Transaction Details */}
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                            <Calendar size={14} /> Dados da Transação
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Data da Aquisição"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                            <Input
                                label="Quantidade (Base)"
                                type="number"
                                step="any"
                                value={String(quantity)}
                                onChange={e => setQuantity(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Preço Unitário"
                                type="number"
                                step="any"
                                value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                                icon={<DollarSign size={14} />}
                            />
                            <div className="flex flex-col justify-end">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 h-[42px] flex items-center justify-between">
                                    <span className="text-xs text-zinc-500 uppercase">Total:</span>
                                    <span className="text-amber-500 font-bold font-mono">
                                        {formatCurrency(parseFloat(totalValue) || 0, item.currency)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {showValuationEditor && (
                        <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                <PenTool size={14} /> Valorizacao
                            </div>
                            <ValuationConfigurator
                                method={valuationMethod}
                                onChange={setValuationMethod}
                                initialValue={parseFloat(totalValue) || item.initialValue || 0}
                                currency={item.currency}
                                initialDate={date}
                                currentValue={item.value}
                                quantity={parseFloat(quantity) || 1}
                            />
                        </div>
                    )}

                    {/* Transaction Net Quantity Info */}
                    {transactionNetQty !== 0 && (
                        <div className="flex items-start gap-2 bg-blue-500/10 text-blue-400 p-3 rounded-lg text-xs border border-blue-500/20">
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <p>
                                Existem <strong>{transactionNetQty}</strong> unidades adicionadas via outras movimentações.
                                O total final do ativo será de <strong>{((parseFloat(quantity) || 0) + transactionNetQty)}</strong>.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-800 shrink-0">
                    <button
                        onClick={onDeleteRequest}
                        className="text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={16} /> Excluir Ativo
                    </button>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={!isFormValid}
                        >
                            <Save size={16} className="mr-2" /> Salvar Alterações
                        </Button>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

