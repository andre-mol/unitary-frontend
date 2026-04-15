export const queryKeys = {
  me: (userId: string | null | undefined) => ['me', userId ?? 'anon'] as const,
  role: (userId: string | null | undefined) => ['role', userId ?? 'anon'] as const,
  plan: (userId: string | null | undefined) => ['plan', userId ?? 'anon'] as const,
  subscription: (userId: string | null | undefined) => ['subscription', userId ?? 'anon'] as const,
  userSettings: (userId: string | null | undefined) => ['userSettings', userId ?? 'anon'] as const,
  portfolios: (userId: string | null | undefined) => ['portfolios', userId ?? 'anon'] as const,
  portfolio: (portfolioId: string | null | undefined) => ['portfolio', portfolioId ?? 'unknown'] as const,
  categories: (userId: string | null | undefined, portfolioId?: string | null) =>
    ['categories', userId ?? 'anon', portfolioId ?? 'all'] as const,
  items: (portfolioId: string | null | undefined) => ['items', portfolioId ?? 'unknown'] as const,
  events: (userId: string | null | undefined, filters?: string | number | null) =>
    ['events', userId ?? 'anon', filters ?? 'all'] as const,
  goals: (userId: string | null | undefined) => ['goals', userId ?? 'anon'] as const,
  objectives: (userId: string | null | undefined) => ['objectives', userId ?? 'anon'] as const,
  budget: (userId: string | null | undefined, month: string | null | undefined) =>
    ['budget', userId ?? 'anon', month ?? 'current'] as const,
  expenses: (userId: string | null | undefined, month: string | null | undefined) =>
    ['expenses', userId ?? 'anon', month ?? 'current'] as const,
  expensesByYear: (userId: string | null | undefined, year: number | null | undefined) =>
    ['expensesByYear', userId ?? 'anon', year ?? new Date().getFullYear()] as const,
  allocation: (userId: string | null | undefined) => ['allocation', userId ?? 'anon'] as const,
  globalMetrics: (userId: string | null | undefined) => ['globalMetrics', userId ?? 'anon'] as const,
  dashboard: (
    userId: string | null | undefined,
    range: string | null | undefined,
    monthKey: string | null | undefined
  ) => ['dashboard', userId ?? 'anon', range ?? '6M', monthKey ?? 'current'] as const,
  evolution: (
    userId: string | null | undefined,
    portfolioId: string | null | undefined,
    range: string | null | undefined
  ) => ['evolution', userId ?? 'anon', portfolioId ?? 'global', range ?? '6M'] as const,
  search: (userId: string | null | undefined, term: string | null | undefined) =>
    ['search', userId ?? 'anon', term ?? ''] as const,
  notifications: (userId: string | null | undefined, limit?: number) =>
    ['notifications', userId ?? 'anon', limit ?? 20] as const,
  notificationBySlug: (slug: string) => ['notification', slug] as const,
  kpiDrilldown: (userId: string | null | undefined, year: number, kpi: string) =>
    ['kpiDrilldown', userId ?? 'anon', year, kpi] as const,
  wealthYearSeries: (year: number) => ['wealth-year-series', year] as const,
  wealthBreakdown: (month: string) => ['wealth-breakdown', month] as const,
  availableYears: () => ['available-years'] as const,
} as const;
