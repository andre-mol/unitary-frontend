/**
 * ============================================================
 * START CHECKOUT - FRONTEND HOOK
 * ============================================================
 *
 * AIDEV-NOTE: This hook initiates the Stripe Checkout flow.
 * It calls the admin API to create a checkout session, then
 * redirects the user to Stripe's hosted checkout page.
 *
 * Usage:
 * ```tsx
 * import { startCheckout } from '@/lib/billing/startCheckout'
 *
 * const handleUpgrade = async () => {
 *   try {
 *     await startCheckout('essencial', 'monthly')
 *   } catch (error) {
 *     // Handle error (show toast, etc.)
 *   }
 * }
 * ```
 *
 * ============================================================
 */

import type { PlanId } from '../plans'

// ============================================================
// TYPES
// ============================================================

export type PaidPlanId = 'essencial' | 'patrio_pro'
export type BillingCycle = 'monthly' | 'annual'

interface CheckoutResponse {
    success: boolean
    url?: string
    error?: string
}

export class CheckoutError extends Error {
    constructor(
        message: string,
        public readonly code: 'VALIDATION' | 'AUTH' | 'NETWORK' | 'UNKNOWN'
    ) {
        super(message)
        this.name = 'CheckoutError'
    }
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Admin API base URL
 * In production, this should point to your admin panel domain
 */
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000'

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Start Stripe Checkout flow
 *
 * @param planKey - Plan to purchase ('essencial' or 'patrio_pro')
 * @param cycle - Billing cycle ('monthly' or 'annual')
 * @throws CheckoutError on failure
 *
 * @example
 * ```tsx
 * try {
 *   await startCheckout('essencial', 'monthly')
 *   // User is redirected to Stripe Checkout
 * } catch (error) {
 *   if (error instanceof CheckoutError) {
 *     if (error.code === 'AUTH') {
 *       // Redirect to login
 *     } else {
 *       // Show error message
 *     }
 *   }
 * }
 * ```
 */
export async function startCheckout(
    planKey: PaidPlanId,
    cycle: BillingCycle,
    token?: string
): Promise<void> {
    // Validate inputs (optional client-side check)
    if (!['essencial', 'patrio_pro'].includes(planKey)) {
        throw new CheckoutError('Invalid plan', 'VALIDATION')
    }

    if (!['monthly', 'annual'].includes(cycle)) {
        throw new CheckoutError('Invalid billing cycle', 'VALIDATION')
    }

    try {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${ADMIN_API_URL}/api/stripe/create-checkout-session`, {
            method: 'POST',
            headers,
            credentials: 'include', // Send cookies for auth (fallback)
            body: JSON.stringify({ planKey, cycle }),
        })

        // Handle HTTP errors
        if (!response.ok) {
            if (response.status === 401) {
                throw new CheckoutError('Authentication required', 'AUTH')
            }

            // Try to get error message from response
            try {
                const data: CheckoutResponse = await response.json()
                throw new CheckoutError(
                    data.error || 'Checkout failed',
                    'UNKNOWN'
                )
            } catch {
                throw new CheckoutError(
                    `Request failed with status ${response.status}`,
                    'UNKNOWN'
                )
            }
        }

        // Parse response
        const data: CheckoutResponse = await response.json()

        if (!data.success || !data.url) {
            throw new CheckoutError(
                data.error || 'Failed to create checkout session',
                'UNKNOWN'
            )
        }

        // Redirect to Stripe Checkout
        // AIDEV-NOTE: Using window.location.href ensures full page redirect
        // which is required for Stripe Checkout
        window.location.href = data.url
    } catch (error) {
        // Re-throw CheckoutError as-is
        if (error instanceof CheckoutError) {
            throw error
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new CheckoutError('Network error. Please try again.', 'NETWORK')
        }

        // Unknown error - log generic message (no PII)
        console.error('[Checkout] Failed to start checkout')
        throw new CheckoutError('An unexpected error occurred', 'UNKNOWN')
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if a plan ID is a paid plan
 */
export function isPaidPlan(planId: PlanId): planId is PaidPlanId {
    return planId === 'essencial' || planId === 'patrio_pro'
}

/**
 * Get checkout URL parameters from current location
 * Used for handling success/cancel redirects
 */
export function getCheckoutResult(): {
    success: boolean
    canceled: boolean
    sessionId: string | null
} {
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash

    // Handle hash-based routing
    const hashParams = hash.includes('?')
        ? new URLSearchParams(hash.split('?')[1])
        : null

    const searchParams = hashParams || params

    return {
        success: searchParams.get('success') === 'true',
        canceled: searchParams.get('canceled') === 'true',
        sessionId: searchParams.get('session_id'),
    }
}
