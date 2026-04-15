/**
 * Subscription Service - Facade Pattern
 * 
 * This service acts as a facade, delegating data operations to a repository
 * while maintaining all business logic for plan features and limits.
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All data operations are async, using Supabase backend.
 * ============================================================
 */

import type { SubscriptionRepository, Subscription } from '../domain/repositories/SubscriptionRepository';
import { SupabaseSubscriptionRepository } from '../infrastructure/database/SupabaseSubscriptionRepository';
import type { PlanId } from './plans';
import {
  isPlanAtLeast as plansIsPlanAtLeast,
  getPortfolioLimit as plansGetPortfolioLimit,
  canAccessPlanning as plansCanAccessPlanning,
  getEffectivePlan,
} from './plans';
import { env } from '../config/env';

export type { Subscription } from '../domain/repositories/SubscriptionRepository';
export type Plan = PlanId;

const DEMO_SUBSCRIPTION: Subscription = {
    plan: 'patrio_pro',
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
};

const repository: SubscriptionRepository = env.DEMO_MODE
    ? { getMySubscription: async () => DEMO_SUBSCRIPTION }
    : new SupabaseSubscriptionRepository();

// ============================================================
// HELPER FUNCTIONS
// ============================================================
// Todas as funções agora delegam para lib/plans.ts

/**
 * Check if a plan meets or exceeds a required plan level
 * Plan hierarchy: inicial < essencial < patrio_pro
 * 
 * @param plan - Current plan
 * @param required - Required minimum plan
 * @returns true if plan meets or exceeds required level
 * 
 * @example
 * isPlanAtLeast('inicial', 'essencial') // false
 * isPlanAtLeast('essencial', 'essencial') // true
 * isPlanAtLeast('patrio_pro', 'essencial') // true
 */
export function isPlanAtLeast(plan: Plan, required: Plan): boolean {
    return plansIsPlanAtLeast(plan, required);
}

/**
 * Get portfolio limit for a plan
 * 
 * @param plan - Plan type
 * @returns Portfolio limit (number) or 'unlimited' for patrio_pro plan
 * 
 * @example
 * getPortfolioLimit('inicial') // 1
 * getPortfolioLimit('essencial') // 5
 * getPortfolioLimit('patrio_pro') // 'unlimited'
 */
export function getPortfolioLimit(plan: Plan): number | 'unlimited' {
    return plansGetPortfolioLimit(plan);
}

/**
 * Check if plan has access to planning features (goals, budget, objectives, expenses)
 * 
 * @param plan - Plan type
 * @returns true if plan has planning access (essencial or patrio_pro)
 * 
 * @example
 * canAccessPlanning('inicial') // false
 * canAccessPlanning('essencial') // true
 * canAccessPlanning('patrio_pro') // true
 */
export function canAccessPlanning(plan: Plan): boolean {
    return plansCanAccessPlanning(plan);
}

// ============================================================
// SUBSCRIPTION SERVICE
// ============================================================

/**
 * Subscription Service
 * Facade that delegates to repository and provides plan utilities
 */
export const subscriptionService = {
    /**
     * Get current user's plan
     * 
     * @returns Promise with current plan ('inicial', 'essencial', or 'patrio_pro')
     */
    getMyPlan: async (): Promise<Plan> => {
        const subscription = await repository.getMySubscription();
        return getEffectivePlan(subscription);
    },
    
    /**
     * Get current user's full subscription data
     * 
     * @returns Promise with full subscription object
     */
    getMySubscription: async (): Promise<Subscription> => {
        return await repository.getMySubscription();
    },
};

/**
 * Require a minimum paid plan using the effective subscription state.
 * Throws when the user is below the required plan.
 */
export async function requirePaidPlan(requiredPlan: Plan): Promise<Plan> {
    const subscription = await repository.getMySubscription();
    const effectivePlan = getEffectivePlan(subscription);

    if (!plansIsPlanAtLeast(effectivePlan, requiredPlan)) {
        const error = new Error(`Plano insuficiente. Necessário ${requiredPlan}.`);
        (error as Error & { code?: string; requiredPlan?: Plan }).code = 'PLAN_REQUIRED';
        (error as Error & { requiredPlan?: Plan }).requiredPlan = requiredPlan;
        throw error;
    }

    return effectivePlan;
}




