import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { authService } from '../../lib/authService';
import { captureLoginCompleted, identifyUser } from '../../lib/analytics';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const resetSuccess = Boolean((location.state as { resetSuccess?: boolean } | null)?.resetSuccess);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownActive) {
      setError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }
    setLoading(true);
    setError(null);
    setCooldownActive(true);
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownActive(false);
    }, 5000);

    try {
      // Usando o serviço de autenticação (atualmente em modo Bypass)
      const { error } = await authService.signIn(email, password);

      if (error) throw error;
      
      // AIDEV-NOTE: Capture login_completed event and identify user
      const { session } = await authService.getSession();
      if (session?.user?.id) {
        identifyUser(session.user.id);
        captureLoginCompleted();
      }
      
      // Redireciona para o dashboard
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao realizar login.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (cooldownActive) {
      setError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }
    setLoading(true);
    setCooldownActive(true);
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownActive(false);
    }, 5000);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) throw error;
      
      // AIDEV-NOTE: Capture login_completed event and identify user
      const { session } = await authService.getSession();
      if (session?.user?.id) {
        identifyUser(session.user.id);
        captureLoginCompleted();
      }
      
      navigate('/dashboard');
    } catch (err: unknown) {
      setError('Erro ao conectar com Google.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Bem-vindo de volta" 
      subtitle="Acesse seu painel patrimonial"
    >
      {resetSuccess && (
        <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm">
          Senha atualizada com sucesso. Fa&#231;a login para continuar.
        </div>
      )}
      <form onSubmit={handleLogin} className="space-y-5">
        <Input 
          label="E-mail" 
          type="email" 
          placeholder="seu@email.com" 
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
            <Input 
            label="Senha" 
            type="password" 
            placeholder="••••••••" 
            icon={<Lock size={18} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            />
            <div className="flex justify-end mt-2">
                <Link to="/recuperar-senha" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
                    Esqueceu a senha?
                </Link>
            </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <Button 
            variant="primary" 
            className="w-full justify-center font-bold"
            disabled={loading || cooldownActive}
        >
          {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : 'Entrar na Plataforma'}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-2 text-zinc-500">Ou continue com</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-zinc-700 rounded-lg shadow-sm bg-zinc-900/50 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Não tem uma conta?{' '}
          <Link to="/cadastro" className="font-medium text-amber-500 hover:text-amber-400 transition-colors">
            Criar patrimônio
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
