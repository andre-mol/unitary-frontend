/**
 * Hook: usePortfolioDetails
 * Encapsulates all state and logic for PortfolioDetailsPage
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { portfolioService, calculateCurrentValue, calculateTotalInvested, getValueAtDate } from '../../../../lib/portfolioService';
import { Portfolio, CustomItem, Transaction, PortfolioEvent, RentTransaction, DividendTransaction } from '../../../../types';
import { formatCurrency } from '../../../../utils/formatters';
import { useAuth } from '../../../auth/AuthProvider';
import { queryKeys } from '../../../../lib/queryKeys';
import { env } from '../../../../config/env';
import { STALE_TIMES, GC_TIMES } from '../../../../lib/queryClient';
import {
    fetchPortfolioById,
    fetchPortfolioItems,
    fetchPortfolioEvents,
    fetchCategories,
    fetchEvolutionData,
    fetchPerformanceData,
    fetchBenchmarkData,
} from '../../../../lib/queries/portfolios';

export type TimeRange = '6M' | '1A' | 'ALL';
export type ActiveTab = 'overview' | 'dividends' | 'history' | 'profitability';

function parseFlexibleDate(value?: string | null): Date | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const isoCandidate = raw.includes('T') ? raw : raw.replace(/\//g, '-');
    const iso = new Date(isoCandidate);
    if (!Number.isNaN(iso.getTime())) return iso;

    const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        const [, dd, mm, yyyy] = br;
        const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function monthStartIso(date: Date): string {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

function localDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildInvestedTimeline(portfolioItems: CustomItem[]): Array<{ ts: number; date: string; invested: number }> {
    const timeline: Array<{ ts: number; date: string; invested: number }> = [];

    for (const item of portfolioItems || []) {
        const currentQty = Number(item.quantity || 0);
        const txNetQty = (item.transactions || []).reduce((acc, tx) => {
            if (tx.type === 'buy') return acc + Number(tx.quantity || 0);
            if (tx.type === 'sell') return acc - Number(tx.quantity || 0);
            return acc;
        }, 0);

        const baseQty = Math.max(0, currentQty - txNetQty);
        const baseInvested = Number(item.initialValue || 0);
        const baseDate = parseFlexibleDate(item.initialDate);

        if (baseQty > 0 && baseDate && Number.isFinite(baseInvested) && baseInvested > 0) {
            timeline.push({
                ts: baseDate.getTime(),
                date: localDateIso(baseDate),
                invested: baseInvested,
            });
        }

        for (const tx of item.transactions || []) {
            if (tx.type !== 'buy' && tx.type !== 'sell') continue;

            const txDate = parseFlexibleDate(tx.date);
            const txValue = Number(tx.totalValue || 0);
            if (!txDate || !Number.isFinite(txValue) || txValue <= 0) continue;

            timeline.push({
                ts: txDate.getTime(),
                date: localDateIso(txDate),
                invested: tx.type === 'buy' ? txValue : -txValue,
            });
        }
    }

    return timeline.sort((a, b) => a.ts - b.ts);
}

function hasMatchingPersistedTransaction(
    item: CustomItem | undefined,
    transaction: Pick<Transaction, 'type' | 'date' | 'quantity' | 'totalValue'>
): boolean {
    if (!item?.transactions?.length) return false;

    const targetDate = String(transaction.date || '').split('T')[0];
    const targetQty = Number(transaction.quantity || 0);
    const targetTotal = Number(transaction.totalValue || 0);
    const approxEqual = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

    return item.transactions.some((current) => {
        if (current.type !== transaction.type) return false;

        const currentDate = String(current.date || '').split('T')[0];
        const currentQty = Number(current.quantity || 0);
        const currentTotal = Number(current.totalValue || 0);

        return currentDate === targetDate &&
            approxEqual(currentQty, targetQty, 1e-8) &&
            approxEqual(currentTotal, targetTotal, 0.01);
    });
}

function chartLabel(dateLike: string): string {
    const parsed = parseFlexibleDate(dateLike);
    if (!parsed) return String(dateLike).slice(0, 10);
    return parsed.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' });
}

function buildDividendFetchRange() {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);

    const start = new Date();
    start.setFullYear(start.getFullYear() - 10);

    return { start, end };
}

function buildLocalPerformanceFallback(
    navSeries: any[],
    portfolioItems: CustomItem[],
    dividendRows: any[]
) {
    const itemCosts = buildInvestedTimeline(portfolioItems);
    if (itemCosts.length === 0) return [];

    const firstInvestmentTs = itemCosts[0].ts;
    const sortedNav = [...(navSeries || [])]
        .filter((point) => point?.fullDate && Number.isFinite(Number(point?.value)) && Number(point.value) > 0)
        .filter((point) => {
            const ts = new Date(point.fullDate).getTime();
            return !Number.isNaN(ts) && ts >= firstInvestmentTs;
        })
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    if (sortedNav.length === 0) return [];

    const totalInvested = itemCosts.reduce((acc, entry) => acc + entry.invested, 0);
    if (!Number.isFinite(totalInvested) || totalInvested <= 0) return [];

    const currentPortfolioValue = (portfolioItems || []).reduce(
        (acc, item) => acc + Number(calculateCurrentValue(item) || 0),
        0
    );
    const latestNavRaw = Number(sortedNav[sortedNav.length - 1]?.value || 0);
    let navScale = 1;

    if (currentPortfolioValue > 0 && latestNavRaw > 0) {
        const ratio = currentPortfolioValue / latestNavRaw;
        const marketItems = (portfolioItems || []).filter((item) => !!item.market_asset_id);
        const allItemsAreMarket = marketItems.length > 0 && marketItems.length === (portfolioItems || []).length;
        const singleMarketQty = allItemsAreMarket && marketItems.length === 1
            ? Number(marketItems[0].quantity || 0)
            : 0;

        if (
            singleMarketQty > 1 &&
            Math.abs(ratio - singleMarketQty) <= Math.max(0.01, singleMarketQty * 0.05)
        ) {
            navScale = ratio;
        }
    }

    const getInvestedBasisAt = (ts: number) => {
        if (ts < firstInvestmentTs) return 0;

        let basis = 0;
        for (const entry of itemCosts) {
            if (entry.ts <= ts) {
                basis += entry.invested;
                continue;
            }
            break;
        }
        return Math.max(0, basis);
    };

    const dividendEvents = (dividendRows || [])
        .map((row) => {
            const amount = Number(row?.total_amount || 0);
            const paymentDate = parseFlexibleDate(row?.payment_date || row?.date || null);
            if (!paymentDate || !Number.isFinite(amount) || amount <= 0) return null;

            const status = String(row?.status || '').toLowerCase();
            const now = new Date();
            if (paymentDate.getTime() > now.getTime()) return null;
            if (status === 'provisioned') return null;

            return {
                ts: paymentDate.getTime(),
                amount,
            };
        })
        .filter((entry): entry is { ts: number; amount: number } => !!entry)
        .sort((a, b) => a.ts - b.ts);

    const navDates = sortedNav.map((point) => new Date(point.fullDate).getTime());
    const navValues = sortedNav.map((point) => (Number(point.value) || 0) * navScale);

    const getNavAt = (ts: number) => {
        let nav = 0;
        for (let i = 0; i < navDates.length; i += 1) {
            if (navDates[i] <= ts) {
                nav = navValues[i];
                continue;
            }
            break;
        }
        return nav > 0 ? nav : getInvestedBasisAt(ts);
    };

    let dividendIdx = 0;
    let reinvestmentFactor = 1;

    const synthetic = sortedNav.map((point) => {
        const pointTs = new Date(point.fullDate).getTime();

        while (dividendIdx < dividendEvents.length && dividendEvents[dividendIdx].ts <= pointTs) {
            const event = dividendEvents[dividendIdx];
            const navAtEvent = getNavAt(event.ts);
            if (navAtEvent > 0) {
                reinvestmentFactor *= (1 + (event.amount / navAtEvent));
            }
            dividendIdx += 1;
        }

        const investedBasis = getInvestedBasisAt(pointTs);
        const adjustedValue = ((Number(point.value) || 0) * navScale) * reinvestmentFactor;
        const cumulativeReturn = investedBasis > 0
            ? (adjustedValue / investedBasis) - 1
            : 0;

        return {
            name: point.name || chartLabel(point.fullDate),
            fullDate: point.fullDate,
            value: cumulativeReturn,
        };
    });

    const firstItemDate = itemCosts[0].date;
    const firstPointDate = String(synthetic[0]?.fullDate || '').slice(0, 10);

    if (firstItemDate && firstPointDate && firstItemDate < firstPointDate) {
        synthetic.unshift({
            name: chartLabel(firstItemDate),
            fullDate: firstItemDate,
            value: 0,
        });
    }

    return synthetic;
}

export function usePortfolioDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    // Core State
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [items, setItems] = useState<CustomItem[]>([]);
    const [historyEvents, setHistoryEvents] = useState<PortfolioEvent[]>([]);
    const [dividends, setDividends] = useState<any[]>([]);
    const [benchmarks, setBenchmarks] = useState<any[]>([]);
    const [evolutionData, setEvolutionData] = useState<any[]>([]);
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [portfolioTotalReturnPct, setPortfolioTotalReturnPct] = useState<number | null>(null);

    // UI State
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

    // Loading & Error State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string[]> | null>(null);

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Selection State
    const [selectedItem, setSelectedItem] = useState<CustomItem | null>(null);
    const [newItem, setNewItem] = useState<Partial<CustomItem>>({});
    const [categories, setCategories] = useState<string[]>([]);

    const customBenchmarkStartDate = useMemo(() => {
        if (timeRange !== 'ALL' || items.length === 0) return undefined;
        let oldestDate = new Date();
        for (const item of items) {
            const itemDate = parseFlexibleDate(item.initialDate);
            if (itemDate && itemDate < oldestDate) oldestDate = itemDate;
        }
        return oldestDate.toISOString().split('T')[0];
    }, [items, timeRange]);

    // Data Loading - SÓ quando usuário estiver autenticado
    useEffect(() => {
        // Não carregar se auth ainda está carregando ou usuário não existe
        if (authLoading || !user) {
            return;
        }

        // AIDEV-NOTE: Guard explícito para garantir que id existe antes de buscar dados
        if (!id) {
            setError('ID do portfólio não encontrado na URL');
            setLoading(false);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const p = await queryClient.fetchQuery({
                    queryKey: queryKeys.portfolio(id),
                    queryFn: () => fetchPortfolioById(id),
                });
                if (p) {
                    setPortfolio(p);

                    const loadedItems = await queryClient.fetchQuery({
                        queryKey: queryKeys.items(id),
                        queryFn: () => fetchPortfolioItems(id),
                    });

                    const dividendRange = buildDividendFetchRange();

                    const [loadedEvents, loadedCategories, loadedDividends] = await Promise.all([
                        queryClient.fetchQuery({
                            queryKey: queryKeys.events(user!.id, `portfolio:${id}`),
                            queryFn: () => fetchPortfolioEvents(id),
                        }),
                        queryClient.fetchQuery({
                            queryKey: queryKeys.categories(user!.id),
                            queryFn: fetchCategories,
                        }),
                        portfolioService.getUserDividends(id, dividendRange)
                    ]);
                    setItems(loadedItems);
                    setHistoryEvents(loadedEvents);
                    setCategories(loadedCategories);
                    setDividends(loadedDividends);
                    await portfolioService.updateLastAccessed(id);
                } else {
                    setError('Portfólio não encontrado');
                    navigate('/dashboard/portfolios');
                }
            } catch (err) {
                // AIDEV-NOTE: Tratamento de erros melhorado - não ignorar silenciosamente
                // AIDEV-NOTE: Tratamento de erros melhorado - não ignorar silenciosamente
                const message = err instanceof Error ? err.message : 'Erro ao carregar portfólio';
                const isAuthError = message.includes('NOT_AUTHENTICATED') ||
                    message.includes('não autenticado') ||
                    message.includes('AUTH_NOT_READY');

                if (isAuthError) {
                    // Erros de autenticação são tratados pelo AuthProvider, não precisamos mostrar erro aqui
                    return;
                }

                // Para outros erros, definir error state para mostrar na UI
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, navigate, user?.id, authLoading, queryClient]);

    // Load evolution + benchmarks (historical data) with stable dependencies
    useEffect(() => {
        if (!user || !portfolio) return;

        let cancelled = false;

        const loadEvolutionAndBenchmarks = async () => {
            try {
                const timingBase = `[PortfolioDetails] evo+bench ${portfolio.id} ${timeRange}`;
                const t0 = performance.now();

                const [evoData, benchData] = await Promise.all([
                    queryClient.fetchQuery({
                        queryKey: queryKeys.evolution(user.id, portfolio.id, timeRange),
                        queryFn: () => fetchEvolutionData(portfolio.id, timeRange),
                        staleTime: STALE_TIMES.HISTORICAL,
                        gcTime: GC_TIMES.HISTORICAL,
                    }),
                    queryClient.fetchQuery({
                        queryKey: ['benchmarks', timeRange, customBenchmarkStartDate],
                        queryFn: () => fetchBenchmarkData(timeRange, customBenchmarkStartDate),
                        staleTime: STALE_TIMES.BENCHMARKS,
                        gcTime: GC_TIMES.BENCHMARKS,
                    })
                ]);

                if (cancelled) return;
                setEvolutionData(evoData);
                setBenchmarks(benchData);

                if (env.isDevelopment) {
                    console.debug('[PortfolioDetails] evo+bench rows', {
                        timer: timingBase,
                        evo: evoData?.length ?? 0,
                        bench: benchData?.length ?? 0,
                        ms: Math.round(performance.now() - t0),
                    });
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : '';
                const isAuthError = message.includes('NOT_AUTHENTICATED') ||
                    message.includes('não autenticado');
                if (!isAuthError) {
                    console.error('Erro ao carregar dados de evolução');
                }
            }
        };

        loadEvolutionAndBenchmarks();
        return () => { cancelled = true; };
    }, [portfolio, timeRange, customBenchmarkStartDate, user?.id, queryClient]);

    // Load performance for tabs that render profitability-based portfolio lines
    useEffect(() => {
        const shouldLoadPerformanceForTab =
            activeTab === 'profitability' ||
            activeTab === 'overview';

        if (!user || !portfolio || !shouldLoadPerformanceForTab) {
            setPerformanceLoading(false);
            return;
        }

        let cancelled = false;

        const loadPerformanceData = async () => {
            setPerformanceLoading(true);
            try {
                const timingBase = `[PortfolioDetails] performance ${portfolio.id} ${timeRange}`;
                const t0 = performance.now();

                const perfDataMaybe = await queryClient.fetchQuery({
                    queryKey: ['performance', user.id, portfolio.id, timeRange],
                    queryFn: () => fetchPerformanceData(portfolio.id, timeRange),
                    staleTime: STALE_TIMES.HISTORICAL,
                    gcTime: GC_TIMES.HISTORICAL,
                });

                if (cancelled) return;
                const perfData = perfDataMaybe || [];

                if (perfData.length > 0) {
                    setPerformanceData(perfData);
                } else if (portfolio.type !== 'real_estate' && portfolio.type !== 'business') {
                    const localFallback = buildLocalPerformanceFallback(evolutionData, items, dividends);
                    setPerformanceData(localFallback);
                } else {
                    setPerformanceData([]);
                }

                if (env.isDevelopment) {
                    console.debug('[PortfolioDetails] performance rows', {
                        timer: timingBase,
                        perf: perfData?.length ?? 0,
                        ms: Math.round(performance.now() - t0),
                    });
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : '';
                const isAuthError = message.includes('NOT_AUTHENTICATED') ||
                    message.includes('não autenticado');
                if (!isAuthError) {
                    console.error('Erro ao carregar dados de performance');
                }
            } finally {
                if (!cancelled) {
                    setPerformanceLoading(false);
                }
            }
        };

        loadPerformanceData();
        return () => { cancelled = true; };
    }, [portfolio, timeRange, activeTab, user?.id, queryClient, evolutionData, items, dividends]);

    const realEstateNetIncomeEvents = useMemo(() => {
        if (!portfolio || portfolio.type !== 'real_estate') return [] as Array<{ date: string; totalValue: number }>;

        const now = new Date();
        const events: Array<{ date: string; totalValue: number }> = [];

        for (const item of items) {
            const status = String(item.customFields?.occupancyStatus || 'Vago');
            if (!['Alugado', 'Parcialmente alugado'].includes(status)) continue;

            const rent = Number(item.customFields?.monthlyRent || 0);
            const condo = Number(item.customFields?.condoFee || 0);
            const maintenance = Number(item.customFields?.maintenance || 0);
            const propertyTax = Number(item.customFields?.propertyTax || 0);
            const insurance = Number(item.customFields?.insurance || 0);
            const monthlyNet = rent - (condo + maintenance + propertyTax + insurance);
            if (!Number.isFinite(monthlyNet)) continue;

            const effectiveFromRaw = String(item.customFields?.rentIncomeEffectiveFrom || item.initialDate || '');
            const effectiveFrom = parseFlexibleDate(effectiveFromRaw) || parseFlexibleDate(item.initialDate) || now;

            const cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 1);

            while (cursor <= end) {
                events.push({
                    date: monthStartIso(cursor),
                    totalValue: monthlyNet,
                });
                cursor.setMonth(cursor.getMonth() + 1);
            }
        }

        return events;
    }, [portfolio, items]);

    const historyEventsForDisplay = useMemo(() => {
        if (!portfolio) return historyEvents;

        const synthetic: PortfolioEvent[] = [];

        if (portfolio.type === 'real_estate') {
            const now = new Date();
            const existingRentKeys = new Set(
                (historyEvents || [])
                    .filter((e) => e.type === 'rent_income')
                    .map((e) => `${e.assetId || ''}|${monthStartIso(new Date(e.date))}|${Number(e.totalValue || 0).toFixed(2)}`)
            );

            for (const item of items) {
                const status = String(item.customFields?.occupancyStatus || 'Vago');
                const isRented = ['Alugado', 'Parcialmente alugado'].includes(status);
                const monthlyRent = isRented ? (Number(item.customFields?.monthlyRent || 0)) : 0;
                const condo = Number(item.customFields?.condoFee || 0);
                const maintenance = Number(item.customFields?.maintenance || 0);
                const propertyTax = Number(item.customFields?.propertyTax || 0);
                const insurance = Number(item.customFields?.insurance || 0);
                const monthlyCosts = condo + maintenance + propertyTax + insurance;

                const effectiveFromRaw = String(
                    item.customFields?.rentIncomeEffectiveFrom ||
                    item.customFields?.costsEffectiveFrom ||
                    item.initialDate ||
                    ''
                );
                const effectiveFrom = parseFlexibleDate(effectiveFromRaw) || parseFlexibleDate(item.initialDate) || now;
                const cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 1);

                while (cursor <= end) {
                    const monthDate = monthStartIso(cursor);

                    if (monthlyRent > 0) {
                        const rentKey = `${item.id}|${monthDate}|${monthlyRent.toFixed(2)}`;
                        if (!existingRentKeys.has(rentKey)) {
                            synthetic.push({
                                id: `synthetic-rent-${item.id}-${monthDate}`,
                                portfolioId: portfolio.id,
                                assetId: item.id,
                                assetName: item.name,
                                assetCategory: item.category,
                                date: monthDate,
                                createdAt: new Date().toISOString(),
                                type: 'rent_income',
                                eventStatus: 'received',
                                totalValue: monthlyRent,
                                observation: 'Aluguel mensal recebido (sintetico)'
                            });
                        }
                    }

                    if (monthlyCosts > 0) {
                        synthetic.push({
                            id: `synthetic-expense-${item.id}-${monthDate}`,
                            portfolioId: portfolio.id,
                            assetId: item.id,
                            assetName: item.name,
                            assetCategory: item.category,
                            date: monthDate,
                            createdAt: new Date().toISOString(),
                            type: 'adjustment',
                            eventStatus: 'executed',
                            totalValue: -monthlyCosts,
                            observation: 'Despesas mensais do imovel (sintetico)'
                        });
                    }

                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }
        }

        if (portfolio.type !== 'real_estate' && portfolio.type !== 'business' && (dividends || []).length > 0) {
            const existingDividendKeys = new Set(
                (historyEvents || [])
                    .filter((e) => e.type === 'dividend' || e.type === 'jcp')
                    .map((e) => `${e.type}|${e.assetId || e.assetName}|${String(e.date).slice(0, 10)}|${Number(e.totalValue || 0).toFixed(2)}`)
            );

            const itemByMarketAssetId = new Map(
                items
                    .filter((i) => i.market_asset_id)
                    .map((i) => [String(i.market_asset_id), i] as const)
            );
            const itemByTicker = new Map(items.map((i) => [String(i.name || '').toUpperCase(), i] as const));

            for (const d of dividends) {
                const totalAmount = Number(d?.total_amount || 0);
                if (!Number.isFinite(totalAmount) || totalAmount === 0) continue;

                const date = String(d?.payment_date || d?.approved_on || d?.date || '').slice(0, 10);
                if (!date) continue;

                const rawType = String(d?.type || '').toLowerCase();
                const eventType: PortfolioEvent['type'] = rawType.includes('jcp') || rawType.includes('jscp') ? 'jcp' : 'dividend';
                const ticker = String(d?.ticker || '').toUpperCase();
                const itemFromAsset = d?.asset_id ? itemByMarketAssetId.get(String(d.asset_id)) : undefined;
                const itemFromTicker = ticker ? itemByTicker.get(ticker) : undefined;
                const item = itemFromAsset || itemFromTicker;

                const eventKey = `${eventType}|${item?.id || ticker || 'unknown'}|${date}|${totalAmount.toFixed(2)}`;
                if (existingDividendKeys.has(eventKey)) continue;

                synthetic.push({
                    id: d?.id ? `rpc-div-${d.id}` : `rpc-div-${eventType}-${ticker}-${date}-${totalAmount.toFixed(2)}`,
                    portfolioId: portfolio.id,
                    assetId: item?.id || String(d?.asset_id || ''),
                    assetName: item?.name || ticker || 'Provento',
                    assetCategory: item?.category || '',
                    date,
                    createdAt: String(d?.created_at || `${date}T12:00:00`),
                    type: eventType,
                    eventStatus: d?.status === 'provisioned' ? 'expected' : 'received',
                    totalValue: totalAmount,
                    quantity: Number(d?.quantity_held || 0) || undefined,
                    unitPrice: Number(d?.rate || 0) || undefined,
                    observation: d?.status === 'provisioned' ? 'Provento provisionado' : 'Provento recebido'
                });
            }
        }

        return [...historyEvents, ...synthetic];
    }, [portfolio, historyEvents, items, dividends]);

    // Refresh Functions
    const refreshItems = useCallback(async () => {
        if (!portfolio || !user) return;

        try {
            setError(null);

            // Invalidate all related queries to force fresh data on next fetch
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.items(portfolio.id) }),
                queryClient.invalidateQueries({ queryKey: ['events', user.id] }),
                queryClient.invalidateQueries({ queryKey: ['evolution', user.id, portfolio.id] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard', user.id] }),
                queryClient.invalidateQueries({ queryKey: ['categories', user.id] }),
            ]);

            const [loadedItems, loadedEvents] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: queryKeys.items(portfolio.id),
                    queryFn: () => fetchPortfolioItems(portfolio.id),
                }),
                queryClient.fetchQuery({
                    queryKey: queryKeys.events(user.id, `portfolio:${portfolio.id}`),
                    queryFn: () => fetchPortfolioEvents(portfolio.id),
                }),
            ]);
            const loadedDividends = await portfolioService.getUserDividends(portfolio.id, buildDividendFetchRange());
            setItems(loadedItems);
            setHistoryEvents(loadedEvents);
            setDividends(loadedDividends);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao atualizar dados';
            const isAuthError = message.includes('NOT_AUTHENTICATED') ||
                message.includes('nÃ£o autenticado') ||
                message.includes('AUTH_NOT_READY');

            if (!isAuthError) {
                setError(message);
            }
        }
    }, [portfolio, queryClient, user]);

    const refreshPortfolio = useCallback(async () => {
        if (id && user) {
            // Invalidate first
            await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio(id) });

            const p = await queryClient.fetchQuery({
                queryKey: queryKeys.portfolio(id),
                queryFn: () => fetchPortfolioById(id),
            });
            if (p) setPortfolio(p);
        }
    }, [id, queryClient, user]);

    // Computed Values
    const totalValue = useMemo(() => items.reduce((acc, item) => acc + calculateCurrentValue(item), 0), [items]);
    const totalInvested = useMemo(() => items.reduce((acc, item) => acc + calculateTotalInvested(item), 0), [items]);
    const totalUnits = useMemo(() => items.reduce((acc, item) => acc + (item.quantity || 0), 0), [items]);
    const variation = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
    const investmentIncomeEventsForReturn = useMemo(() => {
        if (portfolio?.type === 'real_estate' || portfolio?.type === 'business') return [] as Array<{ date: string; amount: number }>;

        const manualIncome = (historyEvents || [])
            .filter((e) => e.type === 'dividend' || e.type === 'jcp')
            .map((e) => ({
                type: e.type,
                date: String(e.date || '').slice(0, 10),
                amount: Number(e.totalValue || 0),
            }))
            .filter((e) => e.date && Number.isFinite(e.amount) && e.amount !== 0);

        const manualKeys = new Set(
            manualIncome.map((e) => `${e.type}|${e.date}|${e.amount.toFixed(2)}`)
        );

        const rpcIncome = (dividends || [])
            .map((d) => {
                const amount = Number(d?.total_amount || 0);
                const date = String(d?.payment_date || d?.approved_on || d?.date || '').slice(0, 10);
                const rawType = String(d?.type || '').toLowerCase();
                const type = rawType.includes('jcp') || rawType.includes('jscp') ? 'jcp' : 'dividend';
                return { type, date, amount };
            })
            .filter((e) => e.date && Number.isFinite(e.amount) && e.amount !== 0)
            .filter((e) => !manualKeys.has(`${e.type}|${e.date}|${e.amount.toFixed(2)}`));

        return [...manualIncome, ...rpcIncome]
            .map((e) => ({ date: e.date, amount: e.amount }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [portfolio?.type, historyEvents, dividends]);

    // Portfolio-level total return aligned with Visao Geral TRI logic.
    useEffect(() => {
        let cancelled = false;

        const loadPortfolioTotalReturn = async () => {
            const validItems = (items || []).filter((item) => calculateCurrentValue(item) > 0);
            if (validItems.length === 0) {
                if (!cancelled) setPortfolioTotalReturnPct(null);
                return;
            }

            try {
                if (portfolio?.type === 'real_estate') {
                    const invested = validItems.reduce((acc, item) => acc + calculateTotalInvested(item), 0);
                    const currentValue = validItems.reduce((acc, item) => acc + calculateCurrentValue(item), 0);
                    const totalRentIncome = (realEstateNetIncomeEvents || [])
                        .reduce((acc, e) => acc + Number(e.totalValue || 0), 0);

                    const totalReturnPct = invested > 0
                        ? ((currentValue + totalRentIncome - invested) / invested) * 100
                        : 0;

                    if (!cancelled) setPortfolioTotalReturnPct(totalReturnPct);
                    return;
                }

                if (portfolio?.type === 'business') {
                    if (!cancelled) setPortfolioTotalReturnPct(Number(businessMetrics.totalReturnPct || 0));
                    return;
                }

                const marketItems = validItems.filter((item) => !!item.market_asset_id);
                const triReturns = new Map<string, number>();

                if (marketItems.length > 0) {
                    await Promise.all(marketItems.map(async (item) => {
                        try {
                            const invested = calculateTotalInvested(item);
                            const quantity = item.quantity || 1;
                            const avgPrice = quantity > 0 ? invested / quantity : 0;
                            const currentUnitPrice = quantity > 0 ? calculateCurrentValue(item) / quantity : 0;
                            if (!Number.isFinite(avgPrice) || !Number.isFinite(currentUnitPrice) || avgPrice <= 0 || currentUnitPrice <= 0) {
                                return;
                            }
                            const itemDividends = (dividends || []).filter((d) =>
                                d.asset_id === item.market_asset_id ||
                                (item.name && d.ticker && String(d.ticker).startsWith(item.name.split('.')[0]))
                            );
                            const data = await portfolioService.calculateReinvestedReturnFromHistory(
                                item.market_asset_id!,
                                item.initialDate,
                                avgPrice,
                                currentUnitPrice,
                                itemDividends
                            );
                            if (Number.isFinite(Number(data?.total_return_pct))) {
                                triReturns.set(item.id, Number(data.total_return_pct));
                            }
                        } catch {
                            // Falls back to simple return below if TRI fetch fails for an item.
                        }
                    }));
                }

                if (validItems.length > 0) {
                    let weightedReturnSum = 0;
                    let usedWeight = 0;

                    for (const item of validItems) {
                        const currentVal = calculateCurrentValue(item);
                        if (currentVal <= 0) continue;

                        let itemReturnPct = 0;
                        if (item.market_asset_id && triReturns.has(item.id)) {
                            itemReturnPct = Number(triReturns.get(item.id) || 0);
                        } else {
                            const invested = calculateTotalInvested(item);
                            const itemDivs = (dividends || [])
                                .filter(d => d.asset_id === item.market_asset_id || (item.name && d.ticker && String(d.ticker).startsWith(item.name.split('.')[0])))
                                .reduce((acc, d) => acc + Number(d.total_amount || 0), 0);
                            itemReturnPct = invested > 0 ? ((currentVal + itemDivs - invested) / invested) * 100 : 0;
                        }

                        weightedReturnSum += itemReturnPct * currentVal;
                        usedWeight += currentVal;
                    }

                    if (usedWeight > 0) {
                        if (!cancelled) setPortfolioTotalReturnPct(weightedReturnSum / usedWeight);
                        return;
                    }
                }

                const quickTotalInvested = validItems.reduce((acc, item) => acc + calculateTotalInvested(item), 0);
                const quickCurrentValue = validItems.reduce((acc, item) => acc + calculateCurrentValue(item), 0);
                const quickDividends = investmentIncomeEventsForReturn.reduce((acc, d) => acc + Number(d.amount || 0), 0);
                const quickReturnPct = quickTotalInvested > 0
                    ? ((quickCurrentValue + quickDividends - quickTotalInvested) / quickTotalInvested) * 100
                    : 0;

                if (!cancelled) setPortfolioTotalReturnPct(quickReturnPct);
            } catch {
                if (!cancelled) setPortfolioTotalReturnPct(null);
            }
        };

        loadPortfolioTotalReturn();
        return () => { cancelled = true; };
    }, [activeTab, items, dividends, historyEvents, portfolio?.type, realEstateNetIncomeEvents, investmentIncomeEventsForReturn, performanceData]);

    const periodMetrics = useMemo(() => {
        const now = new Date();
        const rangeStart = new Date(now);
        if (timeRange === '6M') rangeStart.setMonth(rangeStart.getMonth() - 6);
        if (timeRange === '1A') rangeStart.setFullYear(rangeStart.getFullYear() - 1);

        const dividendSum = investmentIncomeEventsForReturn.reduce((sum, d) => {
            const divDate = new Date(d.date);
            if (Number.isNaN(divDate.getTime())) return sum;
            if (timeRange === 'ALL' || (divDate >= rangeStart && divDate <= now)) {
                return sum + Number(d.amount || 0);
            }
            return sum;
        }, 0);

        const profitabilityValue = (totalValue + dividendSum) - totalInvested;
        const profitabilityPct = totalInvested > 0 ? (profitabilityValue / totalInvested) * 100 : variation;
        return {
            dividendsReceived: dividendSum,
            profitabilityValue,
            profitabilityPct
        };
    }, [timeRange, investmentIncomeEventsForReturn, totalValue, totalInvested, variation]);

    const indexedMirrorBenchmark = null as string | null;
    const indexedMirrorReturnPct = null as number | null;

    const investmentKpiMetrics = useMemo(() => ({
        totalValue,
        variation,
        periodMetrics,
    }), [totalValue, variation, periodMetrics]);

    // Type-Specific Metrics
    const reMetrics = useMemo(() => portfolioService.getRealEstateMetrics(items), [items]);
    const businessMetrics = useMemo(() => portfolioService.getBusinessMetrics(items, historyEvents), [items, historyEvents]);
    const businessEquitySeries = useMemo(() => {
        if (!portfolio || portfolio.type !== 'business') return [] as any[];
        const totalBase = Number(businessMetrics.totalPatrimonialValue) || 0;
        const factor = totalBase > 0 ? (Number(businessMetrics.totalEquityValueUser) || 0) / totalBase : 1;
        return (evolutionData || []).map((point: any) => ({
            ...point,
            value: (Number(point.value) || 0) * factor,
        }));
    }, [portfolio, businessMetrics.totalPatrimonialValue, businessMetrics.totalEquityValueUser, evolutionData]);
    const businessCashFlowData = useMemo(() => {
        if (!portfolio || portfolio.type !== 'business') return [] as any[];
        const netProfitMap = new Map(
            (businessMetrics.netProfitMonthly || []).map((row: any) => [String(row.month), Number(row.netProfit || 0)])
        );
        return (businessMetrics.cashFlowMonthly || []).map((row: any) => ({
            month: row.month,
            distributions: Number(row.distributions || 0),
            capitalCalls: Number(row.capitalCalls || 0),
            netProfit: Number(netProfitMap.get(String(row.month)) || 0),
        }));
    }, [portfolio, businessMetrics.cashFlowMonthly, businessMetrics.netProfitMonthly]);
    const groupedItems = useMemo(() => portfolioService.getItemsByCategory(items), [items]);

    // Strategy
    const criteriaCount = portfolio?.criteria?.length || 0;
    const idealAllocationMap = useMemo(() =>
        portfolioService.calculateIdealAllocation(items, criteriaCount, portfolio?.categoryTargets),
        [items, criteriaCount, portfolio?.categoryTargets]);

    const usedCategories = useMemo(() => {
        const uniqueCats = new Set(items.map(i => i.category));
        return Array.from(uniqueCats).sort();
    }, [items]);

    // Real Estate Charts Data
    const cashFlowData = useMemo(() => {
        if (!portfolio || portfolio.type !== 'real_estate') return [];
        const net = reMetrics.monthlyNetIncome;
        return [
            { name: 'Receita Bruta', value: reMetrics.monthlyGrossRent, color: '#10b981' },
            { name: 'Custos Fixos', value: reMetrics.monthlyCosts, color: '#ef4444' },
            { name: 'Renda LÃ­quida', value: net, color: net >= 0 ? '#f59e0b' : '#ef4444' },
        ];
    }, [portfolio, reMetrics]);

    const occupancyData = useMemo(() => {
        if (!portfolio || portfolio.type !== 'real_estate') return [];
        const stats = reMetrics.occupancyStats;
        const data = [];
        if (stats.rented > 0) data.push({ name: 'Alugado', value: stats.rented, color: '#10b981' });
        if (stats.vacant > 0) data.push({ name: 'Vago', value: stats.vacant, color: '#ef4444' });
        if (stats.own_use > 0) data.push({ name: 'Uso PrÃ³prio', value: stats.own_use, color: '#3b82f6' });
        if (stats.other > 0) data.push({ name: 'Outros/Reforma', value: stats.other, color: '#71717a' });
        return data;
    }, [portfolio, reMetrics]);

    // Handlers
    const handleSaveEditItem = useCallback(async (updated: CustomItem) => {
        if (!portfolio) return;
        const previous = items.find(i => i.id === updated.id);
        let normalizedUpdated = { ...updated };

        // Keep UI consistent immediately after editing a market-linked automatic asset:
        // preserve the current unit market price and scale value by the edited quantity.
        if (
            previous &&
            previous.market_asset_id &&
            previous.valuationMethod?.type === 'automatic' &&
            normalizedUpdated.valuationMethod?.type === 'automatic'
        ) {
            const prevQty = Number(previous.quantity || 0);
            const nextQty = Number(normalizedUpdated.quantity || 0);
            const prevUnit = prevQty > 0 ? Number(previous.value || 0) / prevQty : 0;
            if (prevUnit > 0 && nextQty >= 0) {
                normalizedUpdated.value = Math.round(prevUnit * nextQty * 100) / 100;
            }
        }

        const newItems = items.map(i => i.id === normalizedUpdated.id ? normalizedUpdated : i);
        setItems(newItems);
        if (selectedItem?.id === normalizedUpdated.id) {
            setSelectedItem(normalizedUpdated);
        }

        await portfolioService.saveCustomItems(portfolio.id, newItems);
        if (user) {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['evolution', user.id, portfolio.id] }),
                queryClient.invalidateQueries({ queryKey: ['performance', user.id, portfolio.id] }),
            ]);
        }
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        await refreshItems();
        setIsEditModalOpen(false);
    }, [portfolio, items, refreshItems, queryClient, selectedItem, user]);

    const handleSaveStrategy = useCallback(async (targets: Record<string, number>) => {
        if (portfolio) {
            await portfolioService.updatePortfolio(portfolio.id, { categoryTargets: targets });
            await refreshPortfolio();
            setIsStrategyModalOpen(false);
        }
    }, [portfolio, refreshPortfolio]);

    const handleSaveSettings = useCallback(async (updates: Partial<Portfolio>) => {
        if (portfolio) {
            await portfolioService.updatePortfolio(portfolio.id, updates);
            await refreshPortfolio();
            setIsSettingsModalOpen(false);
        }
    }, [portfolio, refreshPortfolio]);

    const handleManualUpdate = useCallback(async (val: number, date: string) => {
        if (selectedItem && portfolio) {
            const newHistoryItem = { date: date, value: val, type: 'manual' as const };
            const currentHistory = selectedItem.history || [];
            const updated = {
                ...selectedItem,
                value: val,
                updatedAt: date,
                history: [...currentHistory, newHistoryItem]
            };
            setSelectedItem(updated);

            await portfolioService.addHistoryEvent(portfolio.id, {
                assetId: selectedItem.id,
                assetName: selectedItem.name,
                assetCategory: selectedItem.category,
                date: date,
                type: 'manual_update',
                totalValue: val,
                observation: 'AtualizaÃ§Ã£o manual de valor'
            });
            await refreshItems();
        }
    }, [selectedItem, portfolio, refreshItems]);

    // AIDEV-NOTE: Item creation with Zod validation. Validates all required fields before creating.
    const handleCreateItem = useCallback(async (draft?: Partial<CustomItem>) => {
        if (!portfolio) return;
        const sourceItem = draft ? { ...newItem, ...draft } : newItem;

        // Validate with Zod schema
        const { createItemSchema } = await import('../../../../lib/validation/schemas');
        const validationData = {
            name: sourceItem.name || '',
            category: sourceItem.category,
            description: sourceItem.description,
            currency: portfolio.currency,
            initialValue: Number(sourceItem.initialValue) || 0,
            initialDate: sourceItem.initialDate || new Date().toISOString().split('T')[0],
            value: Number(sourceItem.value) || Number(sourceItem.initialValue) || 0,
            quantity: Number(sourceItem.quantity) || 1,
            tags: sourceItem.tags || [],
            customFields: sourceItem.customFields || {},
        };

        console.log('DEBUG: handleCreateItem called', validationData);
        const errors: Record<string, string[]> = {};

        // AIDEV-NOTE: Manual check to ensure behavior and provide instant feedback
        if (!validationData.category) {
            errors['category'] = ['O tipo de ativo é obrigatório.'];
        }
        if (!validationData.name) {
            errors['name'] = ['O nome do ativo é obrigatório.'];
        }

        if (Object.keys(errors).length > 0) {
            console.error('DEBUG: Validation failed (manual check)', errors);
            setValidationErrors(errors);
            return;
        }

        const validationResult = createItemSchema.safeParse(validationData);
        if (!validationResult.success) {
            const fieldErrors = validationResult.error.flatten().fieldErrors;
            console.error('Erro de validação ao criar item:', fieldErrors);
            setValidationErrors(fieldErrors as Record<string, string[]>);
            return;
        }

        setValidationErrors(null);

        // 2. Wrap everything else in a global try/catch to catch DB/RPC errors
        try {
            const initialTransaction: Transaction = {
                id: crypto.randomUUID(),
                type: 'buy',
                date: (sourceItem.initialDate || new Date().toISOString()).split('T')[0],
                quantity: Number(sourceItem.quantity) || 1,
                unitPrice: (Number(sourceItem.initialValue) || 0) / Math.max(1, Number(sourceItem.quantity) || 1),
                totalValue: Number(sourceItem.initialValue) || 0,
                observation: 'Lote inicial',
                createdAt: new Date().toISOString(),
                valuationMethod: sourceItem.valuationMethod || { type: 'manual' }
            };

            const itemToCreate: CustomItem = {
                id: crypto.randomUUID(),
                name: sourceItem.name!,
                category: sourceItem.category!,
                currency: portfolio.currency,
                initialValue: Number(sourceItem.initialValue) || 0,
                value: Number(sourceItem.value) || Number(sourceItem.initialValue) || 0,
                initialDate: sourceItem.initialDate || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                valuationMethod: sourceItem.valuationMethod || { type: 'manual' },
                market_asset_id: sourceItem.market_asset_id,
                transactions: Number(sourceItem.initialValue) > 0 ? [initialTransaction] : [],
                history: sourceItem.history || [{
                    date: new Date().toISOString(),
                    value: Number(sourceItem.initialValue) || 0,
                    type: 'initial'
                }],
                metadata: {},
                customFields: sourceItem.customFields || {},
                quantity: Number(sourceItem.quantity) || 1,
                tags: sourceItem.tags || []
            };

            await portfolioService.saveCustomItems(portfolio.id, [...items, itemToCreate]);

            await portfolioService.addHistoryEvent(portfolio.id, {
                assetId: itemToCreate.id,
                assetName: itemToCreate.name,
                assetCategory: itemToCreate.category,
                date: itemToCreate.initialDate,
                type: 'create',
                quantity: itemToCreate.quantity,
                unitPrice: (itemToCreate.initialValue / (itemToCreate.quantity || 1)),
                totalValue: itemToCreate.initialValue,
                observation: 'Criação do ativo'
            });

            if (itemToCreate.customFields?.occupancyStatus === 'Alugado' || itemToCreate.customFields?.occupancyStatus === 'Parcialmente alugado') {
                await portfolioService.addHistoryEvent(portfolio.id, {
                    assetId: itemToCreate.id,
                    assetName: itemToCreate.name,
                    assetCategory: itemToCreate.category,
                    date: itemToCreate.initialDate,
                    type: 'rent_start',
                    totalValue: Number(itemToCreate.customFields.monthlyRent) || 0,
                    eventStatus: 'executed',
                    observation: 'Contrato ativo na criação'
                });
            }

            // AIDEV-NOTE: Capture asset_added event (asset_type only, no IDs or values)
            const { captureAssetAdded } = await import('../../../../lib/analytics');
            captureAssetAdded(portfolio.type);

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                user ? queryClient.invalidateQueries({ queryKey: ['evolution', user.id, portfolio.id] }) : Promise.resolve(),
                user ? queryClient.invalidateQueries({ queryKey: ['performance', user.id, portfolio.id] }) : Promise.resolve(),
            ]);

            // Trigger refresh (swallow error to allow modal close)
            try {
                await refreshItems();
            } catch (refreshErr) {
                console.warn('Silent refresh failed after create:', refreshErr);
            }

            setIsAddModalOpen(false);
        } catch (globalError: any) {
            console.error('CRITICAL: Failed to create item:', globalError);
            setValidationErrors({
                'form': [`Erro ao salvar ativo: ${globalError.message || 'Erro desconhecido'}.`]
            });
        }
    }, [portfolio, newItem, items, refreshItems, queryClient, user]);

    // AIDEV-NOTE: Transaction handling with type-safe rent and dividend transactions.
    // Uses discriminated unions to safely access type-specific fields.
    const handleSaveTransaction = useCallback(async (assetId: string, transactionData: Omit<Transaction | RentTransaction | DividendTransaction, 'id' | 'createdAt'> & { retroactive?: boolean, closeRent?: boolean }) => {
        if (!portfolio) return;

        const targetItem = items.find(i => i.id === assetId);
        if (!targetItem) return;

        if (transactionData.type === 'rent_start' || transactionData.type === 'rent_end') {
            const rentData = transactionData as Omit<RentTransaction, 'id' | 'createdAt'>;
            await portfolioService.processRentEvent(
                portfolio.id,
                targetItem,
                transactionData.type === 'rent_start' ? 'start' : 'end',
                {
                    date: transactionData.date,
                    amount: transactionData.totalValue,
                    observation: transactionData.observation || '',
                    rentIndexer: rentData.rentIndexer,
                    rentAdjustmentMonth: rentData.rentAdjustmentMonth?.toString()
                }
            );
            // AIDEV-NOTE: Capture transaction_added event (type only, no values)
            const { captureTransactionAdded } = await import('../../../../lib/analytics');
            captureTransactionAdded(transactionData.type);
            await refreshItems();
            return;
        }

        if (
            transactionData.type === 'dividend' ||
            transactionData.type === 'jcp' ||
            transactionData.type === 'profit_registered' ||
            transactionData.type === 'profit_distribution' ||
            transactionData.type === 'profit_report' ||
            transactionData.type === 'distribution' ||
            transactionData.type === 'capital_call'
        ) {
            const dividendData = transactionData as Omit<DividendTransaction, 'id' | 'createdAt'>;
            await portfolioService.addHistoryEvent(portfolio.id, {
                assetId: targetItem.id,
                assetName: targetItem.name,
                assetCategory: targetItem.category,
                date: transactionData.date,
                type: transactionData.type,
                totalValue: transactionData.totalValue,
                observation: transactionData.observation,
                period: dividendData.period,
                periodStart: (transactionData as any).periodStart,
                periodEnd: (transactionData as any).periodEnd,
                payload: (transactionData as any).payload
            });
            // AIDEV-NOTE: Capture transaction_added event (type only, no values)
            const { captureTransactionAdded } = await import('../../../../lib/analytics');
            captureTransactionAdded(transactionData.type);
            await refreshItems();
            return;
        }

        if (transactionData.type === 'manual_update' || transactionData.type === 'valuation_update') {
            const newValue = transactionData.totalValue;
            const newHistoryEntry = {
                date: transactionData.date,
                value: newValue,
                type: 'manual' as const,
                note: transactionData.observation || 'Atualização de preço'
            };

            const updatedItem: CustomItem = {
                ...targetItem,
                value: newValue,
                updatedAt: new Date().toISOString(),
                history: [...(targetItem.history || []), newHistoryEntry]
            };

            const newItemsList = items.map(i => i.id === assetId ? updatedItem : i);
            await portfolioService.saveCustomItems(portfolio.id, newItemsList);

            await portfolioService.addHistoryEvent(portfolio.id, {
                assetId: targetItem.id,
                assetName: targetItem.name,
                assetCategory: targetItem.category,
                date: transactionData.date,
                type: transactionData.type,
                unitPrice: transactionData.unitPrice,
                totalValue: newValue,
                observation: transactionData.observation
            });

        } else {
            if (transactionData.type === 'buy') {
                const currentQty = Number(targetItem.quantity || 0);
                const txNetQty = (targetItem.transactions || []).reduce((acc, t) => {
                    if (t.type === 'buy') return acc + Number(t.quantity || 0);
                    if (t.type === 'sell') return acc - Number(t.quantity || 0);
                    return acc;
                }, 0);
                const baseQty = Math.max(0, currentQty - txNetQty);
                const initialValue = Number(targetItem.initialValue || 0);
                const txQty = Number(transactionData.quantity || 0);
                const txTotal = Number(transactionData.totalValue || 0);
                const itemInitialDate = String(targetItem.initialDate || '').split('T')[0];
                const txDate = String(transactionData.date || '').split('T')[0];
                const approxEqual = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

                const duplicatesBaseLotExactly =
                    baseQty > 0 &&
                    initialValue > 0 &&
                    itemInitialDate &&
                    txDate === itemInitialDate &&
                    approxEqual(txQty, baseQty, 1e-8) &&
                    approxEqual(txTotal, initialValue, 0.01);

                if (duplicatesBaseLotExactly) {
                    const message = 'Compra bloqueada: este lancamento replica exatamente o lote inicial (mesma data, quantidade e valor). Isso duplicaria o custo investido e distorceria a rentabilidade.';
                    setValidationErrors({ form: [message] });
                    if (typeof window !== 'undefined') window.alert(message);
                    return;
                }
            }

            const valuationSnapshot = { ...targetItem.valuationMethod };

            const newTransaction: Transaction = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                ...transactionData,
                valuationMethod: valuationSnapshot
            };

            const isBuy = transactionData.type === 'buy';
            const currentQty = targetItem.quantity || 0;
            const qtyDelta = isBuy ? transactionData.quantity : -transactionData.quantity;
            const newTotalQuantity = Math.max(0, currentQty + qtyDelta);

            const newHistoryEntry = {
                date: transactionData.date,
                value: 0,
                type: 'event' as const,
                note: `${isBuy ? (portfolio.type === 'business' ? 'Aporte' : 'Compra') : (portfolio.type === 'business' ? 'Diluição' : 'Venda')} de ${transactionData.quantity} un.`
            };

            let customFieldsUpdate = {};
            if ((transactionData as any).closeRent) {
                customFieldsUpdate = {
                    occupancyStatus: 'Vago',
                    monthlyRent: 0,
                    rentIndexer: '',
                    rentAdjustmentMonth: ''
                };
                await portfolioService.addHistoryEvent(portfolio.id, {
                    assetId: targetItem.id,
                    assetName: targetItem.name,
                    assetCategory: targetItem.category,
                    date: transactionData.date,
                    type: 'rent_end',
                    totalValue: 0,
                    eventStatus: 'executed',
                    observation: 'Encerramento automático por venda'
                });
            }

            // AIDEV-FIX: Robust local value update. 
            // Calculate new temporary value based on transaction
            let newValue = targetItem.value || 0;
            if (targetItem.valuationMethod.type === 'automatic' && (targetItem.quantity || 0) > 0) {
                // For automatic assets, maintain the current unit price for the new quantity
                const currentUnitPrice = (targetItem.value || 0) / (targetItem.quantity || 1);
                newValue = newTotalQuantity * currentUnitPrice;
            } else {
                // For manual or others, simply add/subtract the transaction value (cash flow)
                newValue = isBuy ? (newValue + transactionData.totalValue) : Math.max(0, newValue - transactionData.totalValue);
            }

            const updatedItem: CustomItem = {
                ...targetItem,
                quantity: newTotalQuantity,
                value: newValue,
                history: [...(targetItem.history || []), newHistoryEntry],
                transactions: [...(targetItem.transactions || []), newTransaction],
                updatedAt: new Date().toISOString(),
                customFields: { ...targetItem.customFields, ...customFieldsUpdate }
            };

            const newItemsList = items.map(i => i.id === assetId ? updatedItem : i);
            await portfolioService.saveCustomItems(portfolio.id, newItemsList);

            await portfolioService.addHistoryEvent(portfolio.id, {
                assetId: targetItem.id,
                assetName: targetItem.name,
                assetCategory: targetItem.category,
                date: transactionData.date,
                type: transactionData.type,
                quantity: transactionData.quantity,
                unitPrice: transactionData.unitPrice,
                totalValue: transactionData.totalValue,
                observation: transactionData.observation
            });
        }

        // AIDEV-NOTE: Capture transaction_added event for buy/sell/manual_update (type only, no values)
        const { captureTransactionAdded } = await import('../../../../lib/analytics');
        captureTransactionAdded(transactionData.type);

        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.items(portfolio.id) }),
            user ? queryClient.invalidateQueries({ queryKey: ['events', user.id] }) : Promise.resolve(),
            user ? queryClient.invalidateQueries({ queryKey: ['evolution', user.id, portfolio.id] }) : Promise.resolve(),
            user ? queryClient.invalidateQueries({ queryKey: ['performance', user.id, portfolio.id] }) : Promise.resolve(),
            user ? queryClient.invalidateQueries({ queryKey: ['dashboard', user.id] }) : Promise.resolve(),
            user ? queryClient.invalidateQueries({ queryKey: ['categories', user.id] }) : Promise.resolve(),
        ]);

        const [loadedItems, loadedEvents] = await Promise.all([
            fetchPortfolioItems(portfolio.id),
            user ? fetchPortfolioEvents(portfolio.id) : Promise.resolve(historyEvents),
        ]);

        const savedItem = loadedItems.find((item) => item.id === assetId);
        const requiresCostBasisFallback =
            (transactionData.type === 'buy' || transactionData.type === 'sell') &&
            !hasMatchingPersistedTransaction(savedItem, {
                type: transactionData.type,
                date: transactionData.date,
                quantity: transactionData.quantity,
                totalValue: transactionData.totalValue,
            });

        if (requiresCostBasisFallback && savedItem) {
            const signedDelta = transactionData.type === 'buy'
                ? Number(transactionData.totalValue || 0)
                : -Number(transactionData.totalValue || 0);

            const repairedItem: CustomItem = {
                ...savedItem,
                initialValue: Math.max(0, Number(savedItem.initialValue || 0) + signedDelta),
                updatedAt: new Date().toISOString(),
            };

            await portfolioService.saveCustomItems(
                portfolio.id,
                loadedItems.map((item) => item.id === assetId ? repairedItem : item)
            );

            const repairedItems = await fetchPortfolioItems(portfolio.id);
            setItems(repairedItems);
            setHistoryEvents(loadedEvents);
            return;
        }

        setItems(loadedItems);
        setHistoryEvents(loadedEvents);
    }, [portfolio, items, user, historyEvents, queryClient]);

    const confirmDelete = useCallback(async () => {
        if (!portfolio || !selectedItem) return;

        await portfolioService.migrateItemHistory(portfolio.id, selectedItem);
        await portfolioService.removeAssetIncomeHistory(portfolio.id, selectedItem.id);
        await portfolioService.saveCustomItems(
            portfolio.id,
            items.filter((item) => item.id !== selectedItem.id)
        );

        await portfolioService.addHistoryEvent(portfolio.id, {
            assetId: selectedItem.id,
            assetName: selectedItem.name,
            assetCategory: selectedItem.category,
            date: new Date().toISOString(),
            type: 'delete',
            totalValue: 0,
            observation: `Ativo excluído. Valor final aproximado: ${formatCurrency(calculateCurrentValue(selectedItem), portfolio.currency)}`
        });

        setIsDeleteConfirmOpen(false);
        setSelectedItem(null);
        if (user) {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['evolution', user.id, portfolio.id] }),
                queryClient.invalidateQueries({ queryKey: ['performance', user.id, portfolio.id] }),
            ]);
        }
        await refreshItems();
    }, [portfolio, selectedItem, items, refreshItems, queryClient, user]);

    return {
        // Core Data
        portfolio,
        items,
        historyEvents,
        historyEventsForDisplay,
        categories,
        realEstateNetIncomeEvents,

        // Loading & Error
        loading,
        error,
        validationErrors,

        // UI State
        timeRange,
        setTimeRange,
        activeTab,
        setActiveTab,

        // Modal State
        isAddModalOpen,
        setIsAddModalOpen,
        isEditModalOpen,
        setIsEditModalOpen,
        isTransactionModalOpen,
        setIsTransactionModalOpen,
        isDeleteConfirmOpen,
        setIsDeleteConfirmOpen,
        isStrategyModalOpen,
        setIsStrategyModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,

        // Selection
        selectedItem,
        setSelectedItem,
        newItem,
        setNewItem,

        // Computed Values
        totalValue,
        totalInvested,
        totalUnits,
        variation,
        periodMetrics,
        investmentKpiMetrics,
        indexedMirrorReturnPct,
        reMetrics,
        businessMetrics,
        businessEquitySeries,
        businessCashFlowData,
        groupedItems,
        evolutionData,
        performanceData,
        performanceLoading,
        benchmarks,
        portfolioTotalReturnPct,
        idealAllocationMap,
        usedCategories,
        cashFlowData,
        occupancyData,
        criteriaCount,

        // Handlers
        handleSaveEditItem,
        handleSaveStrategy,
        handleSaveSettings,
        handleManualUpdate,
        handleCreateItem,
        handleSaveTransaction,
        confirmDelete,
        refreshItems,
        refreshPortfolio,
        dividends, // Exposed
    };
}
