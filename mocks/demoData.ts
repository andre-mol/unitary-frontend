import type { Portfolio, CustomItem, PortfolioEvent } from '../types';
import type { Goal, Budget, Expense } from '../domain/repositories/PlanningRepository';

const PORTFOLIO_ID = 'demo-portfolio-001';
const PORTFOLIO_ID_2 = 'demo-portfolio-002';

const now = new Date();
const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

function makeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const PORTFOLIOS: Portfolio[] = [
  {
    id: PORTFOLIO_ID,
    name: 'Carteira Principal',
    type: 'investments',
    value: 142850,
    monthVar: 2.3,
    yearVar: 14.7,
    currency: 'BRL',
    createdAt: '2024-01-15T10:00:00.000Z',
    lastAccessedAt: makeDate(0),
    objective: 'growth',
    timeHorizon: 'long',
    userConvictionScore: 8,
    criteria: [
      'O ativo possui liquidez adequada?',
      'Entendo como este ativo gera valor?',
      'O risco é compatível com meu perfil?',
      'Paga dividendos constantes?',
      'Governança confiável?',
    ],
    categoryTargets: {
      'Ações': 40,
      'FIIs': 25,
      'Renda Fixa': 30,
      'Caixa': 5,
    },
  },
  {
    id: PORTFOLIO_ID_2,
    name: 'Reserva de Emergência',
    type: 'investments',
    value: 32000,
    monthVar: 0.9,
    yearVar: 11.2,
    currency: 'BRL',
    createdAt: '2024-03-01T10:00:00.000Z',
    lastAccessedAt: makeDate(2),
    objective: 'protection',
    timeHorizon: 'short',
    userConvictionScore: 9,
    criteria: ['Liquidez imediata?', 'Risco mínimo?', 'Rendimento acima da inflação?'],
    categoryTargets: { 'Renda Fixa': 70, 'Caixa': 30 },
  },
];

const ITEMS_PORTFOLIO_1: CustomItem[] = [
  {
    id: 'item-001', name: 'PETR4', category: 'Ações', currency: 'BRL',
    initialValue: 12000, initialDate: '2024-02-10', value: 18500, updatedAt: makeDate(1),
    valuationMethod: { type: 'automatic' }, history: [], metadata: { liquidity: 'Alta', risk: 3, confidence: 'Alta' },
    customFields: {}, market_asset_id: 'PETR4', quantity: 500, tags: ['Petróleo', 'Dividendos'],
    transactions: [
      { id: 'tx-001', type: 'buy', date: '2024-02-10', quantity: 300, unitPrice: 40, totalValue: 12000, createdAt: '2024-02-10T10:00:00Z' },
      { id: 'tx-002', type: 'buy', date: '2024-06-15', quantity: 200, unitPrice: 38.5, totalValue: 7700, createdAt: '2024-06-15T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, true, true],
  },
  {
    id: 'item-002', name: 'VALE3', category: 'Ações', currency: 'BRL',
    initialValue: 10000, initialDate: '2024-03-05', value: 14200, updatedAt: makeDate(1),
    valuationMethod: { type: 'automatic' }, history: [], metadata: { liquidity: 'Alta', risk: 3, confidence: 'Média' },
    customFields: {}, market_asset_id: 'VALE3', quantity: 200, tags: ['Mineração'],
    transactions: [
      { id: 'tx-003', type: 'buy', date: '2024-03-05', quantity: 200, unitPrice: 50, totalValue: 10000, createdAt: '2024-03-05T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, true, false],
  },
  {
    id: 'item-003', name: 'ITUB4', category: 'Ações', currency: 'BRL',
    initialValue: 8000, initialDate: '2024-01-20', value: 11500, updatedAt: makeDate(1),
    valuationMethod: { type: 'automatic' }, history: [], metadata: { liquidity: 'Alta', risk: 2, confidence: 'Alta' },
    customFields: {}, market_asset_id: 'ITUB4', quantity: 350, tags: ['Bancário', 'Dividendos'],
    transactions: [
      { id: 'tx-004', type: 'buy', date: '2024-01-20', quantity: 350, unitPrice: 22.86, totalValue: 8000, createdAt: '2024-01-20T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, true, true],
  },
  {
    id: 'item-004', name: 'HGLG11', category: 'FIIs', currency: 'BRL',
    initialValue: 15000, initialDate: '2024-02-01', value: 16800, updatedAt: makeDate(1),
    valuationMethod: { type: 'automatic' }, history: [], metadata: { liquidity: 'Alta', risk: 2, confidence: 'Alta' },
    customFields: {}, market_asset_id: 'HGLG11', quantity: 100, tags: ['Logística', 'FII'],
    transactions: [
      { id: 'tx-005', type: 'buy', date: '2024-02-01', quantity: 100, unitPrice: 150, totalValue: 15000, createdAt: '2024-02-01T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, true, true],
  },
  {
    id: 'item-005', name: 'XPLG11', category: 'FIIs', currency: 'BRL',
    initialValue: 12000, initialDate: '2024-04-10', value: 13350, updatedAt: makeDate(1),
    valuationMethod: { type: 'automatic' }, history: [], metadata: { liquidity: 'Alta', risk: 2, confidence: 'Média' },
    customFields: {}, market_asset_id: 'XPLG11', quantity: 120, tags: ['Logística', 'FII'],
    transactions: [
      { id: 'tx-006', type: 'buy', date: '2024-04-10', quantity: 120, unitPrice: 100, totalValue: 12000, createdAt: '2024-04-10T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, true, false],
  },
  {
    id: 'item-006', name: 'CDB 120% CDI', category: 'Renda Fixa', currency: 'BRL',
    initialValue: 30000, initialDate: '2024-01-15', value: 34500, updatedAt: makeDate(0),
    valuationMethod: { type: 'periodic', periodicRate: 12.5, periodicFrequency: 'yearly', growthMode: 'indexed', indexBenchmark: 'CDI' },
    history: [
      { date: '2024-01-15', value: 30000, type: 'initial' },
      { date: '2024-07-15', value: 31800, type: 'automatic' },
      { date: '2025-01-15', value: 33600, type: 'automatic' },
      { date: makeDate(0).split('T')[0], value: 34500, type: 'automatic' },
    ],
    metadata: { liquidity: 'Média', risk: 1, confidence: 'Alta' },
    customFields: {}, tags: ['Renda Fixa', 'CDI'],
    transactions: [
      { id: 'tx-007', type: 'buy', date: '2024-01-15', quantity: 1, unitPrice: 30000, totalValue: 30000, createdAt: '2024-01-15T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, false, true],
  },
  {
    id: 'item-007', name: 'Tesouro IPCA+ 2035', category: 'Renda Fixa', currency: 'BRL',
    initialValue: 25000, initialDate: '2024-05-20', value: 28000, updatedAt: makeDate(0),
    valuationMethod: { type: 'periodic', periodicRate: 6.5, periodicFrequency: 'yearly', growthMode: 'indexed', indexBenchmark: 'IPCA' },
    history: [
      { date: '2024-05-20', value: 25000, type: 'initial' },
      { date: '2025-01-20', value: 27000, type: 'automatic' },
      { date: makeDate(0).split('T')[0], value: 28000, type: 'automatic' },
    ],
    metadata: { liquidity: 'Baixa', risk: 1, confidence: 'Alta' },
    customFields: {}, tags: ['Tesouro Direto', 'IPCA'],
    transactions: [
      { id: 'tx-008', type: 'buy', date: '2024-05-20', quantity: 1, unitPrice: 25000, totalValue: 25000, createdAt: '2024-05-20T10:00:00Z' },
    ],
    criteriaAnswers: [false, true, true, false, true],
  },
  {
    id: 'item-008', name: 'Caixa (Nubank)', category: 'Caixa', currency: 'BRL',
    initialValue: 5000, initialDate: '2024-01-15', value: 6000, updatedAt: makeDate(0),
    valuationMethod: { type: 'manual' }, history: [], metadata: { liquidity: 'Alta', risk: 1, confidence: 'Alta' },
    customFields: {}, tags: ['Liquidez'],
    transactions: [
      { id: 'tx-009', type: 'buy', date: '2024-01-15', quantity: 1, unitPrice: 5000, totalValue: 5000, createdAt: '2024-01-15T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true, false, true],
  },
];

const ITEMS_PORTFOLIO_2: CustomItem[] = [
  {
    id: 'item-r01', name: 'Tesouro Selic 2027', category: 'Renda Fixa', currency: 'BRL',
    initialValue: 20000, initialDate: '2024-03-01', value: 22500, updatedAt: makeDate(0),
    valuationMethod: { type: 'periodic', periodicRate: 13.25, periodicFrequency: 'yearly', growthMode: 'indexed', indexBenchmark: 'CDI' },
    history: [
      { date: '2024-03-01', value: 20000, type: 'initial' },
      { date: makeDate(0).split('T')[0], value: 22500, type: 'automatic' },
    ],
    metadata: { liquidity: 'Alta', risk: 1, confidence: 'Alta' },
    customFields: {}, tags: ['Selic', 'Reserva'],
    transactions: [
      { id: 'tx-r01', type: 'buy', date: '2024-03-01', quantity: 1, unitPrice: 20000, totalValue: 20000, createdAt: '2024-03-01T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true],
  },
  {
    id: 'item-r02', name: 'CDB Liquidez Diária', category: 'Caixa', currency: 'BRL',
    initialValue: 8000, initialDate: '2024-03-01', value: 9500, updatedAt: makeDate(0),
    valuationMethod: { type: 'periodic', periodicRate: 12.0, periodicFrequency: 'yearly', growthMode: 'indexed', indexBenchmark: 'CDI' },
    history: [], metadata: { liquidity: 'Alta', risk: 1, confidence: 'Alta' },
    customFields: {}, tags: ['Liquidez', 'Reserva'],
    transactions: [
      { id: 'tx-r02', type: 'buy', date: '2024-03-01', quantity: 1, unitPrice: 8000, totalValue: 8000, createdAt: '2024-03-01T10:00:00Z' },
    ],
    criteriaAnswers: [true, true, true],
  },
];

const HISTORY_EVENTS: PortfolioEvent[] = [
  { id: 'ev-001', portfolioId: PORTFOLIO_ID, assetName: 'PETR4', assetCategory: 'Ações', date: '2024-02-10', createdAt: '2024-02-10T10:00:00Z', type: 'buy', totalValue: 12000, quantity: 300, unitPrice: 40 },
  { id: 'ev-002', portfolioId: PORTFOLIO_ID, assetName: 'ITUB4', assetCategory: 'Ações', date: '2024-01-20', createdAt: '2024-01-20T10:00:00Z', type: 'buy', totalValue: 8000, quantity: 350, unitPrice: 22.86 },
  { id: 'ev-003', portfolioId: PORTFOLIO_ID, assetName: 'HGLG11', assetCategory: 'FIIs', date: '2024-02-01', createdAt: '2024-02-01T10:00:00Z', type: 'buy', totalValue: 15000, quantity: 100, unitPrice: 150 },
  { id: 'ev-004', portfolioId: PORTFOLIO_ID, assetName: 'VALE3', assetCategory: 'Ações', date: '2024-03-05', createdAt: '2024-03-05T10:00:00Z', type: 'buy', totalValue: 10000, quantity: 200, unitPrice: 50 },
  { id: 'ev-005', portfolioId: PORTFOLIO_ID, assetName: 'XPLG11', assetCategory: 'FIIs', date: '2024-04-10', createdAt: '2024-04-10T10:00:00Z', type: 'buy', totalValue: 12000, quantity: 120, unitPrice: 100 },
  { id: 'ev-006', portfolioId: PORTFOLIO_ID, assetName: 'PETR4', assetCategory: 'Ações', date: '2024-06-15', createdAt: '2024-06-15T10:00:00Z', type: 'buy', totalValue: 7700, quantity: 200, unitPrice: 38.5 },
  { id: 'ev-007', portfolioId: PORTFOLIO_ID, assetName: 'HGLG11', assetCategory: 'FIIs', date: '2024-07-15', createdAt: '2024-07-15T10:00:00Z', type: 'dividend', totalValue: 85, quantity: 100, unitPrice: 0.85 },
  { id: 'ev-008', portfolioId: PORTFOLIO_ID, assetName: 'XPLG11', assetCategory: 'FIIs', date: '2024-07-15', createdAt: '2024-07-15T10:00:00Z', type: 'dividend', totalValue: 96, quantity: 120, unitPrice: 0.80 },
  { id: 'ev-009', portfolioId: PORTFOLIO_ID, assetName: 'ITUB4', assetCategory: 'Ações', date: '2024-08-01', createdAt: '2024-08-01T10:00:00Z', type: 'dividend', totalValue: 52.5, quantity: 350, unitPrice: 0.15 },
];

/**
 * Distribuição do salário (Orçamento doméstico / página Metas — aba Distribuição).
 * As categorias das despesas devem coincidir com `goal.category` para os cards preencherem.
 */
const GOALS: Goal[] = [
  { id: '1', category: 'Investimentos', percentage: 30, color: '#f59e0b' },
  { id: '2', category: 'Custos Fixos', percentage: 35, color: '#ef4444' },
  { id: '6', category: 'Metas', percentage: 10, color: '#06b6d4' },
  { id: '3', category: 'Conforto', percentage: 15, color: '#3b82f6' },
  { id: '4', category: 'Conhecimento', percentage: 5, color: '#8b5cf6' },
  { id: '5', category: 'Prazeres', percentage: 5, color: '#ec4899' },
];

const BUDGET: Budget = {
  month: monthStr,
  salary: 8500,
  updatedAt: makeDate(5),
};

const PREV_BUDGET: Budget = {
  month: prevMonthStr,
  salary: 8500,
  updatedAt: makeDate(35),
};

const EXPENSES: Expense[] = [
  { id: 'exp-1', month: monthStr, category: 'Custos Fixos', name: 'Aluguel', value: 2200, type: 'fixo', createdAt: makeDate(5) },
  { id: 'exp-2', month: monthStr, category: 'Custos Fixos', name: 'Condomínio', value: 450, type: 'fixo', createdAt: makeDate(5) },
  { id: 'exp-3', month: monthStr, category: 'Conforto', name: 'Supermercado', value: 1200, type: 'variavel', createdAt: makeDate(3) },
  { id: 'exp-4', month: monthStr, category: 'Conforto', name: 'Combustível', value: 350, type: 'variavel', createdAt: makeDate(2) },
  { id: 'exp-5', month: monthStr, category: 'Custos Fixos', name: 'Plano de Saúde', value: 680, type: 'fixo', createdAt: makeDate(5) },
  { id: 'exp-6', month: monthStr, category: 'Prazeres', name: 'Streaming', value: 85, type: 'recorrente', createdAt: makeDate(5) },
  { id: 'exp-7', month: monthStr, category: 'Conhecimento', name: 'Curso Online', value: 150, type: 'recorrente', createdAt: makeDate(5) },
  { id: 'exp-8', month: monthStr, category: 'Metas', name: 'Aporte: Viagem Internacional', value: 400, type: 'recorrente', createdAt: makeDate(4) },
];

/** Mês anterior — navegação no seletor da página de orçamento */
const EXPENSES_PREV: Expense[] = [
  { id: 'exp-p1', month: prevMonthStr, category: 'Custos Fixos', name: 'Aluguel', value: 2200, type: 'fixo', createdAt: makeDate(35) },
  { id: 'exp-p2', month: prevMonthStr, category: 'Custos Fixos', name: 'Condomínio', value: 450, type: 'fixo', createdAt: makeDate(35) },
  { id: 'exp-p3', month: prevMonthStr, category: 'Conforto', name: 'Supermercado', value: 1100, type: 'variavel', createdAt: makeDate(33) },
  { id: 'exp-p4', month: prevMonthStr, category: 'Conforto', name: 'Combustível', value: 320, type: 'variavel', createdAt: makeDate(32) },
  { id: 'exp-p5', month: prevMonthStr, category: 'Custos Fixos', name: 'Plano de Saúde', value: 680, type: 'fixo', createdAt: makeDate(35) },
  { id: 'exp-p6', month: prevMonthStr, category: 'Prazeres', name: 'Streaming', value: 85, type: 'recorrente', createdAt: makeDate(35) },
  { id: 'exp-p7', month: prevMonthStr, category: 'Metas', name: 'Aporte: Fundo de Emergência', value: 850, type: 'recorrente', createdAt: makeDate(34) },
];

const CATEGORIES = ['Geral', 'Ações', 'FIIs', 'Renda Fixa', 'Caixa', 'Imóveis', 'Veículos', 'Participações'];

export function seedDemoData(): void {
  const DEMO_SEEDED_KEY = 'patrio_demo_seeded_v3';
  if (localStorage.getItem(DEMO_SEEDED_KEY)) return;

  localStorage.setItem('patrio_portfolios', JSON.stringify(PORTFOLIOS));
  localStorage.setItem(`patrio_items_${PORTFOLIO_ID}`, JSON.stringify(ITEMS_PORTFOLIO_1));
  localStorage.setItem(`patrio_items_${PORTFOLIO_ID_2}`, JSON.stringify(ITEMS_PORTFOLIO_2));
  localStorage.setItem(`patrio_history_${PORTFOLIO_ID}`, JSON.stringify(HISTORY_EVENTS));
  localStorage.setItem(`patrio_history_${PORTFOLIO_ID_2}`, JSON.stringify([]));
  localStorage.setItem('patrio_categories', JSON.stringify(CATEGORIES));

  localStorage.setItem('patrio_goals', JSON.stringify(GOALS));
  localStorage.setItem(`patrio_budget_${monthStr}`, JSON.stringify(BUDGET));
  localStorage.setItem(`patrio_budget_${prevMonthStr}`, JSON.stringify(PREV_BUDGET));
  localStorage.setItem(`patrio_expenses_${monthStr}`, JSON.stringify(EXPENSES));
  localStorage.setItem(`patrio_expenses_${prevMonthStr}`, JSON.stringify(EXPENSES_PREV));
  localStorage.setItem('patrio_objectives', JSON.stringify([
    {
      id: 'obj-1',
      name: 'Viagem Internacional',
      description: 'Viagem para Europa',
      totalValue: 15000,
      currentValue: 6500,
      status: 'active',
      createdAt: '2024-06-01T10:00:00Z',
    },
    {
      id: 'obj-2',
      name: 'Fundo de Emergência',
      description: '6 meses de despesas',
      totalValue: 50000,
      currentValue: 32000,
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
    },
  ]));

  localStorage.setItem(DEMO_SEEDED_KEY, 'true');
}
