/**
 * Mock Auth Repository
 * 
 * Implementação mock para desenvolvimento local sem backend.
 * Simula todas as operações de autenticação com delays de rede.
 * 
 * ============================================================
 * COMPORTAMENTO:
 * - Todas as operações retornam sucesso após um delay simulado
 * - Nenhum dado é persistido (refresh perde a sessão)
 * - Útil para desenvolvimento de UI sem dependência de backend
 * ============================================================
 */

import { 
    AuthRepository, 
    AuthUser, 
    AuthSession, 
    AuthResult, 
    SignUpData 
} from '../../domain/repositories/AuthRepository';

// Simulated network delay
const MOCK_DELAY = 800;

// Mock user for development
const MOCK_USER: AuthUser = {
    id: 'mock-user-id',
    email: 'dev@patrio.app',
    name: 'Desenvolvedor',
    createdAt: new Date().toISOString()
};

// Mock session
const MOCK_SESSION: AuthSession = {
    user: MOCK_USER,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000 // 1 hour
};

/**
 * Mock implementation of AuthRepository
 * Used for local development without Supabase
 */
export class MockAuthRepository implements AuthRepository {
    
    private currentUser: AuthUser | null = null;
    private authListeners: ((user: AuthUser | null) => void)[] = [];
    
    async signIn(email: string, password: string): Promise<AuthResult<AuthSession>> {
        await this.delay();
        
        // Always succeed in mock mode
        const user: AuthUser = { ...MOCK_USER, email };
        this.currentUser = user;
        this.notifyListeners(user);
        
        return {
            data: { ...MOCK_SESSION, user },
            error: null
        };
    }
    
    async signUp(data: SignUpData): Promise<AuthResult<AuthUser>> {
        await this.delay();
        
        const user: AuthUser = {
            id: crypto.randomUUID(),
            email: data.email,
            name: data.name,
            createdAt: new Date().toISOString()
        };
        
        this.currentUser = user;
        this.notifyListeners(user);
        
        return { data: user, error: null };
    }
    
    async signInWithProvider(provider: 'google' | 'github' | 'apple'): Promise<AuthResult<void>> {
        await this.delay();
        
        // In mock mode, we can't do real OAuth
        // Just simulate success and set a mock user
        this.currentUser = { ...MOCK_USER, email: `${provider}@mock.com` };
        this.notifyListeners(this.currentUser);
        
        return { data: null, error: null };
    }
    
    async signOut(): Promise<AuthResult<void>> {
        await this.delay(300);
        
        this.currentUser = null;
        this.notifyListeners(null);
        
        return { data: null, error: null };
    }
    
    async getSession(): Promise<AuthResult<AuthSession>> {
        await this.delay(100);
        
        if (this.currentUser) {
            return {
                data: { ...MOCK_SESSION, user: this.currentUser },
                error: null
            };
        }
        
        return { data: null, error: null };
    }
    
    async getCurrentUser(): Promise<AuthResult<AuthUser>> {
        await this.delay(100);
        
        return { data: this.currentUser, error: null };
    }
    
    onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
        this.authListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            this.authListeners = this.authListeners.filter(cb => cb !== callback);
        };
    }
    
    async resetPassword(email: string): Promise<AuthResult<void>> {
        await this.delay();
        
        // Não logar email por segurança (mesmo em mock)
        console.log('[Mock] Password reset email sent');
        return { data: null, error: null };
    }
    
    async updatePassword(newPassword: string): Promise<AuthResult<void>> {
        await this.delay();
        
        console.log('[Mock] Password updated');
        return { data: null, error: null };
    }
    
    // --- Helpers ---
    
    private delay(ms: number = MOCK_DELAY): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    private notifyListeners(user: AuthUser | null): void {
        this.authListeners.forEach(cb => cb(user));
    }
}

