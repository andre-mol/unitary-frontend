/**
 * Global Banner Component
 * 
 * Exibe banner global no topo do site quando habilitado nas configurações.
 * Suporta variantes (info, warn, critical) e CTA opcional.
 */

import React from 'react'
import { useSettings } from './settings/SettingsProvider'
import { X, ExternalLink } from 'lucide-react'

/**
 * Componente de banner global
 * 
 * Exibe banner no topo do site quando global_banner.enabled === true.
 * Suporta variantes e CTA configurável.
 */
export function GlobalBanner() {
  const { getGlobalBanner, loading } = useSettings()
  const [dismissed, setDismissed] = React.useState(false)

  // Se ainda está carregando, não mostrar nada
  if (loading) {
    return null
  }

  const banner = getGlobalBanner()

  // Se banner não está habilitado ou foi fechado, não renderizar
  if (!banner.enabled || !banner.text || dismissed) {
    return null
  }

  // Estilos por variante
  const variantStyles = {
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-300',
      cta: 'text-blue-400 hover:text-blue-300',
    },
    warn: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/50',
      text: 'text-yellow-300',
      cta: 'text-yellow-400 hover:text-yellow-300',
    },
    critical: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-300',
      cta: 'text-red-400 hover:text-red-300',
    },
  }

  const styles = variantStyles[banner.variant] || variantStyles.info

  return (
    <div
      className={`${styles.bg} ${styles.border} border-b px-4 py-3 relative z-50`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-3">
          <p className={`${styles.text} text-sm font-medium flex-1`}>
            {banner.text}
          </p>

          {banner.ctaText && banner.ctaUrl && (
            <a
              href={banner.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.cta} text-sm font-medium flex items-center gap-1 underline transition-colors`}
            >
              {banner.ctaText}
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className={`${styles.text} hover:opacity-70 transition-opacity p-1`}
          aria-label="Fechar banner"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

