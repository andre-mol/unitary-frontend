/**
 * Planning Repository Interface
 * Defines the contract for planning/budget data access
 */

export interface Goal {
    id: string;
    category: string;
    percentage: number;
    color: string;
}

export interface Budget {
    month: string; // "YYYY-MM"
    salary: number;
    updatedAt: string;
}

export interface Objective {
    id: string;
    name: string;
    description?: string;
    totalValue: number;
    currentValue: number;
    status: 'active' | 'paused' | 'completed';
    completedAt?: string;
    createdAt: string;
}

export interface Expense {
    id: string;
    month: string;
    category: string;
    name: string;
    value: number;
    type: 'fixo' | 'variavel' | 'recorrente';
    frequency?: string;
    observation?: string;
    createdAt: string;
    installment?: {
        current: number;
        total: number;
    };
    objectiveId?: string;
    source?: 'manual' | 'real_estate' | string;
    sourceRef?: string;
    effectiveFrom?: string; // ISO date YYYY-MM-DD for backdating costs
}

export interface Income {
    id: string;
    month: string;
    category: string;
    name: string;
    value: number;
    source?: 'manual' | 'real_estate' | string;
    sourceRef?: string;
    effectiveFrom?: string; // ISO date YYYY-MM-DD
    createdAt: string;
}

/**
 * Planning Repository Interface
 * Provides data access methods for planning/budget
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All methods return Promises, enabling seamless swap to Supabase later.
 * ============================================================
 */
export interface PlanningRepository {
    // === GOALS ===
    getGoals(): Promise<Goal[]>;
    saveGoals(goals: Goal[]): Promise<void>;

    // === BUDGET ===
    getBudget(monthStr: string): Promise<Budget | null>;
    saveBudget(budget: Budget): Promise<void>;

    // === OBJECTIVES ===
    getObjectives(): Promise<Objective[]>;
    saveObjectives(objectives: Objective[]): Promise<void>;

    // === EXPENSES ===
    getExpenses(monthStr: string): Promise<Expense[]>;
    getExpensesByYearRange(year: number): Promise<Map<string, Expense[]>>;
    saveExpenses(monthStr: string, expenses: Expense[]): Promise<void>;
    upsertExpenses(expenses: Expense[]): Promise<void>;
    deleteExpensesByObjective(objectiveId: string, objectiveName?: string): Promise<void>;

    // === INCOME ===
    getIncomes(monthStr: string): Promise<Income[]>;
    saveIncomes(monthStr: string, incomes: Income[]): Promise<void>;
    upsertIncomes(incomes: Income[]): Promise<void>;

    // === STORAGE MANAGEMENT ===
    dispatchUpdateEvent(): void;
}
