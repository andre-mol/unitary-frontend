/**
 * Settings Provider
 * 
 * Contexto React para compartilhar configurações globais do sistema
 * entre componentes. Carrega configurações na inicialização e fornece
 * funções helper para verificar flags específicas.
 */

import React, { createContext, useContext, ReactNode } from 'react'
import { useAppSettings } from '../../hooks/useAppSettings'
import type { AppSettings } from '../../lib/settingsService'

interface SettingsContextValue {
  settings: AppSettings
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  // Helper functions
  isMaintenanceMode: () => boolean
  isLockdownMode: () => boolean
  isSignupDisabled: () => boolean
  isExportEnabled: () => boolean
  isBetaFeaturesEnabled: () => boolean
  getGlobalBanner: () => AppSettings['global_banner']
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

interface SettingsProviderProps {
  children: ReactNode
}

/**
 * Provider de configurações do sistema
 * 
 * @example
 * ```tsx
 * <SettingsProvider>
 *   <App />
 * </SettingsProvider>
 * ```
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { settings, loading, error, refresh } = useAppSettings()

  const isMaintenanceMode = () => {
    return settings.maintenance_mode === true
  }

  const isLockdownMode = () => {
    return settings.lockdown_mode === true
  }

  const isSignupDisabled = () => {
    return settings.disable_signups === true
  }

  const isExportEnabled = () => {
    return settings.enable_exports === true
  }

  const isBetaFeaturesEnabled = () => {
    return settings.enable_beta_features === true
  }

  const getGlobalBanner = () => {
    return settings.global_banner
  }

  const value: SettingsContextValue = {
    settings,
    loading,
    error,
    refresh,
    isMaintenanceMode,
    isLockdownMode,
    isSignupDisabled,
    isExportEnabled,
    isBetaFeaturesEnabled,
    getGlobalBanner,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

/**
 * Hook para acessar o contexto de configurações
 * 
 * @throws Error se usado fora de SettingsProvider
 * 
 * @example
 * ```tsx
 * const { isMaintenanceMode, settings } = useSettings()
 * 
 * if (isMaintenanceMode()) {
 *   return <MaintenancePage />
 * }
 * ```
 */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  
  if (context === undefined) {
    throw new Error('useSettings deve ser usado dentro de SettingsProvider')
  }
  
  return context
}

