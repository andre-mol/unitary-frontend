import { portfolioService } from '../portfolioService';
import { planningService } from '../planningService';
import type { PortfolioEvent, Portfolio, CustomItem } from '../../types';
import type { Objective, Budget, Expense } from '../planningService';
import type { AllocationSlice, EvolutionPoint } from './portfolios';
import { calculateCurrentValue, getValueAtDate } from '../../domain/calculations/asset';
import { calculatePortfolioScore } from '../../domain/calculations/portfolio';
import { createPortfolioRepository } from '../../config/storage';
import { toPassiveIncomePortfolioEventType } from '../utils/passiveIncome';

export type DashboardBundle = {
  portfolios: Portfolio[];
  portfolioScores: Record<string, number>;
  allocation: AllocationSlice[];
  globalMetrics: {
    totalBalance: number;
    monthlyProfit: number;
    monthlyVariation: number;
  };
  objectives: Objective[];
  budget: Budget;
  expenses: Expense[];
  historyEvents: PortfolioEvent[];
};

// AIDEV-NOTE: Optimized repository instance for bulk fetching
const repository = createPortfolioRepository();

function buildEventDedupKey(event: Pick<PortfolioEvent, 'type' | 'date' | 'totalValue' | 'assetId' | 'assetName'>): string {
  return [
    event.type,
    String(event.date || '').slice(0, 10),
    Number(event.totalValue || 0).toFixed(2),
    String(event.assetId || '').trim().toUpperCase(),
    String(event.assetName || '').trim().toUpperCase(),
  ].join('|');
}

function groupItemsByPortfolio(
  allItems: (CustomItem & { portfolio_id?: string })[]
): Map<string, CustomItem[]> {
  const grouped = new Map<string, CustomItem[]>();

  for (const item of allItems) {
    const portfolioId = item.portfolio_id;
    if (!portfolioId) continue;

    const existing = grouped.get(portfolioId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(portfolioId, [item]);
    }
  }

  return grouped;
}

function computePortfolioScores(
  portfolios: Portfolio[],
  itemsByPortfolio: Map<string, CustomItem[]>
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const portfolio of portfolios) {
    const items = itemsByPortfolio.get(portfolio.id) || [];
    const criteriaCount = portfolio.criteria?.length || 0;
    const userScore = portfolio.userConvictionScore ?? 5;
    scores[portfolio.id] = calculatePortfolioScore(items, criteriaCount, userScore);
  }

  return scores;
}

/**
 * AIDEV-NOTE: Compute allocation data from pre-fetched portfolios and items
 * Replaces portfolioService.getAllocationData() which had N+1 queries
 */
function computeAllocationData(
  portfolios: Portfolio[],
  itemsByPortfolio: Map<string, CustomItem[]>
): AllocationSlice[] {
  const map = new Map<string, number>();

  for (const p of portfolios) {
    const portfolioItems = itemsByPortfolio.get(p.id) || [];

    const pTotal = portfolioItems.length > 0
      ? portfolioItems.reduce((acc, i) => acc + calculateCurrentValue(i), 0)
      : (Number(p.value) || 0);

    let label = '';
    if (p.type === 'custom') {
      label = p.customClass || 'Personalizado';
    } else {
      const labels: Record<string, string> = {
        'investments': 'Financeiro',
        'real_estate': 'Imóveis',
        'business': 'Empresas'
      };
      label = labels[p.type] || 'Outros';
    }

    const current = map.get(label) || 0;
    map.set(label, current + pTotal);
  }

  const palette = [
    '#a855f7', '#f43f5e', '#06b6d4', '#6366f1', '#84cc16',
    '#f97316', '#14b8a6', '#d946ef', '#0ea5e9',
  ];

  const fixedColors: Record<string, string> = {
    'Financeiro': '#f59e0b',
    'Imóveis': '#3f3f46',
    'Empresas': '#059669',
    'Personalizado': '#71717a'
  };

  let colorIndex = 0;

  const data = Array.from(map.entries()).map(([key, value]) => {
    let color = fixedColors[key];

    if (!color) {
      color = palette[colorIndex % palette.length];
      colorIndex++;
    }

    return { name: key, value: value, color: color };
  });

  if (data.every(d => d.value === 0)) return [];
  return data.sort((a, b) => b.value - a.value);
}

/**
 * AIDEV-NOTE: Compute global metrics from pre-fetched portfolios and items
 * Replaces portfolioService.getGlobalMetrics() which had N+1 queries
 */
function computeGlobalMetrics(
  portfolios: Portfolio[],
  itemsByPortfolio: Map<string, CustomItem[]>
): { totalBalance: number; monthlyProfit: number; monthlyVariation: number } {
  let currentTotal = 0;
  let lastMonthTotal = 0;

  const now = new Date();
  const lastMonthDate = new Date();
  lastMonthDate.setDate(now.getDate() - 30);
  lastMonthDate.setHours(23, 59, 59, 999);

  for (const p of portfolios) {
    const portfolioItems = itemsByPortfolio.get(p.id) || [];

    const portfolioValue = Number(p.value) || 0;
    const pTotal = portfolioItems.length > 0
      ? portfolioItems.reduce((acc, i) => acc + calculateCurrentValue(i), 0)
      : portfolioValue;
    currentTotal += pTotal;

    if (portfolioItems.length > 0) {
      const pLastMonth = getValueAtDate(portfolioItems, lastMonthDate);
      lastMonthTotal += pLastMonth;
    } else if (Number.isFinite(p.monthVar)) {
      const monthVar = Number(p.monthVar);
      const divisor = 1 + (monthVar / 100);
      lastMonthTotal += divisor > 0 ? (portfolioValue / divisor) : portfolioValue;
    } else {
      lastMonthTotal += portfolioValue;
    }
  }

  const profit = currentTotal - lastMonthTotal;
  const percentage = lastMonthTotal > 0 ? (profit / lastMonthTotal) * 100 : 0;

  return {
    totalBalance: currentTotal,
    monthlyProfit: profit,
    monthlyVariation: percentage
  };
}

export async function fetchDashboardBundle(
  _userId: string,
  monthKey: string
): Promise<DashboardBundle> {
  // AIDEV-NOTE: Optimized to reduce N+1 queries by fetching all data upfront
  // Before optimization: 300+ requests
  // After optimization: ~5 requests (portfolios, items, events, objectives, budget, expenses, incomes)

  // Phase 1: Fetch all data in parallel (bulk fetch - minimal network requests)
  const monthStart = new Date(`${monthKey}-01T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const [portfolios, allItems, objectives, budget, expenses, historyEvents, periodIncomes, monthDividends] =
    await Promise.all([
      repository.getAll(),           // 1 request
      repository.getAllItems(),      // 2 requests (items + transactions)
      planningService.getObjectives(),
      planningService.getBudget(monthKey),
      planningService.getExpenses(monthKey),
      repository.getAllHistoryEvents(), // AIDEV-PERF: Bulk fetch all events in 1 query
      planningService.getIncomes(monthKey),
      portfolioService.getUserDividends(null, { start: monthStart, end: monthEnd }).catch(() => []),
    ]);

  // Phase 2: Compute allocation and metrics in-memory (zero network requests)
  const itemsByPortfolio = groupItemsByPortfolio(allItems);
  const portfolioScores = computePortfolioScores(portfolios, itemsByPortfolio);
  const allocation = computeAllocationData(portfolios, itemsByPortfolio);
  const globalMetrics = computeGlobalMetrics(portfolios, itemsByPortfolio);

  // Merge Real Estate Income from Ledger into History Events (for KPI Cards)
  const syntheticIncomeEvents: PortfolioEvent[] = periodIncomes
    .filter(i => i.source === 'real_estate')
    .map(i => ({
      id: i.id,
      portfolioId: '',
      portfolioName: 'Imóveis (Planejado)',
      assetId: i.sourceRef || '',
      assetName: i.name,
      assetCategory: 'Aluguel de Imóveis',
      date: `${i.month}-01T12:00:00`,
      type: 'rent_income',
      quantity: 0,
      unitPrice: 0,
      totalValue: i.value,
      observation: 'Sincronizado do Planejamento',
      createdAt: i.createdAt
    }));

  const existingKeys = new Set(historyEvents.map(buildEventDedupKey));
  const syntheticDividendEvents: PortfolioEvent[] = (monthDividends || [])
    .filter((d: any) => {
      const amount = Number(d?.total_amount || 0);
      const status = String(d?.status || '').toLowerCase();
      const type = toPassiveIncomePortfolioEventType(d?.type);
      return !!type && type !== 'rent_income' && Number.isFinite(amount) && amount > 0 && status !== 'provisioned';
    })
    .map((d: any) => {
      const type = toPassiveIncomePortfolioEventType(d?.type) || 'dividend';
      const date = String(d?.payment_date || d?.approved_on || d?.date || '').slice(0, 10) || `${monthKey}-01`;
      return {
        id: d?.id ? `rpc-div-${d.id}` : crypto.randomUUID(),
        portfolioId: String(d?.portfolioId || ''),
        portfolioName: String(d?.portfolioName || ''),
        assetId: String(d?.asset_id || ''),
        assetName: String(d?.ticker || 'Provento'),
        assetCategory: '',
        date,
        type,
        quantity: Number(d?.quantity_held || 0),
        unitPrice: Number(d?.rate || 0),
        totalValue: Number(d?.total_amount || 0),
        observation: 'Provento (RPC)',
        createdAt: String(d?.created_at || `${date}T12:00:00`),
        eventStatus: 'received' as const
      };
    })
    .filter((evt) => {
      const fullKey = buildEventDedupKey(evt);
      if (existingKeys.has(fullKey)) return false;
      const relaxedKey = `${evt.type}|${String(evt.date || '').slice(0, 10)}|${Number(evt.totalValue || 0).toFixed(2)}`;
      const hasRelaxedMatch = historyEvents.some((existing) =>
        `${existing.type}|${String(existing.date || '').slice(0, 10)}|${Number(existing.totalValue || 0).toFixed(2)}` === relaxedKey
      );
      if (hasRelaxedMatch) return false;
      existingKeys.add(fullKey);
      return true;
    });

  const combinedHistoryEvents = [...historyEvents, ...syntheticIncomeEvents, ...syntheticDividendEvents];

  return {
    portfolios,
    portfolioScores,
    allocation,
    globalMetrics,
    objectives,
    budget,
    expenses,
    historyEvents: combinedHistoryEvents,
  };
}
