import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { useAuth } from '../auth/AuthProvider';
import { getSupabaseClient } from '../../config/supabase';
import { authService } from '../../lib/authService';
import { Bell, ShieldCheck, SunMoon, Globe, LogOut, FileText, Mail } from 'lucide-react';
import { queryKeys } from '../../lib/queryKeys';
import { DEFAULT_USER_SETTINGS, fetchUserSettings, type UserSettings } from '../../lib/queries/user';
import { useCacheSettings } from '../cache/CacheProvider';
import { formatVersionDate } from '../../lib/legal/versions';

export const SettingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { cacheEnabled, setCacheEnabled, clearLocalCache } = useCacheSettings();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: UserSettings) => {
      const supabase = getSupabaseClient();
      if (!user) {
        throw new Error('Usuario nao autenticado.');
      }

      // AIDEV-NOTE: Detecta se houve mudança em consentimentos para mostrar mensagem específica
      const consentChanged =
        (initialSettings.marketingEmailsOptIn !== nextSettings.marketingEmailsOptIn) ||
        (initialSettings.productUpdatesOptIn !== nextSettings.productUpdatesOptIn);

      const payload = {
        user_id: user.id,
        theme: nextSettings.theme,
        currency: nextSettings.currency,
        locale: nextSettings.locale,
        notifications_email: nextSettings.notificationsEmail,
        marketing_emails_opt_in: nextSettings.marketingEmailsOptIn,
        product_updates_opt_in: nextSettings.productUpdatesOptIn,
      };

      const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      return { nextSettings, consentChanged };
    },
    onSuccess: ({ nextSettings, consentChanged }) => {
      queryClient.setQueryData(queryKeys.userSettings(user?.id), nextSettings);
      setInitialSettings(nextSettings);
      // Mensagem específica para mudanças de consentimento
      if (consentChanged) {
        setMessage('Preferências de e-mail atualizadas com sucesso.');
      } else {
        setMessage('Configuracoes salvas com sucesso.');
      }
    },
  });

  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: queryKeys.userSettings(user?.id),
    queryFn: () => fetchUserSettings(user!.id),
    enabled: !!user && !authLoading,
  });

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    setLoading(settingsLoading);
    setMessage(null);

    if (settingsError) {
      const messageText = settingsError instanceof Error
        ? settingsError.message
        : 'Nao foi possivel carregar suas configuracoes.';
      setMessage(messageText);
      return;
    }

    if (settingsData) {
      setSettings(settingsData);
      setInitialSettings(settingsData);
    }
  }, [authLoading, user, settingsData, settingsLoading, settingsError]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const { userSettingsSchema } = await import('../../lib/validation/schemas');
    const validation = userSettingsSchema.safeParse(settings);
    if (!validation.success) {
      setMessage(validation.error.issues[0]?.message ?? 'Dados invalidos.');
      return;
    }

    setSaving(true);
    try {
      await saveMutation.mutateAsync(settings);
    } catch (error) {
      const messageText = error instanceof Error
        ? error.message
        : 'Nao foi possivel salvar as configuracoes.';
      setMessage(messageText);
      // AIDEV-NOTE: Em caso de erro de rede, o usuário pode tentar novamente.
      // O estado local mantém as mudanças até que sejam salvas com sucesso.
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setSecurityMessage(null);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut({ scope: 'global' });
      await authService.signOut();
      setSecurityMessage('Sessao encerrada em todos os dispositivos.');
    } catch (error) {
      const messageText = error instanceof Error
        ? error.message
        : 'Nao foi possivel encerrar todas as sessoes.';
      setSecurityMessage(messageText);
    }
  };

  if (loading || authLoading) {
    return (
      <DashboardLayout title="Configuracoes" subtitle="Preferencias da sua conta.">
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configuracoes" subtitle="Preferencias da sua conta.">
      <div className="space-y-8">
        {message && (
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-300 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <SunMoon size={18} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Preferencias do app</h2>
                <p className="text-sm text-zinc-500">Personalize a experiencia.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Tema</label>
                <select
                  className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none"
                  value={settings.theme}
                  onChange={(e) => setSettings((prev) => ({ ...prev, theme: e.target.value as UserSettings['theme'] }))}
                >
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
                <p className="text-xs text-zinc-500 mt-2">Preferencia salva para uso futuro.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Moeda</label>
                <select
                  className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none"
                  value={settings.currency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value as UserSettings['currency'] }))}
                >
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Locale</label>
                <select
                  className="w-full bg-zinc-900/50 text-white border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none"
                  value={settings.locale}
                  onChange={(e) => setSettings((prev) => ({ ...prev, locale: e.target.value as UserSettings['locale'] }))}
                >
                  <option value="pt-BR">pt-BR</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail size={18} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Preferências de e-mail</h2>
                <p className="text-sm text-zinc-500">Controle quais e-mails você deseja receber.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-sm text-white font-medium">Notificações por e-mail</p>
                  <p className="text-xs text-zinc-500">E-mails transacionais importantes sobre sua conta (obrigatórios para segurança).</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationsEmail}
                  onChange={(e) => setSettings((prev) => ({ ...prev, notificationsEmail: e.target.checked }))}
                  className="h-5 w-5 accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-sm text-white font-medium">E-mails de marketing e atualizações de produto</p>
                  <p className="text-xs text-zinc-500">Receba ofertas promocionais, conteúdo de marketing e novidades do Patri. Você pode cancelar a qualquer momento.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.marketingEmailsOptIn && settings.productUpdatesOptIn}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setSettings((prev) => ({
                      ...prev,
                      marketingEmailsOptIn: newValue,
                      productUpdatesOptIn: newValue
                    }));
                  }}
                  className="h-5 w-5 accent-amber-500"
                />
              </label>
            </div>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText size={18} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Termos</h2>
                <p className="text-sm text-zinc-500">Documentos legais e versões aceitas.</p>
              </div>
            </div>

            <div className="space-y-4">
              {settings.termsAcceptedAt && (
                <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                  <p className="text-sm text-white font-medium mb-2">Termos aceitos em</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(settings.termsAcceptedAt).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {settings.termsVersion && (
                  <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-400 mb-1">Versão dos Termos</p>
                    <p className="text-sm text-white font-medium">{formatVersionDate(settings.termsVersion)}</p>
                  </div>
                )}
                {settings.privacyVersion && (
                  <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-400 mb-1">Versão da Privacidade</p>
                    <p className="text-sm text-white font-medium">{formatVersionDate(settings.privacyVersion)}</p>
                  </div>
                )}
                {settings.communicationsVersion && (
                  <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-400 mb-1">Versão das Comunicações</p>
                    <p className="text-sm text-white font-medium">{formatVersionDate(settings.communicationsVersion)}</p>
                  </div>
                )}
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs text-zinc-400 mb-2">Documentos legais:</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/terms"
                    className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
                  >
                    Termos de Uso
                  </Link>
                  <Link
                    to="/privacy"
                    className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
                  >
                    Política de Privacidade
                  </Link>
                  <Link
                    to="/communications"
                    className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
                  >
                    Política de Comunicações
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe size={18} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Cache no dispositivo</h2>
                <p className="text-sm text-zinc-500">Acelere o carregamento com cache local opcional.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div>
                  <p className="text-sm text-white font-medium">Cache neste dispositivo</p>
                  <p className="text-xs text-zinc-500">Mantem dados recentes salvos no navegador.</p>
                </div>
                <input
                  type="checkbox"
                  checked={cacheEnabled}
                  onChange={(e) => setCacheEnabled(e.target.checked)}
                  className="h-5 w-5 accent-amber-500"
                />
              </label>

              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={clearLocalCache}>
                  Limpar cache local
                </Button>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={18} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold text-white">Seguranca e privacidade</h2>
                <p className="text-sm text-zinc-500">Controle suas sessoes.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <p className="text-sm text-white font-medium">Sessoes ativas</p>
                <p className="text-xs text-zinc-500">Detalhes de sessao em breve.</p>
              </div>

              {securityMessage && (
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-300">
                  {securityMessage}
                </div>
              )}

              <Button type="button" variant="outline" onClick={handleSignOutEverywhere}>
                <LogOut size={16} className="mr-2" />
                Sair de todos os dispositivos
              </Button>
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              className="justify-center font-bold"
              disabled={saving || !isDirty}
            >
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};
