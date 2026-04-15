
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { portfolioService } from '../../lib/portfolioService';
import { Portfolio, PortfolioEvent } from '../../types';
import { 
    ArrowLeft, Search, Filter, History, 
    MoreHorizontal, TrendingUp, TrendingDown, ChevronDown, 
    ChevronUp, Clock, Hash, Trash2, Edit2, PlusCircle, ArrowUpDown, Key, PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../utils/formatters';

type SortKey = 'date' | 'assetName' | 'type' | 'totalValue';
type SortDirection = 'asc' | 'desc';

export const PortfolioHistoryPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [events, setEvents] = useState<PortfolioEvent[]>([]);
    
    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'patrimonial' | 'operational'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        const loadData = async () => {
            if (id) {
                const p = await portfolioService.getPortfolioById(id);
                if (p) {
                    setPortfolio(p);
                    setEvents(await portfolioService.getHistoryEvents(id));
                } else {
                    navigate('/dashboard/portfolios');
                }
            }
        };
        loadData();
    }, [id, navigate]);

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
            const matchesSearch = tx.assetName.toLowerCase().includes(searchQuery.toLowerCase());
            
            let matchesType = true;
            if (typeFilter === 'patrimonial') {
                matchesType = ['buy', 'sell', 'create', 'delete', 'manual_update', 'profit_distribution'].includes(tx.type);
            } else if (typeFilter === 'operational') {
                matchesType = ['rent_start', 'rent_end', 'rent_income', 'profit_registered'].includes(tx.type);
            }

            return matchesSearch && matchesType;
        });

        return filtered.sort((a, b) => {
            // Special handling for date sorting:
            if (sortConfig.key === 'date') {
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
                    case 'assetName': return event.assetName?.toLowerCase() || '';
                    case 'type': return event.type || '';
                    case 'totalValue': return event.totalValue || 0;
                    default: return '';
                }
            };

            const valA = getValueByKey(a, sortConfig.key);
            const valB = getValueByKey(b, sortConfig.key);

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [events, searchQuery, typeFilter, sortConfig]);

    const totalPages = Math.ceil(processedEvents.length / itemsPerPage);
    const paginatedEvents = processedEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            case 'rent_start': return <Key size={10} />;
            case 'rent_end': return <Key size={10} />;
            case 'rent_income': return <TrendingUp size={10} />;
            case 'profit_registered': return <TrendingUp size={10} />;
            case 'profit_distribution': return <PieChart size={10} />;
            default: return <Clock size={10} />;
        }
    };

    const getTypeLabel = (type: string, status?: string) => {
        switch(type) {
            case 'buy': return 'Compra';
            case 'sell': return 'Venda';
            case 'create': return 'Criação';
            case 'delete': return 'Exclusão';
            case 'manual_update': return 'Atualização';
            case 'rent_start': return 'Início Aluguel';
            case 'rent_end': return 'Fim Aluguel';
            case 'rent_income': return status === 'expected' ? 'Aluguel (Prev.)' : 'Aluguel (Rec.)';
            case 'profit_registered': return 'Lucro Registrado';
            case 'profit_distribution': return 'Distribuição';
            default: return type;
        }
    };

    const getTypeColorClass = (type: string, status?: string) => {
         switch(type) {
            case 'buy': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'sell': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'create': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'delete': return 'bg-zinc-800 text-zinc-400 border-zinc-700';
            case 'manual_update': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'rent_start': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'rent_end': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'rent_income': 
                return status === 'expected' 
                    ? 'bg-zinc-700 text-zinc-300 border-zinc-600' // Expected
                    : 'bg-green-500/10 text-green-500 border-green-500/20'; // Received
            case 'profit_registered': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'profit_distribution': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            default: return 'bg-zinc-800 text-zinc-400';
        }
    };

    const SortIcon = ({ active }: { active: boolean }) => (
        <ArrowUpDown size={12} className={`ml-1 transition-opacity ${active ? 'opacity-100 text-amber-500' : 'opacity-30'}`} />
    );

    if (!portfolio) return <div />;

    return (
        <DashboardLayout title={portfolio.name} subtitle="Histórico">
            <div className="space-y-6">
                
                {/* 1. Header & Navigation */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-6">
                    <div>
                         <Link to={`/dashboard/portfolio/${portfolio.id}`} className="inline-flex items-center text-xs text-zinc-500 hover:text-white mb-2 transition-colors">
                            <ArrowLeft size={12} className="mr-1" /> Voltar ao Dashboard
                        </Link>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Histórico do Portfólio
                            <span className="bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-medium">Auditável</span>
                        </h2>
                    </div>
                </div>

                {/* 2. Compact Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar por ativo..."
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
                             <option value="patrimonial">Patrimonial</option>
                             <option value="operational">Operacional</option>
                         </select>
                         <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={14} />
                    </div>
                </div>

                {/* 3. History Table */}
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
                                        <th className="px-6 py-4 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('assetName')}>
                                            <div className="flex items-center">Ativo <SortIcon active={sortConfig.key === 'assetName'} /></div>
                                        </th>
                                        <th className="px-6 py-4 cursor-pointer hover:text-white select-none group" onClick={() => handleSort('type')}>
                                            <div className="flex items-center">Evento <SortIcon active={sortConfig.key === 'type'} /></div>
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:text-white select-none group" onClick={() => handleSort('totalValue')}>
                                            <div className="flex items-center justify-end">Valor Total <SortIcon active={sortConfig.key === 'totalValue'} /></div>
                                        </th>
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
                                                
                                                return (
                                                    <React.Fragment key={tx.id}>
                                                        <tr 
                                                            onClick={() => toggleRow(tx.id)}
                                                            className={`transition-colors cursor-pointer group ${isExpanded ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20'}`}
                                                        >
                                                            <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                                                                {dateObj.toLocaleDateString('pt-BR')}
                                                            </td>
                                                            <td className="px-6 py-4 font-medium text-white group-hover:text-amber-500 transition-colors">
                                                                {tx.assetName}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getTypeColorClass(tx.type, tx.eventStatus)}`}>
                                                                    {getTypeIcon(tx.type)}
                                                                    {getTypeLabel(tx.type, tx.eventStatus)}
                                                                </span>
                                                            </td>
                                                            <td className={`px-6 py-4 text-right font-mono font-medium ${tx.type === 'buy' || tx.type === 'create' || tx.type === 'rent_income' || tx.type === 'profit_registered' ? 'text-white' : tx.type === 'sell' ? 'text-zinc-300' : 'text-amber-500'}`}>
                                                                {formatCurrency(tx.totalValue, portfolio.currency)}
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
                                                                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Detalhes do Registro</h4>
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-zinc-600 flex items-center gap-1"><Hash size={10}/> ID do Evento</span>
                                                                                        <span className="text-zinc-400 font-mono">{tx.id.slice(0, 8)}...</span>
                                                                                    </div>
                                                                                    <div className="flex justify-between text-xs">
                                                                                        <span className="text-zinc-600 flex items-center gap-1"><Clock size={10}/> Registrado em</span>
                                                                                        <span className="text-zinc-400">{new Date(tx.createdAt).toLocaleString()}</span>
                                                                                    </div>
                                                                                    {tx.period && (
                                                                                        <div className="flex justify-between text-xs">
                                                                                            <span className="text-zinc-600 flex items-center gap-1"><Clock size={10}/> Período Ref.</span>
                                                                                            <span className="text-emerald-500 font-bold">{tx.period}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                 <div className="space-y-3 border-l border-zinc-800 pl-6">
                                                                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Impacto Patrimonial</h4>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className={`p-2 rounded-lg ${getTypeColorClass(tx.type, tx.eventStatus)}`}>
                                                                                            {getTypeIcon(tx.type)}
                                                                                        </div>
                                                                                        <div>
                                                                                            <p className="text-xs text-zinc-500">Valor do Evento</p>
                                                                                            <p className="text-sm font-bold font-mono text-white">
                                                                                                {formatCurrency(tx.totalValue, portfolio.currency)}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                 </div>
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
