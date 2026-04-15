import { portfolioService } from '../portfolioService';
import type { Portfolio, CustomItem, PortfolioEvent, DashboardConfig } from '../../types';

export type AllocationSlice = { name: string; value: number; color: string };
export type EvolutionPoint = { name: string; value: number; valuePrice?: number; fullDate: string };

export async function fetchPortfolios(): Promise<Portfolio[]> {
  return portfolioService.getPortfolios();
}

export async function fetchPortfolioById(id: string): Promise<Portfolio | undefined> {
  return portfolioService.getPortfolioById(id);
}

export async function fetchPortfolioItems(portfolioId: string): Promise<CustomItem[]> {
  return portfolioService.getCustomItems(portfolioId);
}

export async function fetchPortfolioEvents(portfolioId: string): Promise<PortfolioEvent[]> {
  return portfolioService.getHistoryEvents(portfolioId);
}

export async function fetchGlobalEvents(): Promise<PortfolioEvent[]> {
  return portfolioService.getGlobalHistoryEvents();
}

export async function fetchAllocationData(): Promise<AllocationSlice[]> {
  return portfolioService.getAllocationData();
}

export async function fetchGlobalMetrics(): Promise<{
  totalBalance: number;
  monthlyProfit: number;
  monthlyVariation: number;
}> {
  return portfolioService.getGlobalMetrics();
}

export async function fetchEvolutionData(
  portfolioId: string | undefined,
  range: '3M' | '6M' | '1A' | 'ALL'
): Promise<EvolutionPoint[]> {
  return portfolioService.getEvolutionData(portfolioId, range);
}

export async function fetchBenchmarkData(range: '6M' | '1A' | 'ALL', customStartDate?: string) {
  return portfolioService.getBenchmarkData(range, customStartDate);
}

export async function fetchPerformanceData(
  portfolioId: string | undefined,
  range: '6M' | '1A' | 'ALL'
): Promise<EvolutionPoint[]> {
  return portfolioService.getPerformanceData(portfolioId, range);
}

export async function fetchCategories(): Promise<string[]> {
  return portfolioService.getCategories();
}

export async function fetchDashboardConfig(portfolioId: string): Promise<DashboardConfig> {
  return portfolioService.getDashboardConfig(portfolioId);
}
