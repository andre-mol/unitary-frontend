const PORTFOLIO_ID = 'demo-portfolio-001';
const PORTFOLIO_ID_2 = 'demo-portfolio-002';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function generateEvolutionSeries(startValue: number, months: number, monthlyGrowth: number): { date: string; value: number }[] {
  const series: { date: string; value: number }[] = [];
  let value = startValue;
  const now = new Date();
  for (let i = months; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const noise = 1 + (Math.sin(i * 0.7) * 0.015);
    value = value * (1 + monthlyGrowth) * noise;
    series.push({
      date: dateStr(d.getFullYear(), d.getMonth() + 1, 15),
      value: Math.round(value * 100) / 100,
    });
  }
  return series;
}

function generateDailyPerformance(months: number): { date: string; return_total: number; return_price: number }[] {
  const series: { date: string; return_total: number; return_price: number }[] = [];
  const now = new Date();
  let cumTotal = 0;
  let cumPrice = 0;
  for (let i = months * 22; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dailyReturn = (Math.random() - 0.48) * 0.008;
    const dailyPrice = dailyReturn * 0.85;
    cumTotal += dailyReturn;
    cumPrice += dailyPrice;
    series.push({
      date: dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      return_total: Math.round(cumTotal * 10000) / 10000,
      return_price: Math.round(cumPrice * 10000) / 10000,
    });
  }
  return series;
}

const GLOBAL_EVOLUTION = generateEvolutionSeries(95000, 18, 0.018);
const PORTFOLIO_1_EVOLUTION = generateEvolutionSeries(75000, 18, 0.02);
const PORTFOLIO_2_EVOLUTION = generateEvolutionSeries(20000, 12, 0.009);
const DAILY_PERFORMANCE = generateDailyPerformance(6);

const DIVIDEND_DATA = [
  { id: 'div-001', asset_id: 'HGLG11', ticker: 'HGLG11', payment_date: dateStr(currentYear, currentMonth, 15), total_amount: 85, type: 'Dividendo', status: 'received', rate: 0.85, quantity_held: 100, approved_on: dateStr(currentYear, currentMonth, 5) },
  { id: 'div-002', asset_id: 'XPLG11', ticker: 'XPLG11', payment_date: dateStr(currentYear, currentMonth, 15), total_amount: 96, type: 'Dividendo', status: 'received', rate: 0.80, quantity_held: 120, approved_on: dateStr(currentYear, currentMonth, 5) },
  { id: 'div-003', asset_id: 'ITUB4', ticker: 'ITUB4', payment_date: dateStr(currentYear, currentMonth, 1), total_amount: 52.5, type: 'JCP', status: 'received', rate: 0.15, quantity_held: 350, approved_on: dateStr(currentYear, currentMonth - 1 || 12, 20) },
  { id: 'div-004', asset_id: 'PETR4', ticker: 'PETR4', payment_date: dateStr(currentYear, currentMonth, 10), total_amount: 375, type: 'Dividendo', status: 'received', rate: 0.75, quantity_held: 500, approved_on: dateStr(currentYear, currentMonth, 1) },
  { id: 'div-005', asset_id: 'HGLG11', ticker: 'HGLG11', payment_date: dateStr(currentYear, Math.max(currentMonth - 1, 1), 15), total_amount: 82, type: 'Dividendo', status: 'received', rate: 0.82, quantity_held: 100, approved_on: dateStr(currentYear, Math.max(currentMonth - 1, 1), 5) },
  { id: 'div-006', asset_id: 'XPLG11', ticker: 'XPLG11', payment_date: dateStr(currentYear, Math.max(currentMonth - 1, 1), 15), total_amount: 93.6, type: 'Dividendo', status: 'received', rate: 0.78, quantity_held: 120, approved_on: dateStr(currentYear, Math.max(currentMonth - 1, 1), 5) },
  { id: 'div-007', asset_id: 'PETR4', ticker: 'PETR4', payment_date: dateStr(currentYear, Math.max(currentMonth - 1, 1), 10), total_amount: 350, type: 'Dividendo', status: 'received', rate: 0.70, quantity_held: 500, approved_on: dateStr(currentYear, Math.max(currentMonth - 1, 1), 1) },
  { id: 'div-008', asset_id: 'ITUB4', ticker: 'ITUB4', payment_date: dateStr(currentYear, Math.max(currentMonth - 2, 1), 1), total_amount: 49, type: 'JCP', status: 'received', rate: 0.14, quantity_held: 350, approved_on: dateStr(currentYear, Math.max(currentMonth - 3, 1), 20) },
  { id: 'div-009', asset_id: 'VALE3', ticker: 'VALE3', payment_date: dateStr(currentYear, Math.max(currentMonth - 2, 1), 20), total_amount: 180, type: 'Dividendo', status: 'received', rate: 0.90, quantity_held: 200, approved_on: dateStr(currentYear, Math.max(currentMonth - 2, 1), 10) },
  { id: 'div-010', asset_id: 'HGLG11', ticker: 'HGLG11', payment_date: dateStr(currentYear, Math.max(currentMonth - 2, 1), 15), total_amount: 80, type: 'Dividendo', status: 'received', rate: 0.80, quantity_held: 100, approved_on: dateStr(currentYear, Math.max(currentMonth - 2, 1), 5) },
  { id: 'div-011', asset_id: 'XPLG11', ticker: 'XPLG11', payment_date: dateStr(currentYear, Math.max(currentMonth - 2, 1), 15), total_amount: 90, type: 'Dividendo', status: 'received', rate: 0.75, quantity_held: 120, approved_on: dateStr(currentYear, Math.max(currentMonth - 2, 1), 5) },
  { id: 'div-012', asset_id: 'PETR4', ticker: 'PETR4', payment_date: dateStr(currentYear, Math.max(currentMonth - 3, 1), 10), total_amount: 400, type: 'Dividendo', status: 'received', rate: 0.80, quantity_held: 500, approved_on: dateStr(currentYear, Math.max(currentMonth - 3, 1), 1) },
];

function generateWealthYearSeries(year: number): { month: string; total_value: number; is_final: boolean; computed_at: string }[] {
  const series: any[] = [];
  const maxMonth = year === currentYear ? currentMonth : 12;
  let base = year === currentYear ? 130000 : 95000;
  for (let m = 1; m <= maxMonth; m++) {
    const growth = 1 + (Math.sin(m * 0.5) * 0.01 + 0.015);
    base = Math.round(base * growth);
    series.push({
      month: monthKey(year, m),
      total_value: base,
      is_final: m < currentMonth || year < currentYear,
      computed_at: new Date().toISOString(),
    });
  }
  return series;
}

function generateTimelineBuckets(year: number): any[] {
  const buckets: any[] = [];
  const maxMonth = year === currentYear ? currentMonth : 12;
  let patrimonyStart = year === currentYear ? 130000 : 95000;
  for (let m = 1; m <= maxMonth; m++) {
    const income = 8500;
    const expense = 4800 + Math.round(Math.random() * 600);
    const contribution = 2500 + Math.round(Math.random() * 500);
    const valuation = Math.round(patrimonyStart * 0.015 * (Math.sin(m) * 0.5 + 1));
    const patrimonyEnd = patrimonyStart + contribution + valuation + income - expense;
    buckets.push({
      month: m,
      patrimony_start: Math.round(patrimonyStart),
      patrimony_end: Math.round(patrimonyEnd),
      cashflow_income_realized: income,
      cashflow_expense_realized: expense,
      contributions_realized: contribution,
      withdrawals_realized: 0,
      income_projected: m > currentMonth - 1 ? income : 0,
      expense_projected: m > currentMonth - 1 ? 5000 : 0,
      contributions_projected: m > currentMonth - 1 ? 2500 : 0,
      withdrawals_projected: 0,
      patrimony_valuation: valuation,
      economic_result_realized: income - expense + valuation,
      residual_diff: 0,
      flags: {
        has_snapshot: true,
        is_projected: m > currentMonth,
        no_data: false,
      },
    });
    patrimonyStart = patrimonyEnd;
  }
  return buckets;
}

function generateTimelineEvents(year: number): any[] {
  const events: any[] = [];
  const maxMonth = year === currentYear ? currentMonth : 12;
  const tickers = ['PETR4', 'VALE3', 'ITUB4', 'HGLG11', 'XPLG11'];
  const categories = ['Ações', 'Ações', 'Ações', 'FIIs', 'FIIs'];
  let evId = 1;

  for (let m = 1; m <= maxMonth; m++) {
    events.push({
      id: `tl-salary-${year}-${m}`,
      date: dateStr(year, m, 5),
      type: 'income',
      title: 'Salário',
      amount: 8500,
      status: 'realized',
      portfolio_id: null,
      metadata: { source: 'planning', category: 'Salário', canonical_nature: 'income' },
    });

    const expenseAmt = 4800 + Math.round(Math.random() * 600);
    events.push({
      id: `tl-expense-${year}-${m}`,
      date: dateStr(year, m, 10),
      type: 'expense',
      title: 'Despesas do mês',
      amount: expenseAmt,
      status: 'realized',
      portfolio_id: null,
      metadata: { source: 'planning', category: 'Despesas', canonical_nature: 'expense' },
    });

    const idx = (m - 1) % tickers.length;
    const buyAmt = 2000 + Math.round(Math.random() * 1000);
    events.push({
      id: `tl-buy-${year}-${m}-${evId++}`,
      date: dateStr(year, m, 15),
      type: 'buy',
      title: `Compra ${tickers[idx]}`,
      amount: buyAmt,
      status: 'realized',
      portfolio_id: PORTFOLIO_ID,
      metadata: { item_name: tickers[idx], category: categories[idx], canonical_nature: 'contribution', source: 'portfolio_events' },
    });

    if (m % 1 === 0) {
      const divAmt = 150 + Math.round(Math.random() * 200);
      events.push({
        id: `tl-div-${year}-${m}-${evId++}`,
        date: dateStr(year, m, 20),
        type: 'dividend',
        title: `Dividendo ${tickers[(m + 2) % tickers.length]}`,
        amount: divAmt,
        status: 'realized',
        portfolio_id: PORTFOLIO_ID,
        metadata: { item_name: tickers[(m + 2) % tickers.length], category: categories[(m + 2) % tickers.length], canonical_nature: 'passive_income', source: 'dividends' },
      });
    }
  }

  return events;
}

function generateBenchmarkSeries(): any[] {
  const series: any[] = [];
  const now = new Date();
  for (let i = 180; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const t = (180 - i) / 180;
    series.push({
      date: dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      cdi: Math.round(t * 0.065 * 10000) / 10000,
      ipca: Math.round(t * 0.045 * 10000) / 10000,
      ibov: Math.round((t * 0.12 + Math.sin(i * 0.05) * 0.03) * 10000) / 10000,
      ifix: Math.round((t * 0.08 + Math.sin(i * 0.04) * 0.02) * 10000) / 10000,
    });
  }
  return series;
}

export function getRpcMockData(): Record<string, any> {
  return {
    patrio_is_admin: false,
    patrio_admin_get_settings: {},
    patrio_get_timeline_monthly: generateTimelineBuckets(currentYear),
    patrio_get_timeline_events: generateTimelineEvents(currentYear),
    get_user_dividends: DIVIDEND_DATA,
    patrio_get_wealth_year_series: generateWealthYearSeries(currentYear),
    patrio_get_wealth_month_breakdown: {
      month: monthKey(currentYear, currentMonth),
      snapshot_exists: true,
      categories: [
        { category: 'Ações', total: 44200 },
        { category: 'FIIs', total: 30150 },
        { category: 'Renda Fixa', total: 62500 },
        { category: 'Caixa', total: 6000 },
      ],
      portfolios: [
        { portfolio_id: PORTFOLIO_ID, total: 142850 },
        { portfolio_id: PORTFOLIO_ID_2, total: 32000 },
      ],
      top_items: [],
    },
    patrio_get_available_years: [{ year: currentYear }, { year: currentYear - 1 }],
    get_portfolio_market_history: PORTFOLIO_1_EVOLUTION,
    get_global_portfolio_history: GLOBAL_EVOLUTION,
    get_portfolio_performance_daily: DAILY_PERFORMANCE,
    get_portfolio_performance_monthly: DAILY_PERFORMANCE.filter((_, i) => i % 22 === 0),
    calculate_reinvested_return: { reinvested_return: 0.187, total_dividends: 1832.1 },
    consolidate_user_portfolios: null,
    patrio_upsert_wealth_monthly_snapshot: null,
    patrio_self_heal_wealth_zero_snapshots: [],
    patrio_backfill_history: { processed_months: 12, last_month_updated: monthKey(currentYear, currentMonth) },
  };
}

export function getTableMockData(): Record<string, any[]> {
  return {
    profiles: [{
      id: 'demo-user-00000000-0000-0000-0000-000000000001',
      full_name: 'André (Demo)',
      phone: null,
      avatar_url: null,
      role: null,
    }],
    user_settings: [{
      user_id: 'demo-user-00000000-0000-0000-0000-000000000001',
      theme: 'system',
      notifications_email: true,
      product_updates_opt_in: true,
      marketing_emails_opt_in: false,
      terms_accepted_at: '2024-01-15T10:00:00.000Z',
      terms_version: '1.0',
      privacy_version: '1.0',
      communications_version: '1.0',
    }],
    user_subscriptions: [{
      user_id: 'demo-user-00000000-0000-0000-0000-000000000001',
      plan: 'patrio_pro',
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
    }],
    user_system_notifications: [],
    bug_reports: [],
    market_quotes: [],
    support_tickets: [],
    support_messages: [],
    broadcast_notifications: [],
    portfolio_performance_rollup: [{ date: dateStr(currentYear - 1, 1, 15) }],
    portfolio_events: [{ date: dateStr(currentYear - 1, 1, 15) }],
    benchmark_cumulative_series: generateBenchmarkSeries(),
  };
}
