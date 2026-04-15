import { planningService } from '../planningService';
import type { Goal, Budget, Expense, Objective } from '../planningService';

export async function fetchGoals(): Promise<Goal[]> {
  return planningService.getGoals();
}

export async function fetchObjectives(): Promise<Objective[]> {
  return planningService.getObjectives();
}

export async function fetchBudget(monthKey: string): Promise<Budget> {
  return planningService.getBudget(monthKey);
}

export async function fetchExpenses(monthKey: string): Promise<Expense[]> {
  return planningService.getExpenses(monthKey);
}

export async function fetchExpensesByYearRange(year: number): Promise<Map<string, Expense[]>> {
  return planningService.getExpensesByYearRange(year);
}
