/**
 * PortfolioTabs - Tab navigation for portfolio details page
 */

import React from 'react';
import { TrendingUp, History, BarChart3 } from 'lucide-react';

export type ActiveTab = 'overview' | 'dividends' | 'history' | 'profitability';

interface PortfolioTabsProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    showDividends: boolean;
}

export const PortfolioTabs: React.FC<PortfolioTabsProps> = ({
    activeTab,
    onTabChange,
    showDividends
}) => {
    return (
        <div className="flex border-b border-zinc-900 mb-8 overflow-x-auto">
            <button 
                onClick={() => onTabChange('overview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-amber-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                Visão Geral
            </button>
            
            {showDividends && (
                <button 
                    onClick={() => onTabChange('dividends')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dividends' ? 'border-amber-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    <BarChart3 size={16} /> Dividendos
                </button>
            )}

            <button 
                onClick={() => onTabChange('profitability')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'profitability' ? 'border-amber-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                <TrendingUp size={16} /> Rentabilidade
            </button>

            <button 
                onClick={() => onTabChange('history')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-amber-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                <History size={16} /> Histórico Completo
            </button>
        </div>
    );
};

