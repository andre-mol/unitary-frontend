/**
 * Domain Repositories - Central Export
 * 
 * Interfaces que definem contratos para acesso a dados.
 * Cada interface pode ter múltiplas implementações:
 * - LocalStorage (atual, para desenvolvimento)
 * - Supabase (futuro, para produção)
 */

export type { 
    PortfolioRepository, 
    CreatePortfolioDTO, 
    CreateHistoryEventDTO 
} from './PortfolioRepository';

export type { 
    PlanningRepository, 
    Goal, 
    Budget, 
    Objective, 
    Expense 
} from './PlanningRepository';

export type { 
    AuthRepository, 
    AuthUser, 
    AuthSession, 
    AuthResult, 
    AuthError, 
    SignUpData 
} from './AuthRepository';

