
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Wallet, FileText, ChevronDown,
  Plus, History, Star, TrendingUp, CircleDollarSign, Calculator,
  Target, Banknote, CalendarClock, Home, Percent, PiggyBank, ShieldCheck, Scale, Ruler,
  Lock, Bug, MessageSquare
} from 'lucide-react';
import { PORTFOLIO_UPDATE_EVENT } from '../../lib/portfolioService';
import { Portfolio } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../../lib/queryKeys';
import { fetchPortfolios, fetchGlobalEvents, fetchEvolutionData } from '../../lib/queries/portfolios';
import { fetchGoals, fetchObjectives, fetchBudget, fetchExpenses } from '../../lib/queries/planning';
import { captureSidebarNavClicked } from '../../lib/analytics';
import { brand } from '../../config/brand';
import { GC_TIMES, STALE_TIMES } from '../../lib/queryClient';

const NavItem: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onHover?: () => void;
}> = ({ to, icon, label, active, onHover }) => {
  const handleClick = () => {
    // AIDEV-NOTE: Capture sidebar navigation click (label only, no IDs)
    captureSidebarNavClicked(label);
  };

  return (
    <Link
      to={to}
      onMouseEnter={onHover}
      onClick={handleClick}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${active
          ? 'bg-zinc-900 text-amber-500 border border-zinc-800 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 border border-transparent'
        }`}
    >
      <span className={`${active ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
};

const NavItemLocked: React.FC<{
  icon: React.ReactNode;
  label: string;
  featureName: string;
  to?: string; // Nova prop opcional
}> = ({ icon, label, featureName, to }) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (to) {
      // Navegar para a rota real, deixando PlanRoute mostrar UpgradePage
      navigate(to);
    } else {
      // Comportamento padrão: redirecionar para /precos
      navigate('/precos', { state: { featureName } });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-zinc-500/60 hover:text-zinc-400 border border-transparent cursor-pointer opacity-60 hover:opacity-80"
    >
      <span className="text-zinc-600 group-hover:text-zinc-500 flex items-center gap-2">
        {icon}
        <Lock size={12} className="text-zinc-600" />
      </span>
      {label}
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [recentPortfolios, setRecentPortfolios] = useState<Portfolio[]>([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canAccessPlanning } = useSubscription();

  // Dropdown States
  const [isPortfoliosOpen, setIsPortfoliosOpen] = useState(false);
  const [isCalculatorsOpen, setIsCalculatorsOpen] = useState(false);

  const portfoliosQuery = useQuery({
    queryKey: queryKeys.portfolios(user?.id),
    queryFn: fetchPortfolios,
    enabled: !!user,
    staleTime: STALE_TIMES.USER_DATA,
    gcTime: GC_TIMES.DEFAULT,
  });

  useEffect(() => {
    const all = portfoliosQuery.data ?? [];
    const sorted = all.sort((a, b) => {
      const dateA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    setRecentPortfolios(sorted.slice(0, 5));
  }, [portfoliosQuery.data]);

  useEffect(() => {
    // Event Listener for real-time sidebar updates
    const handleUpdate = () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.portfolios(user.id) });
      }
    };
    window.addEventListener(PORTFOLIO_UPDATE_EVENT, handleUpdate);

    // Auto-open logic
    if (location.pathname.includes('/dashboard/portfolio')) {
      setIsPortfoliosOpen(true);
    }
    if (location.pathname.includes('/dashboard/calculadoras')) {
      setIsCalculatorsOpen(true);
    }

    return () => {
      window.removeEventListener(PORTFOLIO_UPDATE_EVENT, handleUpdate);
    };
  }, [location.pathname, queryClient, user?.id]);

  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const prefetchDashboard = useCallback(() => {
    if (!user?.id) return;
    if (!queryClient.getQueryData(queryKeys.portfolios(user.id))) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.portfolios(user.id),
        queryFn: fetchPortfolios,
        staleTime: STALE_TIMES.USER_DATA,
      });
    }
    void queryClient.prefetchQuery({
      queryKey: queryKeys.evolution(user.id, null, '6M'),
      queryFn: () => fetchEvolutionData(undefined, '6M'),
      staleTime: STALE_TIMES.HISTORICAL,
    });
  }, [user?.id, queryClient]);

  const prefetchGoals = useCallback(() => {
    if (!user?.id || !canAccessPlanning) return;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.goals(user.id),
      queryFn: fetchGoals,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.objectives(user.id),
      queryFn: fetchObjectives,
    });
  }, [user?.id, queryClient, canAccessPlanning]);

  const prefetchBudget = useCallback(() => {
    if (!user?.id || !canAccessPlanning) return;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.budget(user.id, monthKey),
      queryFn: () => fetchBudget(monthKey),
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.expenses(user.id, monthKey),
      queryFn: () => fetchExpenses(monthKey),
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.goals(user.id),
      queryFn: fetchGoals,
    });
  }, [user?.id, queryClient, canAccessPlanning, monthKey]);

  const prefetchTimeline = useCallback(() => {
    if (!user?.id || !canAccessPlanning) return;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.events(user.id, 'global'),
      queryFn: fetchGlobalEvents,
    });
  }, [user?.id, queryClient, canAccessPlanning]);

  const isPortfolioSectionActive = location.pathname.includes('/dashboard/portfolio') || location.pathname.includes('/dashboard/global-profitability');
  const isCalculatorSectionActive = location.pathname.includes('/dashboard/calculadoras');

  return (
    <aside className="w-64 h-screen bg-zinc-950 border-r border-zinc-900 flex flex-col fixed left-0 top-0 z-40 hidden md:flex">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-900/50">
        <Link to="/dashboard" className="hover:opacity-80 transition-opacity">
          <img
            src="/assets/logos/logo-dashboard.svg"
            alt={`${brand.name} Logo`}
            className="h-8 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">

        {/* --- PRINCIPAL --- */}
        <div>
          <p className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Principal</p>
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard size={18} />}
            label="Visão Geral"
            onHover={location.pathname === '/dashboard' ? undefined : prefetchDashboard}
            active={location.pathname === '/dashboard'}
          />
        </div>

        {/* --- INVESTIMENTOS --- */}
        <div>
          <p className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Investimentos</p>

          {/* Collapsible Portfolios Menu */}
          <div className="space-y-1 mb-1">
            <button
              onClick={() => setIsPortfoliosOpen(!isPortfoliosOpen)}
              className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isPortfolioSectionActive && !isPortfoliosOpen
                  ? 'bg-zinc-900 text-amber-500 border border-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 border border-transparent'
                }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${isPortfolioSectionActive ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  <Wallet size={18} />
                </span>
                Portfólios
              </div>
              <div className={`text-zinc-600 transition-transform duration-200 ${isPortfoliosOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} />
              </div>
            </button>

            <AnimatePresence>
              {isPortfoliosOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-4 space-y-1 pb-2">
                    {/* List Recent Portfolios */}
                    {recentPortfolios.map(p => (
                      <Link
                        key={p.id}
                        to={`/dashboard/portfolio/${p.id}`}
                        className={`block pl-6 py-2 text-xs border-l transition-colors truncate ${location.pathname === `/dashboard/portfolio/${p.id}`
                            ? 'border-amber-500 text-amber-500 font-medium bg-amber-500/5'
                            : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                          }`}
                      >
                        {p.name}
                      </Link>
                    ))}

                    {/* Action Links */}
                    <div className="pt-1 space-y-1">
                      <Link
                        to="/dashboard/portfolios"
                        className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname === '/dashboard/portfolios'
                            ? 'border-amber-500 text-amber-500 font-medium'
                            : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                          }`}
                      >
                        <span className={`w-1 h-1 rounded-full transition-colors ${location.pathname === '/dashboard/portfolios' ? 'bg-current' : 'bg-zinc-600 group-hover:bg-amber-500'}`}></span>
                        Ver todos
                      </Link>
                      <Link
                        to="/dashboard/create-portfolio"
                        className="flex items-center gap-2 pl-6 py-2 text-xs border-l border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50 transition-colors group"
                      >
                        <Plus size={10} className="group-hover:text-amber-500" />
                        Novo Portfólio
                      </Link>

                      <Link
                        to="/dashboard/global-profitability"
                        className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname === '/dashboard/global-profitability'
                            ? 'text-amber-500 border-amber-500 font-medium'
                            : 'text-zinc-500 border-zinc-800 hover:text-amber-500 hover:border-amber-500/50'
                          }`}
                      >
                        <TrendingUp size={10} className={`${location.pathname === '/dashboard/global-profitability' ? 'text-amber-500' : 'text-zinc-500 group-hover:text-amber-500'}`} />
                        Rentabilidade Global
                      </Link>

                      <Link
                        to="/dashboard/global-history"
                        className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname === '/dashboard/global-history'
                            ? 'text-amber-500 border-amber-500 font-medium'
                            : 'text-zinc-500 border-zinc-800 hover:text-amber-500 hover:border-amber-500/50'
                          }`}
                      >
                        <History size={10} className={`${location.pathname === '/dashboard/global-history' ? 'text-amber-500' : 'text-zinc-500 group-hover:text-amber-500'}`} />
                        Histórico Geral
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <NavItem
            to="/dashboard/contributions"
            icon={<CircleDollarSign size={18} />}
            label="Aportes"
            active={location.pathname === '/dashboard/contributions'}
          />
          <NavItem
            to="/dashboard/notas"
            icon={<Star size={18} />}
            label="Notas"
            active={location.pathname === '/dashboard/notas'}
          />
        </div>

        {/* --- FERRAMENTAS --- */}
        <div>
          <p className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Ferramentas</p>

          {/* Calculadoras Dropdown */}
          <div className="space-y-1">
            <button
              onClick={() => setIsCalculatorsOpen(!isCalculatorsOpen)}
              className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isCalculatorSectionActive && !isCalculatorsOpen
                  ? 'bg-zinc-900 text-amber-500 border border-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 border border-transparent'
                }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${isCalculatorSectionActive ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  <Calculator size={18} />
                </span>
                Calculadoras
              </div>
              <div className={`text-zinc-600 transition-transform duration-200 ${isCalculatorsOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={14} />
              </div>
            </button>

            <AnimatePresence>
              {isCalculatorsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pl-4 space-y-1 pb-2">
                    <Link
                      to="/dashboard/calculadoras/alugar-vs-financiar"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('alugar-vs-financiar')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <Home size={10} /> Alugar vs Financiar
                    </Link>
                    <Link
                      to="/dashboard/calculadoras/juros-compostos"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('juros-compostos')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <Percent size={10} /> Juros Compostos
                    </Link>
                    <Link
                      to="/dashboard/calculadoras/comparador-investimentos"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('comparador-investimentos')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <Scale size={10} /> Comparador de Invest.
                    </Link>
                    <Link
                      to="/dashboard/calculadoras/reserva-emergencia"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('reserva-emergencia')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <ShieldCheck size={10} /> Reserva de Emergência
                    </Link>
                    <Link
                      to="/dashboard/calculadoras/bazin"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('bazin')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <Target size={10} /> Fórmula Bazin
                    </Link>
                    <Link
                      to="/dashboard/calculadoras/graham"
                      className={`flex items-center gap-2 pl-6 py-2 text-xs border-l transition-colors group ${location.pathname.includes('graham')
                          ? 'border-amber-500 text-amber-500 font-medium'
                          : 'border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/50'
                        }`}
                    >
                      <Ruler size={10} /> Fórmula Graham
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* --- PLANEJAMENTO --- */}
        <div>
          <p className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Planejamento</p>
          {canAccessPlanning ? (
            <>
              <NavItem
                to="/dashboard/metas"
                icon={<Target size={18} />}
                label="Minhas Metas"
                onHover={prefetchGoals}
                active={location.pathname === '/dashboard/metas'}
              />
              <NavItem
                to="/dashboard/orcamento"
                icon={<Banknote size={18} />}
                label="Orçamento Doméstico"
                onHover={prefetchBudget}
                active={location.pathname === '/dashboard/orcamento'}
              />
              <NavItem
                to="/dashboard/linha-tempo"
                icon={<CalendarClock size={18} />}
                label="Linha do Tempo"
                onHover={prefetchTimeline}
                active={location.pathname === '/dashboard/linha-tempo'}
              />
            </>
          ) : (
            <>
              <NavItemLocked
                icon={<Target size={18} />}
                label="Minhas Metas"
                featureName="Planejamento (Metas, Orçamento e Linha do Tempo)"
                to="/dashboard/metas"
              />
              <NavItemLocked
                icon={<Banknote size={18} />}
                label="Orçamento Doméstico"
                featureName="Planejamento (Metas, Orçamento e Linha do Tempo)"
                to="/dashboard/orcamento"
              />
              <NavItemLocked
                icon={<CalendarClock size={18} />}
                label="Linha do Tempo"
                featureName="Planejamento (Metas, Orçamento e Linha do Tempo)"
                to="/dashboard/linha-tempo"
              />
            </>
          )}
        </div>

        {/* --- GESTÃO --- */}
        <div>
          <p className="px-3 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Gestão</p>
          <NavItem
            to="/reports"
            icon={<FileText size={18} />}
            label="Relatórios"
            active={location.pathname === '/reports' || location.pathname === '/dashboard/relatorios'}
          />
        </div>

        {/* Reportar Bug - Promotional Banner */}
        <div className="px-3 mt-4">
          <Link
            to="/dashboard/reportar-bug"
            className={`group relative block overflow-hidden rounded-xl p-4 transition-all duration-300 ${location.pathname === '/dashboard/reportar-bug'
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30'
                : 'bg-gradient-to-br from-amber-500/90 to-amber-600/90 hover:from-amber-500 hover:to-amber-600 hover:shadow-lg hover:shadow-amber-500/30'
              }`}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="bug-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 0 10 L 10 0 L 20 10 L 10 20 Z" fill="white" opacity="0.3" />
                    <path d="M 10 0 L 20 10 L 10 20 L 0 10 Z" fill="white" opacity="0.2" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#bug-pattern)" />
              </svg>
            </div>

            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Bug size={16} className="text-white" />
                </div>
                <span className="text-white/90 text-xs font-semibold uppercase tracking-wider">
                  Reportar Bug
                </span>
              </div>
              <h3 className="text-white font-bold text-sm mb-1 leading-tight">
                Ajude-nos a melhorar
              </h3>
              <p className="text-white/80 text-xs mb-3 leading-relaxed">
                Encontrou um problema? Reporte agora
              </p>
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-[10px] font-medium uppercase tracking-wider">
                  Feedback
                </span>
                <div className="px-3 py-1.5 bg-white text-amber-600 rounded-lg text-xs font-bold transition-transform group-hover:scale-105">
                  Reportar
                </div>
              </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" style={{ transition: 'transform 0.6s ease-in-out' }}></div>
          </Link>
        </div>

      </div>
    </aside>
  );
};
