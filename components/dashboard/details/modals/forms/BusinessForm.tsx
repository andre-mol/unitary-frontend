/**
 * BusinessForm - Form for business portfolio items
 */

import React from 'react';
import { Hash, Calculator } from 'lucide-react';
import { Input } from '../../../../ui/Input';
import { CustomItem } from '../../../../../types';
import { ValuationConfigurator } from '../../components/ValuationConfigurator';
import { formatCurrency } from '../../../../../utils/formatters';

interface BusinessFormProps {
    newItem: Partial<CustomItem>;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    portfolioCurrency: string;
    unitPrice: string;
    structureType: string;
    handleCurrencyChange: (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => void;
    handleCustomFieldChange: (key: string, value: any) => void;
    setUnitPrice: React.Dispatch<React.SetStateAction<string>>;
    parseBRL: (value: string) => number;
}

export const BusinessForm: React.FC<BusinessFormProps> = ({
    newItem,
    setNewItem,
    portfolioCurrency,
    unitPrice,
    structureType,
    handleCurrencyChange,
    handleCustomFieldChange,
    setUnitPrice,
    parseBRL,
}) => {
    return (
        <div className="space-y-6">
            <Input
                label="Nome da Empresa"
                placeholder="Ex: Holding Familiar, Tech Startup Ltda"
                value={newItem.name || ''}
                onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
            />

            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Tipo de Estrutura</label>
                <select
                    className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                    value={structureType}
                    onChange={(e) => handleCustomFieldChange('structureType', e.target.value)}
                >
                    <option value="" disabled>Selecione...</option>
                    <option value="Holding">Holding Patrimonial</option>
                    <option value="Operacional">Empresa Operacional</option>
                    <option value="Participacao">Participacao Minoritaria</option>
                    <option value="Equity">Private Equity / Venture</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="CNPJ (Opcional)"
                    placeholder="00.000.000/0001-00"
                    icon={<Hash size={14} />}
                    value={String(newItem.customFields?.cnpj ?? '')}
                    onChange={(e) => handleCustomFieldChange('cnpj', e.target.value)}
                />
                <Input
                    label="Papel / Participacao"
                    placeholder="Ex: Socio Majoritario"
                    value={String(newItem.customFields?.role ?? '')}
                    onChange={(e) => handleCustomFieldChange('role', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="% de Participacao"
                    type="number"
                    placeholder="100"
                    value={String(newItem.customFields?.ownershipPercentage ?? '')}
                    onChange={(e) => handleCustomFieldChange('ownershipPercentage', e.target.value)}
                    icon={<span className="text-zinc-500 text-xs font-bold">%</span>}
                />
                <Input
                    label="Data de Aquisicao / Constituicao"
                    type="date"
                    value={newItem.initialDate ? newItem.initialDate.split('T')[0] : ''}
                    onChange={e => setNewItem(prev => ({ ...prev, initialDate: e.target.value }))}
                />
            </div>

            <div className="grid grid-cols-1 gap-4">
                <Input
                    label={`Capital Investido / Custo de Aquisicao (${portfolioCurrency})`}
                    type="text"
                    placeholder="0,00"
                    value={unitPrice}
                    onChange={e => handleCurrencyChange(e.target.value, setUnitPrice)}
                />
                <Input
                    label={`Valor atual da empresa (opcional) (${portfolioCurrency})`}
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={String(newItem.customFields?.companyCurrentValue ?? '')}
                    onChange={(e) => handleCustomFieldChange('companyCurrentValue', e.target.value)}
                />
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Periodicidade de acompanhamento</label>
                    <select
                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                        value={String(newItem.customFields?.reportingFrequency ?? 'monthly')}
                        onChange={(e) => handleCustomFieldChange('reportingFrequency', e.target.value)}
                    >
                        <option value="monthly">Mensal</option>
                        <option value="quarterly">Trimestral</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 text-zinc-400">
                    <Calculator size={14} />
                    <span className="text-xs font-medium uppercase">Investimento Inicial</span>
                </div>
                <span className="text-amber-500 font-mono font-bold">
                    {formatCurrency(parseBRL(unitPrice), portfolioCurrency)}
                </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Valorizacao da Empresa</p>
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
