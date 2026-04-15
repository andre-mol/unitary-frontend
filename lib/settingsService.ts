/**
 * Settings Service
 * 
 * Serviço para ler configurações globais do sistema do banco de dados.
 * Usa RPC patrio_admin_get_settings() quando disponível, com fallback
 * para valores padrão seguros quando não autenticado ou sem permissão.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase'

// Tipos para as configurações
export interface AppSettings {
  maintenance_mode: boolean
  lockdown_mode: boolean
  disable_signups: boolean
  enable_exports: boolean
  enable_beta_features: boolean
  global_banner: {
    enabled: boolean
    text: string
    variant: 'info' | 'warn' | 'critical'
    ctaText: string
    ctaUrl: string
  }
  rate_limits: {
    enabled: boolean
    user: {
      requestsPerMinute: number
      heavyActionsPerMinute: number
    }
    admin: {
      requestsPerMinute: number
      heavyActionsPerMinute: number
    }
  }
}

// Valores padrão seguros (manutenção desativada)
const DEFAULT_SETTINGS: AppSettings = {
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

// Cache simples (sem expiração por enquanto)
let settingsCache: AppSettings | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60000 // 1 minuto

/**
 * Converte o formato do banco (SettingsMap) para AppSettings
 */
function parseSettings(settingsMap: Record<string, any>): AppSettings {
  const getBoolean = (key: string): boolean => {
    const setting = settingsMap[key]
    if (!setting) return DEFAULT_SETTINGS[key as keyof AppSettings] as boolean
    return setting.value === true || setting.value === 'true'
  }

  const getJson = <T>(key: string, defaultValue: T): T => {
    const setting = settingsMap[key]
    if (!setting || !setting.value) return defaultValue
    try {
      return typeof setting.value === 'string'
        ? JSON.parse(setting.value)
        : setting.value
    } catch {
      return defaultValue
    }
  }

  return {
    maintenance_mode: getBoolean('maintenance_mode'),
    lockdown_mode: getBoolean('lockdown_mode'),
    disable_signups: getBoolean('disable_signups'),
    enable_exports: getBoolean('enable_exports'),
    enable_beta_features: getBoolean('enable_beta_features'),
    global_banner: getJson('global_banner', DEFAULT_SETTINGS.global_banner),
    rate_limits: getJson('rate_limits', DEFAULT_SETTINGS.rate_limits),
  }
}

/**
 * Busca configurações do banco de dados
 * Retorna valores padrão se não conseguir acessar (usuário não-admin ou erro)
 */
export async function getAppSettings(): Promise<AppSettings> {
  // Verificar cache
  const now = Date.now()
  if (settingsCache && now - cacheTimestamp < CACHE_DURATION) {
    return settingsCache
  }

  // Se Supabase nao esta configurado, retornar padroes
  if (!isSupabaseConfigured()) {
    return DEFAULT_SETTINGS
  }

  try {
    const supabase = getSupabaseClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      settingsCache = DEFAULT_SETTINGS
      cacheTimestamp = now
      return DEFAULT_SETTINGS
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc('patrio_is_admin')

    if (adminError || !isAdmin) {
      settingsCache = DEFAULT_SETTINGS
      cacheTimestamp = now
      return DEFAULT_SETTINGS
    }

    // Usuario admin: carregar configuracoes reais
    const { data, error } = await supabase.rpc('patrio_admin_get_settings')

    if (error) {
      settingsCache = DEFAULT_SETTINGS
      cacheTimestamp = now
      return DEFAULT_SETTINGS
    }

    // Parsear e cachear
    const parsed = parseSettings(data || {})
    settingsCache = parsed
    cacheTimestamp = now
    return parsed
  } catch {
    settingsCache = DEFAULT_SETTINGS
    cacheTimestamp = now
    return DEFAULT_SETTINGS
  }
}

/**
 * Limpa o cache (útil após atualizações)
 */
export function clearSettingsCache(): void {
  settingsCache = null
  cacheTimestamp = 0
}

/**
 * Retorna valores padrão (útil para SSR ou quando não há conexão)
 */
export function getDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS }
}

