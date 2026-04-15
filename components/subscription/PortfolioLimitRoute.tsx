/**
 * Portfolio Limit Route Component
 * 
 * ============================================================
 * PROTEÇÃO DE ROTA POR LIMITE DE PORTFÓLIOS
 * 
 * Wrapper para rotas que requerem verificação de limite de portfólios.
 * Bloqueia acesso quando o usuário já atingiu o limite do seu plano.
 * 
 * Comportamento:
 * - Se loading: renderiza null (sem alterar layout)
 * - Se limite atingido: renderiza UpgradePage
 * - Se dentro do limite: renderiza children
 * 
 * AIDEV-NOTE: Client-side plan gating. This is UX-only protection.
 * Server-side validation must also check portfolio limits before allowing
 * creation. Never rely solely on this component for security.
 * 
 * IMPORTANTE:
 * Este componente NÃO substitui o ProtectedRoute.
 * Ele é um layer adicional que deve ser usado DENTRO do ProtectedRoute.
 * 
 * Uso:
 * ```tsx
 * <Route 
 *   path="/dashboard/create-portfolio" 
 *   element={
 *     <ProtectedRoute>
 *       <PortfolioLimitRoute>
 *         <CreatePortfolioPage />
 *       </PortfolioLimitRoute>
 *     </ProtectedRoute>
 *   } 
 * />
 * ```
 * ============================================================
 */

import React, { useEffect, useState } from 'react';
import { useSubscription } from './SubscriptionProvider';
import { portfolioService } from '../../lib/portfolioService';
import { UpgradePage } from '../dashboard/UpgradePage';
import type { Portfolio } from '../../types';

interface PortfolioLimitRouteProps {
    /** Children to render if portfolio limit is not reached */
    children: React.ReactNode;
}

export function PortfolioLimitRoute({ children }: PortfolioLimitRouteProps) {
    const { plan, portfolioLimit, loading: subscriptionLoading } = useSubscription();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Load portfolios to check current count
    useEffect(() => {
        if (subscriptionLoading) {
            return;
        }
        
        const loadPortfolios = async () => {
            try {
                setLoading(true);
                const allPortfolios = await portfolioService.getPortfolios();
                setPortfolios(allPortfolios);
            } catch (error) {
                console.error('[PortfolioLimitRoute] Erro ao carregar portfólios:', error);
                // On error, allow access (fail open)
                setPortfolios([]);
            } finally {
                setLoading(false);
            }
        };
        
        loadPortfolios();
    }, [subscriptionLoading]);
    
    // While checking subscription or portfolios, render nothing (no layout change)
    if (subscriptionLoading || loading) {
        return null;
    }
    
    // If plan is 'patrio_pro', always allow (unlimited)
    if (plan === 'patrio_pro') {
        return <>{children}</>;
    }
    
    // Check if limit is reached
    const currentCount = portfolios.length;
    const limit = portfolioLimit === 'unlimited' ? Infinity : portfolioLimit;
    const limitReached = currentCount >= limit;
    
    // If limit is reached, show upgrade page
    if (limitReached) {
        const requiredPlan = plan === 'inicial' ? 'essencial' : 'patrio_pro';
        return (
            <UpgradePage 
                featureName="Criação de Portfólio" 
                requiredPlan={requiredPlan}
                limitInfo={{
                    current: currentCount,
                    limit: limit,
                    plan: plan,
                }}
            />
        );
    }
    
    // Within limit, render children
    return <>{children}</>;
}




