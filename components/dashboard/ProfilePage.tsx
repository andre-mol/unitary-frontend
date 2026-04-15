import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { useAuth } from '../auth/AuthProvider';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { authService } from '../../lib/authService';
import { getSupabaseClient } from '../../config/supabase';
import { getPlanDisplayName, isPaidPlan } from '../../lib/plans';
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, Download, Trash2, RotateCcw, XCircle, Loader2 } from 'lucide-react';
import { queryKeys } from '../../lib/queryKeys';
import { fetchProfile, fetchSubscription, type ProfileRecord } from '../../lib/queries/user';
import { fetchPortfolios } from '../../lib/queries/portfolios';
import { InvoiceHistory } from '../billing/InvoiceHistory';
import { CancelSubscriptionModal } from '../billing/CancelSubscriptionModal';
import { reactivateSubscription } from '../../lib/billing/reactivateSubscription';
import { useToast } from '../ui/Toast';
import { supabase } from '../../lib/supabase';

const DELETE_CONFIRM_PHRASE = 'EXCLUIR MINHA CONTA';
const APP_VERSION = 'web-1.0.0';

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'N/A';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(parsed));
};

const createDownload = (fileName: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    plan,
    loading: planProviderLoading,
    cancelAtPeriodEnd,
    currentPeriodEnd: providerPeriodEnd,
    refreshPlan
  } = useSubscription();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteNotes, setDeleteNotes] = useState('');

  const effectivePlanName = useMemo(() => getPlanDisplayName(plan), [plan]);

  const isExpired = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status !== 'active') return true;
    if (!subscription.currentPeriodEnd) return false;
    const parsed = Date.parse(subscription.currentPeriodEnd);
    return Number.isNaN(parsed) ? false : parsed < Date.now();
  }, [subscription]);

  const loadProfile = async () => {
    if (!user?.id) {
      return null;
    }
    return queryClient.fetchQuery({
      queryKey: queryKeys.me(user.id),
      queryFn: () => fetchProfile(user.id),
    });
  };

  const loadSubscription = async () => {
    if (!user?.id) {
      return;
    }
    const subscriptionData = await queryClient.fetchQuery({
      queryKey: queryKeys.subscription(user.id),
      queryFn: fetchSubscription,
    });
    setSubscription(subscriptionData);
  };

  useEffect(() => {
    const loadData = async () => {
      if (authLoading || !user) {
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const profileRow = await loadProfile();
        const name = profileRow?.name ?? user?.name ?? '';
        const phone = profileRow?.phone ?? '';

        setProfile({
          name: profileRow?.name ?? null,
          phone: profileRow?.phone ?? null,
          avatarUrl: profileRow?.avatarUrl ?? null,
        });
        setForm({ name, phone });
        await loadSubscription();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível carregar seu perfil.';
        setErrorMessage(message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [authLoading, user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const { profileUpdateSchema } = await import('../../lib/validation/schemas');
    const validationResult = profileUpdateSchema.safeParse({
      name: form.name,
      phone: form.phone,
    });

    if (!validationResult.success) {
      setErrorMessage(validationResult.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }

    if (!user) {
      setErrorMessage('Você precisa estar autenticado para atualizar seus dados.');
      return;
    }

    const previousProfile = profile;
    const optimisticProfile: ProfileRecord = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      avatarUrl: profile?.avatarUrl ?? null,
    };

    setProfile(optimisticProfile);
    setSaveLoading(true);

    try {
      const supabase = getSupabaseClient();
      const userId = user.id;

      const payload = {
        full_name: optimisticProfile.name,
        phone: optimisticProfile.phone,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, ...payload },
          { onConflict: 'id' }
        )
        .select('full_name, phone, avatar_url')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile({
          name: data.full_name ?? null,
          phone: data.phone ?? null,
          avatarUrl: data.avatar_url ?? null,
        });
        queryClient.setQueryData(queryKeys.me(user.id), {
          name: data.full_name ?? null,
          phone: data.phone ?? null,
          avatarUrl: data.avatar_url ?? null,
        });
      }

      setSuccessMessage('Dados atualizados com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar seu perfil.';
      setErrorMessage(message);
      setProfile(previousProfile);
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    const { changePasswordSchema } = await import('../../lib/validation/schemas');
    const validationResult = changePasswordSchema.safeParse(passwordForm);

    if (!validationResult.success) {
      setPasswordMessage(validationResult.error.issues[0]?.message ?? 'Senha inválida.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await authService.updatePassword(passwordForm.password);
      if (error) {
        throw new Error(error.message || 'Não foi possível atualizar a senha.');
      }

      setPasswordMessage('Senha atualizada com sucesso.');
      setPasswordForm({ password: '', confirmPassword: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar a senha.';
      setPasswordMessage(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleExport = async () => {
    setExportMessage(null);
    setExportLoading(true);

    if (!user?.id) {
      setExportMessage('Você precisa estar autenticado para exportar seus dados.');
      setExportLoading(false);
      return;
    }

    try {
      const profileRow = await loadProfile();
      const subscriptions = await queryClient.fetchQuery({
        queryKey: queryKeys.subscription(user.id),
        queryFn: fetchSubscription,
      });
      const portfolios = await queryClient.fetchQuery({
        queryKey: queryKeys.portfolios(user.id),
        queryFn: fetchPortfolios,
      });

      const payload = {
        profile: {
          name: profileRow?.name ?? null,
          phone: profileRow?.phone ?? null,
          avatar_url: profileRow?.avatarUrl ?? null,
          email: user?.email ?? null,
        },
        subscription: subscriptions ?? null,
        portfolios: portfolios ?? [],
        generatedAt: new Date().toISOString(),
      };

      const fileName = `patrio-export-${new Date().toISOString().slice(0, 10)}.json`;
      createDownload(fileName, JSON.stringify(payload, null, 2), 'application/json');
      setExportMessage('Exportação gerada com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível exportar seus dados.';
      setExportMessage(message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteMessage(null);

    if (deletePhrase.trim().toUpperCase() !== DELETE_CONFIRM_PHRASE) {
      setDeleteMessage('A frase de confirmação não corresponde.');
      return;
    }

    if (!user?.id) {
      setDeleteMessage('Você precisa estar autenticado para solicitar exclusão.');
      return;
    }

    setDeleteLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('bug_reports').insert({
        user_id: user.id,
        title: 'Solicitação de exclusão de conta',
        description: deleteNotes.trim() || 'Solicitação enviada via página de perfil.',
        severity: 'low',
        route: '/dashboard/configuracoes',
        app_version: APP_VERSION,
        user_agent: navigator.userAgent,
      });

      if (error) {
        throw error;
      }

      setDeleteMessage('Solicitação enviada. Nossa equipe entrará em contato.');
      setDeletePhrase('');
      setDeleteNotes('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.';
      setDeleteMessage(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirm('Tem certeza que deseja reativar sua assinatura? Ela será renovada automaticamente ao fim do período atual.')) {
      return;
    }

    setReactivating(true);
    try {
      if (!supabase) throw new Error('Cliente Supabase não inicializado');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada');

      await reactivateSubscription(session.access_token);

      addToast({
        type: 'success',
        title: 'Assinatura reativada!',
        message: 'A renovação automática foi habilitada novamente.'
      });
      await refreshPlan();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Erro',
        message: error.message
      });
    } finally {
      setReactivating(false);
    }
  };

  if (loading || authLoading || planProviderLoading) {
    return (
      <DashboardLayout title="Meu Perfil" subtitle="Atualize seus dados e configurações de segurança.">
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Meu Perfil" subtitle="Atualize seus dados e configurações de segurança.">
      <div className="space-y-8">
        {errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm">
            {successMessage}
          </div>
        )}

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Conta</h2>
              <p className="text-sm text-zinc-500">Atualize seus dados básicos.</p>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome"
              type="text"
              placeholder="Seu nome completo"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: { name: string; phone: string }) => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Telefone (opcional)"
              type="tel"
              placeholder="(11) 99999-0000"
              value={form.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((prev: { name: string; phone: string }) => ({ ...prev, phone: e.target.value }))}
            />
            <Input
              label="E-mail"
              type="email"
              value={user?.email ?? ''}
              readOnly
            />

            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center font-bold"
                disabled={saveLoading}
              >
                {saveLoading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Segurança</h2>
              <p className="text-sm text-zinc-500">Mantenha sua conta protegida.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nova senha"
              type="password"
              placeholder="Mínimo 10 caracteres"
              icon={<Lock size={16} />}
              value={passwordForm.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm((prev: { password: string; confirmPassword: string }) => ({ ...prev, password: e.target.value }))}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              placeholder="Repita sua senha"
              icon={<Lock size={16} />}
              value={passwordForm.confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm((prev: { password: string; confirmPassword: string }) => ({ ...prev, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              required
            />

            <div className="flex items-center gap-2 text-xs text-zinc-500 md:col-span-2">
              <ShieldCheck size={14} className="text-zinc-500" />
              <span>Use pelo menos 10 caracteres para maior segurança.</span>
            </div>

            {passwordMessage && (
              <div className="md:col-span-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-xs text-zinc-300">
                {passwordMessage}
              </div>
            )}

            <div className="md:col-span-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                className="justify-center font-bold"
                disabled={passwordLoading}
              >
                {passwordLoading ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 border border-dashed border-zinc-700 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-amber-500" size={18} />
              <div>
                <p className="text-sm text-white font-medium">Autenticação em dois fatores</p>
                <p className="text-xs text-zinc-500">Em breve você poderá habilitar 2FA para proteção extra.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Assinatura</h2>
              <p className="text-sm text-zinc-500">Detalhes do seu plano atual.</p>
            </div>

            {isPaidPlan(plan) && !cancelAtPeriodEnd && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300"
                onClick={() => setIsCancelModalOpen(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Interromper renovação
              </Button>
            )}

            {isPaidPlan(plan) && cancelAtPeriodEnd && (
              <Button
                variant="primary"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white border-none shadow-lg shadow-green-900/20"
                onClick={handleReactivate}
                disabled={reactivating}
              >
                {reactivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Reativar assinatura
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Plano efetivo</p>
              <p className="text-lg font-semibold text-white">{effectivePlanName}</p>
            </div>
            <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-white">{subscription?.status ?? 'N/A'}</p>
                {cancelAtPeriodEnd && (
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 uppercase font-bold tracking-wider">
                    Cancelamento Agendado
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">{cancelAtPeriodEnd ? 'Expira em' : 'Renovação'}</p>
              <p className="text-lg font-semibold text-white">{formatDate(subscription?.currentPeriodEnd)}</p>
            </div>
          </div>

          {isExpired && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
              <div>
                <p className="text-sm text-amber-200 font-medium">Assinatura expirada</p>
                <p className="text-xs text-amber-200/70">
                  Atualize seu plano para recuperar acesso completo ao Unitary.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-3 text-sm"
                  onClick={() => navigate('/precos')}
                >
                  Ver planos
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-zinc-800">
            <h3 className="text-sm font-medium text-white mb-4">Histórico de Faturas</h3>
            <InvoiceHistory />
          </div>
        </section>

        <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Dados & Privacidade</h2>
              <p className="text-sm text-zinc-500">Gerencie seus dados pessoais.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-zinc-950/70 rounded-xl border border-zinc-800">
              <div>
                <p className="text-sm text-white font-medium">Exportar meus dados</p>
                <p className="text-xs text-zinc-500">Gera um arquivo JSON com seus dados essenciais.</p>
                {exportMessage && (
                  <p className="text-xs text-zinc-400 mt-2">{exportMessage}</p>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="justify-center"
                disabled={exportLoading}
                onClick={handleExport}
              >
                <Download size={16} className="mr-2" />
                {exportLoading ? 'Gerando...' : 'Exportar'}
              </Button>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Trash2 className="text-red-400 mt-1" size={18} />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-300">Excluir conta</h3>
                  <p className="text-xs text-red-200/70 mb-4">
                    Essa ação abre uma solicitação para nossa equipe processar a exclusão.
                  </p>
                  <form onSubmit={handleDeletionRequest} className="space-y-3">
                    <Input
                      label={`Digite "${DELETE_CONFIRM_PHRASE}" para confirmar`}
                      type="text"
                      value={deletePhrase}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeletePhrase(e.target.value)}
                      required
                    />
                    <Input
                      label="Observações (opcional)"
                      type="text"
                      value={deleteNotes}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteNotes(e.target.value)}
                    />
                    {deleteMessage && (
                      <p className="text-xs text-red-200/80">{deleteMessage}</p>
                    )}
                    <Button
                      type="submit"
                      variant="outline"
                      className="border-red-500/40 text-red-300 hover:text-red-100 hover:border-red-400"
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? 'Enviando...' : 'Solicitar exclusão'}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CancelSubscriptionModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={() => {
            refreshPlan();
          }}
        />
      </div>
    </DashboardLayout >
  );
};
