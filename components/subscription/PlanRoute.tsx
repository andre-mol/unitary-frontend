/**
 * Plan Route Component
 * 
 * ============================================================
 * PROTEÇÃO DE ROTAS POR PLANO
 * 
 * Wrapper para rotas que requerem plano específico (essencial/patrio_pro).
 * 
 * Comportamento:
 * - Se loading: renderiza null (sem alterar layout)
 * - Se plano insuficiente: renderiza UpgradePage diretamente na rota
 * - Se plano suficiente: renderiza children
 * 
 * IMPORTANTE:
 * Este componente NÃO substitui o ProtectedRoute.
 * Ele é um layer adicional que deve ser usado DENTRO do ProtectedRoute.
 * 
 * AIDEV-NOTE: Security boundary. Never trust client plan flags; verify server-side.
 * This component provides UX gating only. Backend must enforce plan limits.
 * 
 * Uso:
 * ```tsx
 * <Route 
 *   path="/dashboard/metas" 
 *   element={
 *     <ProtectedRoute>
 *       <PlanRoute required="essencial" featureName="Planejamento">
 *         <GoalsPage />
 *       </PlanRoute>
 *     </ProtectedRoute>
 *   } 
 * />
 * ```
 * ============================================================
 */

import React, { useEffect, useState } from 'react';
import { useSubscription } from './SubscriptionProvider';
import { isPlanAtLeast, requirePaidPlan, type Plan } from '../../lib/subscriptionService';
import { UpgradePage } from '../dashboard/UpgradePage';

interface PlanRouteProps {
    /** Children to render if plan requirement is met */
    children: React.ReactNode;
    /** Minimum plan required to access this route */
    required: Plan;
    /** Name of the feature that is blocked (shown in upgrade page) */
    featureName: string;
}

export function PlanRoute({ 
    children, 
    required,
    featureName 
}: PlanRouteProps) {
    const { plan, loading } = useSubscription();
    const [serverAllowed, setServerAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;
        requirePaidPlan(required)
            .then(() => {
                if (active) {
                    setServerAllowed(true);
                }
            })
            .catch(() => {
                if (active) {
                    setServerAllowed(false);
                }
            });
        return () => {
            active = false;
        };
    }, [required]);
    
    // While checking subscription state, render nothing (no layout change)
    if (loading || serverAllowed === null) {
        return null;
    }
    
    // Check if current plan meets the required plan level
    const hasAccess = serverAllowed && isPlanAtLeast(plan, required);
    
    // If plan is insufficient, show UpgradePage directly
    if (!hasAccess) {
        return (
            <UpgradePage 
                featureName={featureName}
                requiredPlan={required}
            />
        );
    }
    
    // Plan requirement met, render children
    return <>{children}</>;
}




