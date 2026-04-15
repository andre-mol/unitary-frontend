/**
 * SmartActionModal
 * Unified entry point for adding assets or transactions.
 * Routes based on:
 * 1. Asset exists in portfolio -> Add Transaction (Buy)
 * 2. Asset doesn't exist -> Create Asset (AddItem)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Building, Briefcase, Plus } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { CustomItem } from '../../../../types';
import { getSupabaseClient } from '../../../../config/supabase';

interface SmartActionModalProps {
    onClose: () => void;
    items: CustomItem[];
    onSelectExisting: (item: CustomItem) => void;
    onSelectNew: (tickerOrName: string) => void;
    onSelectManual: () => void;
    portfolioType: string;
}

export const SmartActionModal: React.FC<SmartActionModalProps> = ({
    onClose,
    items,
    onSelectExisting,
    onSelectNew,
    onSelectManual,
    portfolioType
}) => {
    const [query, setQuery] = useState('');
    const [marketResults, setMarketResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Filter local items
    const localMatches = items.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.category?.toLowerCase().includes(query.toLowerCase()) ||
        (typeof item.customFields?.ticker === 'string' && item.customFields.ticker.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 3);

    // Search Market (Debounced)
    useEffect(() => {
        if (query.length < 2 || portfolioType === 'real_estate' || portfolioType === 'business') {
            setMarketResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            const supabase = getSupabaseClient();
            try {
                // Search market_quotes
                const { data } = await supabase
                    .from('market_quotes')
                    .select('ticker, name')
                    .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
                    .limit(5);

                // Filter out results that are already in localMatches to avoid duplicates
                const localTickers = new Set(localMatches.map(i => i.name.toUpperCase()));
                const filtered = (data || []).filter(m => !localTickers.has(m.ticker));

                setMarketResults(filtered);
            } catch (err) {
                console.error('Market search failed', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, portfolioType, localMatches]);

    const handleSelectLocal = (item: CustomItem) => {
        // Direct to Transaction Flow (Buy)
        onSelectExisting(item);
    };

    const handleSelectMarket = (result: any) => {
        // Direct to Create Asset Flow (Pre-filled)
        onSelectNew(result.ticker);
    };

    const handleManualCreate = () => {
        onSelectManual();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl p-6"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-lg">Adicionar ao Portfólio</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Search Input */}
                    <Input
                        autoFocus
                        placeholder={portfolioType === 'real_estate' ? "Buscar imóvel..." :
                            portfolioType === 'business' ? "Buscar empresa..." :
                                "Buscar ativo (ex: PETR4)..."}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        icon={<Search size={18} />}
                    />

                    <div className="min-h-[200px] space-y-4">
                        {/* 1. Local Matches */}
                        {localMatches.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Meus Ativos (Adicionar Aporte)</h4>
                                <div className="space-y-2">
                                    {localMatches.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectLocal(item)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-zinc-400">
                                                    {portfolioType === 'real_estate' ? <Building size={16} /> :
                                                        portfolioType === 'business' ? <Briefcase size={16} /> :
                                                            <span className="text-xs font-bold">{item.name.substring(0, 2)}</span>}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-white">{item.name}</div>
                                                    <div className="text-xs text-zinc-500">{item.category}</div>
                                                </div>
                                            </div>
                                            <span className="text-xs text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Novo Aporte →
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Market Results */}
                        {marketResults.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Mercado (Novo Ativo)</h4>
                                <div className="space-y-2">
                                    {marketResults.map(res => (
                                        <button
                                            key={res.ticker}
                                            onClick={() => handleSelectMarket(res)}
                                            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-500">
                                                    <Search size={14} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-white">{res.ticker}</div>
                                                    <div className="text-xs text-zinc-500">{res.name}</div>
                                                </div>
                                            </div>
                                            <Plus size={14} className="text-zinc-500" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Empty State / Manual Create */}
                        {query.length > 0 && localMatches.length === 0 && marketResults.length === 0 && !isSearching && (
                            <div className="text-center py-8">
                                <p className="text-zinc-500 text-sm mb-4">Nenhum ativo encontrado.</p>
                                <Button onClick={handleManualCreate} variant="outline" className="w-full">
                                    <Plus size={16} className="mr-2" />
                                    Criar "{query}" Manualmente
                                </Button>
                            </div>
                        )}

                        {/* Default State */}
                        {query.length === 0 && (
                            <div className="text-center py-8">
                                <Button onClick={handleManualCreate} variant="secondary" className="w-full">
                                    <Plus size={16} className="mr-2" />
                                    Criar Novo Ativo Manualmente
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
