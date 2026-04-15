
import React, { useState, useEffect } from 'react';
import { FileText, Download, Settings, Target, Star } from 'lucide-react';
import { Portfolio } from '../../../../types';
import { portfolioService } from '../../../../lib/portfolioService';
import { useSettings } from '../../../settings/SettingsProvider';

const OBJECTIVE_LABELS: Record<string, string> = {
    'growth': 'Crescimento',
    'income': 'Renda Passiva',
    'protection': 'Proteção',
    'speculation': 'Alto Risco',
    'mixed': 'Misto'
};

const HORIZON_LABELS: Record<string, string> = {
    'short': 'Curto Prazo',
    'medium': 'Médio Prazo',
    'long': 'Longo Prazo'
};

export const PortfolioInfoCard: React.FC<{
    portfolio: Portfolio,
    itemCount: number,
    categoriesCount: number,
    totalUnits: number,
    profitability: number,
    profitabilityPercentage: number,
    className?: string,
    onOpenSettings: () => void;
}> = ({ portfolio, itemCount, categoriesCount, totalUnits, profitability, profitabilityPercentage, className = '', onOpenSettings }) => {

    const { isExportEnabled } = useSettings();
    const [score, setScore] = useState(0);

    useEffect(() => {
        const loadScore = async () => {
            const s = await portfolioService.getPortfolioScore(portfolio.id);
            setScore(s);
        };
        loadScore();
    }, [portfolio.id, portfolio.userConvictionScore, itemCount]);

    const getScoreColor = (s: number) => s >= 8 ? 'text-green-500' : s >= 5 ? 'text-amber-500' : 'text-red-500';

    return (
        <div className={`bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col h-full ${className}`}>
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-4 shrink-0">
                <FileText className="text-zinc-400" size={18} />
                <h3 className="font-bold text-white text-sm uppercase tracking-wide">Informações do Portfólio</h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-2 -mr-2">
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Tipo</span>
                        <span className="text-white font-medium bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 capitalize text-xs">
                            {portfolio.type === 'custom' ? 'Personalizado' :
                                portfolio.type === 'investments' ? 'Investimentos' :
                                    portfolio.type === 'real_estate' ? 'Imóveis' : 'Empresas'}
                        </span>
                    </div>

                    {/* Strategic Fields */}
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors flex items-center gap-1.5">
                            Objetivo
                        </span>
                        <span className="text-zinc-300 font-medium flex items-center gap-1.5 text-xs">
                            {portfolio.objective === 'growth' && <Target size={12} className="text-amber-500" />}
                            {portfolio.objective === 'income' && <Target size={12} className="text-blue-500" />}
                            {portfolio.objective === 'protection' && <Target size={12} className="text-zinc-400" />}
                            {OBJECTIVE_LABELS[portfolio.objective || 'growth']}
                        </span>
                    </div>
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Horizonte</span>
                        <span className="text-zinc-300 font-medium text-xs">
                            {HORIZON_LABELS[portfolio.timeHorizon || 'long']}
                        </span>
                    </div>

                    {/* NEW: Portfolio Score */}
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors flex items-center gap-1.5">
                            Nota Geral
                        </span>
                        <span className={`font-mono font-bold flex items-center gap-1.5 text-sm ${getScoreColor(score)}`}>
                            <Star size={12} fill="currentColor" />
                            {score.toFixed(1)}
                        </span>
                    </div>

                    {/* NEW: Profitability */}
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors flex items-center gap-1.5">
                            Rentabilidade
                        </span>
                        <div className={`font-mono text-xs flex flex-col items-end ${profitability >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span className="font-bold">
                                {profitability > 0 ? '+' : ''}{profitability.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-[10px] opacity-80">
                                {profitability > 0 ? '+' : ''}{profitabilityPercentage.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {portfolio.customClass && (
                        <div className="flex justify-between items-center group">
                            <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Classificação</span>
                            <span className="text-zinc-300 font-medium text-xs">{portfolio.customClass}</span>
                        </div>
                    )}
                    {portfolio.location && (
                        <div className="flex justify-between items-center group">
                            <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Localização</span>
                            <span className="text-zinc-300 font-medium text-right max-w-[150px] truncate text-xs" title={portfolio.location}>
                                {portfolio.location}
                            </span>
                        </div>
                    )}

                    {/* Currency Removed */}

                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">
                            {portfolio.type === 'real_estate' ? 'Tipos de Imóvel' : 'Categorias'}
                        </span>
                        <span className="text-zinc-300 text-xs">{categoriesCount}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Total de Ativos</span>
                        <span className="text-zinc-300 text-xs">{itemCount}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Quantidade Total</span>
                        <span className="text-zinc-300 font-mono text-xs">{totalUnits.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                        <span className="text-zinc-500 group-hover:text-zinc-400 transition-colors">Última Atualização</span>
                        <span className="text-zinc-300 text-xs">{new Date(portfolio.lastAccessedAt || portfolio.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-zinc-900 shrink-0">
                {isExportEnabled() ? (
                    <button className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium py-2.5 rounded-lg border border-zinc-800 transition-colors">
                        <Download size={14} /> Exportar Relatório
                    </button>
                ) : (
                    <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900/50 text-zinc-600 text-xs font-medium py-2.5 rounded-lg border border-zinc-800/50 cursor-not-allowed opacity-50"
                        title="Exportação temporariamente desabilitada"
                    >
                        <Download size={14} /> Exportar Relatório
                    </button>
                )}
                <button
                    onClick={onOpenSettings}
                    className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 text-xs font-medium py-2.5 rounded-lg transition-colors"
                >
                    <Settings size={14} /> Configurações
                </button>
            </div>
        </div>
    );
};
