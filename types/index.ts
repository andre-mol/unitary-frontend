
export type PortfolioObjective = 'growth' | 'income' | 'protection' | 'speculation' | 'mixed';
export type PortfolioTimeHorizon = 'short' | 'medium' | 'long';

export interface Portfolio {
  id: string;
  name: string;
  type: string;
  value: number;
  monthVar: number;
  yearVar: number;
  currency: string;
  createdAt: string;
  lastAccessedAt?: string; // New field for tracking recent access
  // Dynamic fields based on type
  region?: string;
  focus?: string;
  location?: string;
  structure?: string;
  description?: string;
  customClass?: string; // User defined class for custom portfolios (e.g. "Crypto", "Wine")

  // Strategic Fields (New)
  objective: PortfolioObjective;
  timeHorizon: PortfolioTimeHorizon;
  userConvictionScore?: number; // 0-10 score set manually by user for the portfolio entity

  // Scoring System
  criteria?: string[]; // Array of questions/criteria defined by user

  // Strategy System
  categoryTargets?: Record<string, number>; // Map Category Name -> Target %
}

export interface ValuationHistory {
  date: string;
  value: number;
  type: 'initial' | 'manual' | 'automatic' | 'event';
  note?: string;
}

export interface ValuationMethod {
  type: 'manual' | 'periodic' | 'automatic';
  // Configs
  periodicRate?: number; // %
  periodicFrequency?: 'monthly' | 'yearly';
  growthMode?: 'fixed' | 'indexed';
  indexBenchmark?: 'CDI' | 'IPCA' | 'IBOV' | 'S&P500' | 'IFIX' | 'IDIV' | 'SMLL' | 'IVVB11';
  indexBenchmarkBaseRate?: number; // % a.a used for simulation
  indexSpreadRate?: number; // spread %
  indexSpreadFrequency?: 'monthly' | 'yearly';
}

export interface ItemMetadata {
  liquidity?: 'Baixa' | 'Média' | 'Alta';
  risk?: 1 | 2 | 3 | 4 | 5;
  confidence?: 'Baixa' | 'Média' | 'Alta';
  lastReview?: string;
}

// AIDEV-NOTE: Transaction type definition. Base transaction interface.
// For rent transactions, use RentTransaction. For dividend/profit, use DividendTransaction.
export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'manual_update' | 'rent_start' | 'rent_end' | 'profit_registered' | 'profit_distribution' | 'profit_report' | 'distribution' | 'capital_call' | 'valuation_update' | 'dividend' | 'jcp';
  date: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  observation?: string;
  createdAt: string;
  // Valuation Snapshot per Lot
  valuationMethod?: ValuationMethod;
}

// Extended transaction types for specific use cases
export interface RentTransaction extends Omit<Transaction, 'type'> {
  type: 'rent_start' | 'rent_end';
  rentIndexer?: string;
  rentAdjustmentMonth?: number;
}

export interface DividendTransaction extends Omit<Transaction, 'type'> {
  type: 'dividend' | 'jcp' | 'profit_registered' | 'profit_distribution' | 'profit_report' | 'distribution' | 'capital_call' | 'valuation_update';
  period?: string;
}

// Union type for all transaction variants
export type TransactionWithExtras = Transaction | RentTransaction | DividendTransaction;

// AIDEV-NOTE: CustomFields type definition. Values can be string, number, boolean, or string array.
// Used for portfolio-type-specific metadata (e.g., propertyType for real estate, structureType for business).
export type CustomFieldValue = string | number | boolean | string[];

export interface CustomItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  // Status removed
  currency: string;

  // Core Value Fields
  initialValue: number;
  initialDate: string;
  value: number; // Current Value
  updatedAt: string;

  // Advanced Fields
  valuationMethod: ValuationMethod;
  history: ValuationHistory[];
  metadata: ItemMetadata;
  customFields: Record<string, CustomFieldValue>;

  // New Fields
  market_asset_id?: string;
  quantity?: number;
  tags?: string[];

  // Transactions MVP
  transactions?: Transaction[];

  // Scoring System
  criteriaAnswers?: boolean[]; // Array of booleans matching Portfolio criteria indices
}

// Global Audit Event
export interface PortfolioEvent {
  id: string;
  portfolioId: string;
  portfolioName?: string; // Snapshot of portfolio name at time of event
  assetId?: string; // Optional for portfolio-level events
  assetName: string; // Used as "Event Name" for portfolio events
  assetCategory?: string;
  date: string; // Event Date (Payment Date for dividends)
  createdAt: string; // System Date
  type: 'create' | 'delete' | 'buy' | 'sell' | 'manual_update' | 'adjustment' | 'portfolio_create' | 'portfolio_delete' | 'rent_start' | 'rent_end' | 'rent_income' | 'profit_registered' | 'profit_distribution' | 'profit_report' | 'distribution' | 'capital_call' | 'valuation_update' | 'dividend' | 'jcp';
  eventStatus?: 'received' | 'expected' | 'executed'; // For Rent/Future events
  quantity?: number;
  unitPrice?: number;
  totalValue: number;
  observation?: string;
  period?: string; // For Profit Registration (e.g. "Q1 2024")
  periodStart?: string;
  periodEnd?: string;
  payload?: Record<string, unknown>;
}

export interface DashboardConfig {
  widgets: {
    id: string;
    type: 'kpi' | 'chart_bar' | 'chart_pie' | 'chart_area' | 'list';
    title: string;
    visible: boolean;
    order: number;
  }[];
}

// ============================================================
// RECHARTS TYPES
// ============================================================

export interface RechartsTooltipPayloadEntry {
  name: string;
  value: number;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

export interface RechartsTooltipProps {
  active?: boolean;
  payload?: RechartsTooltipPayloadEntry[];
  label?: string | number;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export type LoadingState = boolean;
export type ErrorState = string | null;

export interface AsyncState<T> {
  data: T | null;
  loading: LoadingState;
  error: ErrorState;
}

// Transaction filter types
export type TransactionFilterType = 'all' | 'buy' | 'sell' | 'dividend' | 'jcp' | 'rent_income' | 'profit_distribution' | 'distribution' | 'capital_call';

// History event types for filtering
export type HistoryEventType = PortfolioEvent['type'] | 'all';
