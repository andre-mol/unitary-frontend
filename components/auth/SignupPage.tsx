import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthLayout } from './AuthLayout';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Mail, Lock, User, Loader2, ArrowRight, CheckCircle2, MailCheck, RefreshCw, AlertCircle, X, Phone } from 'lucide-react';
import { authService } from '../../lib/authService';
import { useSettings } from '../settings/SettingsProvider';
import { captureSignupStarted, captureSignupCompleted, identifyUser } from '../../lib/analytics';
import { validatePassword, type PasswordValidationResult } from '../../lib/validation/password';
import { validateAndNormalizePhone, type PhoneValidationResult } from '../../lib/validation/phone';
import { TERMS_VERSION, PRIVACY_VERSION, COMMUNICATIONS_VERSION } from '../../lib/legal/versions';

function isDuplicateEmailError(error: { status?: number; code?: string; message?: string }): boolean {
  if (error.status !== 400) {
    return false;
  }

  const code = error.code?.toLowerCase();
  if (code === 'email_exists' || code === 'identity_already_exists' || code === 'email_conflict_identity_not_deletable') {
    return true;
  }

  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('user already registered') ||
    message.includes('email already in use') ||
    message.includes('email already exists') ||
    message.includes('already registered') ||
    message.includes('already exists')
  );
}

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignupDisabled, loading: settingsLoading } = useSettings();

  // AIDEV-NOTE: Capture signup_started event when page mounts
  useEffect(() => {
    captureSignupStarted();
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailInUse, setIsEmailInUse] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidationResult | null>(null);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidationResult | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const [validationErrors, setValidationErrors] = useState({
    termsNotAccepted: false,
    passwordsDontMatch: false,
    emailsDontMatch: false
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    phone: '',
    acceptedTerms: false,
    marketingEmails: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(newFormData);

    // Validação em tempo real para o campo de senha
    if (e.target.name === 'password') {
      const validation = validatePassword(e.target.value);
      setPasswordValidation(validation);
      // Limpar erro de senhas não coincidem se a senha mudou
      if (newFormData.confirmPassword && newFormData.password === newFormData.confirmPassword) {
        setValidationErrors(prev => ({ ...prev, passwordsDontMatch: false }));
      }
    }

    // Validação em tempo real para confirmar senha
    if (e.target.name === 'confirmPassword') {
      if (newFormData.password && newFormData.password !== newFormData.confirmPassword) {
        setValidationErrors(prev => ({ ...prev, passwordsDontMatch: true }));
      } else {
        setValidationErrors(prev => ({ ...prev, passwordsDontMatch: false }));
      }
    }

    // Validação em tempo real para confirmar e-mail
    if (e.target.name === 'confirmEmail') {
      if (newFormData.email && newFormData.email !== newFormData.confirmEmail) {
        setValidationErrors(prev => ({ ...prev, emailsDontMatch: true }));
      } else {
        setValidationErrors(prev => ({ ...prev, emailsDontMatch: false }));
      }
    }

    // Validação em tempo real para o campo de telefone
    if (e.target.name === 'phone') {
      const validation = validateAndNormalizePhone(e.target.value);
      setPhoneValidation(validation);
    }
  };

  const handlePasswordFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsPasswordFocused(true);
    if (formData.password) {
      const validation = validatePassword(formData.password);
      setPasswordValidation(validation);
    }
  };

  const handlePasswordBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsPasswordFocused(false);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownActive) {
      setError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }
    setError(null);
    setIsEmailInUse(false);
    setValidationErrors({
      termsNotAccepted: false,
      passwordsDontMatch: false,
      emailsDontMatch: false
    });

    // Verificar se cadastros estão desabilitados
    if (isSignupDisabled()) {
      setError('Cadastros estão temporariamente desabilitados. Por favor, tente novamente mais tarde.');
      return;
    }

    // AIDEV-NOTE: Validação de senha forte antes do schema Zod
    const passwordValidationResult = validatePassword(formData.password);
    if (!passwordValidationResult.ok) {
      setError(passwordValidationResult.errors.join(' '));
      return;
    }

    // AIDEV-NOTE: Validação de nome completo - requer pelo menos 2 palavras
    const nameWords = formData.name.trim().split(/\s+/).filter(word => word.length > 0);
    if (nameWords.length < 2) {
      setError('Por favor, insira seu nome completo (nome e sobrenome).');
      return;
    }

    // AIDEV-NOTE: Validação de e-mails coincidem
    if (formData.email !== formData.confirmEmail) {
      setValidationErrors(prev => ({ ...prev, emailsDontMatch: true }));
      setError('Os e-mails não coincidem. Por favor, verifique.');
      return;
    }

    // AIDEV-NOTE: Validação de senhas coincidem
    if (formData.password !== formData.confirmPassword) {
      setValidationErrors(prev => ({ ...prev, passwordsDontMatch: true }));
      setError('As senhas não coincidem. Por favor, verifique.');
      return;
    }

    // AIDEV-NOTE: Validação de aceitação dos termos
    if (!formData.acceptedTerms) {
      setValidationErrors(prev => ({ ...prev, termsNotAccepted: true }));
      setError(null);
      return;
    }

    // AIDEV-NOTE: Validação e normalização de telefone
    const phoneValidationResult = validateAndNormalizePhone(formData.phone);
    if (!phoneValidationResult.ok) {
      setError(phoneValidationResult.error || 'Digite um número de telefone válido');
      return;
    }
    const phoneE164 = phoneValidationResult.e164;

    // AIDEV-NOTE: Validação usando Zod schema. Valida nome, email, senha, confirmação e telefone.
    const { signupSchema } = await import('../../lib/validation/schemas');
    const validationResult = signupSchema.safeParse(formData);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      setError(firstError.message);
      return;
    }

    const validatedData = validationResult.data;
    const normalizedEmail = validatedData.email;
    const fullName = validatedData.name.trim();

    setLoading(true);
    setCooldownActive(true);
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownActive(false);
    }, 5000);

    try {
      const { user, error } = await authService.signUp({
        email: normalizedEmail,
        password: formData.password,
        name: fullName,
        phone: phoneE164,
        marketingEmailsOptIn: formData.marketingEmails,
        productUpdatesOptIn: formData.marketingEmails, // Mesmo valor de marketing (são a mesma coisa)
        termsAccepted: formData.acceptedTerms,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        communicationsVersion: COMMUNICATIONS_VERSION
      });

      if (error) {
        const errorMessage = error.message || 'Erro ao criar conta.';
        const lowerMessage = errorMessage.toLowerCase();

        if (isDuplicateEmailError(error)) {
          setIsEmailInUse(true);
          setError(null);
          setLoading(false);
          return;
        }

        setIsEmailInUse(false);

        let finalMessage = errorMessage;
        if (lowerMessage.includes('password') && lowerMessage.includes('least')) {
          finalMessage = 'A senha deve atender aos requisitos: m?nimo 10 caracteres, 1 s?mbolo e 2 d?gitos.';
        } else if (lowerMessage.includes('invalid') && lowerMessage.includes('email')) {
          finalMessage = 'Por favor, insira um e-mail v?lido.';
        } else if (lowerMessage.includes('rate limit')) {
          finalMessage = 'Muitas tentativas. Aguarde um momento.';
        } else if (error.status === 500) {
          finalMessage = 'Erro no servidor. Tente novamente em alguns segundos.';
        }

        throw new Error(finalMessage);
      }

      // Signup bem-sucedido!
      // AIDEV-NOTE: Identify user and capture signup_completed event
      // AIDEV-NOTE: Não fazer upsert manual de profiles - o trigger handle_new_user() 
      // deve ler new.raw_user_meta_data->>'full_name' e new.raw_user_meta_data->>'phone'
      if (user?.id) {
        identifyUser(user.id);
        captureSignupCompleted();

        // AIDEV-NOTE: O trigger handle_new_user() agora cria user_settings e user_consents
        // automaticamente, então não precisamos fazer upsert manual aqui.
        // Os metadados foram passados em raw_user_meta_data e o trigger os processará.
      }

      // Mostra a tela de confirmação de email
      setRegisteredEmail(normalizedEmail);
      setEmailSent(true);
      setLoading(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
      setError(message);
      setIsEmailInUse(false);
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    // Verificar se cadastros estão desabilitados
    if (isSignupDisabled()) {
      setError('Cadastros estão temporariamente desabilitados. Por favor, tente novamente mais tarde.');
      return;
    }

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
      navigate('/dashboard');
    } catch (err: unknown) {
      setError('Erro ao conectar com Google.');
      setLoading(false);
    }
  };

  // Tela de confirmação de email
  if (emailSent) {
    return (
      <AuthLayout
        title="Verifique seu e-mail"
        subtitle="Falta pouco para você começar!"
      >
        <motion.div
          className="text-center space-y-6 ph-no-capture"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Ícone de sucesso animado */}
          <motion.div
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
          >
            <MailCheck className="w-10 h-10 text-amber-500" />
          </motion.div>

          {/* Mensagem principal */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">
              Conta criada com sucesso!
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-amber-500 font-medium">
              {registeredEmail}
            </p>
          </div>

          {/* Instruções */}
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
            <div className="flex items-start gap-3 text-left">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-zinc-300">
                <p className="font-medium mb-1">Próximos passos:</p>
                <ol className="list-decimal list-inside text-zinc-400 space-y-1">
                  <li>Abra sua caixa de entrada</li>
                  <li>Clique no link de confirmação</li>
                  <li>Volte aqui e faça login</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Aviso sobre spam */}
          <p className="text-xs text-zinc-500">
            Não encontrou o e-mail? Verifique sua pasta de spam ou lixo eletrônico.
          </p>

          {/* Botão para ir ao login */}
          <div className="pt-2 space-y-3">
            <Link to="/login" className="block">
              <Button
                variant="primary"
                className="w-full justify-center font-bold"
              >
                Ir para o Login
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setFormData({ name: '', email: '', confirmEmail: '', password: '', confirmPassword: '', phone: '', acceptedTerms: false, marketingEmails: false });
              }}
              className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors flex items-center justify-center gap-2 w-full"
            >
              <RefreshCw size={14} />
              Usar outro e-mail
            </button>
          </div>
        </motion.div>
      </AuthLayout>
    );
  }

  // Se ainda está carregando configurações, mostrar loading
  if (settingsLoading) {
    return (
      <AuthLayout
        title="Começar agora"
        subtitle="Inicie sua jornada de organização patrimonial"
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      </AuthLayout>
    );
  }

  // Se cadastros estão desabilitados, mostrar mensagem
  const signupDisabled = isSignupDisabled();

  return (
    <AuthLayout
      title="Começar agora"
      subtitle="Inicie sua jornada de organização patrimonial"
    >
      {signupDisabled && (
        <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-300 mb-1">
                Cadastros Temporariamente Desabilitados
              </h3>
              <p className="text-sm text-yellow-400/80">
                Estamos temporariamente pausando novos cadastros. Por favor, tente novamente mais tarde.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-3">
        <Input
          label="Nome Completo"
          type="text"
          name="name"
          placeholder="Ex: João da Silva"
          icon={<User size={18} />}
          value={formData.name}
          onChange={handleChange}
          required
        />
        <Input
          label="E-mail profissional"
          type="email"
          name="email"
          placeholder="seu@email.com"
          icon={<Mail size={18} />}
          value={formData.email}
          onChange={handleChange}
          error={validationErrors.emailsDontMatch && formData.confirmEmail ? 'Os e-mails não coincidem' : undefined}
          required
        />
        <Input
          label="Confirmar E-mail"
          type="email"
          name="confirmEmail"
          placeholder="confirme@email.com"
          icon={<Mail size={18} />}
          value={formData.confirmEmail}
          onChange={handleChange}
          error={validationErrors.emailsDontMatch && formData.confirmEmail ? 'Os e-mails não coincidem' : undefined}
          required
        />
        <div>
          <Input
            label="Telefone"
            type="tel"
            name="phone"
            placeholder="+55 (11) 91234-5678"
            icon={<Phone size={18} />}
            value={formData.phone}
            onChange={handleChange}
            required
          />
          {phoneValidation && !phoneValidation.ok && formData.phone && (
            <p className="mt-1.5 text-xs text-red-400 ml-1">
              {phoneValidation.error || 'Digite um número de telefone válido'}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Input
              label="Senha"
              type="password"
              name="password"
              placeholder="Mínimo 10 caracteres, 1 símbolo, 2 dígitos"
              icon={<Lock size={18} />}
              value={formData.password}
              onChange={handleChange}
              onFocus={handlePasswordFocus}
              onBlur={handlePasswordBlur}
              required
            />
            {(isPasswordFocused || formData.password) && passwordValidation && (
              <div className="mt-1.5 p-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Requisitos:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-1.5 text-xs">
                    {passwordValidation.checks.minLength ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    <span className={passwordValidation.checks.minLength ? 'text-zinc-300' : 'text-zinc-500'}>
                      10+ caracteres
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5 text-xs">
                    {passwordValidation.checks.hasSymbol ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    <span className={passwordValidation.checks.hasSymbol ? 'text-zinc-300' : 'text-zinc-500'}>
                      1 símbolo
                    </span>
                  </li>
                  <li className="flex items-center gap-1.5 text-xs">
                    {passwordValidation.checks.hasTwoDigits ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    <span className={passwordValidation.checks.hasTwoDigits ? 'text-zinc-300' : 'text-zinc-500'}>
                      2 dígitos
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </div>
          <Input
            label="Confirmar Senha"
            type="password"
            name="confirmPassword"
            placeholder="Confirme sua senha"
            icon={<Lock size={18} />}
            value={formData.confirmPassword}
            onChange={handleChange}
            error={validationErrors.passwordsDontMatch && formData.confirmPassword ? 'As senhas não coincidem' : undefined}
            required
          />
        </div>

        {isEmailInUse && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="text-amber-400 mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-300 mb-1">Precisa de ajuda para entrar?</h3>
                <p className="text-sm text-amber-400/80 mb-4">If you already have an account, log in or reset your password.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="primary" className="w-full justify-center text-sm py-2">
                      Fazer login
                    </Button>
                  </Link>
                  <Link to="/recuperar-senha" className="flex-1">
                    <Button variant="outline" className="w-full justify-center text-sm py-2">
                      Recuperar senha
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && !isEmailInUse && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full justify-center font-bold"
            disabled={loading || signupDisabled || cooldownActive || (passwordValidation !== null && !passwordValidation.ok) || (phoneValidation !== null && !phoneValidation.ok)}
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : (
              <>
                Criar conta gratuita
                <ArrowRight size={16} className="ml-2" />
              </>
            )}
          </Button>
        </div>

        <div className={`flex items-start gap-2 pt-1 p-2.5 rounded-lg transition-all duration-200 ${validationErrors.termsNotAccepted
          ? 'bg-red-500/10 border-2 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
          : ''
          }`}>
          <input
            type="checkbox"
            id="acceptTerms"
            name="acceptedTerms"
            checked={formData.acceptedTerms}
            onChange={(e) => {
              setFormData({ ...formData, acceptedTerms: e.target.checked });
              if (e.target.checked) {
                setValidationErrors(prev => ({ ...prev, termsNotAccepted: false }));
              }
            }}
            className={`mt-1 w-4 h-4 rounded bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-all duration-200 ${validationErrors.termsNotAccepted
              ? 'border-2 border-red-500 ring-2 ring-red-500/30'
              : 'border border-zinc-700'
              }`}
            required
          />
          <label
            htmlFor="acceptTerms"
            className={`text-xs cursor-pointer transition-colors duration-200 ${validationErrors.termsNotAccepted ? 'text-red-400 font-medium' : 'text-zinc-400'
              }`}
          >
            Ao criar uma conta, você concorda com nossos{' '}
            <Link to="/terms" className={`underline hover:text-zinc-300 ${validationErrors.termsNotAccepted ? 'text-red-300' : 'text-zinc-300'
              }`}>Termos de Uso</Link>
            {' '}e{' '}
            <Link to="/privacy" className={`underline hover:text-zinc-300 ${validationErrors.termsNotAccepted ? 'text-red-300' : 'text-zinc-300'
              }`}>Política de Privacidade</Link>.
          </label>
        </div>
        {validationErrors.termsNotAccepted && (
          <p className="mt-2 text-xs text-red-400 ml-6">Voc? precisa aceitar os Termos de Uso e a Pol?tica de Privacidade.</p>
        )}

        <div className="flex items-start gap-2 pt-2">
          <input
            type="checkbox"
            id="marketingEmails"
            name="marketingEmails"
            checked={formData.marketingEmails}
            onChange={(e) => setFormData({ ...formData, marketingEmails: e.target.checked })}
            className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
          />
          <label htmlFor="marketingEmails" className="text-xs text-zinc-400 cursor-pointer">
            Quero receber e-mails de marketing, ofertas promocionais e atualizações de produto.{' '}
            <Link to="/communications" className="underline hover:text-zinc-300 text-zinc-300">
              Saiba mais
            </Link>
          </label>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-2 text-zinc-500">Ou cadastre-se com</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading || signupDisabled}
          className="w-full flex items-center justify-center px-4 py-3 border border-zinc-700 rounded-lg shadow-sm bg-zinc-900/50 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p className="text-center text-sm text-zinc-500 mt-2">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-amber-500 hover:text-amber-400 transition-colors">
            Fazer login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
