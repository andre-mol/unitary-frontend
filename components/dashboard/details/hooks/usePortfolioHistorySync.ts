import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { portfolioService } from '../../../../lib/portfolioService';
import { useAuth } from '../../../auth/AuthProvider';

export function usePortfolioHistorySync() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (!user) return;

        const syncHistory = async () => {
            // Optimization: check localStorage or cookie to avoid running this on every reload?
            // For now, let's rely on the RPC being efficient (idempotent calculations).
            // But we can limit it to run once per session using sessionStorage.

            const hasSynced = sessionStorage.getItem(`history_sync_${user.id}`);
            if (hasSynced) return;

            try {
                setIsSyncing(true);
                // Trigger backfill starting from 2020 (or dynamic?)
                // We can make this dynamic based on earliest asset later.
                const result = await portfolioService.backfillHistory(2020);

                if (result.processed_months > 0) {
                    console.log(`History Backfill: Processed ${result.processed_months} months.`);
                    // Invalidating evolution cache to force redraw of charts
                    await queryClient.invalidateQueries({ queryKey: ['evolution', user.id] });
                }

                sessionStorage.setItem(`history_sync_${user.id}`, 'true');
            } catch (err) {
                console.error('History Sync Failed:', err);
            } finally {
                setIsSyncing(false);
            }
        };

        syncHistory();
    }, [user?.id, queryClient]);

    return { isSyncing };
}
