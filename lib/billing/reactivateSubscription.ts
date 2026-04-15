import { supabase } from '../supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function reactivateSubscription(token: string): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/api/billing/reactivate-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({}) // Empty body, auth is enough
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao reativar assinatura');
        }

        // Force refresh subscription by invalidating Supabase cache or letting SWR/Tanstack revalidate.
        // For now, we rely on the component to reload or refresh.

    } catch (error: any) {
        console.error('Error reactivating subscription:', error);
        throw new Error(error.message || 'Erro de conexão');
    }
}
