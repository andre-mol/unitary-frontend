/**
 * Subscription Repository Interface
 * Defines the contract for subscription/plan data access
 * This abstraction allows swapping storage implementations (localStorage, Supabase, etc.)
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All methods return Promises to support both sync (localStorage)
 * and async (Supabase, API) implementations transparently.
 * ============================================================
 */

/**
 * User subscription/plan data
 */
export interface Subscription {
    /** Plan type: inicial, essencial, or patrio_pro */
    plan: 'inicial' | 'essencial' | 'patrio_pro';
    /** Subscription status */
    status: 'active' | 'inactive' | 'past_due' | 'canceled';
    /** Optional: subscription period end date */
    currentPeriodEnd?: string; // ISO 8601 date string
    /** Optional: true if subscription is scheduled to cancel at period end */
    cancelAtPeriodEnd?: boolean;
}

/**
 * Subscription Repository Interface
 * Provides async data access methods for user subscriptions
 */
export interface SubscriptionRepository {
    /**
     * Get the current user's subscription/plan
     * Returns default free plan if no subscription exists
     * 
     * @returns Promise<Subscription> The user's current subscription
     */
    getMySubscription(): Promise<Subscription>;
}




