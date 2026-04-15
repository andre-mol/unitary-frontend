/**
 * ============================================================
 * SUPABASE ERROR HANDLING
 * ============================================================
 * 
 * Normalizes Supabase/PostgREST errors into standardized messages.
 * Provides consistent error codes for the application to handle.
 * 
 * ERROR CODES:
 * - NOT_AUTHENTICATED: User is not logged in (401)
 * - FORBIDDEN: RLS violation or insufficient permissions (403)
 * - NOT_FOUND: Resource not found (404/PGRST116)
 * - CONFLICT: Unique constraint violation (409/23505)
 * - VALIDATION_ERROR: Invalid data (400)
 * - RATE_LIMITED: Too many requests (429)
 * - SERVER_ERROR: Internal server error (500+)
 * - UNKNOWN: Unknown error
 * 
 * ============================================================
 */

// ============================================================
// ERROR CODES
// ============================================================

export const SUPABASE_ERROR_CODES = {
    NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PORTFOLIO_LIMIT_REACHED: 'PORTFOLIO_LIMIT_REACHED',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVER_ERROR: 'SERVER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SUPABASE_NOT_CONFIGURED: 'SUPABASE_NOT_CONFIGURED',
    UNKNOWN: 'UNKNOWN',
} as const;

export type SupabaseErrorCode = typeof SUPABASE_ERROR_CODES[keyof typeof SUPABASE_ERROR_CODES];

// ============================================================
// ERROR CLASS
// ============================================================

export class SupabaseError extends Error {
    public readonly code: SupabaseErrorCode;
    public readonly originalError?: unknown;
    public readonly context?: string;
    
    constructor(
        message: string, 
        code: SupabaseErrorCode, 
        originalError?: unknown,
        context?: string
    ) {
        super(message);
        this.name = 'SupabaseError';
        this.code = code;
        this.originalError = originalError;
        this.context = context;
        
        // Maintains proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SupabaseError);
        }
    }
}

// ============================================================
// ERROR MESSAGES (Portuguese)
// ============================================================

const ERROR_MESSAGES: Record<SupabaseErrorCode, string> = {
    NOT_AUTHENTICATED: 'Usuário não autenticado. Faça login para continuar.',
    FORBIDDEN: 'Acesso negado. Você não tem permissão para esta operação.',
    NOT_FOUND: 'Recurso não encontrado.',
    CONFLICT: 'Este registro já existe.',
    VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente novamente.',
    PORTFOLIO_LIMIT_REACHED: 'Limite de portfólios atingido para o seu plano. Faça upgrade para criar mais portfólios.',
    RATE_LIMITED: 'Muitas requisições. Aguarde um momento e tente novamente.',
    SERVER_ERROR: 'Erro no servidor. Tente novamente mais tarde.',
    NETWORK_ERROR: 'Erro de conexão. Verifique sua internet.',
    SUPABASE_NOT_CONFIGURED: 'Supabase não está configurado. Configure as variáveis de ambiente.',
    UNKNOWN: 'Erro desconhecido. Tente novamente.',
};

// ============================================================
// POSTGREST ERROR CODES
// ============================================================

const POSTGREST_ERROR_MAP: Record<string, SupabaseErrorCode> = {
    // Auth errors
    'PGRST301': SUPABASE_ERROR_CODES.NOT_AUTHENTICATED,
    
    // Not found
    'PGRST116': SUPABASE_ERROR_CODES.NOT_FOUND,
    
    // Postgres constraint violations
    '23505': SUPABASE_ERROR_CODES.CONFLICT, // unique_violation
    '23503': SUPABASE_ERROR_CODES.VALIDATION_ERROR, // foreign_key_violation
    '23502': SUPABASE_ERROR_CODES.VALIDATION_ERROR, // not_null_violation
    '23514': SUPABASE_ERROR_CODES.VALIDATION_ERROR, // check_violation
    
    // RLS violations typically return these
    '42501': SUPABASE_ERROR_CODES.FORBIDDEN, // insufficient_privilege
    '42000': SUPABASE_ERROR_CODES.FORBIDDEN, // syntax_error_or_access_rule_violation
};

// ============================================================
// NORMALIZER FUNCTION
// ============================================================

/**
 * Normalize any Supabase/PostgREST error into a SupabaseError
 * 
 * @param error - The error object from Supabase
 * @param context - Optional context string for logging
 * @returns SupabaseError with normalized code and message
 */
export function normalizeSupabaseError(
    error: unknown, 
    context?: string
): SupabaseError {
    // Already a SupabaseError
    if (error instanceof SupabaseError) {
        return error;
    }
    
    // Handle null/undefined
    if (!error) {
        return new SupabaseError(
            ERROR_MESSAGES.UNKNOWN,
            SUPABASE_ERROR_CODES.UNKNOWN,
            error,
            context
        );
    }
    
    // Extract error properties
    const errorObj = error as any;
    const code = errorObj.code;
    const status = errorObj.status;
    const message = errorObj.message || String(error);
    const hint = errorObj.hint;
    
    // Determine error code
    let errorCode: SupabaseErrorCode = SUPABASE_ERROR_CODES.UNKNOWN;
    
    // PRIORITY: Check for PATRIO_PORTFOLIO_LIMIT error first (before other checks)
    // This is a specific business logic error that should be detected early
    if (code === '23514' && message && message.includes('PATRIO_PORTFOLIO_LIMIT')) {
        errorCode = SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED;
    }
    // Check by PostgREST/Postgres code
    else if (code && POSTGREST_ERROR_MAP[code]) {
        errorCode = POSTGREST_ERROR_MAP[code];
    }
    // Check by HTTP status
    else if (status) {
        switch (status) {
            case 401:
                errorCode = SUPABASE_ERROR_CODES.NOT_AUTHENTICATED;
                break;
            case 403:
                errorCode = SUPABASE_ERROR_CODES.FORBIDDEN;
                break;
            case 404:
                errorCode = SUPABASE_ERROR_CODES.NOT_FOUND;
                break;
            case 409:
                errorCode = SUPABASE_ERROR_CODES.CONFLICT;
                break;
            case 400:
            case 422:
                errorCode = SUPABASE_ERROR_CODES.VALIDATION_ERROR;
                break;
            case 429:
                errorCode = SUPABASE_ERROR_CODES.RATE_LIMITED;
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                errorCode = SUPABASE_ERROR_CODES.SERVER_ERROR;
                break;
        }
    }
    // Check by message content (fallback)
    else if (message) {
        const lowerMessage = message.toLowerCase();
        // Check for PATRIO_PORTFOLIO_LIMIT in message (fallback detection)
        if (message.includes('PATRIO_PORTFOLIO_LIMIT') || lowerMessage.includes('limite do plano') || lowerMessage.includes('limite de portfólios')) {
            errorCode = SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED;
        } else if (lowerMessage.includes('jwt') || lowerMessage.includes('auth') || lowerMessage.includes('token')) {
            errorCode = SUPABASE_ERROR_CODES.NOT_AUTHENTICATED;
        } else if (lowerMessage.includes('permission') || lowerMessage.includes('denied') || lowerMessage.includes('rls')) {
            errorCode = SUPABASE_ERROR_CODES.FORBIDDEN;
        } else if (lowerMessage.includes('not found') || lowerMessage.includes('no rows')) {
            errorCode = SUPABASE_ERROR_CODES.NOT_FOUND;
        } else if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
            errorCode = SUPABASE_ERROR_CODES.CONFLICT;
        } else if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
            errorCode = SUPABASE_ERROR_CODES.NETWORK_ERROR;
        }
    }
    
    // Build error message
    let normalizedMessage = ERROR_MESSAGES[errorCode];
    
    // For portfolio limit errors, use friendly message
    if (errorCode === SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED) {
        // Use detail message if available, otherwise use friendly default
        const detail = (errorObj as any).details || (errorObj as any).detail;
        if (detail) {
            normalizedMessage = detail;
        } else {
            normalizedMessage = 'Você atingiu o limite de portfólios do seu plano. Faça upgrade para criar mais.';
        }
    } else if (hint) {
        normalizedMessage += ` (${hint})`;
    }
    
    // Log with context
    if (context) {
        console.error(`[SupabaseError] ${context}:`, {
            code: errorCode,
            originalCode: code,
            status,
            message,
            hint,
        });
    }
    
    return new SupabaseError(normalizedMessage, errorCode, error, context);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if error is a specific type
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
    return error instanceof SupabaseError;
}

export function isNotAuthenticated(error: unknown): boolean {
    return isSupabaseError(error) && error.code === SUPABASE_ERROR_CODES.NOT_AUTHENTICATED;
}

export function isForbidden(error: unknown): boolean {
    return isSupabaseError(error) && error.code === SUPABASE_ERROR_CODES.FORBIDDEN;
}

export function isNotFound(error: unknown): boolean {
    return isSupabaseError(error) && error.code === SUPABASE_ERROR_CODES.NOT_FOUND;
}

export function isConflict(error: unknown): boolean {
    return isSupabaseError(error) && error.code === SUPABASE_ERROR_CODES.CONFLICT;
}

export function isPortfolioLimitReached(error: unknown): boolean {
    return isSupabaseError(error) && error.code === SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED;
}

/**
 * Handle error and throw standardized SupabaseError
 * Convenience function for repository methods
 */
export function handleSupabaseError(context: string, error: unknown): never {
    const normalizedError = normalizeSupabaseError(error, context);
    throw normalizedError;
}

