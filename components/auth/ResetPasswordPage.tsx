import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { authService } from '../../lib/authService';
import { getSupabaseClient } from '../../config/supabase';

const getUrlParam = (key: string, url: string): string | null => {
  const match = url.match(new RegExp(`[?#&]${key}=([^&#]+)`));
  return match ? decodeURIComponent(match[1]) : null;
};

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hasMinimumLength = useMemo(() => password.length >= 10, [password]);

  useEffect(() => {
    let isActive = true;

    const initializeRecovery = async () => {
      if (!authService.isConfigured()) {
        if (isActive) {
          setLinkError('Recuperação indisponível. Tente novamente mais tarde.');
          setLoading(false);
        }
        return;
      }

      const url = window.location.href;
      const accessToken = getUrlParam('access_token', url);
      const refreshToken = getUrlParam('refresh_token', url);
      const flowType = getUrlParam('type', url);

      if (accessToken && refreshToken) {
        const supabase = getSupabaseClient();
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isActive) return;

        if (sessionError || !data.session || (flowType && flowType !== 'recovery')) {
          setLinkError('Link inválido ou expirado. Solicite um novo envio.');
          setLoading(false);
          return;
        }

        navigate('/reset-password', { replace: true });
        setLoading(false);
        return;
      }

      const { session } = await authService.getSession();
      if (!isActive) return;

      if (!session?.user) {
        setLinkError('Link inválido ou expirado. Solicite um novo envio.');
      }
      setLoading(false);
    };

    void initializeRecovery();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const { resetPasswordSchema } = await import('../../lib/validation/schemas');
    const validationResult = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      setFormError(validationResult.error.issues[0]?.message ?? 'Senha inválida.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await authService.updatePassword(password);
      if (updateError) {
        throw new Error(updateError.message || 'Não foi possívelvel redefinir a senha.');
      }

      await authService.signOut();
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possívelvel redefinir a senha.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Redefinir senha" subtitle="Estamos preparando sua recuperação">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      </AuthLayout>
    );
  }

  if (linkError) {
    return (
      <AuthLayout title="Redefinir senha" subtitle="N&#227;o foi poss&#237;vel validar o link">
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-sm text-red-400">{linkError}</p>
          <Link
            to="/recuperar-senha"
            className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
          >
            Solicitar novo link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Defina uma nova senha" subtitle="Escolha uma senha forte para sua conta">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nova senha"
          type="password"
          placeholder="M&#237;nimo 10 caracteres"
          icon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          placeholder="Repita a senha"
          icon={<Lock size={18} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {hasMinimumLength ? (
            <CheckCircle2 className="text-green-400" size={14} />
          ) : (
            <ShieldCheck className="text-zinc-500" size={14} />
          )}
          <span>M&#237;nimo de 10 caracteres</span>
        </div>

        {formError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {formError}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full justify-center font-bold"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="animate-spin mr-2" size={20} />
          ) : (
            'Atualizar senha'
          )}
        </Button>
      </form>
    </AuthLayout>
  );
};
