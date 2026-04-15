/**
 * ============================================================
 * SUPABASE SUBSCRIPTION REPOSITORY - IMPLEMENTATION
 * ============================================================
 * 
 * Full implementation of SubscriptionRepository using Supabase.
 * 
 * FEATURES:
 * - Get current user's subscription/plan
 * - Returns default free plan if subscription doesn't exist
 * 
 * MAPPING:
 * - Database uses snake_case (e.g., user_id, current_period_end)
 * - App uses camelCase (e.g., userId, currentPeriodEnd)
 * 
 * AIDEV-NOTE: RLS critical. Subscription data is protected by RLS policies.
 * Any changes to subscription queries require running scripts/test-rls.ts.
 * Never bypass RLS or expose subscription data across users.
 * 
 * ============================================================
 */

import type { SubscriptionRepository, Subscription } from '../../domain/repositories/SubscriptionRepository';
import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import { handleSupabaseError } from '../../utils/supabaseErrors';

// ============================================================
// DATABASE ROW TYPES (snake_case)
// ============================================================

interface DbSubscription {
    user_id: string;
    plan: 'inicial' | 'essencial' | 'patrio_pro';
    status: 'active' | 'inactive' | 'past_due' | 'canceled';
    current_period_end: string | null;
    cancel_at_period_end?: boolean; // Added column definition
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert database row (snake_case) to app Subscription (camelCase)
 */
function fromDbSubscription(row: DbSubscription): Subscription {
    // metadata fallback for legacy/partially migrated rows
    const metadata = row.metadata as Record<string, any>;
    const cancelAtPeriodEnd = row.cancel_at_period_end === true || metadata?.cancel_at_period_end === true;

    return {
        plan: row.plan,
        status: row.status,
        currentPeriodEnd: row.current_period_end ?? undefined,
        cancelAtPeriodEnd,
    };
}

// ============================================================
// REPOSITORY IMPLEMENTATION
// ============================================================

export class SupabaseSubscriptionRepository implements SubscriptionRepository {

    private get supabase() {
        return getSupabaseClient();
    }

    /**
     * Get the current user's subscription
     * Returns default free plan if no subscription exists
     * 
     * AIDEV-NOTE: Security boundary. Uses getRequiredUserId() to ensure
     * authenticated user. RLS enforces user_id = auth.uid() on user_subscriptions table.
     */
    async getMySubscription(): Promise<Subscription> {
        try {
            const userId = await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .limit(1);

            if (error) {
                handleSupabaseError('Erro ao buscar assinatura', error);
            }

            const row = Array.isArray(data) ? data[0] : null;
            if (!row) {
                return {
                    plan: 'inicial',
                    status: 'active',
                };
            }

            return fromDbSubscription(row as DbSubscription);
        } catch (error) {
            // On any error, return default inicial plan as fallback
            console.warn('[SupabaseSubscriptionRepository] Erro ao buscar assinatura, retornando plano inicial:', error);
            return {
                plan: 'inicial',
                status: 'active',
            };
        }
    }
}



