import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { authService } from '../../lib/authService';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownActive) {
      return;
    }
    setLoading(true);
    setCooldownActive(true);
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownActive(false);
    }, 5000);

    try {
      await authService.resetPassword(email.trim().toLowerCase());
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Receba um link seguro para redefinir sua senha"
    >
      {submitted ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30">
            <MailCheck className="w-8 h-8 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              Verifique seu e-mail
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Se o e-mail existir, enviamos um link de recupera&#231;&#227;o.
            </p>
          </div>
          <Link
            to="/login"
            className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
          >
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            icon={<Mail size={18} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Button
            variant="primary"
            className="w-full justify-center font-bold"
            disabled={loading || cooldownActive}
          >
            {loading ? (
              <Loader2 className="animate-spin mr-2" size={20} />
            ) : (
              'Enviar link de recuperação'
            )}
          </Button>

          <p className="text-center text-sm text-zinc-500">
            Lembrou da senha?{' '}
            <Link
              to="/login"
              className="font-medium text-amber-500 hover:text-amber-400 transition-colors"
            >
              Fazer login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
};
