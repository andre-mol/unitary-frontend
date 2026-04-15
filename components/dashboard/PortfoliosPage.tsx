
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { portfolioService } from '../../lib/portfolioService';
import { Portfolio } from '../../types';
import { 
  Wallet, TrendingUp, Building2, Briefcase, Layers, 
  Plus, Edit2, Trash2, X, AlertTriangle, History,
  Target, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to get icon based on type
const getIcon = (type: string) => {
    switch (type) {
        case 'investments': return <TrendingUp size={20} />;
        case 'real_estate': return <Building2 size={20} />;
        case 'business': return <Briefcase size={20} />;
        default: return <Layers size={20} />;
    }
};

const getLabel = (type: string) => {
    const labels: Record<string, string> = {
        'investments': 'Investimentos Financeiros',
        'real_estate': 'Imóveis',
        'business': 'Empresas & Participações',
        'custom': 'Portfólio Personalizado'
    };
    return labels[type] || 'Outros';
};

// Strategic Labels
const OBJECTIVE_INFO: Record<string, { label: string, color: string, bg: string }> = {
    'growth': { label: 'Crescimento', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
    'income': { label: 'Renda', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    'protection': { label: 'Proteção', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
    'speculation': { label: 'Alto Risco', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    'mixed': { label: 'Misto', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const HORIZON_LABELS: Record<string, string> = {
    'short': 'Curto',
    'medium': 'Médio',
    'long': 'Longo'
};

export const PortfoliosPage: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioScores, setPortfolioScores] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Edit Form State
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadPortfolios();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadScores = async () => {
      if (portfolios.length === 0) {
        if (!cancelled) setPortfolioScores({});
        return;
      }

      const entries = await Promise.all(
        portfolios.map(async (portfolio) => {
          try {
            const score = await portfolioService.getPortfolioScore(portfolio.id);
            return [portfolio.id, Number.isFinite(score) ? score : (portfolio.userConvictionScore ?? 5)] as const;
          } catch {
            return [portfolio.id, portfolio.userConvictionScore ?? 5] as const;
          }
        })
      );

      if (!cancelled) {
        setPortfolioScores(Object.fromEntries(entries));
      }
    };

    loadScores();

    return () => {
      cancelled = true;
    };
  }, [portfolios]);

  const loadPortfolios = async () => {
    setPortfolios(await portfolioService.getPortfolios());
  };

  const startEdit = (portfolio: Portfolio) => {
    setEditingId(portfolio.id);
    setEditForm({ 
        name: portfolio.name, 
        description: portfolio.description || '' 
    });
  };

  const handleSaveEdit = async () => {
    if (editingId && editForm.name) {
        await portfolioService.updatePortfolio(editingId, editForm);
        await loadPortfolios();
        setEditingId(null);
    }
  };

  const handleDelete = async () => {
    if (deletingId) {
        await portfolioService.deletePortfolio(deletingId);
        await loadPortfolios();
        setDeletingId(null);
    }
  };

  const getScoreColor = (s: number) => s >= 8 ? 'text-green-500 border-green-500/30' : s >= 5 ? 'text-amber-500 border-amber-500/30' : 'text-red-500 border-red-500/30';

  return (
    <DashboardLayout 
      title="Meus Portfólios" 
      subtitle="Gerencie, edite e organize suas estruturas patrimoniais."
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
            <div className="hidden sm:block">
                {/* Placeholder for future filters */}
            </div>
            <div className="flex gap-3">
                <Link to="/dashboard/global-history">
                    <Button variant="secondary" className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white">
                        <History size={18} className="mr-2" />
                        Histórico Geral
                    </Button>
                </Link>
                <Link to="/dashboard/create-portfolio">
                    <Button variant="primary">
                        <Plus size={18} className="mr-2" />
                        Novo Portfólio
                    </Button>
                </Link>
            </div>
        </div>

        {portfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
                    <Layers className="text-zinc-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Nenhum portfólio encontrado</h3>
                <p className="text-zinc-500 max-w-md mb-8">
                    Crie sua primeira estrutura patrimonial para começar a gerenciar seus ativos.
                </p>
                <Link to="/dashboard/create-portfolio">
                    <Button variant="primary">Criar Portfólio</Button>
                </Link>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {portfolios.map((portfolio) => {
                        const objInfo = OBJECTIVE_INFO[portfolio.objective || 'growth'];
                        const horizonLabel = HORIZON_LABELS[portfolio.timeHorizon || 'long'];
                        const score = portfolioScores[portfolio.id] ?? portfolio.userConvictionScore ?? 5;

                        return (
                            <motion.div
                                key={portfolio.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                layout
                                className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-zinc-900"
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-amber-500 group-hover:border-amber-500/30 transition-colors">
                                            {getIcon(portfolio.type)}
                                        </div>
                                        <div className="relative">
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => startEdit(portfolio)}
                                                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" 
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setDeletingId(portfolio.id)}
                                                    className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" 
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-1 truncate">{portfolio.name}</h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">{getLabel(portfolio.type)}</p>

                                    {/* STRATEGIC TAGS & SCORE */}
                                    <div className="flex flex-wrap gap-2 mb-6 items-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${objInfo.bg} ${objInfo.color}`}>
                                            <Target size={10} />
                                            {objInfo.label}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-zinc-950 border border-zinc-800 text-zinc-400">
                                            {horizonLabel}
                                        </span>
                                        {/* Score Badge */}
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold border bg-zinc-950 ${getScoreColor(score)}`}>
                                            <Star size={10} fill="currentColor" />
                                            {score.toFixed(1)}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm text-zinc-400">Saldo Atual</span>
                                            <span className="text-xl font-mono text-white">
                                                R$ {portfolio.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-zinc-950/50 border-t border-zinc-800 p-4 flex justify-between items-center">
                                    <span className="text-xs text-zinc-500">
                                        {portfolio.currency} • Criado em {new Date(portfolio.createdAt).toLocaleDateString()}
                                    </span>
                                    <Link to={`/dashboard/portfolio/${portfolio.id}`} state={{ name: portfolio.name }}>
                                        <span className="text-xs font-medium text-amber-500 hover:text-amber-400 cursor-pointer">
                                            Abrir detalhes →
                                        </span>
                                    </Link>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        )}
      </div>

      {/* --- EDIT MODAL --- */}
      <AnimatePresence>
        {editingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Editar Portfólio</h3>
                        <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                        <Input 
                            label="Nome do Portfólio" 
                            value={editForm.name} 
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        />
                         <Input 
                            label="Descrição (Opcional)" 
                            value={editForm.description} 
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setEditingId(null)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveEdit}>Salvar Alterações</Button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {deletingId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl"
                >
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Excluir Portfólio?</h3>
                        <p className="text-zinc-400 text-sm">
                            Esta ação é irreversível. O portfólio e todos os dados serão removidos em conjunto.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" className="w-full" onClick={() => setDeletingId(null)}>Cancelar</Button>
                        <button 
                            onClick={handleDelete}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Excluir
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </DashboardLayout>
  );
};
