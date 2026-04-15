/**
 * Privacy Settings Page
 * 
 * AIDEV-NOTE: LGPD-compliant privacy settings page. Allows users to manage their consent
 * preferences for analytics and marketing cookies.
 */

import React from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useConsent } from '../consent/ConsentProvider';
import { Button } from '../ui/Button';
import { Shield, Check, X, AlertTriangle } from 'lucide-react';
import { brand } from '../../config/brand';

export const PrivacySettingsPage: React.FC = () => {
  const { consent, updateConsent, clearAll, hasConsent } = useConsent();

  const handleToggle = (category: 'analytics' | 'marketing', value: boolean) => {
    updateConsent(category, value);
  };

  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as preferências de consentimento? O banner de cookies aparecerá novamente na próxima visita.')) {
      clearAll();
    }
  };

  const consentDate = consent?.ts
    ? new Date(consent.ts).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <DashboardLayout title="Privacidade e Cookies" subtitle="Gerencie suas preferências de privacidade e consentimento.">
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Sobre Privacidade no {brand.name}</h3>
            <p className="text-sm text-zinc-400">
              Respeitamos sua privacidade e cumprimos a LGPD. Cookies essenciais são necessários
              para o funcionamento do site (autenticação, segurança). Você pode escolher permitir
              ou não cookies de analytics e marketing.
            </p>
          </div>
        </div>

        {/* Consent Status */}
        {consent && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-300">Última atualização</span>
              <span className="text-sm text-zinc-400">{consentDate}</span>
            </div>
          </div>
        )}

        {/* Cookie Categories */}
        <div className="space-y-4">
          {/* Essential - Always on */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-white">Cookies Essenciais</h3>
                  <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-1 rounded">
                    Sempre ativo
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-3">
                  Essenciais para autenticação, segurança e funcionalidades básicas do site.
                  Estes cookies não podem ser desabilitados.
                </p>
                <div className="text-xs text-zinc-500 space-y-1">
                  <div>• Autenticação de usuário (Supabase)</div>
                  <div>• Sessão e segurança</div>
                  <div>• Preferências básicas do app</div>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Nos ajuda a entender como você usa o site para melhorar a experiência e
                  identificar problemas. Usamos PostHog para analytics (sem captura de dados
                  pessoais ou valores financeiros).
                </p>
                <div className="text-xs text-zinc-500 space-y-1">
                  <div>• Eventos de navegação genéricos</div>
                  <div>• Métricas de uso (sem PII)</div>
                  <div>• Análise de performance</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={hasConsent('analytics')}
                  onChange={(e) => handleToggle('analytics', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            {hasConsent('analytics') && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Analytics está ativo</span>
                </div>
              </div>
            )}
          </div>

          {/* Marketing */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Marketing</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Usado para personalizar anúncios e medir campanhas de marketing. Atualmente
                  não utilizamos cookies de marketing, mas você pode optar por permitir para
                  uso futuro.
                </p>
                <div className="text-xs text-zinc-500 space-y-1">
                  <div>• Pixels de rastreamento (futuro)</div>
                  <div>• Medição de campanhas (futuro)</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={hasConsent('marketing')}
                  onChange={(e) => handleToggle('marketing', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
            {hasConsent('marketing') && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Check className="w-4 h-4" />
                  <span>Marketing está ativo</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Ações</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="w-full md:w-auto"
            >
              Limpar todas as preferências
            </Button>
            <p className="text-xs text-zinc-500">
              Isso removerá todas as suas preferências de consentimento. O banner de cookies
              aparecerá novamente na próxima visita.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
