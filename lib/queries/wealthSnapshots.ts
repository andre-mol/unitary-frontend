/**
 * Wealth Snapshots Queries
 * 
 * Funções para interagir com RPCs de snapshots mensais de patrimônio líquido.
 * Usa snapshots imutáveis do banco de dados para histórico confiável.
 */

import { z } from 'zod';
import { getSupabaseClient } from '../../config/supabase';
import { env } from '../../config/env';
import { buildRangeMonths } from '../utils/monthRange';

export type WealthYearSeriesItem = {
  month: string; // 'YYYY-MM'
  total_value: number;
  is_final: boolean;
  computed_at: string;
};

export type WealthYearSeriesItemWithStatus = WealthYearSeriesItem & {
  hasSnapshot: boolean;
};

export type WealthMonthBreakdown = {
  month: string;
  snapshot_exists: boolean;
  categories: Array<{ category: string; total: number }>;
  portfolios: Array<{ portfolio_id: string; total: number }>;
  top_items: Array<{
    item_id: string;
    category: string;
    portfolio_id: string;
    value: number;
  }>;
};

/**
 * Schema Zod para validação de month key
 * Formato esperado: YYYY-MM (ex: '2026-01')
 */
export const MonthKeySchema = z.string().regex(/^\d{4}-\d{2}$/, {
  message: 'Formato de mês inválido. Use YYYY-MM (ex: 2026-01)'
});

/**
 * Constrói month key no formato YYYY-MM
 * @param year Ano (ex: 2026)
 * @param monthIndex1to12 Mês de 1 a 12 (Janeiro = 1, Dezembro = 12)
 * @returns Month key no formato 'YYYY-MM'
 */
export function toMonthKey(year: number, monthIndex1to12: number): string {
  if (monthIndex1to12 < 1 || monthIndex1to12 > 12) {
    throw new Error(`Mês inválido: ${monthIndex1to12}. Deve estar entre 1 e 12.`);
  }
  return `${year}-${String(monthIndex1to12).padStart(2, '0')}`;
}

/**
 * Constrói lista completa de meses para um ano (12 meses)
 * @param year Ano (ex: 2026)
 * @returns Array de month keys no formato 'YYYY-MM' ['2026-01', '2026-02', ..., '2026-12']
 */
export function buildFullYearMonthList(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => toMonthKey(year, i + 1));
}

/**
 * Mescla lista completa de meses com snapshots retornados do RPC.
 * Meses sem snapshot terão valores null/undefined para indicar ausência.
 * 
 * @param year Ano selecionado
 * @param snapshots Array de snapshots retornados do RPC
 * @returns Array completo de 12 meses, com snapshots mesclados onde existem
 */
export function mergeFullYearWithSnapshots(
  year: number,
  snapshots: WealthYearSeriesItem[]
): WealthYearSeriesItemWithStatus[] {
  const fullYearMonths = buildFullYearMonthList(year);
  const snapshotMap = new Map(snapshots.map(s => [s.month, s]));

  return fullYearMonths.map(month => {
    const snapshot = snapshotMap.get(month);
    if (snapshot) {
      return { ...snapshot, hasSnapshot: true };
    }
    return {
      month,
      total_value: 0, // Placeholder para gráfico (será tratado como null no chart)
      is_final: false,
      computed_at: '',
      hasSnapshot: false
    };
  });
}

/**
 * Garante que existe um snapshot para o mês atual (não finalizado).
 * Cria o snapshot se não existir, ou atualiza se já existir mas não estiver finalizado.
 * 
 * @throws Error se houver erro ao criar/atualizar snapshot
 */
export async function ensureCurrentMonthSnapshot(): Promise<void> {
  const supabase = getSupabaseClient();

  // Calcular mês atual no formato YYYY-MM
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Chamar RPC para criar/atualizar snapshot (não finalizado)
  const { error } = await supabase.rpc('patrio_upsert_wealth_monthly_snapshot', {
    p_month: currentMonth,
    p_finalize: false
  });

  if (error) {
    // Se erro é de snapshot já finalizado, ignorar (não é erro crítico)
    if (error.message.includes('finalized') || error.message.includes('final')) {
      // Snapshot já existe e está finalizado, tudo bem
      return;
    }

    // Outros erros são críticos
    throw new Error(`Erro ao garantir snapshot do mês atual: ${error.message}`);
  }
}

/**
 * Busca série anual de snapshots mensais.
 * Retorna array ordenado por mês (crescente).
 * 
 * @param year Ano para buscar (ex: 2026)
 * @returns Array de snapshots do ano, ordenado por mês
 */
export async function getWealthYearSeries(year: number): Promise<WealthYearSeriesItem[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('patrio_get_wealth_year_series', {
    p_year: year
  });

  if (error) {
    // Capturar detalhes completos do erro para debug
    const errorDetails = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status: (error as any).status,
    };

    // Log detalhado apenas em DEV (sem PII)
    if (env.isDevelopment) {
      console.error('[wealthSnapshots] Erro ao buscar série anual:', {
        rpc: 'patrio_get_wealth_year_series',
        params: { p_year: year },
        error: errorDetails,
      });
    }

    const errorMessage = error.message || 'Erro desconhecido ao buscar série anual';
    const enhancedError = new Error(errorMessage) as Error & {
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
    };
    enhancedError.details = error.details;
    enhancedError.hint = error.hint;
    enhancedError.code = error.code;
    enhancedError.status = (error as any).status;

    throw enhancedError;
  }

  // RPC já retorna ordenado por month ASC, mas garantimos aqui também
  return (data || []).sort((a: WealthYearSeriesItem, b: WealthYearSeriesItem) =>
    a.month.localeCompare(b.month)
  );
}

/**
 * Busca breakdown detalhado de um snapshot mensal específico.
 * Retorna distribuição por categoria, portfolio e top items.
 * 
 * @param month Mês no formato YYYY-MM (ex: '2026-01')
 * @returns Breakdown do mês ou objeto vazio se snapshot não existe
 */
export async function getWealthMonthBreakdown(month: string): Promise<WealthMonthBreakdown> {
  const supabase = getSupabaseClient();

  // Validação Zod antes de chamar RPC
  const validationResult = MonthKeySchema.safeParse(month);
  if (!validationResult.success) {
    const error = validationResult.error.issues[0];
    throw new Error(`Formato de mês inválido: ${error.message}`);
  }

  const validatedMonth = validationResult.data;

  const { data, error } = await supabase.rpc('patrio_get_wealth_month_breakdown', {
    p_month: validatedMonth
  });

  if (error) {
    // Capturar detalhes completos do erro para debug
    const errorDetails = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status: (error as any).status,
    };

    // Log detalhado apenas em DEV (sem PII)
    if (env.isDevelopment) {
      console.error('[wealthSnapshots] Erro ao buscar breakdown mensal:', {
        rpc: 'patrio_get_wealth_month_breakdown',
        params: { p_month: validatedMonth },
        error: errorDetails,
      });
    }

    const errorMessage = error.message || 'Erro desconhecido ao buscar breakdown mensal';
    const enhancedError = new Error(errorMessage) as Error & {
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
    };
    enhancedError.details = error.details;
    enhancedError.hint = error.hint;
    enhancedError.code = error.code;
    enhancedError.status = (error as any).status;

    throw enhancedError;
  }

  // Se não há dados, retornar estrutura vazia
  if (!data) {
    return {
      month: validatedMonth,
      snapshot_exists: false,
      categories: [],
      portfolios: [],
      top_items: []
    };
  }

  return data as WealthMonthBreakdown;
}

/**
 * Fallback para recomputar totais mensais a partir do breakdown quando a série anual
 * vier com total_value zerado apesar de existir snapshot.
 */
export async function getWealthYearTotalsFromBreakdowns(year: number): Promise<Map<string, number>> {
  const months = buildFullYearMonthList(year);
  const breakdowns = await Promise.all(
    months.map(async (month) => {
      try {
        const breakdown = await getWealthMonthBreakdown(month);
        if (!breakdown.snapshot_exists) {
          return [month, 0] as const;
        }

        const total = (breakdown.categories || []).reduce(
          (sum, category) => sum + Number(category.total || 0),
          0
        );

        return [month, total] as const;
      } catch {
        return [month, 0] as const;
      }
    })
  );

  return new Map(breakdowns);
}

/**
 * Mapeia timeRange para anos necessários para buscar snapshots
 * @param range TimeRange do dashboard ('3M' | '6M' | '1A' | 'YTD')
 * @returns Array de anos para buscar (ex: [2025, 2026] para '1A')
 */
export function getYearsForTimeRange(range: '3M' | '6M' | '1A'): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  switch (range) {
    case '3M':
      // Últimos 3 meses: pode ser mesmo ano ou ano anterior
      return currentMonth < 3 ? [currentYear - 1, currentYear] : [currentYear];
    case '6M':
      // Últimos 6 meses: pode ser mesmo ano ou ano anterior
      return currentMonth < 6 ? [currentYear - 1, currentYear] : [currentYear];
    case '1A':
      // Último ano: ano atual e anterior
      return [currentYear - 1, currentYear];
    default:
      return [currentYear];
  }
}

/**
 * Filtra snapshots para incluir apenas meses dentro do timeRange
 * @param snapshots Array completo de snapshots
 * @param range TimeRange do dashboard
 * @returns Array filtrado de snapshots
 */
export function filterSnapshotsByTimeRange(
  snapshots: WealthYearSeriesItem[],
  range: '3M' | '6M' | '1A'
): WealthYearSeriesItem[] {
  const now = new Date();
  const cutoffDate = new Date();

  switch (range) {
    case '3M':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1A':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return snapshots.filter(s => {
    const [year, month] = s.month.split('-').map(Number);
    const snapshotDate = new Date(year, month - 1, 1);
    return snapshotDate >= cutoffDate && snapshotDate <= now;
  });
}

/**
 * Busca dados de evolução para dashboard usando snapshots mensais.
 * Retorna formato compatível com EvolutionPoint[] usado pelo dashboard.
 * 
 * @param range TimeRange do dashboard
 * @returns Array de EvolutionPoint com dados de snapshots ou null para meses faltantes
 */
export async function getDashboardEvolutionFromSnapshots(
  range: '3M' | '6M' | '1A' | 'ALL'
): Promise<Array<{ name: string; value: number | null; fullDate: string; hasSnapshot: boolean }>> {
  let years: number[];

  if (range === 'ALL') {
    const availableYears = await getAvailableYears();
    if (availableYears.length === 0) {
      years = [new Date().getFullYear()];
    } else {
      years = availableYears;
    }
  } else {
    years = getYearsForTimeRange(range);
  }

  const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Buscar snapshots de todos os anos necessários
  const allSnapshots: WealthYearSeriesItem[] = [];
  for (const year of years) {
    try {
      const yearSnapshots = await getWealthYearSeries(year);
      allSnapshots.push(...yearSnapshots);
    } catch (error) {
      // Se erro ao buscar um ano, continuar com outros anos
      if (env.isDevelopment) {
        console.error(`Erro ao buscar snapshots de ${year}:`, error);
      }
    }
  }

  // AIDEV-NOTE: Range de datas corrigido usando buildRangeMonths
  let minYear = new Date().getFullYear();
  if (range === 'ALL' && years.length > 0) {
    minYear = Math.min(...years);
  }
  const { months: monthsToShow } = buildRangeMonths(range, undefined, minYear);

  // Criar mapa de snapshots por mês (filtrar apenas meses do range)
  const snapshotMap = new Map<string, WealthYearSeriesItem>();
  allSnapshots.forEach(snapshot => {
    if (monthsToShow.includes(snapshot.month)) {
      snapshotMap.set(snapshot.month, snapshot);
    }
  });

  // Construir array de EvolutionPoint
  return monthsToShow.map(monthKey => {
    const snapshot = snapshotMap.get(monthKey);
    const [year, month] = monthKey.split('-').map(Number);
    const monthName = monthsShort[month - 1];
    const fullDate = new Date(year, month - 1, 1).toISOString();

    return {
      name: `${monthName}/${year}`,
      value: snapshot ? snapshot.total_value : null, // null para meses sem snapshot
      fullDate,
      hasSnapshot: !!snapshot
    };
  });
}

/**
 * Busca anos disponíveis no histórico de patrimônio.
 * Retorna array ordenado do mais recente para o mais antigo (ex: [2026, 2025, ...])
 */
export async function getAvailableYears(): Promise<number[]> {
  const supabase = getSupabaseClient();
  const currentYear = new Date().getFullYear();

  const [yearsRpcResult, earliestRollupResult, earliestEventResult] = await Promise.all([
    supabase.rpc('patrio_get_available_years'),
    supabase
      .from('portfolio_performance_rollup')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('portfolio_events')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data, error } = yearsRpcResult;

  if (error) {
    if (env.isDevelopment) {
      console.error('Erro ao buscar anos disponíveis:', error);
    }
  }

  // Mapear resultado (tabela com coluna 'year') para array de números
  const years = new Set<number>((data || []).map((item: any) => Number(item.year)));

  if (earliestRollupResult.error && env.isDevelopment) {
    console.error('Erro ao buscar menor data de portfolio_performance_rollup:', earliestRollupResult.error);
  }

  const rollupDate = String(earliestRollupResult.data?.date || '').slice(0, 10);
  const rollupYear = rollupDate ? Number(rollupDate.slice(0, 4)) : NaN;
  if (Number.isFinite(rollupYear) && rollupYear > 1900) {
    years.add(rollupYear);
  }

  if (earliestEventResult.error && env.isDevelopment) {
    console.error('Erro ao buscar menor data de portfolio_events:', earliestEventResult.error);
  }

  const eventDate = String(earliestEventResult.data?.date || '').slice(0, 10);
  const eventYear = eventDate ? Number(eventDate.slice(0, 4)) : NaN;
  if (Number.isFinite(eventYear) && eventYear > 1900) {
    years.add(eventYear);
  }

  if (years.size === 0) {
    years.add(currentYear);
  }

  return Array.from(years).sort((a, b) => b - a);
}

export async function selfHealZeroWealthSnapshots(year: number): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('patrio_self_heal_wealth_zero_snapshots', {
    p_year: year
  });

  if (error) {
    throw new Error(`Erro ao reparar snapshots de patrimônio: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : 0;
}
