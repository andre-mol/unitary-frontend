import { supabase } from '../../lib/supabase';
import {
    TimelineBucket,
    TimelineEvent,
    TimelineEventMetadata,
    TimelineEventRpcRow,
    TimelineMode
} from '../../types/timeline';

function normalizeTimelineEvent(row: TimelineEventRpcRow): TimelineEvent {
    const metadata: TimelineEventMetadata = row.metadata ?? {};
    const itemName = typeof metadata.item_name === 'string' ? metadata.item_name : '';
    const category = typeof metadata.category === 'string' ? metadata.category : '';
    const portfolioName = itemName ? `${category || 'Sem categoria'} (${itemName})` : 'Geral';
    const metadataObservation = typeof metadata.observation === 'string' ? metadata.observation : '';

    return {
        id: row.id,
        portfolioId: row.portfolio_id,
        portfolioName,
        assetName: itemName || row.title,
        assetCategory: category || row.type,
        date: row.date,
        createdAt: row.date,
        type: row.type,
        quantity: 1,
        unitPrice: Number(row.amount || 0),
        totalValue: Number(row.amount || 0),
        title: row.title,
        observation: metadataObservation || row.title + (row.status === 'projected' ? ' (Previsto)' : ''),
        status: row.status,
        isProjected: row.status === 'projected',
        metadata
    };
}

export const timelineService = {
    /**
     * Fetches monthly timeline data from the backend RPC
     */
    async getTimeline(
        year: number,
        portfolioId: string | null = null,
        mode: TimelineMode = 'both'
    ): Promise<TimelineBucket[]> {
        if (!supabase) throw new Error('Supabase client not initialized');
        const { data, error } = await supabase.rpc('patrio_get_timeline_monthly', {
            p_year: year,
            p_portfolio_id: portfolioId,
            p_mode: mode
        });

        if (error) {
            console.error('Error fetching timeline:', error.message);
            throw new Error(error.message);
        }

        return data as TimelineBucket[];
    },

    /**
     * Fetches raw events for the timeline feed, filtered by year and portfolio
     */
    async getTimelineEvents(
        year: number,
        portfolioId: string | null = null,
        mode: TimelineMode = 'both'
    ): Promise<TimelineEvent[]> {
        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase.rpc('patrio_get_timeline_events', {
            p_year: year,
            p_portfolio_id: portfolioId,
            p_mode: mode
        });

        if (error) {
            console.error('Error fetching timeline events:', error.message);
            throw new Error(error.message);
        }

        return ((data || []) as TimelineEventRpcRow[]).map(normalizeTimelineEvent);
    }
};
