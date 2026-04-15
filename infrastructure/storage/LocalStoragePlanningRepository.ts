/**
 * LocalStorage Implementation of PlanningRepository
 * Contains the exact same storage logic from the original planningService
 * 
 * ============================================================
 * ASYNC WRAPPER
 * All methods return Promises (via Promise.resolve) to match
 * the async interface, enabling seamless swap to Supabase later.
 * ============================================================
 */

import {
    PlanningRepository,
    Goal,
    Budget,
    Objective,
    Expense
} from '../../domain/repositories/PlanningRepository';
import { safeJsonParse } from '../../utils/storage';

// Storage Keys
const GOALS_KEY = 'patrio_goals';
const BUDGET_KEY = 'patrio_budget';
const EXPENSES_KEY_PREFIX = 'patrio_expenses_';
const OBJECTIVES_KEY = 'patrio_objectives';

// Custom Event for updates
export const BUDGET_UPDATE_EVENT = 'patrio_budget_updated';

// Default "AUVP" Style Goals with "Metas" added
const DEFAULT_GOALS: Goal[] = [
    { id: '1', category: 'Investimentos', percentage: 30, color: '#f59e0b' },
    { id: '2', category: 'Custos Fixos', percentage: 35, color: '#ef4444' },
    { id: '6', category: 'Metas', percentage: 10, color: '#06b6d4' },
    { id: '3', category: 'Conforto', percentage: 15, color: '#3b82f6' },
    { id: '4', category: 'Conhecimento', percentage: 5, color: '#8b5cf6' },
    { id: '5', category: 'Prazeres', percentage: 5, color: '#ec4899' },
];

/**
 * LocalStorage implementation of PlanningRepository
 */
export class LocalStoragePlanningRepository implements PlanningRepository {

    // === GOALS ===

    getGoals(): Promise<Goal[]> {
        const data = localStorage.getItem(GOALS_KEY);
        if (!data) {
            // Seed defaults if empty
            localStorage.setItem(GOALS_KEY, JSON.stringify(DEFAULT_GOALS));
            return Promise.resolve(DEFAULT_GOALS);
        }

        // Migration check: If 'Metas' is missing, add it
        const goals = safeJsonParse<Goal[]>(data, DEFAULT_GOALS);
        if (!goals.some((g: Goal) => g.category === 'Metas')) {
            const newGoals = [...goals, { id: '6', category: 'Metas', percentage: 0, color: '#06b6d4' }];
            localStorage.setItem(GOALS_KEY, JSON.stringify(newGoals));
            return Promise.resolve(newGoals);
        }

        return Promise.resolve(goals);
    }

    saveGoals(goals: Goal[]): Promise<void> {
        localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
        this.dispatchUpdateEvent();
        return Promise.resolve();
    }

    // === BUDGET ===

    getBudget(monthStr: string): Promise<Budget | null> {
        const data = localStorage.getItem(`${BUDGET_KEY}_${monthStr}`);
        if (data) {
            return Promise.resolve(safeJsonParse<Budget>(data, null));
        }
        return Promise.resolve(null);
    }

    saveBudget(budget: Budget): Promise<void> {
        localStorage.setItem(`${BUDGET_KEY}_${budget.month}`, JSON.stringify(budget));
        this.dispatchUpdateEvent();
        return Promise.resolve();
    }

    // === OBJECTIVES ===

    getObjectives(): Promise<Objective[]> {
        const data = localStorage.getItem(OBJECTIVES_KEY);
        return Promise.resolve(safeJsonParse<Objective[]>(data, []));
    }

    saveObjectives(objectives: Objective[]): Promise<void> {
        localStorage.setItem(OBJECTIVES_KEY, JSON.stringify(objectives));
        this.dispatchUpdateEvent();
        return Promise.resolve();
    }

    // === EXPENSES ===

    getExpenses(monthStr: string): Promise<Expense[]> {
        const data = localStorage.getItem(`${EXPENSES_KEY_PREFIX}${monthStr}`);
        return Promise.resolve(safeJsonParse<Expense[]>(data, []));
    }

    getExpensesByYearRange(year: number): Promise<Map<string, Expense[]>> {
        const expensesMap = new Map<string, Expense[]>();

        // Generate all month keys for the year (YYYY-MM format)
        const months: string[] = [];
        for (let m = 1; m <= 12; m++) {
            const monthKey = `${year}-${String(m).padStart(2, '0')}`;
            months.push(monthKey);

            // Fetch expenses for this month from localStorage
            const data = localStorage.getItem(`${EXPENSES_KEY_PREFIX}${monthKey}`);
            const expenses = safeJsonParse<Expense[]>(data, []);
            expensesMap.set(monthKey, expenses);
        }

        return Promise.resolve(expensesMap);
    }

    async saveExpenses(monthStr: string, expenses: Expense[]): Promise<void> {
        // Retrieve existing expenses
        const allExisting = await this.getExpenses(monthStr);

        // Filter out existing manually entered expenses (we will replace them)
        // Keep non-manual expenses (e.g. Real Estate) safely
        const preserved = allExisting.filter(e => e.source && e.source !== 'manual');

        // Process new expenses
        // We assume saveExpenses is primarily for Manual Budget
        // So we take all 'manual' from input
        const newManuals = expenses.filter(e => !e.source || e.source === 'manual');

        // If the input ALSO contains non-manual (e.g. UI passed them back), we prioritize the input?
        // Or strict separation? strict separation is safer for now to avoid accidental overwrites.
        // But if UI allows editing Real Estate note, we might want to save it.
        // For now, let's just save everything passed, effectively merging with preserved.

        // Actually, preventing duplication is key.
        // If 'expenses' contains Real Estate items, and we kept them in 'preserved', we have duplicates.
        // So we should filter 'preserved' to exclude those present in 'expenses'?

        // Simpler approach compatible with Supabase logic:
        // 1. We treat 'expenses' as the Authority for 'manual' expenses.
        // 2. We Keep 'real_estate' from storage UNLESS they are in 'expenses'? 
        //    No, usually `saveExpenses` comes from Budget Page which might likely just read/write manual.

        // Let's implement the "Manual Budget" contract:
        // Replace all Manual expenses with the new list of Manual expenses.
        // Upsert any Non-Manual expenses passed (rare).

        const merged = [
            ...preserved,
            ...newManuals
        ];

        localStorage.setItem(`${EXPENSES_KEY_PREFIX}${monthStr}`, JSON.stringify(merged));
        this.dispatchUpdateEvent();
        return Promise.resolve();
    }

    async upsertExpenses(expenses: Expense[]): Promise<void> {
        // Group by month to minimize IO
        const byMonth = new Map<string, Expense[]>();
        expenses.forEach(e => {
            const list = byMonth.get(e.month) || [];
            list.push(e);
            byMonth.set(e.month, list);
        });

        for (const [month, newExpenses] of byMonth.entries()) {
            const existing = await this.getExpenses(month);

            // Merge logic: Remove old ones that match (source, sourceRef, name)
            const resolved = existing.filter(oldE => {
                return !newExpenses.some(newE =>
                    newE.source === oldE.source &&
                    newE.sourceRef === oldE.sourceRef &&
                    newE.name === oldE.name
                );
            });

            resolved.push(...newExpenses);
            localStorage.setItem(`${EXPENSES_KEY_PREFIX}${month}`, JSON.stringify(resolved));
        }

        this.dispatchUpdateEvent();
        return Promise.resolve();
    }

    deleteExpensesByObjective(objectiveId: string, objectiveName?: string): Promise<void> {
        const legacyName = objectiveName ? `Aporte: ${objectiveName}` : null;
        let changed = false;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(EXPENSES_KEY_PREFIX)) continue;

            const monthExpenses = safeJsonParse<Expense[]>(localStorage.getItem(key), []);
            const filteredExpenses = monthExpenses.filter((expense) => {
                if (expense.objectiveId === objectiveId) {
                    changed = true;
                    return false;
                }

                if (
                    legacyName
                    && !expense.objectiveId
                    && (expense.source ?? 'manual') === 'manual'
                    && expense.category === 'Metas'
                    && expense.name === legacyName
                ) {
                    changed = true;
                    return false;
                }

                return true;
            });

            if (filteredExpenses.length !== monthExpenses.length) {
                localStorage.setItem(key, JSON.stringify(filteredExpenses));
            }
        }

        if (changed) {
            this.dispatchUpdateEvent();
        }

        return Promise.resolve();
    }

    // === STORAGE MANAGEMENT ===

    dispatchUpdateEvent(): void {
        window.dispatchEvent(new Event(BUDGET_UPDATE_EVENT));
    }
}
