/**
 * Supabase Authentication Helpers
 * 
 * ============================================================
 * HELPERS DE AUTENTICAÇÃO COM CACHING
 * 
 * Funções utilitárias para operações de autenticação que precisam
 * garantir que o usuário está logado.
 * 
 * IMPORTANTE: Usa cache em memória para evitar chamadas excessivas
 * ao endpoint /auth/v1/user (reduz de ~30 chamadas para 1 por sessão)
 * 
 * Uso típico em repositories e services que precisam do user_id:
 * ```typescript
 * const userId = await getRequiredUserId();
 * // userId é garantidamente um UUID válido aqui
 * ```
 * ============================================================
 */

import { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { env } from './env';
import { DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_NAME } from '../mocks/demoMode';

/**
 * Custom error code for authentication failures
 */
export const AUTH_ERROR_CODE = 'NOT_AUTHENTICATED' as const;

/**
 * Authentication error class
 * Thrown when user is not authenticated but authentication is required
 */
export class AuthenticationError extends Error {
    public readonly code = AUTH_ERROR_CODE;

    constructor(message: string = 'Usuário não autenticado') {
        super(message);
        this.name = 'AuthenticationError';

        // Maintains proper stack trace for where error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthenticationError);
        }
    }
}

/**
 * Check if an error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
    return error instanceof AuthenticationError ||
        (error instanceof Error && (error as { code?: string }).code === AUTH_ERROR_CODE);
}

// ============================================================
// USER CACHE - Evita chamadas excessivas ao /auth/v1/user
// ============================================================

interface CachedUser {
    user: User | null;
    timestamp: number;
    promise: Promise<User | null> | null;
}

// Cache duration (5 minutes) - balances freshness with performance
const CACHE_DURATION_MS = 5 * 60 * 1000;

// In-memory cache
let userCache: CachedUser = {
    user: null,
    timestamp: 0,
    promise: null
};

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
    return userCache.user !== null &&
        (Date.now() - userCache.timestamp) < CACHE_DURATION_MS;
}

/**
 * Invalidate the user cache
 * Call this on logout or when user data changes
 */
export function invalidateUserCache(): void {
    userCache = { user: null, timestamp: 0, promise: null };
}

/**
 * Get user from cache or fetch from Supabase
 * Uses deduplication to prevent multiple concurrent requests
 */
async function getCachedUser(): Promise<User | null> {
    // Return cached user if valid
    if (isCacheValid()) {
        return userCache.user;
    }

    // If there's already a pending request, wait for it
    if (userCache.promise) {
        return userCache.promise;
    }

    // Create new request and store promise for deduplication
    userCache.promise = (async () => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase.auth.getUser();

            if (error) {
                userCache = { user: null, timestamp: 0, promise: null };
                return null;
            }

            // Update cache with fresh user data
            userCache = {
                user: data.user,
                timestamp: Date.now(),
                promise: null
            };

            return data.user;
        } catch {
            userCache = { user: null, timestamp: 0, promise: null };
            return null;
        }
    })();

    return userCache.promise;
}

// ============================================================
// Listen for auth state changes to invalidate cache
// ============================================================

let authListenerInitialized = false;

function initAuthListener(): void {
    if (authListenerInitialized || !isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();

    supabase.auth.onAuthStateChange((event, session) => {
        // Invalidate cache on sign out or session changes
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            invalidateUserCache();

            // Pre-populate cache for SIGNED_IN to avoid extra request
            if (event === 'SIGNED_IN' && session?.user) {
                userCache = {
                    user: session.user,
                    timestamp: Date.now(),
                    promise: null
                };
            }
        }
    });

    authListenerInitialized = true;
}

// Initialize listener on module load
if (typeof window !== 'undefined') {
    // Defer initialization to avoid blocking initial render
    setTimeout(initAuthListener, 0);
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Get the current authenticated user's ID
 * 
 * This function uses caching to minimize network requests:
 * - Returns cached user ID if available and valid
 * - Deduplicates concurrent requests
 * - Auto-invalidates on auth state changes
 * 
 * @returns Promise<string> The authenticated user's UUID
 * @throws AuthenticationError if user is not logged in
 * @throws Error if Supabase is not configured
 */
export async function getRequiredUserId(): Promise<string> {
    if (env.DEMO_MODE) return DEMO_USER_ID;

    if (!isSupabaseConfigured()) {
        throw new AuthenticationError(
            'Supabase não está configurado. Configure as variáveis de ambiente.'
        );
    }

    const user = await getCachedUser();

    if (!user) {
        throw new AuthenticationError('Usuário não autenticado');
    }

    return user.id;
}

/**
 * Get the current authenticated user's ID (nullable version)
 * 
 * Unlike getRequiredUserId(), this function returns null instead of throwing
 * when the user is not authenticated. Useful for optional auth scenarios.
 * 
 * @returns Promise<string | null> The user ID or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
    if (env.DEMO_MODE) return DEMO_USER_ID;

    if (!isSupabaseConfigured()) {
        return null;
    }

    const user = await getCachedUser();
    return user?.id ?? null;
}

/**
 * Get the full cached user object
 * Useful when you need more than just the user ID
 * 
 * @returns Promise<User | null> The full user object or null
 */
export async function getCurrentUser(): Promise<User | null> {
    if (env.DEMO_MODE) {
        return { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, user_metadata: { name: DEMO_USER_NAME }, app_metadata: {}, aud: 'authenticated' } as unknown as User;
    }

    if (!isSupabaseConfigured()) {
        return null;
    }

    return getCachedUser();
}

/**
 * Check if user is currently authenticated
 * 
 * @returns Promise<boolean> True if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const userId = await getCurrentUserId();
    return userId !== null;
}
