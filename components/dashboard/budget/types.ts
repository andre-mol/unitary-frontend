import type { Goal, Expense, Objective } from '../../../lib/planningService';

export interface CategoryStats {
    planned: number;
    realized: number;
    remaining: number;
    percentUsed: number;
}

export interface GroupedExpenseData {
    goal: Goal;
    catExpenses: Expense[];
    catTotal: number;
    pctOfTotal: number;
}

export type { Goal, Expense, Objective };

