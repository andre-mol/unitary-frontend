/**
 * Maintenance Mode Component
 *
 * Blocks access when maintenance_mode or lockdown_mode is active.
 * Allows access only for admins/superadmins.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettings } from './settings/SettingsProvider';
import { useAuth } from './auth/AuthProvider';
import { isSupabaseConfigured } from '../config/supabase';
import { Wrench, Shield, AlertTriangle } from 'lucide-react';
import { queryKeys } from '../lib/queryKeys';
import { fetchUserRole } from '../lib/queries/user';

interface MaintenanceModeProps {
  children: React.ReactNode;
}

export function MaintenanceMode({ children }: MaintenanceModeProps) {
  const { isMaintenanceMode, isLockdownMode, loading: settingsLoading } = useSettings();
  const { user } = useAuth();

  const shouldCheckRole = (isMaintenanceMode() || isLockdownMode()) && !!user && isSupabaseConfigured();

  const { data: role, isLoading: checkingRole } = useQuery({
    queryKey: queryKeys.role(user?.id),
    queryFn: () => fetchUserRole(user!.id),
    enabled: shouldCheckRole,
  });

  const isAdmin = role === 'admin' || role === 'superadmin';

  if (settingsLoading || (shouldCheckRole && checkingRole)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-400">Carregando...</div>
      </div>
    );
  }

  if (!isMaintenanceMode() && !isLockdownMode()) {
    return <>{children}</>;
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  const isLockdown = isLockdownMode();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
        <div className="mb-6 flex justify-center">
          {isLockdown ? (
            <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
              <Shield className="text-red-400" size={40} />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
              <Wrench className="text-amber-400" size={40} />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          {isLockdown ? 'Sistema em Lockdown' : 'Sistema em Manutencao'}
        </h1>

        <div className="mb-6">
          {isLockdown ? (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
              <p className="text-sm text-red-300">
                O sistema esta temporariamente indisponivel devido a uma emergencia.
                Por favor, tente novamente mais tarde.
              </p>
            </div>
          ) : (
            <p className="text-zinc-400">
              Estamos realizando manutencoes no sistema para melhorar sua experiencia.
              O servico estara disponivel em breve.
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm text-zinc-500">
          <p>Por favor, verifique novamente em alguns minutos.</p>
          <p className="text-xs">
            Se voce e um administrador e precisa de acesso, verifique se esta logado
            com uma conta de administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
