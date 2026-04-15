/**
 * Auth Provider
 * 
 * ============================================================
 * CONTEXTO DE AUTENTICAÇÃO
 * 
 * Provê estado de autenticação para toda a aplicação.
 * Gerencia:
 * - Estado do usuário atual
 * - Loading state durante verificação inicial
 * - Listener de mudanças de auth state
 * 
 * Uso:
 * ```tsx
 * // No App.tsx
 * <AuthProvider>
 *   <Routes>...</Routes>
 * </AuthProvider>
 * 
 * // Em qualquer componente
 * const { user, loading } = useAuth();
 * ```
 * ============================================================
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authService } from '../../lib/authService';
import { AuthUser } from '../../domain/repositories/AuthRepository';
import { cleanupLegacyLocalData } from '../../utils/cleanupLegacyLocalData';
import { clearQueryCache } from '../../lib/queryClient';
import { removePersistedCache } from '../../lib/queryPersistence';
import { identifyUser, resetUser, captureLogout } from '../../lib/analytics';

// ============================================================
// TYPES
// ============================================================

interface AuthContextValue {
    /** Current authenticated user, null if not logged in */
    user: AuthUser | null;
    /** True while checking initial auth state */
    loading: boolean;
    /** Refresh user state manually */
    refreshUser: () => Promise<void>;
    /** Check if auth is configured */
    isConfigured: boolean;
}

// ============================================================
// CONTEXT
// ============================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const isConfigured = authService.isConfigured();

    // In-memory ref to track if cleanup has run this session (no localStorage)
    const cleanupRanRef = useRef(false);
    const previousUserIdRef = useRef<string | null>(null);

    /**
     * Refresh user state from session
     */
    const refreshUser = useCallback(async () => {
        if (!isConfigured) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const { session } = await authService.getSession();
            setUser(session?.user ?? null);
        } catch (error) {
            console.error('[AuthProvider] Erro ao buscar sessão:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [isConfigured]);

    /**
     * Initial session check on mount
     */
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    /**
     * Listen to auth state changes
     */
    useEffect(() => {
        if (!isConfigured) {
            return;
        }

        const unsubscribe = authService.onAuthStateChange((authUser) => {
            // AIDEV-FIX: Only update state if user Identity actually changed to prevent re-renders on token refresh
            setUser((current) => {
                // If both are null, no change
                if (!current && !authUser) return current;

                // If one matches the other deeply (checking ID and email is enough for auth context)
                if (current?.id === authUser?.id && current?.email === authUser?.email) {
                    return current;
                }

                return authUser;
            });
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [isConfigured]);

    /**
     * Cleanup legacy localStorage data after successful login
     * Runs once per session when user is authenticated
     */
    useEffect(() => {
        if (user && !cleanupRanRef.current) {
            cleanupRanRef.current = true;
            cleanupLegacyLocalData();
        }
    }, [user]);

    useEffect(() => {
        // Handle logout: reset analytics and clear cache
        if (previousUserIdRef.current && !user) {
            captureLogout(); // AIDEV-NOTE: Capture logout event
            resetUser(); // AIDEV-NOTE: Reset PostHog user identification on logout
            clearQueryCache();
            void removePersistedCache();
        }

        // Handle login: identify user in analytics
        if (user && user.id && previousUserIdRef.current !== user.id) {
            // AIDEV-NOTE: Identify user with Supabase UUID. Never sends email.
            // Only sends safe properties: plan, role, onboarding_completed, created_at
            identifyUser(user.id, {
                // Add plan if available from subscription context
                // Note: plan will be added separately when subscription data is available
            });
        }

        previousUserIdRef.current = user?.id ?? null;
    }, [user]);

    const value: AuthContextValue = {
        user,
        loading,
        refreshUser,
        isConfigured,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook to access auth context
 * 
 * @throws Error if used outside AuthProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading } = useAuth();
 *   
 *   if (loading) return <Spinner />;
 *   if (!user) return <Navigate to="/login" />;
 *   
 *   return <div>Olá, {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }

    return context;
}

