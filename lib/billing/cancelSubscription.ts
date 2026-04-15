const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000'

export interface CancelFeedback {
    reasonCode: string
    reasonDetails?: Record<string, any>
    freeText?: string
    allowContact: boolean
}

export async function cancelSubscription(
    feedback: CancelFeedback,
    token?: string
): Promise<void> {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${ADMIN_API_URL}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(feedback),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to cancel subscription')
    }
}
