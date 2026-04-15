import React, { useState, useRef, useEffect } from 'react';
import { Bell, Menu, Settings, User, LogOut, ChevronRight, Crown, Zap, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { authService } from '../../lib/authService';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSearch } from '../search/AppSearch';
import { brand } from '../../config/brand';
import { NotificationsDropdown } from './NotificationsDropdown';

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/');
    } catch (error) {
      console.error("Erro ao sair", error);
    }
  };

  // Obter iniciais do nome ou email
  const getInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  return (
    <header className="h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-zinc-400 hover:text-white">
          <Menu size={24} />
        </button>
        <div>
          <h1 className="text-white font-semibold text-lg">{title}</h1>
          {subtitle && <p className="text-zinc-500 text-xs hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <AppSearch />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* User Avatar with Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-black cursor-pointer hover:ring-2 hover:ring-amber-500/50 transition-all"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || user.email}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials()
            )}
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50"
              >
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-black">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name || user.email}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {user?.name || 'Usuário'}
                      </p>
                      <p className="text-zinc-400 text-xs truncate">
                        {user?.email || ''}
                      </p>
                    </div>
                    <Link
                      to="/dashboard/configuracoes"
                      onClick={() => setIsMenuOpen(false)}
                      className="p-1 text-zinc-400 hover:text-amber-400 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  {/* Plan Badge */}
                  <div className="px-4 py-2 mb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">Plano:</span>
                      <span className={`font-medium flex items-center gap-1 ${plan === 'inicial' ? 'text-zinc-400' :
                        plan === 'essencial' ? 'text-amber-400' :
                          'text-purple-400'
                        }`}>
                        {plan === 'inicial' ? 'Inicial' : plan === 'essencial' ? 'Essencial' : brand.proPlanDisplayName}
                        {plan === 'essencial' && <Zap size={12} />}
                        {plan === 'patrio_pro' && <Crown size={12} />}
                      </span>
                    </div>
                  </div>

                  {/* Profile Link */}
                  <Link
                    to="/dashboard/configuracoes"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition-colors"
                  >
                    <User size={18} className="text-zinc-400" />
                    <span>Meu Perfil</span>
                  </Link>

                  {/* Settings Link */}
                  <Link
                    to="/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition-colors"
                  >
                    <Settings size={18} className="text-zinc-400" />
                    <span>Configurações</span>
                  </Link>

                  {/* Upgrade Button (only for inicial/essencial) */}
                  {plan !== 'patrio_pro' && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/dashboard/planos');
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-amber-400 transition-colors"
                    >
                      {plan === 'inicial' ? (
                        <>
                          <Zap size={18} className="text-zinc-400" />
                          <span>Upgrade</span>
                        </>
                      ) : (
                        <>
                          <Crown size={18} className="text-zinc-400" />
                          <span>Upgrade para Max</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Support Link */}
                  <Link
                    to="/dashboard/suporte"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition-colors"
                  >
                    <MessageSquare size={18} className="text-zinc-400" />
                    <span>Suporte</span>
                  </Link>

                  {/* Divider */}
                  <div className="my-2 border-t border-zinc-800"></div>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-red-400 transition-colors"
                  >
                    <LogOut size={18} className="text-zinc-400" />
                    <span>Sair</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
