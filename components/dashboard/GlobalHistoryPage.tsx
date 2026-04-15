
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { portfolioService } from '../../lib/portfolioService';
import { PortfolioEvent, HistoryEventType } from '../../types';
import { 
    ArrowLeft, Search, Filter, History, 
    MoreHorizontal, TrendingUp, TrendingDown, ChevronDown, 
    ChevronUp, Clock, Hash, Trash2, Edit2, PlusCircle, ArrowUpDown, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../utils/formatters';

type SortKey = 'date' | 'assetName' | 'type' | 'totalValue' | 'portfolioName';
type SortDirection = 'asc' | 'desc';

export const GlobalHistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<PortfolioEvent[]>([]);
    
    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell' | 'create' | 'delete' | 'manual_update' | 'lifecycle' | 'income' | 'business' | 'real_estate'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        // Load Global History (Aggregated)
        const loadEvents = async () => {
            setEvents(await portfolioService.getGlobalHistoryEvents());
        };
        loadEvents();
    }, []);

    const handleSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Process Data: Filter -> Sort
    const processedEvents = useMemo(() => {
        let filtered = events.filter(tx => {
            const matchesSearch = tx.assetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  (tx.portfolioName || '').toLowerCase().includes(searchQuery.toLowerCase());
            
            if (typeFilter === 'all') return matchesSearch;
            if (typeFilter === 'lifecycle') return matchesSearch && (tx.type === 'portfolio_create' || tx.type === 'portfolio_delete');
            if (typeFilter === 'income') return matchesSearch && ['dividend', 'jcp', 'rent_income', 'profit_distribution', 'distribution'].includes(tx.type);
            if (typeFilter === 'business') return matchesSearch && ['profit_report', 'profit_registered', 'profit_distribution', 'distribution', 'capital_call', 'valuation_update'].includes(tx.type);
            if (typeFilter === 'real_estate') return matchesSearch && ['rent_start', 'rent_end', 'rent_income', 'adjustment'].includes(tx.type);
            
            return matchesSearch && tx.type === typeFilter;
        });

        return filtered.sort((a, b) => {
            // Special handling for date sorting:
            if (sortConfig.key === 'date') {
                 // Explicit logic matching portfolioService
                 const timeA = new Date(a.date).getTime();
                 const timeB = new Date(b.date).getTime();
                 
                 const validA = isNaN(timeA) ? 0 : timeA;
                 const validB = isNaN(timeB) ? 0 : timeB;

                 const dayA = Math.floor(validA / 86400000);
                 const dayB = Math.floor(validB / 86400000);

                 if (dayA !== dayB) {
                     return sortConfig.direction === 'asc' ? dayA - dayB : dayB - dayA;
                 }

                 const createdA = new Date(a.createdAt).getTime();
                 const createdB = new Date(b.createdAt).getTime();
                 
                 return sortConfig.direction === 'asc' ? createdA - createdB : createdB - createdA;
            } 
            
            const getValueByKey = (event: PortfolioEvent, key: SortKey): string | number => {
                switch (key) {
                    case 'assetName': return event.assetName || '';
                    case 'type': return event.type || '';
                    case 'totalValue': return event.totalValue || 0;
                    case 'portfolioName': return event.portfolioName || '';
                    default: return '';
                }
            };

            let valA: string | number = getValueByKey(a, sortConfig.key);
            let valB: string | number = getValueByKey(b, sortConfig.key);

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [events, searchQuery, typeFilter, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(processedEvents.length / itemsPerPage);
    const paginatedEvents = processedEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Grouping for Display
    const groupedTransactions = useMemo(() => {
        const groups: Record<string, PortfolioEvent[]> = {};
        paginatedEvents.forEach(tx => {
            const dateObj = new Date(tx.date);
            const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
            const key = validDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(tx);
        });
        return groups;
    }, [paginatedEvents]);

    const toggleRow = (txId: string) => {
        setExpandedId(expandedId === txId ? null : txId);
    };

    const getTypeIcon = (type: string) => {
        switch(type) {
            case 'buy': return <TrendingUp size={10} />;
            case 'sell': return <TrendingDown size={10} />;
            case 'create': return <PlusCircle size={10} />;
            case 'delete': return <Trash2 size={10} />;
            case 'manual_update': return <Edit2 size={10} />;
            case 'valuation_update': return <Edit2 size={10} />;
            case 'portfolio_create': return <Wallet size={10} />;
            case 'portfolio_delete': return <Trash2 size={10} />;
            case 'rent_income': return <TrendingUp size={10} />;
            case 'rent_start': return <Clock size={10} />;
            case 'rent_end': return <Clock size={10} />;
            case 'profit_registered': return <TrendingUp size={10} />;
            case 'profit_report': return <TrendingUp size={10} />;
            case 'profit_distribution': return <TrendingDown size={10} />;
            case 'distribution': return <TrendingDown size={10} />;
            case 'capital_call': return <TrendingUp size={10} />;
            case 'dividend': return <TrendingUp size={10} />;
            case 'jcp': return <TrendingUp size={10} />;
            case 'adjustment': return <TrendingDown size={10} />;
            default: return <Clock size={10} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch(type) {
            case 'buy': return 'Compra';
            case 'sell': return 'Venda';
            case 'create': return 'Criação';
            case 'delete': return 'Exclusão';
            case 'manual_update': return 'Atualização';
            case 'valuation_update': return 'Valuataion';
            case 'rent_income': return 'Aluguel';
            case 'rent_start': return 'Inicio Aluguel';
            case 'rent_end': return 'Fim Aluguel';
            case 'profit_registered': return 'Lucro Registrado';
            case 'profit_report': return 'Resultado';
            case 'profit_distribution': return 'Distribuicao';
            case 'distribution': return 'Distribuicao';
            case 'capital_call': return 'Aporte';
            case 'dividend': return 'Dividendo';
            case 'jcp': return 'JCP';
            case 'adjustment': return 'Ajuste';
            case 'portfolio_create': return 'Novo Portfólio';
            case 'portfolio_delete': return 'Portfólio Excluído';
            default: return type;
        }
    };

    const getTypeColorClass = (type: string) => {
         switch(type) {
            case 'buy': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'sell': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'create': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'delete': return 'bg-zinc-800 text-zinc-400 border-zinc-700';
            case 'manual_update': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'valuation_update': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'portfolio_create': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'portfolio_delete': return 'bg-red-900/20 text-red-400 border-red-900/30';
            case 'rent_income': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'rent_start': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'rent_end': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'profit_registered': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'profit_report': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'profit_distribution': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'distribution': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'capital_call': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'dividend': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'jcp': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'adjustment': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-zinc-800 text-zinc-400';
        }
    };

    const SortIcon = ({ active }: { active: boolean }) => (
        <ArrowUpDown size={12} className={`ml-1 transition-opacity ${active ? 'opacity-100 text-amber-500' : 'opacity-30'}`} />
    );

    const isLifecycle = (type: string) => type === 'portfolio_create' || type === 'portfolio_delete';

    return (
        <DashboardLayout title="Histórico Geral" subtitle="Visão consolidada de todas as movimentações">
            <div className="space-y-6">
                
                {/* 1. Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar ativo ou portfólio..."
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    
                    <div className="relative w-full sm:w-48">
                         <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                         <select 
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-8 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer"
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
                         >
                             <option value="all">Todos os eventos</option>
                             <option value="lifecycle">Portfólios (Ciclo de Vida)</option>
                             <option value="income">Proventos e Receitas</option>
                             <option value="business">Eventos de Empresa</option>
                             <option value="real_estate">Eventos de Imóveis</option>
                             <option value="create">Criação de Ativos</option>
                             <option value="buy">Compras / Aportes</option>
                             <option value="sell">Vendas / Saídas</option>
                             <option value="manual_update">Atualizações Manuais</option>
                                <option value="delete">Exclusões de Ativos</option>
                         </select>
                         <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={14} />
                    </div>
                </div>

                {/* 2. History Table */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-h-[400px]">
                    {Object.keys(groupedTransactions).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                            <History size={48} className="mb-4 opacity-20" />
                            <p>Nenhuma movimentação encontrada.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-4 w-32 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center">Data <SortIcon active={sortConfig.key === 'date'} /></div>
                                        </th>
                                        <th className="px-6 py-4 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('portfolioName')}>
                                            <div className="flex items-center">Portfólio <SortIcon active={sortConfig.key === 'portfolioName'} /></div>
                                        </th>
                                        <th className="px-6 py-4 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('assetName')}>
                                            <div className="flex items-center">Ativo / Evento <SortIcon active={sortConfig.key === 'assetName'} /></div>
                                        </th>
                                        <th className="px-6 py-4 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('type')}>
                                            <div className="flex items-center">Tipo <SortIcon active={sortConfig.key === 'type'} /></div>
                                        </th>
                                        <th className="px-6 py-4 text-right">Valor Total</th>
                                        <th className="px-6 py-4 w-48">Observação</th>
                                        <th className="px-4 py-4 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {Object.entries(groupedTransactions).map(([period, groupItems]: [string, PortfolioEvent[]]) => (
                                        <React.Fragment key={period}>
                                            <tr className="bg-zinc-900/30">
                                                <td colSpan={8} className="px-6 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest border-y border-zinc-900">
                                                    {period}
                                                </td>
                                            </tr>

                                            {groupItems.map((tx) => {
                                                const isExpanded = expandedId === tx.id;
                                                const dateObj = new Date(tx.date.includes('T') ? tx.date : tx.date + 'T12:00:00');
                                                const isSystemEvent = isLifecycle(tx.type);
                                                
                                                return (
                                                    <React.Fragment key={tx.id}>
                                                        <tr 
                                                            onClick={() => toggleRow(tx.id)}
                                                            className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20'}`}
                                                        >
                                                            <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                                                                {dateObj.toLocaleDateString('pt-BR')}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                                                                    <Wallet size={10} className="text-zinc-500" />
                                                                    {tx.portfolioName || 'Desconhecido'}
                                                                </span>
                                                            </td>
                                                            <td className={`px-6 py-4 font-medium transition-colors ${isSystemEvent ? 'text-zinc-400 italic' : 'text-white group-hover:text-amber-500'}`}>
                                                                {tx.assetName}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getTypeColorClass(tx.type)}`}>
                                                                    {getTypeIcon(tx.type)}
                                                                    {getTypeLabel(tx.type)}
                                                                </span>
                                                            </td>
                                                            <td className={`px-6 py-4 text-right font-mono font-medium ${['buy', 'create', 'rent_income', 'profit_registered', 'profit_report', 'capital_call', 'dividend', 'jcp'].includes(tx.type) ? 'text-white' : tx.type === 'sell' ? 'text-zinc-300' : tx.type === 'adjustment' ? 'text-red-400' : 'text-amber-500'}`}>
                                                                {formatCurrency(tx.totalValue, 'BRL')}
                                                            </td>
                                                            <td className="px-6 py-4 text-zinc-500 text-xs italic truncate max-w-[200px]">
                                                                {tx.observation || '-'}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <button className="text-zinc-600 group-hover:text-white transition-colors p-1 rounded hover:bg-zinc-800">
                                                                    {isExpanded ? <ChevronUp size={16} /> : <MoreHorizontal size={16} />}
                                                                </button>
                                                            </td>
                                                        </tr>

                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={8} className="p-0 border-b border-zinc-800 bg-zinc-950">
                                                                        <motion.div 
                                                                            initial={{ height: 0, opacity: 0 }}
                                                                            animate={{ height: 'auto', opacity: 1 }}
                                                                            exit={{ height: 0, opacity: 0 }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-900/20 shadow-inner">
                                                                                <div className="space-y-3">
                                                                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Detalhes</h4>
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-zinc-600 flex items-center gap-1"><Hash size={10}/> ID do Evento</span>
                                                                                        <span className="text-zinc-400 font-mono">{tx.id.slice(0, 8)}...</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-zinc-600 flex items-center gap-1"><Clock size={10}/> Registrado em</span>
                                                                                        <span className="text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</span>
                                                                                    </div>
                                                                                </div>
                                                                                 {!isSystemEvent && (
                                                                                     <div className="space-y-3 border-l border-zinc-800 pl-6">
                                                                                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Dados da Transação</h4>
                                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                            <div>
                                                                                                <p className="text-xs text-zinc-600">Quantidade</p>
                                                                                                <p className="text-sm text-white font-mono">{tx.quantity || '-'}</p>
                                                                                            </div>
                                                                                            <div>
                                                                                                <p className="text-xs text-zinc-600">Valor Unitário</p>
                                                                                                <p className="text-sm text-white font-mono">{tx.unitPrice ? formatCurrency(tx.unitPrice, 'BRL') : '-'}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                     </div>
                                                                                 )}
                                                                            </div>
                                                                        </motion.div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </AnimatePresence>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-4">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => Math.max(1, c - 1))} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 disabled:opacity-50 hover:text-white">Anterior</button>
                        <span className="text-xs text-zinc-500">Página {currentPage} de {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 disabled:opacity-50 hover:text-white">Próxima</button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};
