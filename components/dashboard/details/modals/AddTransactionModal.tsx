
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Calculator, ChevronDown, Check, TrendingUp, TrendingDown, Search, RefreshCw, Key, Building, DollarSign, Calendar, AlertTriangle, Briefcase, Coins, FileText, PieChart } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { CustomItem, Transaction } from '../../../../types';
import { formatCurrency } from '../../../../utils/formatters';
import { portfolioService } from '../../../../lib/portfolioService';

interface AddTransactionModalProps {
    items: CustomItem[];
    currency: string;
    type: string; // 'real_estate' | 'investments' | 'business' | 'custom'
    onClose: () => void;
    onSave: (assetId: string, transaction: any) => void;
    initialAssetId?: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
    items, currency, type, onClose, onSave, initialAssetId
}) => {
    // Top Level Tabs
    const [activeTab, setActiveTab] = useState<'patrimonial' | 'operational'>('patrimonial');

    // General States
    const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
    const [isPriceUpdate, setIsPriceUpdate] = useState(false); // Toggle state for Patrimonial

    // Operational States
    const [rentAction, setRentAction] = useState<'start' | 'end'>('start'); // RE Toggle
    const [businessAction, setBusinessAction] = useState<'profit_report' | 'distribution' | 'capital_call'>('profit_report'); // Business Toggle
    const [dividendAction, setDividendAction] = useState<'dividend' | 'jcp'>('dividend'); // Investment Toggle

    const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAssetId || '');
    const initialItem = items.find(i => i.id === initialAssetId);
    const [searchQuery, setSearchQuery] = useState(initialItem?.name || '');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Form States
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [quantity, setQuantity] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [totalValue, setTotalValue] = useState(''); // For Rent/Profit Amount
    const [observation, setObservation] = useState('');
    const [periodInput, setPeriodInput] = useState(''); // Legacy free period label
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [businessRevenue, setBusinessRevenue] = useState('');
    const [businessGrossProfit, setBusinessGrossProfit] = useState('');
    const [businessNetProfit, setBusinessNetProfit] = useState('');
    const [distributionTotalCompany, setDistributionTotalCompany] = useState('');

    // Real Estate Contract States
    const [rentIndexer, setRentIndexer] = useState('IGP-M');
    const [adjustmentMonth, setAdjustmentMonth] = useState('');
    const [closeRentOnSale, setCloseRentOnSale] = useState(true);

    // Retroactive Wizard State
    const [showRetroactiveOptions, setShowRetroactiveOptions] = useState(false);
    const [retroactiveMode, setRetroactiveMode] = useState<'ignore' | 'generate'>('ignore');
    const [retroactiveStatus, setRetroactiveStatus] = useState<'received' | 'expected'>('received');

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter items based on search
    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const selectedAsset = useMemo(() => items.find(i => i.id === selectedAssetId), [items, selectedAssetId]);

    const isBusiness = type === 'business';
    const isRealEstate = type === 'real_estate';
    const isInvestments = type === 'investments';
    const showOperationalTab = !isInvestments;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Effect: Update Quantity/Inputs based on modes
    useEffect(() => {
        if (isPriceUpdate) {
            setQuantity('0');
        } else if (activeTab === 'patrimonial') {
            if (isBusiness) {
                setQuantity('0');
            } else {
                setQuantity('');
            }
        }

        // Reset when switching main tabs
        if (activeTab === 'operational') {
            setQuantity('0');
        }
    }, [isPriceUpdate, activeTab, isBusiness]);

    // Calculate Total for Patrimonial
    const calculatedTotal = useMemo(() => {
        if (activeTab === 'operational') return 0;

        const price = parseFloat(unitPrice) || 0;

        if (isPriceUpdate && selectedAsset) {
            if (isBusiness) return price;
            return price * (selectedAsset.quantity || 0);
        } else {
            if (isBusiness) return price;
            const qty = parseFloat(quantity) || 0;
            return price * qty;
        }
    }, [quantity, unitPrice, isPriceUpdate, selectedAsset, activeTab, isBusiness]);

    const handleSaveClick = () => {
        if (!selectedAssetId) return;

        // RETROACTIVE CHECK INTERCEPTION (Only for Rent Start)
        if (activeTab === 'operational' && isRealEstate && rentAction === 'start') {
            const inputDate = new Date(date);
            const today = new Date();
            inputDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            if (inputDate < today && !showRetroactiveOptions) {
                setShowRetroactiveOptions(true);
                return;
            }
        }

        executeSave();
    };

    const executeSave = () => {
        if (activeTab === 'operational') {
            const val = parseFloat(totalValue) || 0;

            if (isRealEstate) {
                if (rentAction === 'start' && !totalValue) return;
                const finalObservation = observation || (rentAction === 'start' ? 'InÃ­cio de Aluguel' : 'Fim de Aluguel');

                onSave(selectedAssetId, {
                    type: rentAction === 'start' ? 'rent_start' : 'rent_end',
                    date,
                    quantity: 1, // Dummy qty
                    unitPrice: val,
                    totalValue: val,
                    observation: finalObservation,
                    rentIndexer,
                    rentAdjustmentMonth: adjustmentMonth,
                    retroactive: showRetroactiveOptions && retroactiveMode === 'generate' ? {
                        status: retroactiveStatus,
                        startDate: date
                    } : null
                });
            } else if (isBusiness) {
                if (businessAction === 'profit_report' && !businessNetProfit) return;
                if (businessAction !== 'profit_report' && !totalValue) return;
                const amountToUser = parseFloat(totalValue) || 0;
                const amountTotalCompany = parseFloat(distributionTotalCompany) || 0;
                const revenue = parseFloat(businessRevenue) || 0;
                const grossProfit = parseFloat(businessGrossProfit) || 0;
                const netProfit = parseFloat(businessNetProfit) || 0;
                onSave(selectedAssetId, {
                    type: businessAction,
                    date,
                    quantity: 0,
                    unitPrice: 0,
                    totalValue: businessAction === 'profit_report' ? netProfit : amountToUser,
                    observation: observation || (
                        businessAction === 'profit_report'
                            ? 'Resultado do perí­odo'
                            : businessAction === 'distribution'
                                ? 'Distribuição de lucro ao sócio'
                                : 'Aporte adicional'
                    ),
                    period: periodInput || undefined,
                    periodStart: periodStart || undefined,
                    periodEnd: periodEnd || undefined,
                    payload: businessAction === 'profit_report'
                        ? { revenue, gross_profit: grossProfit, net_profit: netProfit }
                        : businessAction === 'distribution'
                            ? { amount_to_user: amountToUser, amount_total_company: amountTotalCompany || undefined }
                            : { amount: amountToUser }
                });
            } else if (isInvestments) {
                // Dividends Logic
                if (!totalValue) return;
                onSave(selectedAssetId, {
                    type: dividendAction, // 'dividend' or 'jcp'
                    date, // Payment Date
                    quantity: 0,
                    unitPrice: 0, // Could be per-share, but user inputs total for MVP
                    totalValue: val,
                    observation: observation || (dividendAction === 'dividend' ? 'Pagamento de Dividendos' : 'Pagamento de JCP')
                });
            }

        } else {
            // --- PATRIMONIAL LOGIC ---
            if (!unitPrice) return;
            if (!isPriceUpdate && !isBusiness && !quantity) return;

            const finalQty = isBusiness || isPriceUpdate ? 0 : parseFloat(quantity);
            const finalUnitPrice = parseFloat(unitPrice);
            const finalTotal = isBusiness ? parseFloat(unitPrice) : calculatedTotal;

            onSave(selectedAssetId, {
                type: isPriceUpdate ? (isBusiness ? 'valuation_update' : 'manual_update') : transactionType,
                date,
                quantity: finalQty,
                unitPrice: finalUnitPrice,
                totalValue: finalTotal,
                observation: isPriceUpdate && !observation ? 'Atualização de valuation' : observation,
                closeRent: (transactionType === 'sell' && closeRentOnSale)
            });
        }
        onClose();
    };

    const handleSelectAsset = (item: CustomItem) => {
        setSelectedAssetId(item.id);
        setSearchQuery(item.name);
        setIsDropdownOpen(false);

        // Prefill logic
        if (activeTab === 'patrimonial') {
            if (isBusiness) {
                setUnitPrice(item.value.toFixed(2));
            } else {
                const currentUnitPrice = item.quantity ? (item.value / item.quantity) : 0;
                if (currentUnitPrice > 0 && !unitPrice) {
                    setUnitPrice(currentUnitPrice.toFixed(2));
                }
            }
        } else {
            if (isRealEstate && item.customFields?.monthlyRent) {
                setTotalValue(String(item.customFields.monthlyRent));
            }
        }
    };

    // Trigger pre-fill on mount if initialAssetId exists
    useEffect(() => {
        if (initialAssetId && items.length > 0) {
            const item = items.find(i => i.id === initialAssetId);
            if (item) {
                handleSelectAsset(item);
            }
        }
    }, [initialAssetId, items]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl p-6 overflow-y-auto max-h-[90vh]"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-lg">
                        Adicionar Lançamento
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                {/* --- TAB SELECTOR (RE, Business & Investments) --- */}
                <div className="flex bg-zinc-950 p-1 rounded-lg mb-6 border border-zinc-800">
                    <button
                        onClick={() => setActiveTab('patrimonial')}
                        className={`py-2 text-sm font-medium rounded-md transition-all ${showOperationalTab ? 'flex-1' : 'w-full'} ${activeTab === 'patrimonial' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        {isBusiness ? 'Estrutura / Equity' : 'Evento Patrimonial'}
                    </button>
                    {showOperationalTab && (
                        <button
                            onClick={() => setActiveTab('operational')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'operational' ? (isBusiness ? 'bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/20' : 'bg-blue-500/20 text-blue-400 shadow-sm border border-blue-500/20') : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {isBusiness ? 'Resultados / Proventos' : 'Evento Operacional'}
                        </button>
                    )}
                </div>

                {/* ASSET SELECTOR (Common) */}
                <div className="mb-6 relative" ref={dropdownRef}>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">
                        {isBusiness ? "Empresa" : "Ativo"}
                    </label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder={items.length === 0 ? "Nenhum ativo cadastrado" : "Buscar..."}
                            className={`w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 pl-10 pr-10 focus:outline-none focus:border-amber-500 transition-all placeholder-zinc-600 ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsDropdownOpen(true);
                                if (!e.target.value) setSelectedAssetId('');
                            }}
                            onFocus={() => items.length > 0 && setIsDropdownOpen(true)}
                            disabled={items.length === 0}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>

                    <AnimatePresence>
                        {isDropdownOpen && items.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute z-50 left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar"
                            >
                                {filteredItems.length > 0 ? (
                                    filteredItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectAsset(item)}
                                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800/30 last:border-0 flex justify-between items-center"
                                        >
                                            <span>{item.name}</span>
                                            {selectedAssetId === item.id && <Check size={14} className="text-amber-500" />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-zinc-500 italic">Nenhum ativo encontrado.</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- FORM CONTENT --- */}

                {/* 1. PATRIMONIAL FORM */}
                {activeTab === 'patrimonial' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Type Switcher */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-sm text-zinc-400">
                                {isBusiness ? 'Apenas atualizar valuation?' : 'Apenas atualizar preço?'}
                            </span>
                            <button
                                onClick={() => setIsPriceUpdate(!isPriceUpdate)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${isPriceUpdate ? 'bg-amber-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isPriceUpdate ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {!isPriceUpdate && (
                            <div className="bg-zinc-950 p-1 rounded-lg flex mb-4 border border-zinc-800 overflow-hidden">
                                <button
                                    onClick={() => setTransactionType('buy')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${transactionType === 'buy'
                                        ? 'bg-green-500/10 text-green-500 shadow-sm border border-green-500/20'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {isBusiness ? <Coins size={16} /> : <TrendingUp size={16} />}
                                    {isBusiness ? 'Aporte de Capital' : 'Compra'}
                                </button>
                                <button
                                    onClick={() => setTransactionType('sell')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${transactionType === 'sell'
                                        ? 'bg-red-500/10 text-red-500 shadow-sm border border-red-500/20'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {isBusiness ? <FileText size={16} /> : <TrendingDown size={16} />}
                                    {isBusiness ? 'Venda / Diluição' : 'Venda'}
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Data"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                            {!isBusiness && (
                                <div className={`transition-opacity duration-300 ${isPriceUpdate ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <Input
                                        label="Quantidade"
                                        type="number"
                                        step="any"
                                        placeholder={isPriceUpdate ? "Mantida" : "0"}
                                        value={isPriceUpdate ? (selectedAsset?.quantity?.toString() || '-') : quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        disabled={isPriceUpdate}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={isBusiness
                                    ? (isPriceUpdate ? `Novo Valuation Total (${currency})` : `Valor do Evento (${currency})`)
                                    : `Preço Unitário (${currency})`
                                }
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                            />
                            <div className="flex items-center justify-end p-2 bg-zinc-950 border border-zinc-800 rounded-lg h-[50px] self-end">
                                <div className="text-right px-2 w-full">
                                    <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">
                                        {isBusiness ? 'Valor Final' : 'Total Estimado'}
                                    </span>
                                    <span className={`font-mono font-bold text-sm ${isPriceUpdate ? 'text-amber-500' : 'text-white'}`}>
                                        {formatCurrency(calculatedTotal, currency)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {transactionType === 'sell' && selectedAsset?.customFields?.occupancyStatus === 'Alugado' && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col gap-2">
                                <div className="flex gap-2 items-center text-red-400 font-bold text-xs">
                                    <AlertTriangle size={14} /> Imóvel Alugado
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={closeRentOnSale}
                                        onChange={(e) => setCloseRentOnSale(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="text-xs text-zinc-300">Encerrar aluguel automaticamente nesta data?</span>
                                </label>
                            </div>
                        )}

                        <Input
                            label="Observação (Opcional)"
                            placeholder={isPriceUpdate ? "Ex: Marcação a mercado" : "Ex: Aporte mensal"}
                            value={observation}
                            onChange={e => setObservation(e.target.value)}
                        />
                    </div>
                )}

                {/* 2. OPERATIONAL FORM */}
                {activeTab === 'operational' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">

                        {isBusiness ? (
                            <>
                                <div className="bg-zinc-950 p-1 rounded-lg flex mb-4 border border-zinc-800 overflow-hidden">
                                    <button
                                        onClick={() => setBusinessAction('profit_report')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${businessAction === 'profit_report'
                                            ? 'bg-emerald-500/10 text-emerald-500 shadow-sm border border-emerald-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <TrendingUp size={16} /> Resultado
                                    </button>
                                    <button
                                        onClick={() => setBusinessAction('distribution')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${businessAction === 'distribution'
                                            ? 'bg-blue-500/10 text-blue-500 shadow-sm border border-blue-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <PieChart size={16} /> Distribuição
                                    </button>
                                    <button
                                        onClick={() => setBusinessAction('capital_call')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${businessAction === 'capital_call'
                                            ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <Coins size={16} /> Aporte
                                    </button>
                                </div>

                                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg mb-2">
                                    <div className="flex gap-2 items-start">
                                        <AlertTriangle size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-zinc-400">
                                            {businessAction === 'profit_report'
                                                ? 'Resultado é valor informado (receita, lucro bruto e lucro líquido).'
                                                : businessAction === 'distribution'
                                                    ? 'Distribuição é caixa real recebido pelo sócio.'
                                                    : 'Aporte aumenta o capital investido da participação.'}
                                        </p>
                                    </div>
                                </div>

                                {businessAction === 'profit_report' ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Período início (opcional)"
                                                type="date"
                                                value={periodStart}
                                                onChange={e => setPeriodStart(e.target.value)}
                                            />
                                            <Input
                                                label="Período fim (opcional)"
                                                type="date"
                                                value={periodEnd}
                                                onChange={e => setPeriodEnd(e.target.value)}
                                            />
                                        </div>
                                        <Input
                                            label="Rótulo do período (opcional)"
                                            type="text"
                                            placeholder="Ex: Jan/2026 ou 1T 2026"
                                            value={periodInput}
                                            onChange={e => setPeriodInput(e.target.value)}
                                        />
                                        <div className="grid grid-cols-3 gap-4">
                                            <Input
                                                label={`Receita (${currency})`}
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={businessRevenue}
                                                onChange={e => setBusinessRevenue(e.target.value)}
                                                icon={<DollarSign size={14} />}
                                            />
                                            <Input
                                                label={`Lucro Bruto (${currency})`}
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={businessGrossProfit}
                                                onChange={e => setBusinessGrossProfit(e.target.value)}
                                            />
                                            <Input
                                                label={`Lucro Líquido (${currency})`}
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={businessNetProfit}
                                                onChange={e => setBusinessNetProfit(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <Input
                                            label="Data do Evento"
                                            type="date"
                                            value={date}
                                            onChange={e => setDate(e.target.value)}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label={businessAction === 'distribution' ? `Valor ao Sócio (${currency})` : `Valor do Aporte (${currency})`}
                                                type="number"
                                                step="any"
                                                placeholder="0.00"
                                                value={totalValue}
                                                onChange={e => setTotalValue(e.target.value)}
                                                icon={<DollarSign size={14} />}
                                            />
                                            {businessAction === 'distribution' ? (
                                                <Input
                                                    label="Valor total da empresa (opcional)"
                                                    type="number"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={distributionTotalCompany}
                                                    onChange={e => setDistributionTotalCompany(e.target.value)}
                                                />
                                            ) : (
                                                <div />
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Input
                                    label="Observação (Opcional)"
                                    placeholder="Ex: fechamento mensal ou distribuição extraordinária"
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                />
                            </>
                        ) : isInvestments ? (
                            /* DIVIDENDS LOGIC */
                            <>
                                <div className="bg-zinc-950 p-1 rounded-lg flex mb-4 border border-zinc-800 overflow-hidden">
                                    <button
                                        onClick={() => setDividendAction('dividend')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${dividendAction === 'dividend'
                                            ? 'bg-blue-500/10 text-blue-500 shadow-sm border border-blue-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <TrendingUp size={16} /> Dividendos
                                    </button>
                                    <button
                                        onClick={() => setDividendAction('jcp')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${dividendAction === 'jcp'
                                            ? 'bg-purple-500/10 text-purple-500 shadow-sm border border-purple-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <PieChart size={16} /> JCP
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Data do Pagamento"
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                    <Input
                                        label={`Valor Total LÃ­quido (${currency})`}
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        value={totalValue}
                                        onChange={e => setTotalValue(e.target.value)}
                                        icon={<DollarSign size={14} />}
                                    />
                                </div>

                                <Input
                                    label="ObservaÃ§Ã£o (Opcional)"
                                    placeholder="Ex: Referente a 2023"
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                />
                            </>
                        ) : (
                            /* REAL ESTATE RENT LOGIC */
                            <>
                                <div className="bg-zinc-950 p-1 rounded-lg flex mb-4 border border-zinc-800 overflow-hidden">
                                    <button
                                        onClick={() => setRentAction('start')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${rentAction === 'start'
                                            ? 'bg-blue-500/10 text-blue-500 shadow-sm border border-blue-500/20'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <Key size={16} /> Iniciar Aluguel
                                    </button>
                                    <button
                                        onClick={() => setRentAction('end')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${rentAction === 'end'
                                            ? 'bg-zinc-800 text-zinc-300 shadow-sm border border-zinc-700'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <X size={16} /> Encerrar
                                    </button>
                                </div>

                                {/* ... RETROACTIVE WIZARD & RENT FORM (Unchanged) ... */}
                                {showRetroactiveOptions && rentAction === 'start' ? (
                                    <div className="p-4 bg-zinc-950 border border-amber-500/30 rounded-xl space-y-4 animate-in zoom-in-95 duration-300">
                                        <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                                            <Calendar size={16} /> Data no Passado Detectada
                                        </div>
                                        <p className="text-xs text-zinc-400">
                                            A data de inÃ­cio Ã© anterior a hoje. Como deseja tratar o histÃ³rico?
                                        </p>

                                        <div className="space-y-2">
                                            <label className="flex items-center gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="retro"
                                                    checked={retroactiveMode === 'ignore'}
                                                    onChange={() => setRetroactiveMode('ignore')}
                                                    className="text-amber-500 focus:ring-amber-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-medium text-white">Registrar apenas início</span>
                                                    <span className="block text-xs text-zinc-500">NÃo gera lançamentos de aluguel para os meses passados.</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="retro"
                                                    checked={retroactiveMode === 'generate'}
                                                    onChange={() => setRetroactiveMode('generate')}
                                                    className="text-amber-500 focus:ring-amber-500"
                                                />
                                                <div>
                                                    <span className="block text-sm font-medium text-white">Gerar histórico retroativo</span>
                                                    <span className="block text-xs text-zinc-500">O sistema criará lançamentos mensais até hoje.</span>
                                                </div>
                                            </label>
                                        </div>

                                        {retroactiveMode === 'generate' && (
                                            <div className="pl-4 border-l-2 border-zinc-800 mt-2">
                                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Status dos lançamentos passados</label>
                                                <select
                                                    value={retroactiveStatus}
                                                    onChange={(e) => setRetroactiveStatus(e.target.value as any)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 outline-none"
                                                >
                                                    <option value="received">Recebido (Verde)</option>
                                                    <option value="expected">Previsto / Pendente (Amarelo)</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label={rentAction === 'start' ? "Data de Iní­cio" : "Data de Encerramento"}
                                                type="date"
                                                value={date}
                                                onChange={e => setDate(e.target.value)}
                                            />
                                            {rentAction === 'start' ? (
                                                <Input
                                                    label={`Valor Mensal (${currency})`}
                                                    type="number"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={totalValue}
                                                    onChange={e => setTotalValue(e.target.value)}
                                                    icon={<DollarSign size={14} />}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-[50px] self-end bg-zinc-950/50 rounded-lg border border-zinc-800 text-xs text-zinc-500 px-4 text-center">
                                                    O imóvel voltará para o status "Vago".
                                                </div>
                                            )}
                                        </div>

                                        {rentAction === 'start' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Indexador</label>
                                                    <select
                                                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 text-sm"
                                                        value={rentIndexer}
                                                        onChange={(e) => setRentIndexer(e.target.value)}
                                                    >
                                                        <option value="IGP-M">IGP-M</option>
                                                        <option value="IPCA">IPCA</option>
                                                        <option value="Fixo">Valor Fixo</option>
                                                        <option value="Manual">Manual</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5 ml-1">Mês de Reajuste</label>
                                                    <select
                                                        className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg py-3 px-4 focus:outline-none focus:border-amber-500 text-sm"
                                                        value={adjustmentMonth}
                                                        onChange={(e) => setAdjustmentMonth(e.target.value)}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {['Janeiro', 'Fevereiro', 'MarÃ§o', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(m => (
                                                            <option key={m} value={m}>{m}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        <Input
                                            label="ObservaÃ§Ã£o (Opcional)"
                                            placeholder={rentAction === 'start' ? "Ex: Contrato de 30 meses" : "Ex: Inquilino devolveu as chaves"}
                                            value={observation}
                                            onChange={e => setObservation(e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-zinc-800 mt-4">
                    {showRetroactiveOptions ? (
                        <Button variant="secondary" onClick={() => setShowRetroactiveOptions(false)}>Voltar</Button>
                    ) : (
                        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    )}

                    <Button
                        onClick={handleSaveClick}
                        disabled={
                            !selectedAssetId ||
                            (activeTab === 'patrimonial' && (!unitPrice || (!isPriceUpdate && !isBusiness && parseFloat(quantity) <= 0))) ||
                            (activeTab === 'operational' && isRealEstate && rentAction === 'start' && !parseFloat(totalValue) && !showRetroactiveOptions) ||
                            (activeTab === 'operational' && isInvestments && !parseFloat(totalValue)) ||
                            (activeTab === 'operational' && isBusiness && (
                                (businessAction === 'profit_report' && !parseFloat(businessNetProfit)) ||
                                (businessAction !== 'profit_report' && !parseFloat(totalValue))
                            ))
                        }
                    >
                        {activeTab === 'operational' ? (
                            <><Check size={16} className="mr-2" /> Confirmar Evento</>
                        ) : isPriceUpdate ? (
                            <><RefreshCw size={16} className="mr-2" /> {isBusiness ? 'Confirmar Valuation' : 'Atualizar Preço'}</>
                        ) : (
                            <><Plus size={16} className="mr-2" /> Adicionar Lançamento</>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

