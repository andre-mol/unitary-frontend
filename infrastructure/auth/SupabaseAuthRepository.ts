/**
 * Supabase Auth Repository (STUB)
 * 
 * ============================================================
 * IMPLEMENTAÇÃO FUTURA - SUPABASE AUTH
 * 
 * Este arquivo contém a estrutura para integração com Supabase Auth.
 * Atualmente é um STUB que não está em uso.
 * 
 * PARA ATIVAR:
 * 1. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env
 * 2. Troque a implementação no authService.ts:
 *    const repository: AuthRepository = new SupabaseAuthRepository();
 * 
 * EDGE FUNCTIONS RECOMENDADAS:
 * - /functions/create-profile: Criar perfil após signup
 * - /functions/sync-user-data: Sincronizar dados do usuário
 * - /functions/delete-account: Deletar conta e dados
 * 
 * AIDEV-NOTE: Security boundary. Auth operations must never expose tokens,
 * passwords, or user IDs in logs. Session management must be secure.
 * ============================================================
 */

import { 
    AuthRepository, 
    AuthUser, 
    AuthSession, 
    AuthResult, 
    SignUpData,
    AuthError
} from '../../domain/repositories/AuthRepository';
import { getSupabaseClient } from '../../config/supabase';

/**
 * Supabase implementation of AuthRepository
 * 
 * NOTA: Esta implementação requer o cliente Supabase configurado.
 * Veja config/supabase.ts para configuração.
 */
export class SupabaseAuthRepository implements AuthRepository {
    
    private get supabase() {
        return getSupabaseClient();
    }
    
    async signIn(email: string, password: string): Promise<AuthResult<AuthSession>> {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }

        // Supabase may return a "fake" user with empty identities for existing emails
        if (data.user?.identities && data.user.identities.length === 0) {
            return {
                data: null,
                error: {
                    message: 'User already registered',
                    code: 'identity_already_exists',
                    status: 400,
                },
            };
        }
        
        return {
            data: this.mapSession(data.session),
            error: null
        };
    }
    
    async signUp(signUpData: SignUpData): Promise<AuthResult<AuthUser>> {
        // AIDEV-NOTE: Passar full_name, phone e metadados de consentimento em options.data
        // para que o trigger handle_new_user() possa ler via new.raw_user_meta_data
        const { data, error } = await this.supabase.auth.signUp({
            email: signUpData.email,
            password: signUpData.password,
            options: {
                data: {
                    full_name: signUpData.name,  // EXACT key name para o trigger
                    phone: signUpData.phone,     // EXACT key name para o trigger
                    marketing_emails_opt_in: signUpData.marketingEmailsOptIn ?? false,
                    // AIDEV-NOTE: product_updates_opt_in sempre recebe o mesmo valor de marketing_emails_opt_in
                    // pois são considerados a mesma coisa pelo usuário
                    product_updates_opt_in: signUpData.productUpdatesOptIn ?? signUpData.marketingEmailsOptIn ?? false,
                    terms_accepted: signUpData.termsAccepted ?? false,
                    terms_version: signUpData.termsVersion,
                    privacy_version: signUpData.privacyVersion,
                    communications_version: signUpData.communicationsVersion
                }
            }
        });
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        /**
         * EDGE FUNCTION: create-profile
         * 
         * Aqui você pode chamar uma Edge Function para criar
         * um perfil adicional na tabela 'profiles':
         * 
         * await this.supabase.functions.invoke('create-profile', {
         *     body: { userId: data.user?.id, name: signUpData.name }
         * });
         */
        
        return {
            data: this.mapUser(data.user),
            error: null
        };
    }
    
    async signInWithProvider(provider: 'google' | 'github' | 'apple'): Promise<AuthResult<void>> {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/dashboard`
            }
        });
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return { data: null, error: null };
    }
    
    async signOut(): Promise<AuthResult<void>> {
        const { error } = await this.supabase.auth.signOut();
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return { data: null, error: null };
    }
    
    async getSession(): Promise<AuthResult<AuthSession>> {
        const { data, error } = await this.supabase.auth.getSession();
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return {
            data: data.session ? this.mapSession(data.session) : null,
            error: null
        };
    }
    
    async getCurrentUser(): Promise<AuthResult<AuthUser>> {
        const { data, error } = await this.supabase.auth.getUser();
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return {
            data: this.mapUser(data.user),
            error: null
        };
    }
    
    onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
        const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
            (event, session) => {
                callback(session?.user ? this.mapUser(session.user) : null);
            }
        );
        
        return () => subscription.unsubscribe();
    }
    
    async resetPassword(email: string): Promise<AuthResult<void>> {
        /**
         * EDGE FUNCTION: custom-reset-email (opcional)
         * 
         * Você pode customizar o email de reset com uma Edge Function:
         * 
         * await this.supabase.functions.invoke('custom-reset-email', {
         *     body: { email, locale: 'pt-BR' }
         * });
         */
        
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/reset-password`
        });
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return { data: null, error: null };
    }
    
    async updatePassword(newPassword: string): Promise<AuthResult<void>> {
        const { error } = await this.supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) {
            return { data: null, error: this.mapError(error) };
        }
        
        return { data: null, error: null };
    }
    
    // --- Mappers ---
    
    private mapUser(user: any): AuthUser | null {
        if (!user) return null;
        
        return {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.user_metadata?.full_name,
            avatarUrl: user.user_metadata?.avatar_url,
            createdAt: user.created_at
        };
    }
    
    private mapSession(session: any): AuthSession | null {
        if (!session) return null;
        
        return {
            user: this.mapUser(session.user)!,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at
        };
    }
    
    private mapError(error: any): AuthError {
        return {
            message: error.message || 'Erro desconhecido',
            code: error.code,
            status: error.status
        };
    }
}

