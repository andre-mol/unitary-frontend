import type { PortfolioEvent } from '../../types';

export type PassiveIncomeEventType = 'dividend' | 'jcp' | 'rent_income' | 'profit_distribution' | 'distribution';

export const PASSIVE_INCOME_EVENT_TYPES: PassiveIncomeEventType[] = [
  'dividend',
  'jcp',
  'rent_income',
  'profit_distribution',
  'distribution',
];

const stripDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function normalizePassiveIncomeEventType(value: unknown): PassiveIncomeEventType | null {
  const raw = stripDiacritics(String(value || '').trim().toLowerCase());
  if (!raw) return null;

  if (raw === 'rent_income' || raw.includes('aluguel') || raw.includes('rent')) {
    return 'rent_income';
  }

  if (raw === 'jcp' || raw === 'jscp' || raw.includes('juros sobre capital')) {
    return 'jcp';
  }

  if (
    raw === 'profit_distribution' ||
    raw.includes('profit distribution') ||
    raw.includes('profit_share') ||
    raw.includes('profit share') ||
    raw.includes('profit-sharing') ||
    raw.includes('distribuicao de lucro') ||
    raw.includes('distribuicao dos lucros')
  ) {
    return 'profit_distribution';
  }

  if (raw === 'distribution' || raw.includes('distribuicao')) {
    return 'distribution';
  }

  if (
    raw === 'dividend' ||
    raw === 'income' ||
    raw === 'other' ||
    raw.includes('dividend') ||
    raw.includes('income') ||
    raw.includes('yield') ||
    raw.includes('amort') ||
    raw.includes('dividendo') ||
    raw.includes('provento') ||
    raw.includes('rendimento')
  ) {
    return 'dividend';
  }

  return null;
}

export function isPassiveIncomeEventType(value: unknown): value is PassiveIncomeEventType {
  return normalizePassiveIncomeEventType(value) !== null;
}

export function toPassiveIncomePortfolioEventType(value: unknown): PortfolioEvent['type'] | null {
  const normalized = normalizePassiveIncomeEventType(value);
  return normalized ? (normalized as PortfolioEvent['type']) : null;
}
