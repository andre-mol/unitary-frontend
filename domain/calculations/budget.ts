/**
 * Budget Calculation Functions
 * Pure functions for budget and expense calculations
 * No localStorage, no React, no side effects
 */

export interface CategoryStats {
    planned: number;
    realized: number;
    remaining: number;
    percentUsed: number;
    count: number;
}

export interface Expense {
    id: string;
    category: string;
    value: number;
}

export interface Goal {
    id: string;
    category: string;
    percentage: number;
}

/**
 * Calculates statistics for a budget category
 */
export const calculateCategoryStats = (
    category: string,
    categoryPercentage: number,
    salary: number,
    expenses: Expense[]
): CategoryStats => {
    const planned = salary * (categoryPercentage / 100);
    const categoryExpenses = expenses.filter(e => e.category === category);
    const realized = categoryExpenses.reduce((sum, e) => sum + e.value, 0);
    const remaining = planned - realized;
    const percentUsed = planned > 0 ? (realized / planned) * 100 : 0;

    return {
        planned,
        realized,
        remaining,
        percentUsed,
        count: categoryExpenses.length
    };
};

/**
 * Calculates total expenses
 */
export const calculateTotalExpenses = (expenses: Expense[]): number => {
    return expenses.reduce((acc, e) => acc + e.value, 0);
};

/**
 * Calculates period result (revenues - expenses)
 */
export const calculatePeriodResult = (revenues: number, expenses: number): number => {
    return revenues - expenses;
};

/**
 * Calculates percentage of total for an amount
 */
export const calculatePercentageOfTotal = (amount: number, total: number): number => {
    if (total <= 0) return 0;
    return (amount / total) * 100;
};

/**
 * Groups expenses by category and calculates totals
 */
export const groupExpensesByCategory = (
    expenses: Expense[],
    goals: Goal[]
): {
    goal: Goal;
    categoryExpenses: Expense[];
    categoryTotal: number;
    percentOfTotal: number;
}[] => {
    const grandTotal = calculateTotalExpenses(expenses);

    return goals.map(goal => {
        const categoryExpenses = expenses
            .filter(e => e.category === goal.category)
            .sort((a, b) => b.value - a.value);

        const categoryTotal = categoryExpenses.reduce((acc, e) => acc + e.value, 0);

        return {
            goal,
            categoryExpenses,
            categoryTotal,
            percentOfTotal: grandTotal > 0 ? (categoryTotal / grandTotal) * 100 : 0
        };
    }).filter(g => g.categoryTotal > 0)
      .sort((a, b) => b.categoryTotal - a.categoryTotal);
};

/**
 * Checks if a category is over budget
 */
export const isCategoryOverBudget = (realized: number, planned: number): boolean => {
    return realized > planned && planned > 0;
};

/**
 * Calculates total percentage allocation from goals
 */
export const calculateTotalPercentage = (goals: Goal[]): number => {
    return goals.reduce((acc, g) => acc + g.percentage, 0);
};

