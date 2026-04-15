/**
 * Cookie Consent Banner
 * 
 * AIDEV-NOTE: LGPD-compliant consent banner. Appears on first visit and allows users to
 * accept/reject/customize analytics and marketing cookies. Essential cookies are always enabled.
 */

import { useState } from 'react';
import { useConsent } from './ConsentProvider';
import { Button } from '../ui/Button';
import { X, Settings, Check } from 'lucide-react';

export function CookieConsentBanner() {
  const { showBanner, acceptAll, rejectNonEssential, updateConsent, consent } = useConsent();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!showBanner) {
    return null;
  }

  const handleCustomize = () => {
    setIsExpanded(true);
  };

  const handleSavePreferences = () => {
    setIsExpanded(false);
    // Consent is already saved via updateConsent
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-zinc-900 border-t-2 border-amber-500 shadow-2xl animate-slide-up"
      style={{
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {!isExpanded ? (
          // Compact mode
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                🍪 Gerenciamento de Cookies e Privacidade
              </h3>
              <p className="text-sm text-zinc-300">
                Usamos cookies essenciais para autenticação e segurança. Você pode optar por
                permitir cookies de analytics e marketing para nos ajudar a melhorar sua
                experiência. Saiba mais em nossa{' '}
                <a href="#/dashboard/privacidade" className="text-amber-500 hover:text-amber-400 underline">
                  Política de Privacidade
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={rejectNonEssential}>
                Rejeitar não-essenciais
              </Button>
              <Button variant="outline" size="sm" onClick={handleCustomize}>
                <Settings className="w-4 h-4 mr-2" />
                Personalizar
              </Button>
              <Button variant="primary" size="sm" onClick={acceptAll}>
                Aceitar todos
              </Button>
            </div>
          </div>
        ) : (
          // Expanded mode
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Personalizar Preferências</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-zinc-400 hover:text-white transition"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Essential - Always on */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-white">Cookies Essenciais</span>
                    <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded">
                      Sempre ativo
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Necessários para autenticação, segurança e funcionalidades básicas do site.
                  </p>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">Analytics</span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Nos ajuda a entender como você usa o site para melhorar a experiência.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent?.analytics ?? false}
                    onChange={(e) => updateConsent('analytics', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">Marketing</span>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Usado para personalizar anúncios e medir campanhas (atualmente não utilizado).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent?.marketing ?? false}
                    onChange={(e) => updateConsent('marketing', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsExpanded(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleSavePreferences}>
                Salvar preferências
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
