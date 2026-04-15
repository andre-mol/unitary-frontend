/**
 * Planning Service - Facade Pattern
 * 
 * This service acts as a facade, delegating data operations to a repository
 * while maintaining all business logic.
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All data operations are now async, preparing for Supabase migration.
 * ============================================================
 * 
 * BACKEND SWITCHING:
 * The storage backend is configured in config/storage.ts
 * Change STORAGE_BACKEND constant to switch between:
 * - 'localStorage' (current, offline-first)
 * - 'supabase' (cloud database)
 */

import type { PlanningRepository } from '../domain/repositories/PlanningRepository';
import {
    Goal,
    Budget,
    Objective,
    Expense,
    Income
} from '../domain/repositories/PlanningRepository';

// Import repository factory from central config
import {
    createPlanningRepository,
    BUDGET_UPDATE_EVENT as UPDATE_EVENT
} from '../config/storage';

// Re-export types for backward compatibility
export type { Goal, Budget, Objective, Expense, Income };

// Re-export the update event for consumers
export const BUDGET_UPDATE_EVENT = UPDATE_EVENT;

// ============================================================
// REPOSITORY INSTANCE (created via factory from config/storage.ts)
// ============================================================
const repository: PlanningRepository = createPlanningRepository();

// Helper to increment month string "YYYY-MM"
const incrementMonth = (monthStr: string, monthsToAdd: number): string => {
    const [yearStr, monthPartStr] = monthStr.split('-');
    const date = new Date(parseInt(yearStr), parseInt(monthPartStr) - 1 + monthsToAdd, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

/**
 * Planning Service
 * Facade that delegates to repository and applies business logic
 */
export const planningService = {

    // === GOALS ===

    getGoals: async (): Promise<Goal[]> => {
        return await repository.getGoals();
    },

    saveGoals: async (goals: Goal[]): Promise<void> => {
        await repository.saveGoals(goals);
    },

    // === BUDGET ===

    getBudget: async (monthStr: string): Promise<Budget> => {
        const budget = await repository.getBudget(monthStr);
        if (budget) return budget;

        // Return empty budget if not found
        return {
            month: monthStr,
            salary: 0,
            updatedAt: new Date().toISOString()
        };
    },

    saveBudget: async (budget: Budget): Promise<void> => {
        budget.updatedAt = new Date().toISOString();
        await repository.saveBudget(budget);
    },

    // === OBJECTIVES MANAGEMENT ===

    getObjectives: async (): Promise<Objective[]> => {
        return await repository.getObjectives();
    },

    saveObjectives: async (objectives: Objective[]): Promise<void> => {
        await repository.saveObjectives(objectives);
    },

    addObjective: async (data: Omit<Objective, 'id' | 'currentValue' | 'createdAt'>): Promise<Objective> => {
        const objectives = await planningService.getObjectives();
        const newObj: Objective = {
            id: crypto.randomUUID(),
            ...data,
            currentValue: 0,
            createdAt: new Date().toISOString()
        };
        await planningService.saveObjectives([...objectives, newObj]);
        return newObj;
    },

    updateObjective: async (id: string, updates: Partial<Objective>): Promise<void> => {
        const objectives = await planningService.getObjectives();
        const index = objectives.findIndex(o => o.id === id);
        if (index !== -1) {
            const updated = { ...objectives[index], ...updates };
            if (updates.status === 'completed' && objectives[index].status !== 'completed') {
                updated.completedAt = new Date().toISOString();
            }
            objectives[index] = updated;
            await planningService.saveObjectives(objectives);
        }
    },

    deleteObjective: async (id: string): Promise<void> => {
        const objectives = await planningService.getObjectives();
        const targetObjective = objectives.find(o => o.id === id);
        if (targetObjective) {
            await repository.deleteExpensesByObjective(targetObjective.id, targetObjective.name);
        }
        const updated = objectives.filter(o => o.id !== id);
        await planningService.saveObjectives(updated);
    },

    // === EXPENSE MANAGEMENT ===

    getExpenses: async (monthStr: string): Promise<Expense[]> => {
        return await repository.getExpenses(monthStr);
    },

    getExpensesByYearRange: async (year: number): Promise<Map<string, Expense[]>> => {
        return await repository.getExpensesByYearRange(year);
    },

    addExpense: async (expense: Omit<Expense, 'id' | 'createdAt'>, repeatMonths: number = 1): Promise<Expense> => {
        const baseId = crypto.randomUUID();
        const createdExpenses: Expense[] = [];

        // Update objective value if linked
        if (expense.objectiveId) {
            const objectives = await planningService.getObjectives();
            const objIndex = objectives.findIndex(o => o.id === expense.objectiveId);
            if (objIndex !== -1) {
                const totalAdd = expense.value * repeatMonths;
                const obj = objectives[objIndex];
                obj.currentValue += totalAdd;
                await planningService.saveObjectives(objectives);
            }
        }

        for (let i = 0; i < repeatMonths; i++) {
            const targetMonth = incrementMonth(expense.month, i);
            const expenses = await repository.getExpenses(targetMonth);

            const isInstallment = repeatMonths > 1;

            const newExpense: Expense = {
                ...expense,
                id: i === 0 ? baseId : crypto.randomUUID(),
                month: targetMonth,
                createdAt: new Date().toISOString(),
                installment: isInstallment ? {
                    current: i + 1,
                    total: repeatMonths
                } : undefined
            };

            const updated = [...expenses, newExpense];
            await repository.saveExpenses(targetMonth, updated);
            createdExpenses.push(newExpense);
        }

        return createdExpenses[0];
    },

    deleteExpense: async (id: string, monthStr: string): Promise<void> => {
        const expenses = await repository.getExpenses(monthStr);
        if (expenses.length === 0) return;

        const expenseToDelete = expenses.find(e => e.id === id);
        if (!expenseToDelete) return;

        // Se o expense tem parcelas (installment), deletar todas as parcelas relacionadas
        if (expenseToDelete.installment && expenseToDelete.installment.total > 1) {
            const totalMonths = expenseToDelete.installment.total;
            const currentInstallment = expenseToDelete.installment.current;
            const startMonth = incrementMonth(monthStr, -(currentInstallment - 1));

            // Reverse Objective Contribution: reverter o valor total de todas as parcelas
            if (expenseToDelete.objectiveId) {
                const totalValueToReverse = expenseToDelete.value * totalMonths;
                const objectives = await planningService.getObjectives();
                const objIndex = objectives.findIndex(o => o.id === expenseToDelete.objectiveId);
                if (objIndex !== -1) {
                    objectives[objIndex].currentValue = Math.max(0, objectives[objIndex].currentValue - totalValueToReverse);
                    await planningService.saveObjectives(objectives);
                }
            }

            // Deletar todas as parcelas em todos os meses
            for (let i = 0; i < totalMonths; i++) {
                const targetMonth = incrementMonth(startMonth, i);
                const monthExpenses = await repository.getExpenses(targetMonth);

                // Buscar expenses relacionados: mesmo nome, valor, categoria, tipo E que tenham installment na mesma posição
                const relatedExpenses = monthExpenses.filter(e =>
                    e.name === expenseToDelete.name &&
                    e.value === expenseToDelete.value &&
                    e.category === expenseToDelete.category &&
                    e.type === expenseToDelete.type &&
                    e.installment &&
                    e.installment.total === totalMonths &&
                    e.installment.current === (i + 1)
                );

                // Deletar todos os expenses relacionados deste mês
                const remaining = monthExpenses.filter(e =>
                    !relatedExpenses.some(re => re.id === e.id)
                );

                await repository.saveExpenses(targetMonth, remaining);
            }
        } else {
            // Expense único, deletar apenas do mês atual
            // Reverse Objective Contribution se existir (já não foi revertido acima)
            if (expenseToDelete.objectiveId) {
                const objectives = await planningService.getObjectives();
                const objIndex = objectives.findIndex(o => o.id === expenseToDelete.objectiveId);
                if (objIndex !== -1) {
                    objectives[objIndex].currentValue = Math.max(0, objectives[objIndex].currentValue - expenseToDelete.value);
                    await planningService.saveObjectives(objectives);
                }
            }

            const updated = expenses.filter(e => e.id !== id);
            await repository.saveExpenses(monthStr, updated);
        }
    },

    // === INCOME MANAGEMENT ===

    getIncomes: async (monthStr: string): Promise<Income[]> => {
        return await repository.getIncomes(monthStr);
    },

    addIncome: async (income: Omit<Income, 'id' | 'createdAt'>): Promise<Income> => {
        const id = crypto.randomUUID();
        const newIncome: Income = {
            ...income,
            id,
            createdAt: new Date().toISOString()
        };

        // Strategy: Load existing incomes for the month, append new one, and save
        const existing = await repository.getIncomes(income.month);
        const updated = [...existing, newIncome];
        await repository.saveIncomes(income.month, updated);

        return newIncome;
    },

    deleteIncome: async (id: string, monthStr: string): Promise<void> => {
        const incomes = await repository.getIncomes(monthStr);
        if (incomes.length === 0) return;

        const updated = incomes.filter(i => i.id !== id);
        await repository.saveIncomes(monthStr, updated);
    },

    // === HELPERS ===

    getTotalPercentage: async (): Promise<number> => {
        const goals = await planningService.getGoals();
        return goals.reduce((acc, g) => acc + g.percentage, 0);
    }
};
