/**
 * ============================================================
 * SUPABASE PLANNING REPOSITORY - IMPLEMENTATION
 * ============================================================
 * 
 * Full implementation of PlanningRepository using Supabase.
 * 
 * FEATURES:
 * - Goals: delete all + insert (or upsert by user_id, category)
 * - Budget: upsert by (user_id, month)
 * - Objectives: upsert by id
 * - Expenses: delete all for month + insert
 * 
 * MAPPING:
 * - Database uses snake_case (e.g., user_id, total_value)
 * - App uses camelCase (e.g., userId, totalValue)
 * 
 * AIDEV-NOTE: Security boundary. All operations rely on RLS policies to enforce
 * user isolation. Never bypass RLS. All queries must use authenticated client
 * from getSupabaseClient() which enforces user_id = auth.uid().
 * 
 * ============================================================
 */

import type { PlanningRepository, Goal, Budget, Objective, Expense, Income } from '../../domain/repositories/PlanningRepository';
import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import { handleSupabaseError, SUPABASE_ERROR_CODES, SupabaseError } from '../../utils/supabaseErrors';

// Event name for cross-component updates
export const BUDGET_UPDATE_EVENT = 'supabase-budget-update';

// ============================================================
// DATABASE ROW TYPES (snake_case)
// ============================================================

interface DbGoal {
    id: string;
    user_id: string;
    category: string;
    percentage: number;
    color: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

interface DbBudget {
    id: string;
    user_id: string;
    month: string;
    salary: number;
    created_at: string;
    updated_at: string;
}

interface DbObjective {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    total_value: number;
    current_value: number;
    status: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface DbExpense {
    id: string;
    user_id: string;
    month: string;
    category: string;
    name: string;
    value: number;
    type: string;
    frequency: string | null;
    observation: string | null;
    installment_current: number | null;
    installment_total: number | null;
    objective_id: string | null;
    source: string;
    source_ref: string | null;
    effective_from: string | null;
    created_at: string;
    updated_at: string;
}

interface DbIncome {
    id: string;
    user_id: string;
    month: string;
    category: string;
    name: string;
    value: number;
    source: string;
    source_ref: string | null;
    effective_from: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================================
// MAPPERS: snake_case <-> camelCase
// ============================================================

/**
 * Convert app Goal to database row
 */
function toDbGoal(goal: Goal, userId: string, sortOrder: number): Omit<DbGoal, 'created_at' | 'updated_at'> {
    return {
        id: goal.id,
        user_id: userId,
        category: goal.category,
        percentage: goal.percentage,
        color: goal.color,
        sort_order: sortOrder,
    };
}

/**
 * Convert database row to app Goal
 */
function fromDbGoal(row: DbGoal): Goal {
    return {
        id: row.id,
        category: row.category,
        percentage: Number(row.percentage) || 0,
        color: row.color,
    };
}

/**
 * Convert app Budget to database row
 */
function toDbBudget(budget: Budget, userId: string): Omit<DbBudget, 'id' | 'created_at' | 'updated_at'> {
    return {
        user_id: userId,
        month: budget.month,
        salary: budget.salary,
    };
}

/**
 * Convert database row to app Budget
 */
function fromDbBudget(row: DbBudget): Budget {
    return {
        month: row.month,
        salary: Number(row.salary) || 0,
        updatedAt: row.updated_at,
    };
}

/**
 * Convert app Objective to database row
 */
function toDbObjective(objective: Objective, userId: string): Omit<DbObjective, 'created_at' | 'updated_at'> {
    return {
        id: objective.id,
        user_id: userId,
        name: objective.name,
        description: objective.description ?? null,
        total_value: objective.totalValue,
        current_value: objective.currentValue,
        status: objective.status,
        completed_at: objective.completedAt ?? null,
    };
}

/**
 * Convert database row to app Objective
 */
function fromDbObjective(row: DbObjective): Objective {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        totalValue: Number(row.total_value) || 0,
        currentValue: Number(row.current_value) || 0,
        status: row.status as Objective['status'],
        completedAt: row.completed_at ?? undefined,
        createdAt: row.created_at,
    };
}

/**
 * Convert app Expense to database row
 */
function toDbExpense(expense: Expense, userId: string): Omit<DbExpense, 'created_at' | 'updated_at'> {
    return {
        id: expense.id,
        user_id: userId,
        month: expense.month,
        category: expense.category,
        name: expense.name,
        value: expense.value,
        type: expense.type,
        frequency: expense.frequency ?? null,
        observation: expense.observation ?? null,
        installment_current: expense.installment?.current ?? null,
        installment_total: expense.installment?.total ?? null,
        objective_id: expense.objectiveId ?? null,
        source: expense.source ?? 'manual',
        source_ref: expense.sourceRef ?? null,
        effective_from: expense.effectiveFrom ?? null,
    };
}

/**
 * Convert database row to app Expense
 */
function fromDbExpense(row: DbExpense): Expense {
    const expense: Expense = {
        id: row.id,
        month: row.month,
        category: row.category,
        name: row.name,
        value: Number(row.value) || 0,
        type: row.type as Expense['type'],
        frequency: row.frequency ?? undefined,
        observation: row.observation ?? undefined,
        createdAt: row.created_at,
        objectiveId: row.objective_id ?? undefined,
        source: row.source,
        sourceRef: row.source_ref ?? undefined,
        effectiveFrom: row.effective_from ?? undefined,
    };

    // Only add installment if both values exist
    if (row.installment_current !== null && row.installment_total !== null) {
        expense.installment = {
            current: row.installment_current,
            total: row.installment_total,
        };
    }

    return expense;
}

/**
 * Convert app Income to database row
 */
function toDbIncome(income: Income, userId: string): Omit<DbIncome, 'created_at' | 'updated_at'> {
    return {
        id: income.id,
        user_id: userId,
        month: income.month,
        category: income.category,
        name: income.name,
        value: income.value,
        source: income.source ?? 'manual',
        source_ref: income.sourceRef ?? null,
        effective_from: income.effectiveFrom ?? null,
    };
}

/**
 * Convert database row to app Income
 */
function fromDbIncome(row: DbIncome): Income {
    return {
        id: row.id,
        month: row.month,
        category: row.category,
        name: row.name,
        value: Number(row.value) || 0,
        source: row.source,
        sourceRef: row.source_ref ?? undefined,
        effectiveFrom: row.effective_from ?? undefined,
        createdAt: row.created_at,
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
    const fullContext = `[SupabasePlanningRepository] ${context}`;
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

export class SupabasePlanningRepository implements PlanningRepository {

    private get supabase() {
        return getSupabaseClient();
    }

    // =============================================
    // GOALS
    // =============================================

    async getGoals(): Promise<Goal[]> {
        try {
            const userId = await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('planning_goals')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                handleError('Erro ao buscar goals', error);
            }

            const goals = (data || []).map(fromDbGoal);

            // Se não houver goals, criar os padrão
            if (goals.length === 0) {
                const defaultGoals: Goal[] = [
                    { id: crypto.randomUUID(), category: 'Investimentos', percentage: 30, color: '#f59e0b' },
                    { id: crypto.randomUUID(), category: 'Custos Fixos', percentage: 35, color: '#ef4444' },
                    { id: crypto.randomUUID(), category: 'Metas', percentage: 10, color: '#06b6d4' },
                    { id: crypto.randomUUID(), category: 'Conforto', percentage: 15, color: '#3b82f6' },
                    { id: crypto.randomUUID(), category: 'Conhecimento', percentage: 5, color: '#8b5cf6' },
                    { id: crypto.randomUUID(), category: 'Prazeres', percentage: 5, color: '#ec4899' },
                ];

                // Salvar os goals padrão no banco
                await this.saveGoals(defaultGoals);
                return defaultGoals;
            }

            return goals;
        } catch (error) {
            // Em caso de erro, tentar retornar goals padrão
            // Se não conseguir salvar, retornar array vazio para evitar crash
            try {
                const defaultGoals: Goal[] = [
                    { id: crypto.randomUUID(), category: 'Investimentos', percentage: 30, color: '#f59e0b' },
                    { id: crypto.randomUUID(), category: 'Custos Fixos', percentage: 35, color: '#ef4444' },
                    { id: crypto.randomUUID(), category: 'Metas', percentage: 10, color: '#06b6d4' },
                    { id: crypto.randomUUID(), category: 'Conforto', percentage: 15, color: '#3b82f6' },
                    { id: crypto.randomUUID(), category: 'Conhecimento', percentage: 5, color: '#8b5cf6' },
                    { id: crypto.randomUUID(), category: 'Prazeres', percentage: 5, color: '#ec4899' },
                ];
                // Tentar salvar, mas não falhar se não conseguir
                try {
                    await this.saveGoals(defaultGoals);
                } catch {
                    // Ignorar erro ao salvar goals padrão
                }
                return defaultGoals;
            } catch {
                // Se tudo falhar, retornar array vazio
                console.error('Erro ao carregar goals:', error);
                return [];
            }
        }
    }

    async saveGoals(goals: Goal[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // Strategy: Delete all goals for user, then insert new ones
            // This ensures removed goals are deleted and order is preserved

            // 1. Delete all existing goals for this user
            const { error: deleteError } = await this.supabase
                .from('planning_goals')
                .delete()
                .eq('user_id', userId);

            if (deleteError) {
                handleError('Erro ao deletar goals existentes', deleteError);
            }

            // 2. Insert new goals with sort order
            if (goals.length > 0) {
                const dbGoals = goals.map((goal, index) => toDbGoal(goal, userId, index));

                const { error: insertError } = await this.supabase
                    .from('planning_goals')
                    .insert(dbGoals);

                if (insertError) {
                    handleError('Erro ao inserir goals', insertError);
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveGoals falhou', error);
        }
    }

    // =============================================
    // BUDGET
    // =============================================

    async getBudget(monthStr: string): Promise<Budget | null> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('planning_budgets')
                .select('*')
                .eq('month', monthStr)
                .maybeSingle();

            if (error) {
                handleError(`Erro ao buscar budget para ${monthStr}`, error);
            }

            return data ? fromDbBudget(data) : null;
        } catch (error) {
            handleError('getBudget falhou', error);
        }
    }

    async saveBudget(budget: Budget): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            const dbBudget = toDbBudget(budget, userId);

            // Upsert by (user_id, month)
            const { error } = await this.supabase
                .from('planning_budgets')
                .upsert(dbBudget, {
                    onConflict: 'user_id,month'
                });

            if (error) {
                handleError(`Erro ao salvar budget para ${budget.month}`, error);
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveBudget falhou', error);
        }
    }

    // =============================================
    // OBJECTIVES
    // =============================================

    async getObjectives(): Promise<Objective[]> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('planning_objectives')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                handleError('Erro ao buscar objectives', error);
            }

            return (data || []).map(fromDbObjective);
        } catch (error) {
            handleError('getObjectives falhou', error);
        }
    }

    async saveObjectives(objectives: Objective[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // Get existing objective IDs
            const { data: existingData, error: fetchError } = await this.supabase
                .from('planning_objectives')
                .select('id');

            if (fetchError) {
                handleError('Erro ao buscar objectives existentes', fetchError);
            }

            const existingIds = new Set((existingData || []).map((o: { id: string }) => o.id));
            const newIds = new Set(objectives.map(o => o.id));

            // Delete objectives that are no longer in the list
            const objectivesToDelete = [...existingIds].filter(id => !newIds.has(id));
            if (objectivesToDelete.length > 0) {
                const { error: deleteError } = await this.supabase
                    .from('planning_objectives')
                    .delete()
                    .in('id', objectivesToDelete);

                if (deleteError) {
                    console.error('[SupabasePlanningRepository] Erro ao deletar objectives removidos:', deleteError);
                }
            }

            // Upsert all objectives
            if (objectives.length > 0) {
                const dbObjectives = objectives.map(obj => toDbObjective(obj, userId));

                const { error: upsertError } = await this.supabase
                    .from('planning_objectives')
                    .upsert(dbObjectives, { onConflict: 'id' });

                if (upsertError) {
                    handleError('Erro ao salvar objectives', upsertError);
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveObjectives falhou', error);
        }
    }

    // =============================================
    // EXPENSES
    // =============================================

    async getExpenses(monthStr: string): Promise<Expense[]> {
        try {
            await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('planning_expenses')
                .select('*')
                .eq('month', monthStr)
                .order('created_at', { ascending: true });

            if (error) {
                handleError(`Erro ao buscar expenses para ${monthStr}`, error);
            }

            return (data || []).map(fromDbExpense);
        } catch (error) {
            handleError('getExpenses falhou', error);
        }
    }

    async getExpensesByYearRange(year: number): Promise<Map<string, Expense[]>> {
        try {
            await getRequiredUserId();

            // Generate all month keys for the year (YYYY-MM format)
            const months: string[] = [];
            for (let m = 1; m <= 12; m++) {
                months.push(`${year}-${String(m).padStart(2, '0')}`);
            }

            // Fetch all expenses for the year in a single query
            const { data, error } = await this.supabase
                .from('planning_expenses')
                .select('*')
                .in('month', months)
                .order('created_at', { ascending: true });

            if (error) {
                handleError(`Erro ao buscar expenses para o ano ${year}`, error);
            }

            // Group expenses by month key
            const expensesMap = new Map<string, Expense[]>();

            // Initialize all months with empty arrays
            months.forEach(month => {
                expensesMap.set(month, []);
            });

            // Populate map with expenses
            (data || []).forEach(dbExpense => {
                const expense = fromDbExpense(dbExpense);
                const month = expense.month;
                const existing = expensesMap.get(month) || [];
                expensesMap.set(month, [...existing, expense]);
            });

            return expensesMap;
        } catch (error) {
            console.error('[SupabasePlanningRepository] getExpensesByYearRange falhou', error);
            // Return empty map with all months initialized
            const months: string[] = [];
            for (let m = 1; m <= 12; m++) {
                months.push(`${year}-${String(m).padStart(2, '0')}`);
            }
            const emptyMap = new Map<string, Expense[]>();
            months.forEach(month => {
                emptyMap.set(month, []);
            });
            return emptyMap;
        }
    }

    async saveExpenses(monthStr: string, expenses: Expense[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // Strategy: Delete all expenses for this month, then insert new ones
            // This is simpler and safer than complex diffing

            // 1. Delete all expenses for this user/month
            const { error: deleteError } = await this.supabase
                .from('planning_expenses')
                .delete()
                .eq('user_id', userId)
                .eq('month', monthStr)
                .eq('source', 'manual'); // Only delete manual expenses to preserve Real Estate mirroring

            if (deleteError) {
                handleError(`Erro ao deletar expenses de ${monthStr}`, deleteError);
            }

            // 2. Reinsert only manual expenses.
            // Non-manual rows (e.g. real_estate mirroring) were intentionally preserved above
            // and must not be inserted again, otherwise their existing primary keys collide.
            const manualExpenses = expenses.filter((expense) => (expense.source ?? 'manual') === 'manual');
            if (manualExpenses.length > 0) {
                const dbExpenses = manualExpenses.map(expense => toDbExpense(expense, userId));

                const { error: insertError } = await this.supabase
                    .from('planning_expenses')
                    .insert(dbExpenses);

                if (insertError) {
                    handleError(`Erro ao inserir expenses de ${monthStr}`, insertError);
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveExpenses falhou', error);
        }
    }

    async upsertExpenses(expenses: Expense[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            if (expenses.length > 0) {
                const dbExpenses = expenses.map(expense => toDbExpense(expense, userId));

                // We utilize the unique index for mirroring: (user_id, month, source, source_ref, name)
                const { error } = await this.supabase
                    .from('planning_expenses')
                    .upsert(dbExpenses, {
                        onConflict: 'user_id,month,source,source_ref,name'
                    });

                if (error) {
                    handleError('Erro ao fazer upsert de expenses', error);
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('upsertExpenses falhou', error);
        }
    }

    async deleteExpensesByObjective(objectiveId: string, objectiveName?: string): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            const { error: linkedDeleteError } = await this.supabase
                .from('planning_expenses')
                .delete()
                .eq('user_id', userId)
                .eq('objective_id', objectiveId);

            if (linkedDeleteError) {
                handleError(`Erro ao deletar expenses vinculados ao objetivo ${objectiveId}`, linkedDeleteError);
            }

            if (objectiveName) {
                const { error: legacyDeleteError } = await this.supabase
                    .from('planning_expenses')
                    .delete()
                    .eq('user_id', userId)
                    .eq('source', 'manual')
                    .eq('category', 'Metas')
                    .eq('name', `Aporte: ${objectiveName}`)
                    .is('objective_id', null);

                if (legacyDeleteError) {
                    handleError(`Erro ao deletar expenses legados do objetivo ${objectiveId}`, legacyDeleteError);
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('deleteExpensesByObjective falhou', error);
        }
    }

    // === INCOME ===

    async getIncomes(monthStr: string): Promise<Income[]> {
        try {
            const userId = await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('planning_income')
                .select('*')
                .eq('user_id', userId)
                .eq('month', monthStr)
                .order('created_at', { ascending: true });

            if (error) {
                // If table doesn't exist yet (migration pending), return empty array
                if (error.code === '42P01') {
                    console.warn('[SupabasePlanningRepository] planning_income table not found');
                    return [];
                }
                handleError(`Erro ao buscar incomes de ${monthStr}`, error);
            }

            return (data || []).map(fromDbIncome);
        } catch (error) {
            handleError('getIncomes', error);
        }
    }

    async saveIncomes(monthStr: string, incomes: Income[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();

            // 1. Delete all MANUAL incomes for this user/month
            // (Preserve synced incomes to avoid accidental data loss)
            const { error: deleteError } = await this.supabase
                .from('planning_income')
                .delete()
                .eq('user_id', userId)
                .eq('month', monthStr)
                .eq('source', 'manual');

            if (deleteError) {
                // Handle table not found
                if (deleteError.code === '42P01') return;
                handleError(`Erro ao deletar incomes manuais de ${monthStr}`, deleteError);
            }

            // 2. Insert new incomes
            if (incomes.length > 0) {
                const manualIncomes = incomes.filter(i => (i.source || 'manual') === 'manual');
                if (manualIncomes.length > 0) {
                    const dbIncomes = manualIncomes.map(i => toDbIncome(i, userId));
                    const { error: insertError } = await this.supabase
                        .from('planning_income')
                        .insert(dbIncomes);

                    if (insertError) {
                        handleError(`Erro ao salvar incomes em ${monthStr}`, insertError);
                    }
                }
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('saveIncomes', error);
        }
    }

    async upsertIncomes(incomes: Income[]): Promise<void> {
        try {
            const userId = await getRequiredUserId();
            if (incomes.length === 0) return;

            // Upsert based on unique constraint
            const dbIncomes = incomes.map(i => toDbIncome(i, userId));

            const { error } = await this.supabase
                .from('planning_income')
                .upsert(dbIncomes, {
                    onConflict: 'user_id,month,source,source_ref,name',
                    ignoreDuplicates: false
                });

            if (error) {
                // Handle table not found
                if (error.code === '42P01') return;
                handleError('Erro ao fazer upsert de incomes', error);
            }

            this.dispatchUpdateEvent();
        } catch (error) {
            handleError('upsertIncomes', error);
        }
    }

    // =============================================
    // STORAGE MANAGEMENT
    // =============================================

    dispatchUpdateEvent(): void {
        window.dispatchEvent(new CustomEvent(BUDGET_UPDATE_EVENT));
    }
}
