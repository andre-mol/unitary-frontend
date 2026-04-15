export type TimelineMode = 'realized' | 'projected' | 'both';

export interface TimelineFlags {
    has_snapshot: boolean;
    is_projected: boolean;
    no_data: boolean;
}

export interface TimelineBucket {
    month: number;

    // Wealth
    patrimony_start: number;
    patrimony_end: number;

    // Realized Flows
    cashflow_income_realized: number;
    cashflow_expense_realized: number;
    contributions_realized: number;
    withdrawals_realized: number;

    // Projected Flows
    income_projected: number;
    expense_projected: number;
    contributions_projected: number;
    withdrawals_projected: number;

    // Calculations
    patrimony_valuation: number;
    economic_result_realized: number;
    residual_diff: number;

    // Metadata
    flags: TimelineFlags;
}

export interface TimelineResponse {
    data: TimelineBucket[];
    params: {
        year: number;
        portfolioId: string | null;
        mode: TimelineMode;
    };
}

export type TimelineEventStatus = 'realized' | 'projected';

export interface TimelineEventMetadata {
    source?: string;
    item_name?: string;
    category?: string;
    asset_id?: string;
    asset_name?: string;
    event_status?: string;
    period?: string;
    period_start?: string;
    period_end?: string;
    payload?: Record<string, unknown>;
    canonical_nature?: string;
    bucket_target?: string;
    is_informational_only?: boolean;
    source_ref?: string;
    source_kind?: string;
    frequency?: string;
    objective_id?: string;
    effective_from?: string;
    installment_current?: number;
    installment_total?: number;
    observation?: string;
    auto_generated?: boolean;
    approved_on?: string;
    payment_date?: string;
    rate?: number;
    quantity_held?: number;
    [key: string]: unknown;
}

export interface TimelineEventRpcRow {
    id: string;
    date: string;
    type: string;
    title: string;
    amount: number;
    status: TimelineEventStatus;
    portfolio_id: string | null;
    metadata: TimelineEventMetadata | null;
}

export interface TimelineEvent {
    id: string;
    portfolioId: string | null;
    portfolioName: string;
    assetName: string;
    assetCategory: string;
    date: string;
    createdAt: string;
    type: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    title: string;
    observation: string;
    status: TimelineEventStatus;
    isProjected: boolean;
    metadata: TimelineEventMetadata;
}
