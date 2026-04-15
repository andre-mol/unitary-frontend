import { portfolioService } from '../portfolioService';
import { planningService } from '../planningService';
import type { Portfolio, CustomItem, PortfolioEvent } from '../../types';
import type { Expense } from '../planningService';

export type TimelineData = {
  portfolios: Portfolio[];
  allItems: CustomItem[];
  expensesByYear: Map<string, Expense[]>;
  globalEvents: PortfolioEvent[];
};

/**
 * Fetches all data needed for the Timeline page in parallel
 * This optimizes loading by fetching everything at once instead of sequentially
 */
export async function fetchTimelineData(year: number): Promise<TimelineData> {
  // Fetch portfolios, expenses by year, and global events in parallel
  const [portfolios, expensesByYear, globalEvents] = await Promise.all([
    portfolioService.getPortfolios(),
    planningService.getExpensesByYearRange(year),
    portfolioService.getGlobalHistoryEvents(),
  ]);

  // Fetch all items for all portfolios in parallel
  const itemsPromises = portfolios.map(p => portfolioService.getCustomItems(p.id));
  const itemsArrays = await Promise.all(itemsPromises);
  const allItems = itemsArrays.flat();

  return {
    portfolios,
    allItems,
    expensesByYear,
    globalEvents,
  };
}
