import { planningService } from '../planningService';
import { portfolioService } from '../portfolioService';
import type { Budget, Expense } from '../planningService';
import type { PortfolioEvent } from '../../types';
import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import {
  PASSIVE_INCOME_EVENT_TYPES,
  normalizePassiveIncomeEventType,
  toPassiveIncomePortfolioEventType,
} from '../utils/passiveIncome';

export type MonthData = {
  month: string; // 'YYYY-MM'
  salary: number;
  expensesTotal: number;
  passiveIncomeTotal: number;
  revenuesTotal: number;
  net: number;
};

export type ExpenseCategoryData = {
  category: string;
  total: number;
};

export type PassiveIncomeByType = {
  type: 'dividend' | 'jcp' | 'rent_income' | 'profit_distribution' | 'distribution';
  total: number;
  label: string;
};

const INCOME_EVENT_TYPES: PortfolioEvent['type'][] = [...PASSIVE_INCOME_EVENT_TYPES];

const INCOME_TYPE_LABELS: Record<PortfolioEvent['type'], string> = {
  dividend: 'Dividendos e Rendimentos',
  jcp: 'JCP',
  rent_income: 'Aluguel',
  profit_distribution: 'Distribuição de Lucros',
  buy: '',
  sell: '',
  create: '',
  delete: '',
  manual_update: '',
  adjustment: '',
  portfolio_create: '',
  portfolio_delete: '',
  rent_start: '',
  rent_end: '',
  profit_registered: '',
  profit_report: '',
  distribution: 'Distribuicao',
  capital_call: '',
  valuation_update: '',
};

function buildIncomeEventDedupKey(event: Pick<PortfolioEvent, 'type' | 'date' | 'totalValue' | 'assetId' | 'assetName'>): string {
  return [
    event.type,
    String(event.date || '').slice(0, 10),
    Number(event.totalValue || 0).toFixed(2),
    String(event.assetId || '').trim().toUpperCase(),
    String(event.assetName || '').trim().toUpperCase(),
  ].join('|');
}

/**
 * Fetch all budgets for a given year
 * Returns a Map with month keys ('YYYY-MM') and Budget values
 * 
 * AIDEV-NOTE: Otimizado para fazer UMA query ao invés de 12 queries individuais.
 */
export async function getYearBudgets(year: number): Promise<Map<string, Budget>> {
  const supabase = getSupabaseClient();
  await getRequiredUserId();

  // Generate all month keys for the year
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}`);
  }

  // Fetch all budgets for the year in a single query
  const { data, error } = await supabase
    .from('planning_budgets')
    .select('*')
    .in('month', months)
    .order('month', { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar budgets para o ano ${year}: ${error.message}`);
  }

  // Build map (initialize all months with empty budgets)
  const budgetsMap = new Map<string, Budget>();
  months.forEach(month => {
    budgetsMap.set(month, {
      month,
      salary: 0,
      updatedAt: new Date().toISOString()
    });
  });

  // Populate map with actual budgets
  (data || []).forEach((db: any) => {
    budgetsMap.set(db.month, {
      month: db.month,
      salary: db.salary,
      updatedAt: db.updated_at
    });
  });

  return budgetsMap;
}

/**
 * Fetch all expenses for a given year
 * Returns a Map with month keys ('YYYY-MM') and Expense[] values
 */
export async function getYearExpenses(year: number): Promise<Map<string, Expense[]>> {
  return planningService.getExpensesByYearRange(year);
}

/**
 * Fetch all income events (passive income) for a given year
 * Filters portfolio events by type and date range
 * 
 * AIDEV-NOTE: Otimizado para fazer query direta no Supabase ao invés de buscar
 * todos os eventos e filtrar depois.
 */
export async function getYearIncomeEvents(year: number): Promise<PortfolioEvent[]> {
  const supabase = getSupabaseClient();
  await getRequiredUserId();

  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999); // December 31st

  const startIso = startDate.toISOString().split('T')[0];
  const endIso = endDate.toISOString().split('T')[0];

  // 1. Fetch Portfolio Events + Planning Income Ledger
  // Generate YYYY-MM keys for the year to filter locally or use db filter if possible
  // Using string comparison for month "YYYY-MM"
  const startMonth = `${year}-01`;
  const endMonth = `${year}-12`;

  const [
    { data: eventsData, error: eventsError },
    { data: ledgerData, error: ledgerError }
  ] = await Promise.all([
    supabase
      .from('portfolio_events')
      .select('*')
      .gte('date', startIso)
      .lte('date', endIso)
      .in('type', INCOME_EVENT_TYPES)
      .order('date', { ascending: true }),
    supabase
      .from('planning_income')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true })
  ]);

  if (eventsError) {
    throw new Error(`Erro ao buscar income events para o ano ${year}: ${eventsError.message}`);
  }

  if (ledgerError && ledgerError.code !== '42P01') {
    console.error('Error fetching income ledger:', ledgerError);
  }

  // 3. Convert Portfolio Events
  const portfolioEvents = (eventsData || []).map((db: any) => ({
    id: db.id,
    portfolioId: db.portfolio_id || undefined,
    portfolioName: db.portfolio_name || undefined,
    assetId: db.asset_id || undefined,
    assetName: db.asset_name || undefined,
    assetCategory: db.asset_category || undefined,
    date: db.date,
    type: db.type as PortfolioEvent['type'],
    quantity: db.quantity || 0,
    unitPrice: db.unit_price || 0,
    totalValue: Number(db.total_value || 0),
    observation: db.observation || undefined,
    createdAt: db.created_at
  }));

  // 4. Convert & Merge Ledger Income (as synthetic rent_income events)
  const ledgerEvents = (ledgerData || []).map((db: any) => ({
    id: db.id,
    portfolioId: '',
    portfolioName: '',
    assetId: '',
    assetName: db.name,
    assetCategory: db.category,
    date: `${db.month}-01T12:00:00`, // Middle of day to avoid timezone shifting
    type: 'rent_income' as const, // Treat as rent
    quantity: 0,
    unitPrice: 0,
    totalValue: Number(db.value),
    observation: `Receita sincronizada (${db.source})`,
    createdAt: db.created_at
  }));

  // 5. Merge dividends/JCP from RPC (covers non-persisted market proventos)
  let dividendRpcEvents: PortfolioEvent[] = [];
  try {
    const dividends = await portfolioService.getUserDividends(null, { start: startDate, end: endDate });
    dividendRpcEvents = (dividends || [])
      .filter((d: any) => {
        const amount = Number(d?.total_amount || 0);
        const status = String(d?.status || '').toLowerCase();
        const eventType = toPassiveIncomePortfolioEventType(d?.type);
        return !!eventType && eventType !== 'rent_income' && Number.isFinite(amount) && amount > 0 && status !== 'provisioned';
      })
      .map((d: any) => {
        const amount = Number(d?.total_amount || 0);
        const eventType = toPassiveIncomePortfolioEventType(d?.type) || 'dividend';
        const date = String(d?.payment_date || d?.approved_on || d?.date || '').slice(0, 10);
        return {
          id: d?.id ? `rpc-div-${d.id}` : crypto.randomUUID(),
          portfolioId: String(d?.portfolioId || ''),
          portfolioName: String(d?.portfolioName || ''),
          assetId: String(d?.asset_id || ''),
          assetName: String(d?.ticker || 'Provento'),
          assetCategory: '',
          date: date || `${year}-01-01`,
          createdAt: String(d?.created_at || `${date || `${year}-01-01`}T12:00:00`),
          type: eventType,
          quantity: Number(d?.quantity_held || 0),
          unitPrice: Number(d?.rate || 0),
          totalValue: amount,
          observation: 'Provento (RPC)',
          eventStatus: 'received' as const
        };
      });
  } catch (error) {
    console.error('Error fetching dividends/JCP RPC for KPI drilldown:', error);
  }

  const persistedKeys = new Set(portfolioEvents.map(buildIncomeEventDedupKey));
  const uniqueDividendRpcEvents = dividendRpcEvents.filter((event) => {
    const fullKey = buildIncomeEventDedupKey(event);
    if (persistedKeys.has(fullKey)) return false;

    const relaxedKey = `${event.type}|${String(event.date || '').slice(0, 10)}|${Number(event.totalValue || 0).toFixed(2)}`;
    const hasRelaxedMatch = portfolioEvents.some((existing) =>
      `${existing.type}|${String(existing.date || '').slice(0, 10)}|${Number(existing.totalValue || 0).toFixed(2)}` === relaxedKey
    );
    if (hasRelaxedMatch) return false;

    persistedKeys.add(fullKey);
    return true;
  });

  // Merged and sorted by date
  return [...portfolioEvents, ...uniqueDividendRpcEvents, ...ledgerEvents].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Aggregate month data from budgets, expenses, and income events
 */
export function aggregateMonthData(
  year: number,
  budgets: Map<string, Budget>,
  expenses: Map<string, Expense[]>,
  incomeEvents: PortfolioEvent[]
): MonthData[] {
  const months: string[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}`);
  }

  return months.map(month => {
    const budget = budgets.get(month);
    const salary = budget?.salary || 0;

    const monthExpenses = expenses.get(month) || [];
    const expensesTotal = monthExpenses.reduce((sum, exp) => sum + exp.value, 0);

    // Filter income events for this month
    const monthIncomeEvents = incomeEvents.filter(event => {
      const eventDate = event.date.split('T')[0];
      return eventDate.startsWith(month);
    });

    const passiveIncomeTotal = monthIncomeEvents.reduce((sum, event) => sum + Number(event.totalValue || 0), 0);
    const revenuesTotal = salary + passiveIncomeTotal;
    const net = revenuesTotal - expensesTotal;

    return {
      month,
      salary,
      expensesTotal,
      passiveIncomeTotal,
      revenuesTotal,
      net,
    };
  });
}

/**
 * Aggregate expenses by category for a specific month
 */
export function aggregateExpensesByCategory(expenses: Expense[]): ExpenseCategoryData[] {
  const categoryMap = new Map<string, number>();

  expenses.forEach(expense => {
    const current = categoryMap.get(expense.category) || 0;
    categoryMap.set(expense.category, current + expense.value);
  });

  return Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Aggregate passive income by type for a specific month
 */
export function aggregatePassiveIncomeByType(incomeEvents: PortfolioEvent[]): PassiveIncomeByType[] {
  const typeMap = new Map<PassiveIncomeByType['type'], number>();

  incomeEvents.forEach(event => {
    const normalizedType = normalizePassiveIncomeEventType(event.type);
    if (!normalizedType) return;

    const current = typeMap.get(normalizedType) || 0;
    typeMap.set(normalizedType, current + Number(event.totalValue || 0));
  });

  return Array.from(typeMap.entries())
    .map(([type, total]) => ({
      type: type as PassiveIncomeByType['type'],
      total,
      label: INCOME_TYPE_LABELS[type] || type,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Calcula resultados mensais para um range de meses específico.
 * Reutiliza lógica de aggregateMonthData mas para range customizado.
 * 
 * @param monthKeys Array de month keys no formato 'YYYY-MM'
 * @param budgets Map de budgets por mês
 * @param expenses Map de expenses por mês
 * @param incomeEvents Array de eventos de renda passiva
 * @returns Map de monthKey -> { salary, expensesTotal, passiveIncomeTotal, revenuesTotal, net }
 */
export function calculateMonthlyResultsForRange(
  monthKeys: string[],
  budgets: Map<string, Budget>,
  expenses: Map<string, Expense[]>,
  incomeEvents: PortfolioEvent[]
): Map<string, { salary: number; expensesTotal: number; passiveIncomeTotal: number; revenuesTotal: number; net: number }> {
  const resultsMap = new Map<string, { salary: number; expensesTotal: number; passiveIncomeTotal: number; revenuesTotal: number; net: number }>();

  monthKeys.forEach(month => {
    const budget = budgets.get(month);
    const salary = budget?.salary || 0;

    const monthExpenses = expenses.get(month) || [];
    const expensesTotal = monthExpenses.reduce((sum, exp) => sum + exp.value, 0);

    // Filter income events for this month
    const monthIncomeEvents = incomeEvents.filter(event => {
      const eventDate = event.date.split('T')[0];
      return eventDate.startsWith(month);
    });

    const passiveIncomeTotal = monthIncomeEvents.reduce((sum, event) => sum + Number(event.totalValue || 0), 0);
    const revenuesTotal = salary + passiveIncomeTotal;
    const net = revenuesTotal - expensesTotal;

    resultsMap.set(month, {
      salary,
      expensesTotal,
      passiveIncomeTotal,
      revenuesTotal,
      net
    });
  });

  return resultsMap;
}

/**
 * Busca budgets, expenses e income events para um range de meses.
 * Otimizado: busca dados de todos os anos necessários de uma vez.
 * 
 * @param monthKeys Array de month keys no formato 'YYYY-MM'
 * @returns Promise com { budgets, expenses, incomeEvents }
 */
export async function fetchDataForMonthRange(monthKeys: string[]): Promise<{
  budgets: Map<string, Budget>;
  expenses: Map<string, Expense[]>;
  incomeEvents: PortfolioEvent[];
}> {
  if (monthKeys.length === 0) {
    return {
      budgets: new Map(),
      expenses: new Map(),
      incomeEvents: []
    };
  }

  // Determinar anos únicos necessários
  const years = new Set<number>();
  monthKeys.forEach(month => {
    const year = parseInt(month.split('-')[0]);
    years.add(year);
  });

  // Buscar dados de todos os anos necessários em paralelo
  const [budgetsMaps, expensesMaps, incomeEventsArrays] = await Promise.all([
    Promise.all(Array.from(years).map(year => getYearBudgets(year))),
    Promise.all(Array.from(years).map(year => getYearExpenses(year))),
    Promise.all(Array.from(years).map(year => getYearIncomeEvents(year)))
  ]);

  // Consolidar budgets
  const budgets = new Map<string, Budget>();
  budgetsMaps.forEach(map => {
    map.forEach((budget, month) => {
      if (monthKeys.includes(month)) {
        budgets.set(month, budget);
      }
    });
  });

  // Consolidar expenses
  const expenses = new Map<string, Expense[]>();
  expensesMaps.forEach(map => {
    map.forEach((expenseArray, month) => {
      if (monthKeys.includes(month)) {
        expenses.set(month, expenseArray);
      }
    });
  });

  // Consolidar income events (filtrar por meses do range)
  const allIncomeEvents = incomeEventsArrays.flat();
  const filteredIncomeEvents = allIncomeEvents.filter(event => {
    const eventDate = event.date.split('T')[0];
    return monthKeys.some(month => eventDate.startsWith(month));
  });

  return {
    budgets,
    expenses,
    incomeEvents: filteredIncomeEvents
  };
}
