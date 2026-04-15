/**
 * RealEstateForm - Form for real estate portfolio items
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, MapPin, Key, Banknote } from 'lucide-react';
import { Input } from '../../../../ui/Input';
import { CustomItem } from '../../../../../types';
import { ValuationConfigurator } from '../../components/ValuationConfigurator';

interface RealEstateFormProps {
    newItem: Partial<CustomItem>;
    setNewItem: React.Dispatch<React.SetStateAction<Partial<CustomItem>>>;
    portfolioCurrency: string;
    // State
    unitPrice: string;
    monthlyRent: string;
    condoFee: string;
    maintenance: string;
    propertyTax: string;
    insurance: string;
    propertyType: string;
    // Handlers
    handleCurrencyChange: (val: string, setter: React.Dispatch<React.SetStateAction<string>>) => void;
    handleCustomFieldChange: (key: string, value: any) => void;
    setUnitPrice: React.Dispatch<React.SetStateAction<string>>;
    setMonthlyRent: React.Dispatch<React.SetStateAction<string>>;
    setCondoFee: React.Dispatch<React.SetStateAction<string>>;
    setMaintenance: React.Dispatch<React.SetStateAction<string>>;
    setPropertyTax: React.Dispatch<React.SetStateAction<string>>;
    setInsurance: React.Dispatch<React.SetStateAction<string>>;
}

export const RealEstateForm: React.FC<RealEstateFormProps> = ({
    newItem,
    setNewItem,
    portfolioCurrency,
    unitPrice,
    monthlyRent,
    condoFee,
    maintenance,
    propertyTax,
    insurance,
    propertyType,
    handleCurrencyChange,
    handleCustomFieldChange,
    setUnitPrice,
    setMonthlyRent,
    setCondoFee,
    setMaintenance,
    setPropertyTax,
    setInsurance,
}) => {
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
            <Input
                label="Nome do Imóvel"
                placeholder="Ex: Apto Jardins, Sala Comercial 101"
                value={newItem.name || ''}
                onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
            />

            {/* 1. Property Type Selector */}
            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Tipo de Imóvel</label>
                <select
                    className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                    value={propertyType}
                    onChange={(e) => handleCustomFieldChange('propertyType', e.target.value)}
                >
                    <option value="" disabled>Selecione...</option>
                    <option value="Residencial">Residencial</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Terreno">Terreno</option>
                </select>
            </div>

            {/* 2. Property Subtype Selector (conditional) */}
            {propertyType && propertyType !== 'Terreno' && (
                <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Subtipo</label>
                    <select
                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                        value={String(newItem.customFields?.propertySubtype || '')}
                        onChange={(e) => handleCustomFieldChange('propertySubtype', e.target.value)}
                    >
                        <option value="" disabled>Selecione o subtipo...</option>
                        {propertyType === 'Residencial' && (
                            <>
                                <option value="Casa">Casa / Apartamento</option>
                                <option value="Prédio">Prédio (múltiplas unidades)</option>
                            </>
                        )}
                        {propertyType === 'Comercial' && (
                            <>
                                <option value="Unidade Única">Unidade Única (loja/sala)</option>
                                <option value="Conjunto">Conjunto (várias salas)</option>
                                <option value="Prédio Comercial">Prédio Comercial</option>
                            </>
                        )}
                    </select>
                </div>
            )}

            <AnimatePresence mode="wait">
                {propertyType && (
                    <motion.div
                        key={propertyType}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* 2. Details Block based on Type */}
                        <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <Home size={16} />
                                <span className="text-xs font-bold uppercase">Detalhes do {propertyType}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {propertyType === 'Terreno' && (
                                    <Input
                                        label="Subtipo"
                                        placeholder="Ex: Urbano/Rural"
                                        value={String(newItem.customFields?.subType || '')}
                                        onChange={(e) => handleCustomFieldChange('subType', e.target.value)}
                                    />
                                )}
                                {propertyType === 'Terreno' ? (
                                    <Input
                                        label="Área do Terreno (m²)"
                                        type="number"
                                        placeholder="Ex: 360"
                                        value={String(newItem.customFields?.landArea || '')}
                                        onChange={(e) => handleCustomFieldChange('landArea', e.target.value)}
                                    />
                                ) : (
                                    <Input
                                        label="Área Construída (m²)"
                                        type="number"
                                        placeholder="Ex: 120"
                                        value={String(newItem.customFields?.builtArea || '')}
                                        onChange={(e) => handleCustomFieldChange('builtArea', e.target.value)}
                                    />
                                )}
                                {propertyType !== 'Terreno' && (
                                    <Input
                                        label="Área do Terreno (m²) (Opcional)"
                                        type="number"
                                        placeholder="Ex: 360"
                                        value={String(newItem.customFields?.landArea || '')}
                                        onChange={(e) => handleCustomFieldChange('landArea', e.target.value)}
                                    />
                                )}
                            </div>

                            {/* Conditional Fields based on Subtype */}
                            {/* Residential Casa: bedrooms/bathrooms/parking */}
                            {propertyType === 'Residencial' && (!newItem.customFields?.propertySubtype || newItem.customFields?.propertySubtype === 'Casa') && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Input label="Quartos" type="number" placeholder="0" value={String(newItem.customFields?.bedrooms || '')} onChange={(e) => handleCustomFieldChange('bedrooms', e.target.value)} />
                                        <Input label="Banheiros" type="number" placeholder="0" value={String(newItem.customFields?.bathrooms || '')} onChange={(e) => handleCustomFieldChange('bathrooms', e.target.value)} />
                                        <Input label="Vagas" type="number" placeholder="0" value={String(newItem.customFields?.parking || '')} onChange={(e) => handleCustomFieldChange('parking', e.target.value)} />
                                    </div>
                                    <Input
                                        label="Ano de Construção"
                                        type="number"
                                        placeholder="Ex: 2015"
                                        value={String(newItem.customFields?.constructionYear || '')}
                                        onChange={(e) => handleCustomFieldChange('constructionYear', e.target.value)}
                                    />
                                </>
                            )}

                            {/* Residential Prédio: units */}
                            {propertyType === 'Residencial' && newItem.customFields?.propertySubtype === 'Prédio' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Total de Unidades" type="number" placeholder="Ex: 10" value={String(newItem.customFields?.unitsTotal || '')} onChange={(e) => handleCustomFieldChange('unitsTotal', e.target.value)} />
                                        <Input label="Unidades Alugadas" type="number" placeholder="Ex: 7" value={String(newItem.customFields?.unitsRented || '')} onChange={(e) => handleCustomFieldChange('unitsRented', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Vagas" type="number" placeholder="0" value={String(newItem.customFields?.parking || '')} onChange={(e) => handleCustomFieldChange('parking', e.target.value)} />
                                        <Input label="Ano de Construção" type="number" placeholder="Ex: 2010" value={String(newItem.customFields?.constructionYear || '')} onChange={(e) => handleCustomFieldChange('constructionYear', e.target.value)} />
                                    </div>
                                </>
                            )}

                            {/* Commercial Single: no units fields */}
                            {propertyType === 'Comercial' && (!newItem.customFields?.propertySubtype || newItem.customFields?.propertySubtype === 'Unidade Única') && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Vagas" type="number" placeholder="0" value={String(newItem.customFields?.parking || '')} onChange={(e) => handleCustomFieldChange('parking', e.target.value)} />
                                    <Input label="Ano de Construção" type="number" placeholder="Ex: 2010" value={String(newItem.customFields?.constructionYear || '')} onChange={(e) => handleCustomFieldChange('constructionYear', e.target.value)} />
                                </div>
                            )}

                            {/* Commercial Multi-unit: units fields */}
                            {propertyType === 'Comercial' && (newItem.customFields?.propertySubtype === 'Conjunto' || newItem.customFields?.propertySubtype === 'Prédio Comercial') && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Total de Salas / Unidades" type="number" placeholder="1" value={String(newItem.customFields?.unitsTotal || newItem.customFields?.totalUnits || '')} onChange={(e) => handleCustomFieldChange('unitsTotal', e.target.value)} />
                                        <Input label="Unidades Alugadas" type="number" placeholder="0" value={String(newItem.customFields?.unitsRented || newItem.customFields?.rentedUnits || '')} onChange={(e) => handleCustomFieldChange('unitsRented', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Vagas" type="number" placeholder="0" value={String(newItem.customFields?.parking || '')} onChange={(e) => handleCustomFieldChange('parking', e.target.value)} />
                                        <Input label="Ano de Construção" type="number" placeholder="Ex: 2010" value={String(newItem.customFields?.constructionYear || '')} onChange={(e) => handleCustomFieldChange('constructionYear', e.target.value)} />
                                    </div>
                                </>
                            )}

                            {propertyType === 'Terreno' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Zoneamento" placeholder="Ex: ZM" value={String(newItem.customFields?.zoning || '')} onChange={(e) => handleCustomFieldChange('zoning', e.target.value)} />
                                    <Input label="Topografia" placeholder="Ex: Plano" value={String(newItem.customFields?.topography || '')} onChange={(e) => handleCustomFieldChange('topography', e.target.value)} />
                                </div>
                            )}

                            <Input
                                label="Endereço Completo"
                                placeholder="Rua, Número, Bairro, Cidade - UF"
                                icon={<MapPin size={14} />}
                                value={String(newItem.customFields?.address || '')}
                                onChange={(e) => handleCustomFieldChange('address', e.target.value)}
                            />
                        </div>

                        {/* 3. Status & Income */}
                        <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-4">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <Key size={16} />
                                <span className="text-xs font-bold uppercase">Situação & Fluxo</span>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Status de Ocupação</label>
                                <select
                                    className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500"
                                    value={String(newItem.customFields?.occupancyStatus || 'Vago')}
                                    onChange={(e) => handleCustomFieldChange('occupancyStatus', e.target.value)}
                                >
                                    <option value="Alugado">Alugado</option>
                                    <option value="Parcialmente alugado">Parcialmente alugado</option>
                                    <option value="Vago">Vago</option>
                                    <option value="Uso Próprio">Uso Próprio</option>
                                    <option value="Reformando">Em Reforma</option>
                                    <option value="Em negociação">Em Negociação</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <Input
                                    label={`Renda Mensal (${portfolioCurrency})`}
                                    placeholder="0,00"
                                    value={monthlyRent}
                                    onChange={(e) => handleCurrencyChange(e.target.value, setMonthlyRent)}
                                    disabled={!['Alugado', 'Parcialmente alugado'].includes(String(newItem.customFields?.occupancyStatus || ''))}
                                    className={!['Alugado', 'Parcialmente alugado'].includes(String(newItem.customFields?.occupancyStatus || '')) ? 'opacity-50' : ''}
                                    icon={<Banknote size={14} />}
                                />
                                {['Alugado', 'Parcialmente alugado'].includes(String(newItem.customFields?.occupancyStatus || '')) && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                        <Input
                                            label="Renda Efetiva Desde"
                                            type="date"
                                            value={String(newItem.customFields?.rentIncomeEffectiveFrom || new Date().toISOString().slice(0, 10))}
                                            onChange={(e) => handleCustomFieldChange('rentIncomeEffectiveFrom', e.target.value)}
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-1 ml-1">
                                            Padrão: hoje. Retroagir gerará histórico de renda no planejamento.
                                        </p>
                                    </div>
                                )}
                                <p className="text-[10px] text-zinc-500 -mt-2">Se vago, a renda considerada para métricas será R$ 0,00.</p>
                            </div>

                            <div className="border-t border-zinc-800/50 pt-4">
                                <label className="block text-xs font-medium text-zinc-400 mb-3 ml-1">Custos Mensais</label>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <Input label="Condomínio" placeholder="0,00" value={condoFee} onChange={(e) => handleCurrencyChange(e.target.value, setCondoFee)} />
                                    <Input label="Manutenção Média" placeholder="0,00" value={maintenance} onChange={(e) => handleCurrencyChange(e.target.value, setMaintenance)} />
                                </div>

                                <label className="block text-xs font-medium text-zinc-400 mb-3 ml-1">Custos Anuais</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="IPTU Total (Anual)" placeholder="0,00" value={propertyTax} onChange={(e) => handleCurrencyChange(e.target.value, setPropertyTax)} />
                                    <Input label="Seguro Incêndio (Anual)" placeholder="0,00" value={insurance} onChange={(e) => handleCurrencyChange(e.target.value, setInsurance)} />
                                </div>
                            </div>
                        </div>

                        {/* 4. Acquisition Value */}
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={`Valor de Mercado (${portfolioCurrency})`}
                                type="text"
                                placeholder="0,00"
                                value={unitPrice}
                                onChange={e => {
                                    handleCurrencyChange(e.target.value, setUnitPrice);
                                    const price = parseBRL(formatBRL(e.target.value));
                                    setNewItem(prev => ({ ...prev, initialValue: price, value: price, quantity: 1 }));
                                }}
                            />
                            <Input
                                label="Data de Aquisição"
                                type="date"
                                value={newItem.initialDate ? newItem.initialDate.split('T')[0] : ''}
                                onChange={e => setNewItem(prev => ({ ...prev, initialDate: e.target.value }))}
                            />
                        </div>

                        {/* Valuation Section */}
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Valorizacao do Imovel</p>
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


