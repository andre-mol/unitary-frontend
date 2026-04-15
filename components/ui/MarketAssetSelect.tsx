import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { getSupabaseClient } from '../../config/supabase';
import { Input } from './Input';

interface MarketAsset {
    id: string;
    ticker: string;
    name: string;
    last_close?: number; // Optional if we fetch it
}

interface MarketAssetSelectProps {
    value: string;
    onChange: (value: string) => void;
    onSelectAttribute: (asset: MarketAsset) => void;
    onBlur?: (value: string) => void;
    disabled?: boolean;
    error?: string | boolean;
}

export const MarketAssetSelect: React.FC<MarketAssetSelectProps> = ({
    value,
    onChange,
    onSelectAttribute,
    onBlur,
    disabled,
    error
}) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState<MarketAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const supabase = getSupabaseClient();

    // Sync internal state with external value
    useEffect(() => {
        setQuery(value);
    }, [value]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 2 || !isOpen) return;

            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('market_quotes')
                    .select('id, ticker, name')
                    .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
                    .limit(10);

                if (error) throw error;
                setResults(data || []);
            } catch (err) {
                console.error('Error searching assets:', err);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, isOpen]);

    const handleSelect = async (asset: MarketAsset) => {
        setQuery(asset.ticker);
        onChange(asset.ticker);
        setIsOpen(false);

        // AIDEV-NOTE: Quotes = current, Prices = historical EOD/compact.
        // Source of truth para preço atual: market_quotes
        // Fallback: market_prices (último <= hoje, priorizando 1d)
        
        // Fetch latest price for this asset
        try {
            // 1. Try market_quotes first (source of truth for current price)
            const { data: quoteData } = await supabase
                .from('market_quotes')
                .select('close, updated_at')
                .eq('id', asset.id)
                .single();

            if (quoteData && quoteData.close != null) {
                // Return price from quotes (most current)
                onSelectAttribute({ ...asset, last_close: Number(quoteData.close) });
                return;
            }

            // 2. Fallback to market_prices (historical EOD data)
            const today = new Date().toISOString().split('T')[0];
            
            // Try granularity='1d' first (daily EOD, more recent)
            const { data: priceData1d } = await supabase
                .from('market_prices')
                .select('close')
                .eq('asset_id', asset.id)
                .eq('granularity', '1d')
                .lte('date', today)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (priceData1d && priceData1d.close != null) {
                onSelectAttribute({ ...asset, last_close: Number(priceData1d.close) });
                return;
            }

            // Try granularity='1w' as last resort (weekly historical)
            const { data: priceData1w } = await supabase
                .from('market_prices')
                .select('close')
                .eq('asset_id', asset.id)
                .eq('granularity', '1w')
                .lte('date', today)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (priceData1w && priceData1w.close != null) {
                onSelectAttribute({ ...asset, last_close: Number(priceData1w.close) });
                return;
            }

            // No price found
            onSelectAttribute({ ...asset, last_close: undefined });
        } catch (e) {
            console.error('Error fetching price for asset:', e);
            onSelectAttribute({ ...asset, last_close: undefined });
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <Input
                label="Nome ou Ticker do Ativo"
                placeholder="Busque por PETR4, ITUB4..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    onChange(e.target.value);
                    setIsOpen(true);
                }}
                onBlur={() => {
                    // Small delay to allow click on dropdown items
                    setTimeout(() => setIsOpen(false), 200);
                    if (onBlur) onBlur(query);
                }}
                onFocus={() => setIsOpen(true)}
                icon={<Search size={14} />}
                disabled={disabled}
                autoComplete="off"
                error={error}
            />

            {isLoading && (
                <div className="absolute right-3 top-[38px] text-zinc-500 animate-spin">
                    <Loader2 size={16} />
                </div>
            )}

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {results.map((asset) => (
                        <button
                            key={asset.id}
                            className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 flex justify-between items-center group"
                            onClick={() => handleSelect(asset)}
                        >
                            <div>
                                <span className="font-bold text-white block">{asset.ticker}</span>
                                <span className="text-xs text-zinc-400 group-hover:text-zinc-300">{asset.name}</span>
                            </div>
                            {query.toUpperCase() === asset.ticker && <Check size={14} className="text-amber-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
