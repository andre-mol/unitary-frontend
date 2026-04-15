/**
 * Subscription Provider
 * 
 * ============================================================
 * CONTEXTO DE ASSINATURA/PLANO
 * 
 * Provê estado de assinatura/plano para toda a aplicação.
 * Gerencia:
 * - Plano atual do usuário (free/pro/max)
 * - Limite de portfólios
 * - Acesso a funcionalidades de planejamento
 * - Loading state durante verificação inicial
 * 
 * Depende de:
 * - AuthProvider (useAuth) para obter usuário atual
 * 
 * AIDEV-NOTE: Plan gating logic. Never trust client-side plan flags alone.
 * Always verify plan status server-side for critical operations. This provider
 * is for UI state only; server-side checks are required for security.
 * 
 * Uso:
 * ```tsx
 * // No App.tsx (dentro de AuthProvider)
 * <SubscriptionProvider>
 *   <Routes>...</Routes>
 * </SubscriptionProvider>
 * 
 * // Em qualquer componente
 * const { plan, portfolioLimit, canAccessPlanning } = useSubscription();
 * ```
 * ============================================================
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { subscriptionService, getPortfolioLimit, canAccessPlanning, type Plan } from '../../lib/subscriptionService';
import { getEffectivePlan } from '../../lib/plans';
import { identifyUser } from '../../lib/analytics';

// ============================================================
// TYPES
// ============================================================

interface SubscriptionContextValue {
    /** Current plan: 'inicial', 'essencial', or 'patrio_pro' */
    plan: Plan;
    /** Full subscription object */
    subscription: {
        status: string;
        currentPeriodEnd?: string;
    } | null;
    /** True while checking initial subscription state */
    loading: boolean;
    /** Portfolio limit: number or 'unlimited' */
    portfolioLimit: number | 'unlimited';
    /** True if plan has access to planning features (essencial/patrio_pro) */
    canAccessPlanning: boolean;
    /** Refresh subscription state manually */
    refreshPlan: () => Promise<void>;
    /** Current period end date (ISO string) */
    currentPeriodEnd?: string;
    /** True if subscription is scheduled to cancel */
    cancelAtPeriodEnd?: boolean;
}

// ... CONTEXT ...
const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

// ... PROVIDER ... 
interface SubscriptionProviderProps {
    children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
    const { user, loading: authLoading } = useAuth();
    const [plan, setPlan] = useState<Plan>('inicial');
    // Store full subscription details
    const [subscription, setSubscription] = useState<SubscriptionContextValue['subscription']>(null);
    const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | undefined>(undefined);
    const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    /**
     * Refresh subscription state from database
     */
    const refreshPlan = useCallback(async () => {
        // If user is not authenticated, reset to inicial plan
        if (!user) {
            setPlan('inicial');
            setSubscription(null);
            setCancelAtPeriodEnd(undefined);
            setCurrentPeriodEnd(undefined);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            // Fetch full subscription object
            const sub = await subscriptionService.getMySubscription();

            // Derive effective plan
            const effectivePlan = getEffectivePlan(sub);

            setPlan(effectivePlan);
            setSubscription({
                status: sub.status,
                currentPeriodEnd: sub.currentPeriodEnd
            });
            // Update top-level state
            setCancelAtPeriodEnd(sub.cancelAtPeriodEnd);
            setCurrentPeriodEnd(sub.currentPeriodEnd);

        } catch (error) {
            console.error('[SubscriptionProvider] Erro ao buscar plano:', error);
            // On error, default to inicial plan
            setPlan('inicial');
            setSubscription(null);
            setCancelAtPeriodEnd(undefined);
            setCurrentPeriodEnd(undefined);
        } finally {
            setLoading(false);
        }
    }, [user]);

    /**
     * Load subscription when user changes
     */
    useEffect(() => {
        // Wait for auth to finish loading
        if (authLoading) {
            return;
        }

        // If no user, reset to inicial plan
        if (!user) {
            setPlan('inicial');
            setSubscription(null);
            setLoading(false);
            return;
        }

        // Load subscription for authenticated user
        refreshPlan();
    }, [user, authLoading, refreshPlan]);

    // Calculate derived values
    const portfolioLimit = getPortfolioLimit(plan);
    const hasPlanningAccess = canAccessPlanning(plan);

    // Update user identification when plan changes
    useEffect(() => {
        if (user?.id && !loading) {
            // AIDEV-NOTE: Update user identification with plan when available
            identifyUser(user.id, {
                plan,
            });
        }
    }, [user?.id, plan, loading]);

    const value: SubscriptionContextValue = {
        plan,
        subscription,
        loading,
        portfolioLimit,
        canAccessPlanning: hasPlanningAccess,
        refreshPlan,
        cancelAtPeriodEnd,
        currentPeriodEnd
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook to access subscription context
 * 
 * @throws Error if used outside SubscriptionProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { plan, portfolioLimit, canAccessPlanning } = useSubscription();
 *   
 *   if (plan === 'free') {
 *     return <UpgradePrompt />;
 *   }
 *   
 *   return <div>Plano: {plan}</div>;
 * }
 * ```
 */
export function useSubscription(): SubscriptionContextValue {
    const context = useContext(SubscriptionContext);

    if (context === undefined) {
        throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
    }

    return context;
}




