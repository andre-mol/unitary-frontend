/**
 * Auth Repository Interface
 * Defines the contract for authentication operations
 * 
 * ============================================================
 * INTEGRAÇÃO COM SUPABASE:
 * 
 * Esta interface define os métodos que serão implementados por:
 * - MockAuthRepository (atual, para desenvolvimento local)
 * - SupabaseAuthRepository (produção, quando configurado)
 * 
 * Para ativar Supabase Auth:
 * 1. Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 * 2. Troque a implementação no authService.ts
 * ============================================================
 */

/**
 * User object returned by auth operations
 */
export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    createdAt?: string;
}

/**
 * Session object for authenticated users
 */
export interface AuthSession {
    user: AuthUser;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
}

/**
 * Result of auth operations
 */
export interface AuthResult<T = AuthUser> {
    data: T | null;
    error: AuthError | null;
}

/**
 * Auth error object
 */
export interface AuthError {
    message: string;
    code?: string;
    status?: number;
}

/**
 * Sign up data
 */
export interface SignUpData {
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
}

/**
 * Auth Repository Interface
 * All authentication implementations must follow this contract
 */
export interface AuthRepository {
    /**
     * Sign in with email and password
     * 
     * SUPABASE: supabase.auth.signInWithPassword({ email, password })
     */
    signIn(email: string, password: string): Promise<AuthResult<AuthSession>>;
    
    /**
     * Sign up a new user
     * 
     * SUPABASE: supabase.auth.signUp({ email, password, options: { data: { name } } })
     * EDGE FUNCTION: Pode ser usada para criar perfil adicional em 'profiles' table
     */
    signUp(data: SignUpData): Promise<AuthResult<AuthUser>>;
    
    /**
     * Sign in with OAuth provider (Google, GitHub, etc)
     * 
     * SUPABASE: supabase.auth.signInWithOAuth({ provider: 'google' })
     */
    signInWithProvider(provider: 'google' | 'github' | 'apple'): Promise<AuthResult<void>>;
    
    /**
     * Sign out the current user
     * 
     * SUPABASE: supabase.auth.signOut()
     */
    signOut(): Promise<AuthResult<void>>;
    
    /**
     * Get current session
     * 
     * SUPABASE: supabase.auth.getSession()
     */
    getSession(): Promise<AuthResult<AuthSession>>;
    
    /**
     * Get current user
     * 
     * SUPABASE: supabase.auth.getUser()
     */
    getCurrentUser(): Promise<AuthResult<AuthUser>>;
    
    /**
     * Listen to auth state changes
     * 
     * SUPABASE: supabase.auth.onAuthStateChange((event, session) => {...})
     */
    onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;
    
    /**
     * Send password reset email
     * 
     * SUPABASE: supabase.auth.resetPasswordForEmail(email)
     * EDGE FUNCTION: Pode customizar o email de reset
     */
    resetPassword(email: string): Promise<AuthResult<void>>;
    
    /**
     * Update user password
     * 
     * SUPABASE: supabase.auth.updateUser({ password })
     */
    updatePassword(newPassword: string): Promise<AuthResult<void>>;
}

