/**
 * Hook useAppSettings
 * 
 * Hook React para acessar configuracoes globais do sistema.
 * Carrega automaticamente na inicializacao e fornece estado de loading/error.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAppSettings, clearSettingsCache, type AppSettings } from '../lib/settingsService'

interface UseAppSettingsReturn {
  settings: AppSettings
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Hook para acessar configuracoes do sistema
 * 
 * @example
 * ```tsx
 * const { settings, loading } = useAppSettings()
 * 
 * if (settings.maintenance_mode) {
 *   return <MaintenancePage />
 * }
 * ```
 */
export function useAppSettings(): UseAppSettingsReturn {
  const fallbackSettings = useMemo<AppSettings>(() => getDefaultSettings(), [])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['appSettings'],
    queryFn: getAppSettings,
    staleTime: 60 * 1000,
  })

  const refresh = async () => {
    clearSettingsCache()
    await refetch()
  }

  return {
    settings: data ?? fallbackSettings,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refresh,
  }
}

// Helper para obter valores padrao (usado na inicializacao)
function getDefaultSettings(): AppSettings {
  return {
    maintenance_mode: false,
    lockdown_mode: false,
    disable_signups: false,
    enable_exports: true,
    enable_beta_features: false,
    global_banner: {
      enabled: false,
      text: '',
      variant: 'info',
      ctaText: '',
      ctaUrl: '',
    },
    rate_limits: {
      enabled: false,
      user: {
        requestsPerMinute: 120,
        heavyActionsPerMinute: 20,
      },
      admin: {
        requestsPerMinute: 240,
        heavyActionsPerMinute: 60,
      },
    },
  }
}
