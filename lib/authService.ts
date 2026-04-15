/**
 * Auth Service - Facade Pattern
 * 
 * ============================================================
 * SERVIÇO DE AUTENTICAÇÃO
 * 
 * Este service atua como facade, delegando operações para o repository.
 * A API permanece inalterada para todos os consumidores.
 * 
 * CONFIGURAÇÃO:
 * 1. Configure as variáveis no .env:
 *    VITE_SUPABASE_URL=https://seu-projeto.supabase.co
 *    VITE_SUPABASE_ANON_KEY=sua-anon-key
 * 
 * 2. Configure RLS (Row Level Security) no Supabase Dashboard
 * 
 * NOTA: O app compila mesmo sem Supabase configurado, mas auth
 * retornará erros controlados até as variáveis serem configuradas.
 * ============================================================
 */

import { AuthRepository, AuthResult, AuthSession, AuthUser } from '../domain/repositories/AuthRepository';
import { SupabaseAuthRepository } from '../infrastructure/auth/SupabaseAuthRepository';
import { isSupabaseConfigured } from '../config/supabase';
import { env } from '../config/env';
import { DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_NAME } from '../mocks/demoMode';
import {
    isDemoSessionActive,
    setDemoSessionActive,
    notifyDemoAuthChanged,
    validateDemoCredentials,
} from '../mocks/demoAuthSession';

// ============================================================
// REPOSITORY INJECTION - SUPABASE AUTH (Produção)
// 
// O SupabaseAuthRepository é usado por padrão.
// Se Supabase não estiver configurado, operações retornam erros controlados.
// ============================================================

let repository: AuthRepository | null = null;

const DEMO_SESSION: AuthSession = {
    user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, name: DEMO_USER_NAME, createdAt: '2024-01-15T10:00:00.000Z' },
    accessToken: 'demo-access-token',
    refreshToken: 'demo-refresh-token',
    expiresAt: Date.now() + 86400000,
};

const DEMO_USER: AuthUser = DEMO_SESSION.user;

function getRepository(): AuthRepository | null {
    if (env.DEMO_MODE) return null;

    if (repository) return repository;

    if (!isSupabaseConfigured()) {
        console.warn(
            '[authService] Supabase não está configurado. ' +
            'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para habilitar autenticação.'
        );
        return null;
    }

    try {
        repository = new SupabaseAuthRepository();
        return repository;
    } catch (error) {
        console.error('[authService] Erro ao inicializar SupabaseAuthRepository:', error);
        return null;
    }
}

/**
 * Create error result for when Supabase is not configured
 */
function notConfiguredError<T>(): AuthResult<T> {
    return {
        data: null,
        error: {
            message: 'Supabase não está configurado. Configure as variáveis de ambiente.',
            code: 'SUPABASE_NOT_CONFIGURED'
        }
    };
}

/**
 * Auth Service
 * Facade that maintains backward compatibility with existing code
 */
export const authService = {
    /**
     * Sign in with email and password
     * 
     * SUPABASE: Uses supabase.auth.signInWithPassword()
     */
    signIn: async (email: string, password: string) => {
        if (env.DEMO_MODE) {
            if (!validateDemoCredentials(email, password)) {
                return {
                    user: null,
                    error: {
                        message: 'E-mail ou senha incorretos.',
                        code: 'invalid_credentials',
                    },
                };
            }
            setDemoSessionActive(true);
            notifyDemoAuthChanged();
            return { user: { email: DEMO_USER.email }, error: null };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<AuthSession>();
            return { user: null, error: error.error };
        }

        const result = await repo.signIn(email, _password);
        return {
            user: result.data?.user ? { email: result.data.user.email } : null,
            error: result.error
        };
    },

    /**
     * Sign up a new user
     * 
     * SUPABASE: Uses supabase.auth.signUp()
     * EDGE FUNCTION: create-profile (criar perfil adicional)
     */
    signUp: async (data: {
        email: string;
        password: string;
        name?: string;
        phone?: string;
        marketingEmailsOptIn?: boolean;
        productUpdatesOptIn?: boolean;
        termsAccepted?: boolean;
        termsVersion?: string;
        privacyVersion?: string;
        communicationsVersion?: string;
    }) => {
        if (env.DEMO_MODE) {
            return {
                user: null,
                error: {
                    message:
                        'Cadastro não está disponível na demonstração. Use Entrar com as credenciais indicadas no portfólio.',
                    code: 'DEMO_SIGNUP_DISABLED',
                },
            };
        }

        const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000';

        try {
            const response = await fetch(`${ADMIN_API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    user: null,
                    error: {
                        message: result.error || 'Erro ao criar conta.',
                        code: 'SIGNUP_FAILED',
                        status: response.status
                    }
                };
            }

            return {
                user: result.user || { email: data.email },
                error: null
            };
        } catch (err: any) {
            return {
                user: null,
                error: {
                    message: err.message || 'Erro de conexão.',
                    code: 'NETWORK_ERROR'
                }
            };
        }
    },

    /**
     * Sign in with Google OAuth
     * 
     * SUPABASE: Uses supabase.auth.signInWithOAuth({ provider: 'google' })
     */
    signInWithGoogle: async () => {
        if (env.DEMO_MODE) {
            return {
                error: {
                    message: 'Login com Google não está disponível na demonstração.',
                    code: 'DEMO_GOOGLE_DISABLED',
                },
            };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<void>();
            return { error: error.error };
        }

        const result = await repo.signInWithProvider('google');
        return { error: result.error };
    },

    /**
     * Sign out the current user
     * 
     * SUPABASE: Uses supabase.auth.signOut()
     */
    signOut: async () => {
        if (env.DEMO_MODE) {
            setDemoSessionActive(false);
            notifyDemoAuthChanged();
            return { error: null };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<void>();
            return { error: error.error };
        }

        const result = await repo.signOut();
        return { error: result.error };
    },

    // ============================================================
    // MÉTODOS ADICIONAIS
    // ============================================================

    /**
     * Get current session
     */
    getSession: async () => {
        if (env.DEMO_MODE) {
            if (!isDemoSessionActive()) {
                return { session: null, error: null };
            }
            return { session: DEMO_SESSION, error: null };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<AuthSession>();
            return { session: null, error: error.error };
        }

        const result = await repo.getSession();
        return { session: result.data, error: result.error };
    },

    /**
     * Get current user
     */
    getCurrentUser: async () => {
        if (env.DEMO_MODE) {
            if (!isDemoSessionActive()) {
                return { user: null, error: null };
            }
            return { user: DEMO_USER, error: null };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<AuthUser>();
            return { user: null, error: error.error };
        }

        const result = await repo.getCurrentUser();
        return { user: result.data, error: result.error };
    },

    /**
     * Listen to auth state changes
     * Returns unsubscribe function
     */
    onAuthStateChange: (callback: (user: AuthUser | null) => void): (() => void) => {
        if (env.DEMO_MODE) {
            const emit = () => {
                callback(isDemoSessionActive() ? DEMO_USER : null);
            };
            emit();
            const onChange = () => emit();
            window.addEventListener('patrio-demo-auth-changed', onChange);
            return () => window.removeEventListener('patrio-demo-auth-changed', onChange);
        }

        const repo = getRepository();
        if (!repo) {
            console.warn('[authService] onAuthStateChange chamado sem Supabase configurado');
            return () => { };
        }

        return repo.onAuthStateChange(callback);
    },

    /**
     * Send password reset email
     * 
     * SUPABASE: Uses supabase.auth.resetPasswordForEmail()
     * EDGE FUNCTION: custom-reset-email (opcional, para emails customizados)
     */
    resetPassword: async (email: string) => {
        if (env.DEMO_MODE) {
            return {
                error: {
                    message: 'Recuperação de senha não está disponível na demonstração.',
                    code: 'DEMO_RESET_DISABLED',
                },
            };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<void>();
            return { error: error.error };
        }

        const result = await repo.resetPassword(email);
        return { error: result.error };
    },

    /**
     * Update user password
     * 
     * SUPABASE: Uses supabase.auth.updateUser({ password })
     */
    updatePassword: async (newPassword: string) => {
        if (env.DEMO_MODE) {
            return {
                error: {
                    message: 'Atualização de senha não está disponível na demonstração.',
                    code: 'DEMO_UPDATE_PASSWORD_DISABLED',
                },
            };
        }

        const repo = getRepository();
        if (!repo) {
            const error = notConfiguredError<void>();
            return { error: error.error };
        }

        const result = await repo.updatePassword(newPassword);
        return { error: result.error };
    },

    /**
     * Check if Supabase Auth is configured
     */
    isConfigured: (): boolean => {
        if (env.DEMO_MODE) return true;
        return isSupabaseConfigured();
    }
};

/**
 * ============================================================
 * EDGE FUNCTIONS - Pontos de Integração para Auth
 * 
 * 1. create-profile
 *    - Chamada após signup para criar perfil na tabela 'profiles'
 *    - Pode incluir lógica de onboarding
 * 
 * 2. delete-account
 *    - Deletar usuário e TODOS os dados relacionados
 *    - Requer SERVICE_ROLE_KEY (só no Edge Function)
 * 
 * 3. sync-subscription
 *    - Sincronizar status de assinatura com Stripe
 *    - Atualizar plano do usuário
 * 
 * 4. custom-reset-email
 *    - Enviar email de reset customizado
 *    - Suporte a múltiplos idiomas
 * ============================================================
 */
