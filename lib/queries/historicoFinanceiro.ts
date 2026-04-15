/**
 * Histórico Financeiro Queries
 * 
 * Queries otimizadas para o gráfico Histórico Financeiro.
 * Faz UMA query por tabela usando ranges ao invés de N+1 queries.
 * 
 * AIDEV-NOTE: Performance crítica. Esta função substitui múltiplas queries
 * individuais por queries em batch usando ranges. Qualquer mudança deve manter
 * a performance < 2s para datasets típicos.
 */

import { getSupabaseClient } from '../../config/supabase';
import { env } from '../../config/env';
import { getRequiredUserId } from '../../config/supabaseAuth';
import type { Budget, Expense } from '../planningService';
import type { PortfolioEvent } from '../../types';
import { portfolioService } from '../portfolioService';
import { getAvailableYears, getWealthYearSeries, type WealthYearSeriesItem } from './wealthSnapshots';
import { buildRangeMonths, type TimeRange } from '../utils/monthRange';
import {
  PASSIVE_INCOME_EVENT_TYPES,
  toPassiveIncomePortfolioEventType,
} from '../utils/passiveIncome';

const INCOME_EVENT_TYPES: PortfolioEvent['type'][] = [...PASSIVE_INCOME_EVENT_TYPES];

// Tipos de dados do banco (snake_case)
interface DbBudget {
  id: string;
  user_id: string;
  month: string;
  salary: number;
  updated_at: string;
}

interface DbExpense {
  id: string;
  user_id: string;
  month: string;
  name: string;
  category: string;
  value: number;
  objective_id?: string;
  created_at: string;
}

interface DbPortfolioEvent {
  id: string;
  user_id: string;
  portfolio_id: string | null;
  portfolio_name: string | null;
  asset_id: string | null;
  asset_name: string | null;
  asset_category: string | null;
  date: string;
  type: string;
  quantity: number | null;
  unit_price: number | null;
  total_value: number;
  observation: string | null;
  created_at: string;
}

/**
 * Converte DbBudget para Budget (camelCase)
 */
function fromDbBudget(db: DbBudget): Budget {
  return {
    month: db.month,
    salary: db.salary,
    updatedAt: db.updated_at
  };
}

/**
 * Converte DbExpense para Expense (camelCase)
 */
function fromDbExpense(db: DbExpense): Expense {
  return {
    id: db.id,
    month: db.month,
    name: db.name,
    category: db.category,
    value: db.value,
    type: 'fixo', // Default to fixo for historical data if not specified
    objectiveId: db.objective_id || undefined,
    createdAt: db.created_at
  };
}

/**
 * Converte DbPortfolioEvent para PortfolioEvent (camelCase)
 */
function fromDbEvent(db: DbPortfolioEvent): PortfolioEvent {
  return {
    id: db.id,
    portfolioId: db.portfolio_id || '',
    portfolioName: db.portfolio_name || '',
    assetId: db.asset_id || '',
    assetName: db.asset_name || '',
    assetCategory: db.asset_category || '',
    date: db.date,
    type: db.type as PortfolioEvent['type'],
    quantity: db.quantity || 0,
    unitPrice: db.unit_price || 0,
    totalValue: Number(db.total_value || 0),
    observation: db.observation || undefined,
    createdAt: db.created_at
  };
}

export type HistoricoFinanceiroData = {
  budgets: Map<string, Budget>;
  expenses: Map<string, Expense[]>;
  incomeEvents: PortfolioEvent[];
  netWorthSnapshots: Map<string, WealthYearSeriesItem>;
};

function normalizeMonthKey(value: string | null | undefined): string {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  return raw.slice(0, 7); // supports YYYY-MM and YYYY-MM-DD
}

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
 * Busca dados otimizados para o gráfico Histórico Financeiro.
 * Faz UMA query por tabela usando ranges, executando todas em paralelo.
 * 
 * @param range TimeRange do gráfico ('3M' | '6M' | '1A' | 'ALL')
 * @returns Dados agregados em Maps para acesso O(1)
 */
export async function fetchHistoricoFinanceiroRange(
  range: TimeRange
): Promise<HistoricoFinanceiroData> {
  const supabase = getSupabaseClient();
  await getRequiredUserId();

  // Determine effective range dynamically if mode is 'ALL'
  let effectiveRange = range;
  let minYear = new Date().getFullYear();

  if (range === 'ALL') {
    const availableYears = await getAvailableYears();
    if (availableYears.length > 0) {
      minYear = Math.min(...availableYears);
    }
  }

  // Construir range de meses
  const { months, startMonth, endMonth, startDateIso, endDateIso } = buildRangeMonths(effectiveRange, undefined, minYear);

  // Instrumentação DEV-only
  if (env.isDevelopment) {
    console.time('histChart:fetch');
    console.log('[histChart] Range:', { range, monthsCount: months.length, startMonth, endMonth, minYear });
  }

  const yearsToFetch = Array.from(
    new Set(months.map((month) => Number(month.slice(0, 4))).filter((year) => Number.isFinite(year)))
  );

  // Executar todas as queries em paralelo
  const [budgetsResult, expensesResult, eventsResult, incomeLedgerResult, yearlySnapshots, dividendRows] = await Promise.all([
    // 1. Budgets: uma query com range de meses
    supabase
      .from('planning_budgets')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true }),

    // 2. Expenses: uma query com range de meses
    supabase
      .from('planning_expenses')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true })
      .order('created_at', { ascending: true }),

    // 3. Income Events: uma query com range de datas e tipos
    supabase
      .from('portfolio_events')
      .select('*')
      .gte('date', startDateIso.split('T')[0]) // Usar apenas data, sem hora
      .lte('date', endDateIso.split('T')[0])
      .in('type', INCOME_EVENT_TYPES)
      .order('date', { ascending: true }),

    // 4. Incomes Ledger: uma query com range de meses
    supabase
      .from('planning_income')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true }),

    // 5. Wealth snapshots (fonte legada de verdade para patrimônio mensal)
    Promise.all(
      yearsToFetch.map(async (year) => {
        try {
          return await getWealthYearSeries(year);
        } catch {
          return [] as WealthYearSeriesItem[];
        }
      })
    ),

    // 6. Dividends/JCP RPC (covers non-persisted market proventos)
    portfolioService.getUserDividends(null, {
      start: new Date(startDateIso),
      end: new Date(endDateIso)
    }).catch((error) => {
      console.error('Error fetching dividends/JCP RPC for histórico financeiro:', error);
      return [];
    })
  ]);

  // Verificar erros
  if (budgetsResult.error) {
    throw new Error(`Erro ao buscar budgets: ${budgetsResult.error.message}`);
  }
  if (expensesResult.error) {
    throw new Error(`Erro ao buscar expenses: ${expensesResult.error.message}`);
  }
  if (eventsResult.error) {
    throw new Error(`Erro ao buscar income events: ${eventsResult.error.message}`);
  }

  // Processar budgets em Map
  const budgets = new Map<string, Budget>();
  (budgetsResult.data || []).forEach((db: DbBudget) => {
    const monthKey = normalizeMonthKey(db.month);
    if (months.includes(monthKey)) {
      budgets.set(monthKey, fromDbBudget({ ...db, month: monthKey }));
    }
  });

  // Processar expenses em Map
  const expenses = new Map<string, Expense[]>();
  months.forEach(month => {
    expenses.set(month, []);
  });
  (expensesResult.data || []).forEach((db: DbExpense) => {
    const monthKey = normalizeMonthKey(db.month);
    if (months.includes(monthKey)) {
      const existing = expenses.get(monthKey) || [];
      expenses.set(monthKey, [...existing, fromDbExpense({ ...db, month: monthKey })]);
    }
  });

  // Processar income events (filtrar por meses do range)
  const allEvents = (eventsResult.data || []).map(fromDbEvent);

  // MERGE LOGIC: Combine Portfolio Income Events + Ledger Income
  // Ledger income items are converted to PortfolioEvent-like structure for standardized processing
  const ledgerIncomes = (incomeLedgerResult.data || []).map((db: any) => ({
    id: db.id,
    month: db.month,
    value: Number(db.value),
    name: db.name,
    category: db.category,
    source: db.source,
    createdAt: db.created_at
  }));

  const incomeEvents = allEvents.filter(event => {
    const eventDate = event.date.split('T')[0];
    return months.some(month => eventDate.startsWith(month));
  });

  const persistedKeys = new Set(incomeEvents.map(buildIncomeEventDedupKey));
  const rpcDividendEvents: PortfolioEvent[] = (dividendRows || [])
    .filter((d: any) => {
      const amount = Number(d?.total_amount || 0);
      const status = String(d?.status || '').toLowerCase();
      const eventType = toPassiveIncomePortfolioEventType(d?.type);
      return !!eventType && eventType !== 'rent_income' && Number.isFinite(amount) && amount > 0 && status !== 'provisioned';
    })
    .map((d: any) => {
      const eventType = toPassiveIncomePortfolioEventType(d?.type) || 'dividend';
      const date = String(d?.payment_date || d?.approved_on || d?.date || '').slice(0, 10);
      return {
        id: d?.id ? `rpc-div-${d.id}` : crypto.randomUUID(),
        portfolioId: String(d?.portfolioId || ''),
        portfolioName: String(d?.portfolioName || ''),
        assetId: String(d?.asset_id || ''),
        assetName: String(d?.ticker || 'Provento'),
        assetCategory: '',
        date: date || startDateIso.split('T')[0],
        type: eventType,
        quantity: Number(d?.quantity_held || 0),
        unitPrice: Number(d?.rate || 0),
        totalValue: Number(d?.total_amount || 0),
        observation: 'Provento (RPC)',
        createdAt: String(d?.created_at || `${date || startDateIso.split('T')[0]}T12:00:00`),
        eventStatus: 'received' as const
      };
    })
    .filter((evt) => {
      const monthKey = normalizeMonthKey(evt.date);
      if (!months.includes(monthKey)) return false;

      const fullKey = buildIncomeEventDedupKey(evt);
      if (persistedKeys.has(fullKey)) return false;

      const relaxedKey = `${evt.type}|${String(evt.date || '').slice(0, 10)}|${Number(evt.totalValue || 0).toFixed(2)}`;
      const hasRelaxedMatch = incomeEvents.some((existing) =>
        `${existing.type}|${String(existing.date || '').slice(0, 10)}|${Number(existing.totalValue || 0).toFixed(2)}` === relaxedKey
      );
      if (hasRelaxedMatch) return false;

      persistedKeys.add(fullKey);
      return true;
    });

  incomeEvents.push(...rpcDividendEvents);

  // Append ledger incomes to incomeEvents list as synthetic events
  // This allows calculateMonthlyResultsForRange to sum them up naturally
  ledgerIncomes.forEach((inc: any) => {
    const monthKey = normalizeMonthKey(inc.month);
    if (months.includes(monthKey)) {
      // Fake event structure for compatibility
      incomeEvents.push({
        id: inc.id,
        type: 'rent_income', // Treat as rent income for calculation
        date: `${monthKey}-01T12:00:00`, // Middle of day to avoid timezone shifting
        totalValue: inc.value,
        assetName: inc.name,
        assetCategory: inc.category,
        createdAt: inc.createdAt,
        // Mandated fields by PortfolioEvent type
        portfolioId: '',
        portfolioName: '',
        assetId: '',
        quantity: 0,
        unitPrice: 0,
        observation: `Receita sincronizada do Planejamento (${inc.source})`
      });
    }
  });

  const netWorthSnapshots = new Map<string, WealthYearSeriesItem>();
  for (const snapshot of yearlySnapshots.flat()) {
    const monthKey = normalizeMonthKey(snapshot?.month);
    if (!monthKey || !months.includes(monthKey)) continue;
    netWorthSnapshots.set(monthKey, {
      month: monthKey,
      total_value: Number(snapshot?.total_value || 0),
      is_final: Boolean(snapshot?.is_final),
      computed_at: String(snapshot?.computed_at || ''),
    });
  }

  // Instrumentação DEV-only
  if (env.isDevelopment) {
    console.timeEnd('histChart:fetch');
    console.log('[histChart] Fetch counts:', {
      budgetsRowsCount: budgets.size,
      expensesRowsCount: Array.from(expenses.values()).flat().length,
      eventsRowsCount: incomeEvents.length,
      snapshotsRowsCount: netWorthSnapshots.size
    });
  }

  return {
    budgets,
    expenses,
    incomeEvents,
    netWorthSnapshots
  };
}
