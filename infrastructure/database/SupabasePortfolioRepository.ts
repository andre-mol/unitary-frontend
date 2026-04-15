/**
 * ============================================================
 * SUPABASE PORTFOLIO REPOSITORY - IMPLEMENTATION
 * ============================================================
 * 
 * Full implementation of PortfolioRepository using Supabase.
 * 
 * FEATURES:
 * - Portfolio CRUD operations
 * - Dashboard config with upsert
 * - Categories with unique constraint handling
 * - Event archival on portfolio deletion
 * 
 * MAPPING:
 * - Database uses snake_case (e.g., user_id, month_var)
 * - App uses camelCase (e.g., userId, monthVar)
 * - Mappers: toDbPortfolio() and fromDbPortfolio()
 * 
 * AIDEV-NOTE: Security boundary. All operations rely on RLS policies to enforce
 * user isolation. Never bypass RLS or use service_role key. All queries must use
 * authenticated client from getSupabaseClient() which enforces user_id = auth.uid().
 * 
 * ============================================================
 */

import type { PortfolioRepository, CreatePortfolioDTO, CreateHistoryEventDTO } from '../../domain/repositories/PortfolioRepository';
import type {
    Portfolio,
    CustomItem,
    DashboardConfig,
    PortfolioEvent,
    PortfolioObjective,
    PortfolioTimeHorizon,
    Transaction,
    ValuationMethod,
    ValuationHistory,
    ItemMetadata
} from '../../types';
import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import {
    handleSupabaseError,
    normalizeSupabaseError,
    SUPABASE_ERROR_CODES,
    SupabaseError
} from '../../utils/supabaseErrors';

// Event name for cross-component updates
export const PORTFOLIO_UPDATE_EVENT = 'supabase-portfolio-update';

// ============================================================
// DATABASE ROW TYPES (snake_case)
// ============================================================

interface DbPortfolio {
    id: string;
    user_id: string;
    name: string;
    type: string;
    value: number;
    month_var: number;
    year_var: number;
    currency: string;
    region: string | null;
    focus: string | null;
    location: string | null;
    structure: string | null;
    description: string | null;
    custom_class: string | null;
    objective: string | null;
    time_horizon: string | null;
    user_conviction_score: number | null;
    criteria: string[] | null;
    category_targets: Record<string, number> | null;
    last_accessed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface DbDashboardConfig {
    id: string;
    portfolio_id: string;
    widgets: DashboardConfig['widgets'];
    created_at: string;
    updated_at: string;
}

interface DbCategory {
    id: string;
    user_id: string;
    name: string;
    color: string | null;
    icon: string | null;
    created_at: string;
    updated_at: string;
}

interface DbItem {
    id: string;
    portfolio_id: string;
    name: string;
    category: string;
    description: string | null;
    currency: string;
    initial_value: number;
    initial_date: string | null;
    value: number;
    quantity: number | null;
    valuation_method: ValuationMethod | null;
    history: ValuationHistory[] | null;
    metadata: ItemMetadata | null;
    custom_fields: Record<string, any> | null;
    tags: string[] | null;
    criteria_answers: boolean[] | null;
    market_asset_id: string | null; // AIDEV-FIX: Vinculação com market_quotes
    created_at: string;
    updated_at: string;
}

interface DbTransaction {
    id: string;
    item_id: string;
    type: string;
    date: string;
    quantity: number | null;
    unit_price: number | null;
    total_value: number;
    observation: string | null;
    valuation_method: ValuationMethod | null;
    created_at: string;
}

interface DbEvent {
    id: string;
    user_id: string;
    portfolio_id: string | null;
    portfolio_name: string | null;
    asset_id: string | null;
    asset_name: string;
    asset_category: string | null;
    date: string;
    type: string;
    event_status: string | null;
    quantity: number | null;
    unit_price: number | null;
    total_value: number;
    observation: string | null;
    period: string | null;
    period_start: string | null;
    period_end: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
}

// ============================================================
// MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert app Portfolio (camelCase) to database row (snake_case)
 */
function toDbPortfolio(portfolio: Partial<Portfolio>, userId?: string): Partial<DbPortfolio> {
    const db: Partial<DbPortfolio> = {};

    if (portfolio.id !== undefined) db.id = portfolio.id;
    if (userId !== undefined) db.user_id = userId;
    if (portfolio.name !== undefined) db.name = portfolio.name;
    if (portfolio.type !== undefined) db.type = portfolio.type;
    if (portfolio.value !== undefined) db.value = portfolio.value;
    if (portfolio.monthVar !== undefined) db.month_var = portfolio.monthVar;
    if (portfolio.yearVar !== undefined) db.year_var = portfolio.yearVar;
    if (portfolio.currency !== undefined) db.currency = portfolio.currency;
    if (portfolio.region !== undefined) db.region = portfolio.region ?? null;
    if (portfolio.focus !== undefined) db.focus = portfolio.focus ?? null;
    if (portfolio.location !== undefined) db.location = portfolio.location ?? null;
    if (portfolio.structure !== undefined) db.structure = portfolio.structure ?? null;
    if (portfolio.description !== undefined) db.description = portfolio.description ?? null;
    if (portfolio.customClass !== undefined) db.custom_class = portfolio.customClass ?? null;
    if (portfolio.objective !== undefined) db.objective = portfolio.objective ?? null;
    if (portfolio.timeHorizon !== undefined) db.time_horizon = portfolio.timeHorizon ?? null;
    if (portfolio.userConvictionScore !== undefined) db.user_conviction_score = portfolio.userConvictionScore ?? null;
    if (portfolio.criteria !== undefined) db.criteria = portfolio.criteria ?? null;
    if (portfolio.categoryTargets !== undefined) db.category_targets = portfolio.categoryTargets ?? null;
    if (portfolio.lastAccessedAt !== undefined) db.last_accessed_at = portfolio.lastAccessedAt ?? null;

    return db;
}

/**
 * Convert database row (snake_case) to app Portfolio (camelCase)
 */
function fromDbPortfolio(row: DbPortfolio): Portfolio {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        value: Number(row.value) || 0,
        monthVar: Number(row.month_var) || 0,
        yearVar: Number(row.year_var) || 0,
        currency: row.currency || 'BRL',
        region: row.region ?? undefined,
        focus: row.focus ?? undefined,
        location: row.location ?? undefined,
        structure: row.structure ?? undefined,
        description: row.description ?? undefined,
        customClass: row.custom_class ?? undefined,
        objective: (row.objective as PortfolioObjective) || 'mixed',
        timeHorizon: (row.time_horizon as PortfolioTimeHorizon) || 'medium',
        userConvictionScore: row.user_conviction_score ?? undefined,
        criteria: row.criteria ?? undefined,
        categoryTargets: row.category_targets ?? undefined,
        lastAccessedAt: row.last_accessed_at ?? undefined,
        createdAt: row.created_at,
    };
}

// ============================================================
// ITEM MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert app CustomItem (camelCase) to database row (snake_case)
 */
function toDbItem(item: CustomItem, portfolioId: string): Omit<DbItem, 'created_at' | 'updated_at'> {
    return {
        id: item.id,
        portfolio_id: portfolioId,
        name: item.name,
        category: item.category,
        description: item.description ?? null,
        currency: item.currency || 'BRL',
        initial_value: item.initialValue || 0,
        initial_date: item.initialDate || null,
        value: item.value || 0,
        quantity: item.quantity ?? null,
        valuation_method: item.valuationMethod || { type: 'manual' },
        history: item.history || [],
        metadata: item.metadata || {},
        custom_fields: item.customFields || {},
        tags: item.tags ?? null,
        criteria_answers: item.criteriaAnswers ?? null,
        market_asset_id: item.market_asset_id ?? null, // AIDEV-FIX: Vincular com market_quotes
    };
}

/**
 * Convert database row (snake_case) to app CustomItem (camelCase)
 * Note: transactions are added separately after fetching
 */
function fromDbItem(row: DbItem): Omit<CustomItem, 'transactions'> {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description ?? undefined,
        currency: row.currency || 'BRL',
        initialValue: Number(row.initial_value) || 0,
        initialDate: row.initial_date || new Date().toISOString().split('T')[0],
        value: Number(row.value) || 0,
        updatedAt: row.updated_at,
        quantity: row.quantity !== null ? Number(row.quantity) : undefined,
        valuationMethod: row.valuation_method || { type: 'manual' },
        history: row.history || [],
        metadata: row.metadata || {},
        customFields: row.custom_fields || {},
        tags: row.tags ?? undefined,
        criteriaAnswers: row.criteria_answers ?? undefined,
        market_asset_id: row.market_asset_id ?? undefined, // AIDEV-FIX: Ler vinculação com market_quotes
    };
}

// ============================================================
// TRANSACTION MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert app Transaction (camelCase) to database row (snake_case)
 */
function toDbTransaction(transaction: Transaction, itemId: string): Omit<DbTransaction, 'created_at'> {
    return {
        id: transaction.id,
        item_id: itemId,
        type: transaction.type,
        date: transaction.date,
        quantity: transaction.quantity ?? null,
        unit_price: transaction.unitPrice ?? null,
        total_value: transaction.totalValue || 0,
        observation: transaction.observation ?? null,
        valuation_method: transaction.valuationMethod ?? null,
    };
}

/**
 * Convert database row (snake_case) to app Transaction (camelCase)
 */
function fromDbTransaction(row: DbTransaction): Transaction {
    return {
        id: row.id,
        type: row.type as Transaction['type'],
        date: row.date,
        quantity: Number(row.quantity) || 0,
        unitPrice: Number(row.unit_price) || 0,
        totalValue: Number(row.total_value) || 0,
        observation: row.observation ?? undefined,
        createdAt: row.created_at,
        valuationMethod: row.valuation_method ?? undefined,
    };
}

// ============================================================
// EVENT MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert app PortfolioEvent (camelCase) to database row (snake_case)
 */
function toDbEvent(
    event: Omit<PortfolioEvent, 'id' | 'createdAt'> & { id?: string },
    userId: string,
    portfolioId: string | null,
    portfolioName: string | null
): Omit<DbEvent, 'created_at'> {
    return {
        id: event.id || crypto.randomUUID(),
        user_id: userId,
        portfolio_id: portfolioId,
        portfolio_name: portfolioName,
        asset_id: event.assetId ?? null,
        asset_name: event.assetName,
        asset_category: event.assetCategory ?? null,
        date: event.date,
        type: event.type,
        event_status: event.eventStatus ?? null,
        quantity: event.quantity ?? null,
        unit_price: event.unitPrice ?? null,
        total_value: event.totalValue || 0,
        observation: event.observation ?? null,
        period: event.period ?? null,
        period_start: event.periodStart ?? null,
        period_end: event.periodEnd ?? null,
        payload: event.payload ?? null,
    };
}

/**
 * Convert database row (snake_case) to app PortfolioEvent (camelCase)
 */
function fromDbEvent(row: DbEvent): PortfolioEvent {
    return {
        id: row.id,
        portfolioId: row.portfolio_id || '',
        portfolioName: row.portfolio_name ?? undefined,
        assetId: row.asset_id ?? undefined,
        assetName: row.asset_name,
        assetCategory: row.asset_category ?? undefined,
        date: row.date,
        createdAt: row.created_at,
        type: row.type as PortfolioEvent['type'],
        eventStatus: row.event_status as PortfolioEvent['eventStatus'],
        quantity: row.quantity !== null ? Number(row.quantity) : undefined,
        unitPrice: row.unit_price !== null ? Number(row.unit_price) : undefined,
        totalValue: Number(row.total_value) || 0,
        observation: row.observation ?? undefined,
        period: row.period ?? undefined,
        periodStart: row.period_start ?? undefined,
        periodEnd: row.period_end ?? undefined,
        payload: row.payload ?? undefined,
    };
}

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * Handle Supabase errors with proper normalization and logging
 * Uses centralized error handling from utils/supabaseErrors
 */
function handleError(context: string, error: unknown): never {
    const fullContext = `[SupabasePortfolioRepository] ${context}`;
    handleSupabaseError(fullContext, error);
}

/**
 * Check if error is a "not found" error that should be handled gracefully
 */
function isNotFoundError(error: unknown): boolean {
    if (error instanceof SupabaseError) {
        return error.code === SUPABASE_ERROR_CODES.NOT_FOUND;
    }
    const errorObj = error as any;
    return errorObj?.code === 'PGRST116';
}

// ============================================================
// REPOSITORY IMPLEMENTATION
// ============================================================

export class SupabasePortfolioRepository implements PortfolioRepository {

    private get supabase() {
        return getSupabaseClient();
    }

    private async requestUserRecalculation(reason: string): Promise<void> {
        try {
            const { error } = await this.supabase.rpc('request_user_recalculation', {
                p_reason: reason,
                p_run_now: true
            });

            if (error) {
                console.warn('[SupabasePortfolioRepository] request_user_recalculation failed:', {
                    reason,
                    code: error.code,
                    message: error.message
                });
            }
        } catch (error) {
            console.warn('[SupabasePortfolioRepository] request_user_recalculation threw:', error);
        }
    }

    // =============================================
    // PORTFOLIO CRUD
    // =============================================

    async getAll(): Promise<Portfolio[]> {
        try {
            const userId = await getRequiredUserId(); // Validates user is authenticated

            const { data, error } = await this.supabase
                .from('portfolios')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                handleError('Erro ao buscar portfolios', error);
            }

            const portfolios = (data || []).map(fromDbPortfolio);

            // Defensive cleanup: if user has no portfolios, remove residual data
            // that can still feed timeline/profitability as ghost values.
            if (portfolios.length === 0) {
                await this.cleanupResidualStateIfNoPortfolios(userId);
            }

            return portfolios;
        } catch (error) {
            handleError('getAll falhou', error);
        }
    }

    async getById(id: string): Promise<Portfolio | undefined> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('portfolios')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                // PGRST116 = row not found, which is not an error for getById
                if (error.code === 'PGRST116') {
                    return undefined;
                }
                handleError(`Erro ao buscar portfolio ${id}`, error);
            }

            return data ? fromDbPortfolio(data) : undefined;
        } catch (error) {
            // If it's our own error about not found, return undefined
            if (error instanceof Error && error.message.includes('PGRST116')) {
                return undefined;
            }
            handleError('getById falhou', error);
        }
    }

    async create(data: CreatePortfolioDTO): Promise<Portfolio> {
        try {
            const userId = await getRequiredUserId();

            const dbData = toDbPortfolio({
                ...data,
                value: 0,
                monthVar: 0,
                yearVar: 0,
            }, userId);

            const { data: created, error } = await this.supabase
                .from('portfolios')
                .insert(dbData)
                .select()
                .single();

            if (error) {
                // Check for portfolio limit error specifically
                const errorObj = error as any;
                if (errorObj?.code === '23514' &&
                    (errorObj?.message?.includes('PATRIO_PORTFOLIO_LIMIT') ||
                        errorObj?.details?.includes('Limite do plano'))) {
                    // Use detail message if available, otherwise use default
                    const detailMessage = errorObj?.details || errorObj?.detail ||
                        'Limite de portfólios atingido para o seu plano. Faça upgrade para criar mais portfólios.';
                    throw new SupabaseError(
                        detailMessage,
                        SUPABASE_ERROR_CODES.PORTFOLIO_LIMIT_REACHED,
                        error,
                        'create portfolio'
                    );
                }
                handleError('Erro ao criar portfolio', error);
            }

            if (!created) {
                throw new Error('Portfolio criado mas não retornado');
            }

            const portfolio = fromDbPortfolio(created);

            // Log lifecycle event
            await this.logLifecycleEvent('portfolio_create', portfolio);

            this.dispatchUpdateEvent();
            return portfolio;
        } catch (error) {
            // Re-throw SupabaseError as-is (already normalized)
            if (error instanceof SupabaseError) {
                throw error;
            }
            handleError('create falhou', error);
        }
    }

    async update(id: string, updates: Partial<Portfolio>): Promise<Portfolio | null> {
        try {
            await getRequiredUserId();

            // Remove fields that shouldn't be updated directly
            const { id: _id, createdAt: _createdAt, ...updateData } = updates;

            const dbData = toDbPortfolio(updateData);

            const { data, error } = await this.supabase
                .from('portfolios')
                .update(dbData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                handleError(`Erro ao atualizar portfolio ${id}`, error);
            }

            this.dispatchUpdateEvent();
            return data ? fromDbPortfolio(data) : null;
        } catch (error) {
            handleError('update falhou', error);
        }
    }

    async updateLastAccessed(id: string): Promise<void> {
        try {
            await getRequiredUserId();

            const { error } = await this.supabase
                .from('portfolios')
                .update({ last_accessed_at: new Date().toISOString() })
                .eq('id', id);

            if (error) {
                handleError(`Erro ao atualizar last_accessed_at para ${id}`, error);
            }
        } catch (error) {
            handleError('updateLastAccessed falhou', error);
        }
    }

    private async cleanupLinkedRowsForItems(userId: string, itemIds: string[], portfolioId?: string): Promise<void> {
        if (itemIds.length === 0) {
            return;
        }

        let eventsDeleteQuery = this.supabase
            .from('portfolio_events')
            .delete()
            .eq('user_id', userId)
            .in('asset_id', itemIds);

        if (portfolioId) {
            eventsDeleteQuery = eventsDeleteQuery.eq('portfolio_id', portfolioId);
        }

        const { error: eventsError } = await eventsDeleteQuery;

        if (eventsError) {
            console.error('[SupabasePortfolioRepository] Erro ao limpar eventos vinculados aos itens removidos:', eventsError);
        }

        const { error: incomeError } = await this.supabase
            .from('planning_income')
            .delete()
            .eq('user_id', userId)
            .in('source_ref', itemIds);

        if (incomeError) {
            console.error('[SupabasePortfolioRepository] Erro ao limpar receitas planejadas vinculadas aos itens removidos:', incomeError);
        }

        const { error: expensesError } = await this.supabase
            .from('planning_expenses')
            .delete()
            .eq('user_id', userId)
            .in('source_ref', itemIds);

        if (expensesError) {
            console.error('[SupabasePortfolioRepository] Erro ao limpar despesas planejadas vinculadas aos itens removidos:', expensesError);
        }
    }

    private async cleanupOrphanPlanningRows(userId: string): Promise<void> {
        const [{ data: incomeRows, error: incomeFetchError }, { data: expenseRows, error: expenseFetchError }] = await Promise.all([
            this.supabase
                .from('planning_income')
                .select('id, source, source_ref')
                .eq('user_id', userId)
                .eq('source', 'real_estate'),
            this.supabase
                .from('planning_expenses')
                .select('id, source, source_ref')
                .eq('user_id', userId)
                .eq('source', 'real_estate')
        ]);

        if (incomeFetchError) {
            console.error('[SupabasePortfolioRepository] Erro ao buscar receitas planejadas para limpeza de órfãos:', incomeFetchError);
            return;
        }

        if (expenseFetchError) {
            console.error('[SupabasePortfolioRepository] Erro ao buscar despesas planejadas para limpeza de órfãos:', expenseFetchError);
            return;
        }

        const incomeRefs = (incomeRows || [])
            .map((row: { source_ref: string | null }) => row.source_ref)
            .filter((sourceRef): sourceRef is string => typeof sourceRef === 'string' && sourceRef.length > 0);
        const expenseRefs = (expenseRows || [])
            .map((row: { source_ref: string | null }) => row.source_ref)
            .filter((sourceRef): sourceRef is string => typeof sourceRef === 'string' && sourceRef.length > 0);

        const allRefs = [...new Set([...incomeRefs, ...expenseRefs])];
        let validItemIds = new Set<string>();

        if (allRefs.length > 0) {
            const { data: existingItems, error: itemFetchError } = await this.supabase
                .from('portfolio_items')
                .select('id')
                .in('id', allRefs);

            if (itemFetchError) {
                console.error('[SupabasePortfolioRepository] Erro ao verificar itens ativos para limpeza de órfãos:', itemFetchError);
                return;
            }

            validItemIds = new Set((existingItems || []).map((row: { id: string }) => row.id));
        }

        const orphanIncomeIds = (incomeRows || [])
            .filter((row: { id: string; source_ref: string | null }) => !row.source_ref || !validItemIds.has(row.source_ref))
            .map((row: { id: string }) => row.id);
        const orphanExpenseIds = (expenseRows || [])
            .filter((row: { id: string; source_ref: string | null }) => !row.source_ref || !validItemIds.has(row.source_ref))
            .map((row: { id: string }) => row.id);

        if (orphanIncomeIds.length > 0) {
            const { error: deleteIncomeError } = await this.supabase
                .from('planning_income')
                .delete()
                .eq('user_id', userId)
                .in('id', orphanIncomeIds);

            if (deleteIncomeError) {
                console.error('[SupabasePortfolioRepository] Erro ao limpar receitas planejadas órfãs:', deleteIncomeError);
            }
        }

        if (orphanExpenseIds.length > 0) {
            const { error: deleteExpenseError } = await this.supabase
                .from('planning_expenses')
                .delete()
                .eq('user_id', userId)
                .in('id', orphanExpenseIds);

            if (deleteExpenseError) {
                console.error('[SupabasePortfolioRepository] Erro ao limpar despesas planejadas órfãs:', deleteExpenseError);
            }
        }
    }

    private async cleanupResidualStateIfNoPortfolios(userId: string): Promise<void> {
        const { data: remainingPortfolios, error: remainingError } = await this.supabase
            .from('portfolios')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        if (remainingError) {
            console.error('[SupabasePortfolioRepository] Erro ao verificar portfolios remanescentes para limpeza residual:', remainingError);
            return;
        }

        if ((remainingPortfolios || []).length > 0) {
            return;
        }

        await this.cleanupOrphanPlanningRows(userId);

        const { error: deleteSnapshotItemsError } = await this.supabase
            .from('wealth_monthly_snapshot_items')
            .delete()
            .eq('user_id', userId);

        if (deleteSnapshotItemsError) {
            console.error('[SupabasePortfolioRepository] Erro ao limpar wealth_monthly_snapshot_items residuais:', deleteSnapshotItemsError);
        }

        const { error: deleteSnapshotsError } = await this.supabase
            .from('wealth_monthly_snapshots')
            .delete()
            .eq('user_id', userId);

        if (deleteSnapshotsError) {
            console.error('[SupabasePortfolioRepository] Erro ao limpar wealth_monthly_snapshots residuais:', deleteSnapshotsError);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // 1. Get portfolio info for archival
            const portfolio = await this.getById(id);
            if (!portfolio) {
                // Não logar ID por segurança
                console.warn('[SupabasePortfolioRepository] Portfolio não encontrado para deletar');
                return;
            }

            const { data: existingItems, error: itemsError } = await this.supabase
                .from('portfolio_items')
                .select('id, name')
                .eq('portfolio_id', id);

            if (itemsError) {
                console.error('[SupabasePortfolioRepository] Erro ao buscar itens do portfolio para limpeza:', itemsError);
            }

            const itemIds = (existingItems || []).map((item: { id: string }) => item.id);
            const itemNames = (existingItems || [])
                .map((item: { name: string | null }) => String(item.name || '').trim())
                .filter((name) => name.length > 0);

            // 2. Remove rows linked to the portfolio assets to avoid orphaned flows.
            await this.cleanupLinkedRowsForItems(userId, itemIds, id);
            await this.cleanupOrphanPlanningRows(userId);

            // 3. Remove all historical events explicitly linked to the portfolio.
            const { error: eventsError } = await this.supabase
                .from('portfolio_events')
                .delete()
                .eq('portfolio_id', id)
                .eq('user_id', userId);

            if (eventsError) {
                console.error('[SupabasePortfolioRepository] Erro ao remover eventos do portfolio excluido:', eventsError);
            }

            // 4. Defensive cleanup for legacy/orphan events that may already have portfolio_id = NULL.
            if (itemIds.length > 0) {
                const { error: orphanEventsByAssetError } = await this.supabase
                    .from('portfolio_events')
                    .delete()
                    .eq('user_id', userId)
                    .in('asset_id', itemIds);

                if (orphanEventsByAssetError) {
                    console.error('[SupabasePortfolioRepository] Erro ao remover eventos órfãos por asset_id:', orphanEventsByAssetError);
                }
            }

            if (itemNames.length > 0) {
                const { error: orphanEventsByNameError } = await this.supabase
                    .from('portfolio_events')
                    .delete()
                    .eq('user_id', userId)
                    .is('portfolio_id', null)
                    .in('asset_name', itemNames);

                if (orphanEventsByNameError) {
                    console.error('[SupabasePortfolioRepository] Erro ao remover eventos órfãos por asset_name:', orphanEventsByNameError);
                }
            }

            // Remove legacy lifecycle-delete ghosts only when there is no active portfolio
            // left with the same name.
            const { data: sameNamePortfolios, error: sameNameError } = await this.supabase
                .from('portfolios')
                .select('id')
                .eq('user_id', userId)
                .eq('name', portfolio.name)
                .neq('id', id)
                .limit(1);

            if (sameNameError) {
                console.error('[SupabasePortfolioRepository] Erro ao verificar portfolios com mesmo nome para limpeza de lifecycle:', sameNameError);
            } else if ((sameNamePortfolios || []).length === 0) {
                const { error: lifecycleDeleteError } = await this.supabase
                    .from('portfolio_events')
                    .delete()
                    .eq('user_id', userId)
                    .eq('type', 'portfolio_delete')
                    .is('portfolio_id', null)
                    .eq('asset_name', portfolio.name);

                if (lifecycleDeleteError) {
                    console.error('[SupabasePortfolioRepository] Erro ao remover eventos de portfolio_delete órfãos:', lifecycleDeleteError);
                }
            }

            // 5. Remove historical wealth/performance rows for this portfolio.
            const { error: snapshotItemsError } = await this.supabase
                .from('wealth_monthly_snapshot_items')
                .delete()
                .eq('user_id', userId)
                .eq('portfolio_id', id);

            if (snapshotItemsError) {
                console.error('[SupabasePortfolioRepository] Erro ao remover wealth_monthly_snapshot_items do portfolio excluído:', snapshotItemsError);
            }

            const { error: perfDailyError } = await this.supabase
                .from('portfolio_performance_daily')
                .delete()
                .eq('portfolio_id', id);

            if (perfDailyError && perfDailyError.code !== '42P01') {
                console.error('[SupabasePortfolioRepository] Erro ao remover portfolio_performance_daily do portfolio excluído:', perfDailyError);
            }

            const { error: dailySnapshotsError } = await this.supabase
                .from('portfolio_daily_snapshots')
                .delete()
                .eq('portfolio_id', id);

            if (dailySnapshotsError && dailySnapshotsError.code !== '42P01') {
                console.error('[SupabasePortfolioRepository] Erro ao remover portfolio_daily_snapshots do portfolio excluído:', dailySnapshotsError);
            }

            // 6. Delete portfolio (items cascade automatically)
            const { error } = await this.supabase
                .from('portfolios')
                .delete()
                .eq('id', id);

            if (error) {
                handleError(`Erro ao deletar portfolio ${id}`, error);
            }

            await this.cleanupResidualStateIfNoPortfolios(userId);
            this.dispatchUpdateEvent();
            await this.requestUserRecalculation('portfolio_delete');
        } catch (error) {
            handleError('delete falhou', error);
        }
    }

    // =============================================
    // CUSTOM ITEMS (ASSETS)
    // =============================================

    async getItems(portfolioId: string): Promise<CustomItem[]> {
        try {
            await getRequiredUserId();

            // 1. Validate portfolio exists and user has access (RLS will filter)
            const { data: portfolioCheck, error: portfolioError } = await this.supabase
                .from('portfolios')
                .select('id')
                .eq('id', portfolioId)
                .single();

            if (portfolioError) {
                if (portfolioError.code === 'PGRST116') {
                    handleError(`Portfolio ${portfolioId} não encontrado ou sem permissão`, portfolioError);
                }
                handleError(`Erro ao verificar portfolio ${portfolioId}`, portfolioError);
            }

            if (!portfolioCheck) {
                handleError(`Portfolio ${portfolioId} não encontrado`, new Error('Portfolio not found'));
            }

            // 2. Fetch all items for this portfolio
            const { data: itemsData, error: itemsError } = await this.supabase
                .from('portfolio_items')
                .select('*')
                .eq('portfolio_id', portfolioId)
                .order('name');

            if (itemsError) {
                handleError(`Erro ao buscar items do portfolio ${portfolioId}`, itemsError);
            }

            if (!itemsData || itemsData.length === 0) {
                return [];
            }

            // 3. Get all item IDs
            const itemIds = itemsData.map((item: DbItem) => item.id);

            // 4. Fetch all transactions for these items in one query
            const { data: transactionsData, error: transactionsError } = await this.supabase
                .from('item_transactions')
                .select('*')
                .in('item_id', itemIds)
                .order('date', { ascending: false });

            if (transactionsError) {
                console.error('[SupabasePortfolioRepository] Erro ao buscar transactions:', transactionsError);
                // Continue without transactions rather than failing completely
            }

            // 5. Group transactions by item_id
            const transactionsByItemId: Record<string, Transaction[]> = {};
            if (transactionsData) {
                for (const dbTx of transactionsData as DbTransaction[]) {
                    if (!transactionsByItemId[dbTx.item_id]) {
                        transactionsByItemId[dbTx.item_id] = [];
                    }
                    transactionsByItemId[dbTx.item_id].push(fromDbTransaction(dbTx));
                }
            }

            // 6. Build CustomItem[] with embedded transactions
            const items: CustomItem[] = itemsData.map((dbItem: DbItem) => {
                const baseItem = fromDbItem(dbItem);
                return {
                    ...baseItem,
                    transactions: transactionsByItemId[dbItem.id] || [],
                };
            });

            return items;
        } catch (error) {
            handleError('getItems falhou', error);
        }
    }

    /**
     * AIDEV-NOTE: Bulk fetch all items for all user portfolios (dashboard optimization)
     * Reduces N+1 queries to just 2 queries (all items + all transactions)
     */
    async getAllItems(): Promise<CustomItem[]> {
        try {
            await getRequiredUserId();

            // 1. Fetch ALL items for the current user (RLS filters by user_id via portfolios)
            const { data: itemsData, error: itemsError } = await this.supabase
                .from('portfolio_items')
                .select('*')
                .order('name');

            if (itemsError) {
                handleError('Erro ao buscar todos os items', itemsError);
            }

            if (!itemsData || itemsData.length === 0) {
                return [];
            }

            // 2. Get all item IDs
            const itemIds = itemsData.map((item: DbItem) => item.id);

            // 3. Fetch all transactions for these items in one query
            const { data: transactionsData, error: transactionsError } = await this.supabase
                .from('item_transactions')
                .select('*')
                .in('item_id', itemIds)
                .order('date', { ascending: false });

            if (transactionsError) {
                console.error('[SupabasePortfolioRepository] Erro ao buscar transactions:', transactionsError);
            }

            // 4. Group transactions by item_id
            const transactionsByItemId: Record<string, Transaction[]> = {};
            if (transactionsData) {
                for (const dbTx of transactionsData as DbTransaction[]) {
                    if (!transactionsByItemId[dbTx.item_id]) {
                        transactionsByItemId[dbTx.item_id] = [];
                    }
                    transactionsByItemId[dbTx.item_id].push(fromDbTransaction(dbTx));
                }
            }

            // 5. Build CustomItem[] with embedded transactions + portfolio_id
            const items: CustomItem[] = itemsData.map((dbItem: DbItem) => {
                const baseItem = fromDbItem(dbItem);
                return {
                    ...baseItem,
                    transactions: transactionsByItemId[dbItem.id] || [],
                    // AIDEV-NOTE: Include portfolio_id for grouping in dashboard calculations
                    portfolio_id: dbItem.portfolio_id,
                } as CustomItem & { portfolio_id: string };
            });

            return items;
        } catch (error) {
            handleError('getAllItems falhou', error);
        }
    }

    async saveItems(portfolioId: string, items: CustomItem[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // 1. Validate portfolio exists and user has access
            const { data: portfolioCheck, error: portfolioError } = await this.supabase
                .from('portfolios')
                .select('id')
                .eq('id', portfolioId)
                .single();

            if (portfolioError) {
                if (portfolioError.code === 'PGRST116') {
                    handleError(`Portfolio ${portfolioId} não encontrado ou sem permissão`, portfolioError);
                }
                handleError(`Erro ao verificar portfolio ${portfolioId}`, portfolioError);
            }

            if (!portfolioCheck) {
                handleError(`Portfolio ${portfolioId} não encontrado`, new Error('Portfolio not found'));
            }

            // 2. Get existing item IDs to determine which were deleted
            const { data: existingItems, error: existingError } = await this.supabase
                .from('portfolio_items')
                .select('id')
                .eq('portfolio_id', portfolioId);

            if (existingError) {
                handleError(`Erro ao buscar items existentes do portfolio ${portfolioId}`, existingError);
            }

            const existingItemIds = new Set((existingItems || []).map((item: { id: string }) => item.id));
            const newItemIds = new Set(items.map(item => item.id));

            // 3. Delete items that are no longer in the list (CASCADE will delete transactions)
            const itemsToDelete = [...existingItemIds].filter(id => !newItemIds.has(id));
            if (itemsToDelete.length > 0) {
                await this.cleanupLinkedRowsForItems(userId, itemsToDelete, portfolioId);

                const { error: deleteError } = await this.supabase
                    .from('portfolio_items')
                    .delete()
                    .in('id', itemsToDelete);

                if (deleteError) {
                    console.error('[SupabasePortfolioRepository] Erro ao deletar items removidos:', deleteError);
                }
            }

            // 4. Upsert all items
            if (items.length > 0) {
                const dbItems = items.map(item => toDbItem(item, portfolioId));

                const { error: upsertError } = await this.supabase
                    .from('portfolio_items')
                    .upsert(dbItems, { onConflict: 'id' });

                if (upsertError) {
                    handleError(`Erro ao salvar items do portfolio ${portfolioId}`, upsertError);
                }
            }

            // 5. Handle transactions for each item.
            for (const item of items) {
                // 5a. Read existing transactions without deleting them
                const { data: existingTxRows, error: deleteTxError } = await this.supabase
                    .from('item_transactions')
                    .select('id')
                    .eq('item_id', item.id);

                if (deleteTxError) {
                    // Não logar item ID por segurança
                    console.error('[SupabasePortfolioRepository] Erro ao deletar transactions do item:', deleteTxError);
                    // Continue to try inserting new ones
                }

                // 5b. Upsert all transactions for this item (if any)
                if (item.transactions && item.transactions.length > 0) {
                    const existingTxIds = new Set((existingTxRows || []).map((row: { id: string }) => row.id));
                    const txNetQty = item.transactions.reduce((acc, t) => {
                        if (t.type === 'buy') return acc + Number(t.quantity || 0);
                        if (t.type === 'sell') return acc - Number(t.quantity || 0);
                        return acc;
                    }, 0);
                    const baseQty = Math.max(0, Number(item.quantity || 0) - txNetQty);
                    const initialValue = Number(item.initialValue || 0);
                    const initialDate = String(item.initialDate || '').split('T')[0];
                    const approxEqual = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

                    const sanitizedTransactions = item.transactions.filter((tx) => {
                        if (tx.type !== 'buy') return true;

                        const txDate = String(tx.date || '').split('T')[0];
                        const txQty = Number(tx.quantity || 0);
                        const txTotal = Number(tx.totalValue || 0);

                        const duplicatesBaseLotExactly =
                            baseQty > 0 &&
                            initialValue > 0 &&
                            !!initialDate &&
                            txDate === initialDate &&
                            approxEqual(txQty, baseQty, 1e-8) &&
                            approxEqual(txTotal, initialValue, 0.01);

                        if (duplicatesBaseLotExactly) {
                            console.warn('[SupabasePortfolioRepository] Bloqueando buy duplicado do lote inicial para evitar custo duplicado.', {
                                itemName: item.name,
                                itemId: item.id,
                                txId: tx.id
                            });
                            return false;
                        }

                        return true;
                    });

                    const dbTransactions = sanitizedTransactions
                        .filter((tx) => !existingTxIds.has(tx.id))
                        .map(tx => toDbTransaction(tx, item.id));

                    if (dbTransactions.length === 0) {
                        continue;
                    }

                    const { error: insertTxError } = await this.supabase
                        .from('item_transactions')
                        .insert(dbTransactions);

                    if (insertTxError) {
                        // Do not abort whole item save when transaction insert is blocked by RLS.
                        // Item persistence and portfolio total update must still succeed.
                        const err = insertTxError as { code?: string; message?: string; details?: string; hint?: string };
                        console.error('[SupabasePortfolioRepository] Erro ao salvar transacoes (nao fatal).', {
                            itemName: item.name,
                            code: err?.code,
                            message: err?.message,
                            details: err?.details,
                            hint: err?.hint,
                            attemptedRows: dbTransactions.length
                        });
                        continue;
                    }
                }
            }

            this.dispatchUpdateEvent();
            await this.requestUserRecalculation('save_items');
        } catch (error) {
            handleError('saveItems falhou', error);
        }
    }

    // =============================================
    // DASHBOARD CONFIG
    // =============================================

    async getDashboardConfig(portfolioId: string): Promise<DashboardConfig> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('portfolio_dashboard_configs')
                .select('*')
                .eq('portfolio_id', portfolioId)
                .single();

            if (error) {
                // Not found is OK - return default
                if (error.code === 'PGRST116') {
                    return { widgets: [] };
                }
                handleError(`Erro ao buscar dashboard config para ${portfolioId}`, error);
            }

            return {
                widgets: data?.widgets || [],
            };
        } catch (error) {
            // If not found error propagated, return default
            if (error instanceof Error && error.message.includes('PGRST116')) {
                return { widgets: [] };
            }
            handleError('getDashboardConfig falhou', error);
        }
    }

    async saveDashboardConfig(portfolioId: string, config: DashboardConfig): Promise<void> {
        try {
            await getRequiredUserId();

            // Upsert: insert or update if exists
            const { error } = await this.supabase
                .from('portfolio_dashboard_configs')
                .upsert(
                    {
                        portfolio_id: portfolioId,
                        widgets: config.widgets
                    },
                    {
                        onConflict: 'portfolio_id'
                    }
                );

            if (error) {
                handleError(`Erro ao salvar dashboard config para ${portfolioId}`, error);
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveDashboardConfig falhou', error);
        }
    }

    // =============================================
    // CATEGORIES
    // =============================================

    async getCategories(): Promise<string[]> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('portfolio_categories')
                .select('name')
                .order('name');

            if (error) {
                handleError('Erro ao buscar categorias', error);
            }

            return (data || []).map((row: { name: string }) => row.name);
        } catch (error) {
            handleError('getCategories falhou', error);
        }
    }

    async addCategory(category: string): Promise<string[]> {
        try {
            const userId = await getRequiredUserId();

            const trimmedCategory = category.trim();
            if (!trimmedCategory) {
                console.warn('[SupabasePortfolioRepository] Tentativa de adicionar categoria vazia');
                return this.getCategories();
            }

            // Insert with ON CONFLICT DO NOTHING (unique constraint on user_id, name)
            const { error } = await this.supabase
                .from('portfolio_categories')
                .upsert(
                    {
                        user_id: userId,
                        name: trimmedCategory
                    },
                    {
                        onConflict: 'user_id,name',
                        ignoreDuplicates: true
                    }
                );

            if (error) {
                // Ignore unique constraint violation (23505)
                if (error.code !== '23505') {
                    handleError(`Erro ao adicionar categoria ${trimmedCategory}`, error);
                }
            }

            this.dispatchUpdateEvent();

            // Return updated list
            return this.getCategories();
        } catch (error) {
            handleError('addCategory falhou', error);
        }
    }

    // =============================================
    // HISTORY EVENTS
    // =============================================

    async addHistoryEvent(portfolioId: string, event: CreateHistoryEventDTO): Promise<PortfolioEvent> {
        try {
            const userId = await getRequiredUserId();

            // Get portfolio name for snapshot
            const portfolio = await this.getById(portfolioId);
            if (!portfolio) {
                handleError(`Portfolio ${portfolioId} não encontrado`, new Error('Portfolio not found'));
            }

            const dbEvent = toDbEvent(
                { ...event, id: undefined, portfolioId },
                userId,
                portfolioId,
                portfolio!.name
            );

            const { data, error } = await this.supabase
                .from('portfolio_events')
                .insert(dbEvent)
                .select()
                .single();

            if (error) {
                handleError('Erro ao adicionar evento', error);
            }

            if (!data) {
                throw new Error('Evento criado mas não retornado');
            }

            this.dispatchUpdateEvent();
            return fromDbEvent(data);
        } catch (error) {
            handleError('addHistoryEvent falhou', error);
        }
    }

    async getHistoryEvents(portfolioId: string): Promise<PortfolioEvent[]> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('portfolio_events')
                .select('*')
                .eq('portfolio_id', portfolioId)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                handleError(`Erro ao buscar eventos do portfolio ${portfolioId}`, error);
            }

            return (data || []).map(fromDbEvent);
        } catch (error) {
            handleError('getHistoryEvents falhou', error);
        }
    }

    /**
     * AIDEV-NOTE: Bulk fetch all history events for all user portfolios (dashboard optimization)
     * Reduces N+1 queries to just 1 query
     */
    async getAllHistoryEvents(): Promise<PortfolioEvent[]> {
        try {
            await getRequiredUserId();

            // Fetch all events for the current user (RLS filters by user_id)
            const { data, error } = await this.supabase
                .from('portfolio_events')
                .select('*')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                handleError('Erro ao buscar todos os eventos', error);
            }

            return (data || []).map(fromDbEvent);
        } catch (error) {
            handleError('getAllHistoryEvents falhou', error);
        }
    }

    async getHistoryArchive(): Promise<PortfolioEvent[]> {
        try {
            await getRequiredUserId();

            // Events where portfolio_id IS NULL and type is NOT lifecycle events
            const { data, error } = await this.supabase
                .from('portfolio_events')
                .select('*')
                .is('portfolio_id', null)
                .not('type', 'in', '(portfolio_create,portfolio_delete)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                handleError('Erro ao buscar arquivo de eventos', error);
            }

            return (data || []).map(fromDbEvent);
        } catch (error) {
            handleError('getHistoryArchive falhou', error);
        }
    }

    async getLifecycleEvents(): Promise<PortfolioEvent[]> {
        try {
            await getRequiredUserId();

            // Events where type IN (portfolio_create, portfolio_delete)
            const { data, error } = await this.supabase
                .from('portfolio_events')
                .select('*')
                .in('type', ['portfolio_create', 'portfolio_delete'])
                .order('created_at', { ascending: false });

            if (error) {
                handleError('Erro ao buscar eventos de ciclo de vida', error);
            }

            return (data || []).map(fromDbEvent);
        } catch (error) {
            handleError('getLifecycleEvents falhou', error);
        }
    }

    async archiveHistoryEvents(portfolioId: string, _events: PortfolioEvent[]): Promise<void> {
        // Note: _events parameter is ignored - we update all events for this portfolio
        // The events are fetched from DB directly for consistency
        try {
            const userId = await getRequiredUserId();

            // Get portfolio name for snapshot before archiving
            const portfolio = await this.getById(portfolioId);
            const portfolioName = portfolio?.name || 'Portfolio Removido';

            // Update events: set portfolio_id = null, portfolio_name = current name
            const { error } = await this.supabase
                .from('portfolio_events')
                .update({
                    portfolio_id: null,
                    portfolio_name: portfolioName
                })
                .eq('portfolio_id', portfolioId)
                .eq('user_id', userId);

            if (error) {
                handleError(`Erro ao arquivar eventos do portfolio ${portfolioId}`, error);
            }
        } catch (error) {
            handleError('archiveHistoryEvents falhou', error);
        }
    }

    async logLifecycleEvent(type: 'portfolio_create' | 'portfolio_delete', portfolio: Portfolio): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            const eventData: Omit<DbEvent, 'created_at' | 'id'> & { id?: string } = {
                user_id: userId,
                portfolio_id: type === 'portfolio_create' ? portfolio.id : null,
                portfolio_name: portfolio.name,
                asset_id: null,
                asset_name: portfolio.name, // Use portfolio name as asset_name
                asset_category: null,
                date: new Date().toISOString().split('T')[0],
                type: type,
                event_status: null,
                quantity: null,
                unit_price: null,
                total_value: portfolio.value || 0,
                observation: null,
                period: null,
                period_start: null,
                period_end: null,
                payload: null,
            };

            const { error } = await this.supabase
                .from('portfolio_events')
                .insert(eventData);

            if (error) {
                console.error(`[SupabasePortfolioRepository] Erro ao registrar evento ${type}:`, error);
                // Don't throw - lifecycle events are optional
            }
        } catch (error) {
            console.error('[SupabasePortfolioRepository] logLifecycleEvent falhou:', error);
            // Don't throw - lifecycle events are optional
        }
    }

    async saveHistoryEvents(portfolioId: string, events: PortfolioEvent[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // Get portfolio name for snapshot
            const portfolio = await this.getById(portfolioId);
            if (!portfolio) {
                handleError(`Portfolio ${portfolioId} não encontrado`, new Error('Portfolio not found'));
            }

            const { error: deleteError } = await this.supabase
                .from('portfolio_events')
                .delete()
                .eq('portfolio_id', portfolioId);

            if (deleteError) {
                handleError(`Erro ao limpar eventos do portfolio ${portfolioId}`, deleteError);
            }

            if (events.length === 0) {
                this.dispatchUpdateEvent();
                return;
            }

            // Convert events to DB format
            const dbEvents = events.map(event => ({
                id: event.id,
                user_id: userId,
                portfolio_id: portfolioId,
                portfolio_name: portfolio!.name,
                asset_id: event.assetId ?? null,
                asset_name: event.assetName,
                asset_category: event.assetCategory ?? null,
                date: event.date,
                type: event.type,
                event_status: event.eventStatus ?? null,
                quantity: event.quantity ?? null,
                unit_price: event.unitPrice ?? null,
                total_value: event.totalValue || 0,
                observation: event.observation ?? null,
                period: event.period ?? null,
                period_start: event.periodStart ?? null,
                period_end: event.periodEnd ?? null,
                payload: event.payload ?? null,
            }));

            // Insert fresh snapshot after cleanup
            const { error } = await this.supabase
                .from('portfolio_events')
                .insert(dbEvents);

            if (error) {
                handleError(`Erro ao salvar eventos do portfolio ${portfolioId}`, error);
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveHistoryEvents falhou', error);
        }
    }

    // =============================================
    // STORAGE MANAGEMENT
    // =============================================

    dispatchUpdateEvent(): void {
        window.dispatchEvent(new CustomEvent(PORTFOLIO_UPDATE_EVENT));
    }
}
