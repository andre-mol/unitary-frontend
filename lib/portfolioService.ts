/**
 * Portfolio Service - Facade Pattern
 * 
 * This service acts as a facade, delegating data operations to a repository
 * while maintaining all business logic and calculations.
 * 
 * The API remains 100% unchanged for all consumers.
 * 
 * ============================================================
 * ASYNC BY DESIGN
 * All data operations are now async, preparing for Supabase migration.
 * ============================================================
 * 
 * BACKEND SWITCHING:
 * The storage backend is configured in config/storage.ts
 * Change STORAGE_BACKEND constant to switch between:
 * - 'localStorage' (current, offline-first)
 * - 'supabase' (cloud database)
 */

import { Portfolio, CustomItem, DashboardConfig, ValuationMethod, Transaction, PortfolioEvent } from '../types';
import type { PortfolioRepository } from '../domain/repositories/PortfolioRepository';
import type { Expense, Income } from '../domain/repositories/PlanningRepository';
import { CreateHistoryEventDTO } from '../domain/repositories/PortfolioRepository';

// Import repository factory from central config
import {
    createPortfolioRepository,
    createPlanningRepository,
    PORTFOLIO_UPDATE_EVENT as UPDATE_EVENT
} from '../config/storage';

// Import pure calculation functions from domain
import {
    calculateCurrentValue as calcCurrentValue,
    calculateTotalInvested as calcTotalInvested,
    getValueAtDate as calcValueAtDate
} from '../domain/calculations/asset';
import {
    calculateScore as calcScore,
    calculateIdealAllocation as calcIdealAllocation,
    calculateBusinessMetrics as calcBusinessMetrics,
    calculatePortfolioScore as calcPortfolioScore,
    groupItemsByCategory as calcGroupItemsByCategory
} from '../domain/calculations/portfolio';
import {
    calculateRealEstateMetrics as calcRealEstateMetrics
} from '../domain/calculations/real-estate';

// ============================================================
// REPOSITORY INSTANCE (created via factory from config/storage.ts)
// ============================================================
const repository: PortfolioRepository = createPortfolioRepository();
const planningRepository = createPlanningRepository();

function normalizeBenchmarkName(name: string): string {
    const normalized = (name || '').trim().toUpperCase();
    const aliases: Record<string, string> = {
        'IBOV': '^BVSP',
        'IBOVESPA': '^BVSP',
        '^IBOV': '^BVSP',
        'SPX': '^GSPC',
        'S&P500': '^GSPC',
        'IFIX.SA': 'IFIX',
        'IDIV.SA': 'IDIV',
        'SMLL.SA': 'SMLL'
    };
    return aliases[normalized] || normalized;
}

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

function buildLocalPerformanceSeriesFromNav(
    navSeries: Array<{ name?: string; fullDate: string; value: number }>,
    portfolioItems: CustomItem[],
    dividendRows: any[]
): Array<{ name: string; fullDate: string; value: number; valuePrice: number }> {
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
        (acc, item) => acc + Number(calcCurrentValue(item) || 0),
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

        // Some backends return the latest NAV as unit price instead of total position value.
        // Only scale when the portfolio is a single market asset and the ratio clearly matches
        // the held quantity. Broad "integer-ish" scaling was causing massive false positives.
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
            const status = String(row?.status || '').toLowerCase();
            if (!paymentDate || !Number.isFinite(amount) || amount <= 0 || status === 'provisioned') return null;
            if (paymentDate.getTime() > Date.now()) return null;
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
        const currentNav = (Number(point.value) || 0) * navScale;
        const adjustedValue = currentNav * reinvestmentFactor;

        return {
            name: point.name || point.fullDate.slice(0, 10),
            fullDate: point.fullDate,
            value: investedBasis > 0 ? (adjustedValue / investedBasis) - 1 : 0,
            valuePrice: investedBasis > 0 ? (currentNav / investedBasis) - 1 : 0,
        };
    });

    const firstItemDate = itemCosts[0]?.date;
    const firstPointDate = String(synthetic[0]?.fullDate || '').slice(0, 10);

    if (firstItemDate && firstPointDate && firstItemDate < firstPointDate) {
        synthetic.unshift({
            name: firstItemDate,
            fullDate: firstItemDate,
            value: 0,
            valuePrice: 0,
        });
    }

    return synthetic;
}

function buildRealEstatePerformanceSeriesFromNav(
    navSeries: Array<{ name?: string; fullDate: string; value: number }>,
    portfolioItems: CustomItem[]
): Array<{ name: string; fullDate: string; value: number; valuePrice: number }> {
    const acquisitionCost = (portfolioItems || []).reduce((acc, item) => acc + Number(calcTotalInvested(item) || 0), 0);
    if (!Number.isFinite(acquisitionCost) || acquisitionCost <= 0) return [];

    const sortedNav = [...(navSeries || [])]
        .filter((point) => point?.fullDate && Number.isFinite(Number(point?.value)))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    if (sortedNav.length === 0) return [];

    const monthlyNetIncomeEvents: Array<{ ts: number; amount: number }> = [];
    const now = new Date();
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const item of portfolioItems || []) {
        const occupancyStatus = String(item.customFields?.occupancyStatus || 'Vago');
        if (!['Alugado', 'Parcialmente alugado'].includes(occupancyStatus)) continue;

        const monthlyRent = Number(item.customFields?.monthlyRent || 0);
        const condo = Number(item.customFields?.condoFee || 0);
        const maintenance = Number(item.customFields?.maintenance || 0);
        const propertyTax = Number(item.customFields?.propertyTax || 0);
        const insurance = Number(item.customFields?.insurance || 0);
        const monthlyNet = monthlyRent - (condo + maintenance + propertyTax + insurance);
        if (!Number.isFinite(monthlyNet) || monthlyNet === 0) continue;

        const effectiveFrom =
            parseFlexibleDate(String(item.customFields?.rentIncomeEffectiveFrom || '')) ||
            parseFlexibleDate(item.initialDate) ||
            null;
        if (!effectiveFrom) continue;

        const cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
        while (cursor <= endMonth) {
            monthlyNetIncomeEvents.push({
                ts: cursor.getTime(),
                amount: monthlyNet,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
    }

    monthlyNetIncomeEvents.sort((a, b) => a.ts - b.ts);

    let incomeIdx = 0;
    let cumulativeIncome = 0;

    return sortedNav.map((point) => {
        const pointTs = new Date(point.fullDate).getTime();
        while (incomeIdx < monthlyNetIncomeEvents.length && monthlyNetIncomeEvents[incomeIdx].ts <= pointTs) {
            cumulativeIncome += monthlyNetIncomeEvents[incomeIdx].amount;
            incomeIdx += 1;
        }

        const absoluteValue = Number(point.value || 0) + cumulativeIncome;
        const cumulativeReturn = (absoluteValue / acquisitionCost) - 1;

        return {
            name: point.name || point.fullDate.slice(0, 10),
            fullDate: point.fullDate,
            value: Number.isFinite(cumulativeReturn) ? cumulativeReturn : 0,
            valuePrice: 0,
        };
    });
}

type CanonicalEconomicPoint = {
    name: string;
    fullDate: string;
    economicValue: number;
    investedBasis: number;
};

function economicSeriesToPerformanceSeries(
    series: CanonicalEconomicPoint[]
): Array<{ name: string; fullDate: string; value: number; valuePrice: number }> {
    return (series || []).map((point) => ({
        name: point.name,
        fullDate: point.fullDate,
        value: point.investedBasis > 0 ? (point.economicValue / point.investedBasis) - 1 : 0,
        valuePrice: 0,
    }));
}

function buildInvestmentEconomicSeriesFromNav(
    navSeries: Array<{ name?: string; fullDate: string; value: number }>,
    portfolioItems: CustomItem[],
    dividendRows: any[]
): CanonicalEconomicPoint[] {
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

    const currentPortfolioValue = (portfolioItems || []).reduce(
        (acc, item) => acc + Number(calcCurrentValue(item) || 0),
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
            const status = String(row?.status || '').toLowerCase();
            if (!paymentDate || !Number.isFinite(amount) || amount <= 0 || status === 'provisioned') return null;
            if (paymentDate.getTime() > Date.now()) return null;
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

    const economicSeries = sortedNav.map((point) => {
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
        const currentNav = (Number(point.value) || 0) * navScale;
        const adjustedValue = currentNav * reinvestmentFactor;

        return {
            name: point.name || point.fullDate.slice(0, 10),
            fullDate: point.fullDate,
            economicValue: adjustedValue,
            investedBasis,
        };
    });

    const firstItemDate = itemCosts[0]?.date;
    const firstPointDate = String(economicSeries[0]?.fullDate || '').slice(0, 10);

    if (firstItemDate && firstPointDate && firstItemDate < firstPointDate) {
        economicSeries.unshift({
            name: firstItemDate,
            fullDate: firstItemDate,
            economicValue: itemCosts[0].invested,
            investedBasis: itemCosts[0].invested,
        });
    }

    return economicSeries;
}

function buildRealEstateEconomicSeriesFromNav(
    navSeries: Array<{ name?: string; fullDate: string; value: number }>,
    portfolioItems: CustomItem[]
): CanonicalEconomicPoint[] {
    const itemCosts = buildInvestedTimeline(portfolioItems);
    const totalInvested = itemCosts.reduce((acc, entry) => acc + entry.invested, 0);
    if (!Number.isFinite(totalInvested) || totalInvested <= 0) return [];

    const sortedNav = [...(navSeries || [])]
        .filter((point) => point?.fullDate && Number.isFinite(Number(point?.value)))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    if (sortedNav.length === 0) return [];

    const getInvestedBasisAt = (ts: number) => {
        let basis = 0;
        for (const entry of itemCosts) {
            if (entry.ts <= ts) {
                basis += entry.invested;
                continue;
            }
            break;
        }
        return basis > 0 ? basis : totalInvested;
    };

    const monthlyNetIncomeEvents: Array<{ ts: number; amount: number }> = [];
    const now = new Date();
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const item of portfolioItems || []) {
        const occupancyStatus = String(item.customFields?.occupancyStatus || 'Vago');
        if (!['Alugado', 'Parcialmente alugado'].includes(occupancyStatus)) continue;

        const monthlyRent = Number(item.customFields?.monthlyRent || 0);
        const condo = Number(item.customFields?.condoFee || 0);
        const maintenance = Number(item.customFields?.maintenance || 0);
        const propertyTax = Number(item.customFields?.propertyTax || 0);
        const insurance = Number(item.customFields?.insurance || 0);
        const monthlyNet = monthlyRent - (condo + maintenance + propertyTax + insurance);
        if (!Number.isFinite(monthlyNet) || monthlyNet === 0) continue;

        const effectiveFrom =
            parseFlexibleDate(String(item.customFields?.rentIncomeEffectiveFrom || '')) ||
            parseFlexibleDate(item.initialDate) ||
            null;
        if (!effectiveFrom) continue;

        const cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
        while (cursor <= endMonth) {
            monthlyNetIncomeEvents.push({
                ts: cursor.getTime(),
                amount: monthlyNet,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }
    }

    monthlyNetIncomeEvents.sort((a, b) => a.ts - b.ts);

    let incomeIdx = 0;
    let cumulativeIncome = 0;

    return sortedNav.map((point) => {
        const pointTs = new Date(point.fullDate).getTime();
        while (incomeIdx < monthlyNetIncomeEvents.length && monthlyNetIncomeEvents[incomeIdx].ts <= pointTs) {
            cumulativeIncome += monthlyNetIncomeEvents[incomeIdx].amount;
            incomeIdx += 1;
        }

        return {
            name: point.name || point.fullDate.slice(0, 10),
            fullDate: point.fullDate,
            economicValue: Number(point.value || 0) + cumulativeIncome,
            investedBasis: getInvestedBasisAt(pointTs),
        };
    });
}

function buildBusinessEconomicSeriesFromNav(
    navSeries: Array<{ name?: string; fullDate: string; value: number }>,
    portfolioItems: CustomItem[],
    historyEvents: PortfolioEvent[]
): CanonicalEconomicPoint[] {
    const businessMetrics = calcBusinessMetrics(portfolioItems, historyEvents);
    const investedBasis = Number(businessMetrics.totalInvestedCapital || 0);
    if (!Number.isFinite(investedBasis) || investedBasis <= 0) return [];

    const equityFactor = Number(businessMetrics.totalPatrimonialValue || 0) > 0
        ? (Number(businessMetrics.totalEquityValueUser || 0) / Number(businessMetrics.totalPatrimonialValue || 0))
        : 1;

    const distributionsByMonth = new Map(
        (businessMetrics.cashFlowMonthly || []).map((row) => [String(row.month), Number(row.distributions || 0)] as const)
    );

    const sortedNav = [...(navSeries || [])]
        .filter((point) => point?.fullDate && Number.isFinite(Number(point?.value)))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    if (sortedNav.length === 0) return [];

    let cumulativeDistributions = 0;
    let lastMonthKey = '';

    return sortedNav.map((point) => {
        const monthKey = String(point.fullDate).slice(0, 7);
        if (monthKey !== lastMonthKey) {
            cumulativeDistributions += Number(distributionsByMonth.get(monthKey) || 0);
            lastMonthKey = monthKey;
        }

        const equityValueUser = Number(point.value || 0) * equityFactor;

        return {
            name: point.name || point.fullDate.slice(0, 10),
            fullDate: point.fullDate,
            economicValue: equityValueUser + cumulativeDistributions,
            investedBasis,
        };
    });
}

async function getCanonicalPortfolioEconomicSeries(
    portfolio: Portfolio,
    range: '6M' | '1A' | 'ALL'
): Promise<CanonicalEconomicPoint[]> {
    const [items, navSeries] = await Promise.all([
        portfolioService.getCustomItems(portfolio.id),
        portfolioService.getEvolutionData(portfolio.id, range),
    ]);

    if (!items.length || !navSeries.length) return [];

    if (portfolio.type === 'real_estate') {
        return buildRealEstateEconomicSeriesFromNav(navSeries, items);
    }

    if (portfolio.type === 'business') {
        const historyEvents = await portfolioService.getHistoryEvents(portfolio.id);
        return buildBusinessEconomicSeriesFromNav(navSeries, items, historyEvents);
    }

    const startDate = new Date(navSeries[0].fullDate);
    const endDate = new Date(navSeries[navSeries.length - 1].fullDate);
    const dividendRows = await portfolioService.getUserDividends(portfolio.id, { start: startDate, end: endDate });
    return buildInvestmentEconomicSeriesFromNav(navSeries, items, dividendRows);
}

function filterDividendRowsByItemAcquisition(dividendRows: any[], portfolioItems: CustomItem[]): any[] {
    if (!Array.isArray(dividendRows) || dividendRows.length === 0 || !Array.isArray(portfolioItems) || portfolioItems.length === 0) {
        return dividendRows || [];
    }

    const itemByAssetId = new Map(
        portfolioItems
            .filter((item) => !!item.market_asset_id)
            .map((item) => [String(item.market_asset_id), item] as const)
    );

    const itemByTicker = new Map(
        portfolioItems.map((item) => [String(item.name || '').replace(/\.SA$/i, '').toUpperCase(), item] as const)
    );

    return dividendRows.filter((row) => {
        const assetId = String(row?.asset_id || '');
        const ticker = String(row?.ticker || '').replace(/\.SA$/i, '').toUpperCase();
        const item = (assetId ? itemByAssetId.get(assetId) : undefined) || (ticker ? itemByTicker.get(ticker) : undefined);
        if (!item?.initialDate) return true;

        const itemStart = String(item.initialDate).slice(0, 10);
        const dividendDate = String(row?.payment_date || row?.approved_on || row?.date || '').slice(0, 10);
        if (!dividendDate) return true;

        return dividendDate >= itemStart;
    });
}

// Helper to generate month range from start to end (YYYY-MM format)
function generateMonthRange(from: Date, to: Date): string[] {
    const months: string[] = [];
    const current = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);

    // Limit to 120 months (10 years) for performance
    const maxMonths = 120;
    let count = 0;

    while (current <= end && count < maxMonths) {
        months.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
        count++;
    }

    return months;
}

// Helper to sync Real Estate expenses - generates rows for all months from effective_from
async function syncRealEstateExpenses(items: CustomItem[]) {
    try {
        const now = new Date();
        const expensesToUpsert: Expense[] = [];

        for (const item of items) {
            // We only care about items that have potential monthly costs
            if (!item.customFields) continue;

            const {
                condoFee,
                propertyTax,
                insurance,
                maintenance,
                costsEffectiveFrom
            } = item.customFields as any;

            const condo = Number(condoFee) || 0;
            const taxAnnual = Number(propertyTax) || 0;
            const insuranceAnnual = Number(insurance) || 0;
            const maint = Number(maintenance) || 0;

            // Calculate monthly equivalents (annual costs spread per month)
            const taxMonthly = taxAnnual;
            const insuranceMonthly = insuranceAnnual;

            // Skip if no costs configured
            if (condo === 0 && maint === 0 && taxMonthly === 0 && insuranceMonthly === 0) {
                continue;
            }

            // Determine effective date (default: today)
            const effectiveFrom = costsEffectiveFrom
                ? new Date(costsEffectiveFrom)
                : now;
            const effectiveFromStr = effectiveFrom.toISOString().slice(0, 10);

            // Generate all months from effective_from to current month
            const months = generateMonthRange(effectiveFrom, now);

            // Definition of costs to sync
            const costs = [
                { name: 'Condomínio', value: condo },
                { name: 'Manutenção', value: maint },
                { name: 'IPTU (Mensal)', value: taxMonthly },
                { name: 'Seguro Incêndio (Mensal)', value: insuranceMonthly }
            ];

            for (const month of months) {
                for (const cost of costs) {
                    // Only create rows for costs > 0
                    if (cost.value <= 0) continue;

                    expensesToUpsert.push({
                        id: crypto.randomUUID(),
                        month,
                        category: 'Moradia',
                        name: `${item.name} - ${cost.name}`,
                        value: Number(cost.value.toFixed(2)),
                        type: 'fixo',
                        source: 'real_estate',
                        sourceRef: item.id,
                        effectiveFrom: effectiveFromStr,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }

        if (expensesToUpsert.length > 0) {
            console.log(`[Sync] Upserting ${expensesToUpsert.length} expense rows`);
            await planningRepository.upsertExpenses(expensesToUpsert);
            console.log('[Sync] Expenses upserted successfully');
        } else {
            console.log('[Sync] No expenses to upsert');
        }
    } catch (e) {
        console.error('Failed to sync real estate expenses', e);
    }
}

// Helper to sync Real Estate INCOME - generates rows for all months from effective_from
async function syncRealEstateIncome(items: CustomItem[]) {
    try {
        const now = new Date();
        const incomesToUpsert: Income[] = [];

        for (const item of items) {
            // Only examine Real Estate items with tenancy data
            if (!item.customFields) continue;

            const {
                occupancyStatus,
                monthlyRent,
                unitsTotal,
                unitsRented,
                totalUnits, // Legacy fallback
                rentedUnits, // Legacy fallback
                rentIncomeEffectiveFrom,
                costsEffectiveFrom // Fallback for effective date
            } = item.customFields as any;

            // Only proceed if status indicates income
            if (!['Alugado', 'Parcialmente alugado'].includes(occupancyStatus)) {
                continue;
            }

            const rawRent = Number(monthlyRent) || 0;
            if (rawRent <= 0) continue;

            // Use rent directly - user enters actual income received
            // Unit ratio (unitsRented/unitsTotal) is only for occupancy metrics, not income calculation
            const effectiveIncome = Number(rawRent.toFixed(2));
            if (effectiveIncome <= 0) continue;

            // Determine effective date (priority: income date > cost date > today)
            const effectiveFromStr = rentIncomeEffectiveFrom || costsEffectiveFrom || now.toISOString().slice(0, 10);
            const effectiveFrom = new Date(effectiveFromStr);

            // Generate all months from effective_from to current month
            const months = generateMonthRange(effectiveFrom, now);

            for (const month of months) {
                incomesToUpsert.push({
                    id: crypto.randomUUID(),
                    month,
                    category: 'Aluguel de Imóveis',
                    name: `${item.name}`,
                    value: effectiveIncome,
                    source: 'real_estate',
                    sourceRef: item.id,
                    effectiveFrom: effectiveFromStr,
                    createdAt: new Date().toISOString()
                });
            }
        }

        if (incomesToUpsert.length > 0) {
            console.log(`[Sync] Upserting ${incomesToUpsert.length} income rows`);
            await planningRepository.upsertIncomes(incomesToUpsert);
            console.log('[Sync] Incomes upserted successfully');
        } else {
            console.log('[Sync] No incomes to upsert');
        }
    } catch (e) {
        console.error('Failed to sync real estate incomes', e);
    }
}

// Re-export the update event for consumers
export const PORTFOLIO_UPDATE_EVENT = UPDATE_EVENT;

// Re-export calculation functions for backward compatibility
export const calculateCurrentValue = calcCurrentValue;
export const calculateTotalInvested = calcTotalInvested;
export const getValueAtDate = calcValueAtDate;

export interface EnhancedTransaction extends Transaction {
    assetName: string;
    assetId: string;
    assetCategory: string;
}

/**
 * Portfolio Service
 * Facade that delegates to repository and applies business logic
 */
export const portfolioService = {

    // === PORTFOLIO OPERATIONS (Delegated to Repository) ===

    getPortfolios: async (): Promise<Portfolio[]> => {
        return repository.getAll();
    },

    getPortfolioById: async (id: string): Promise<Portfolio | undefined> => {
        return repository.getById(id);
    },

    getPortfolioScore: async (portfolioId: string): Promise<number> => {
        const portfolio = await repository.getById(portfolioId);
        if (!portfolio) return 0;

        const items = await portfolioService.getCustomItems(portfolioId);
        const criteriaCount = portfolio.criteria?.length || 0;
        const userScore = portfolio.userConvictionScore ?? 5;

        return calcPortfolioScore(items, criteriaCount, userScore);
    },

    addPortfolio: async (data: Omit<Portfolio, 'id' | 'value' | 'monthVar' | 'yearVar' | 'createdAt'>): Promise<Portfolio> => {
        return repository.create(data);
    },

    updatePortfolio: async (id: string, updates: Partial<Portfolio>): Promise<Portfolio | null> => {
        return repository.update(id, updates);
    },

    updateLastAccessed: async (id: string): Promise<void> => {
        await repository.updateLastAccessed(id);
    },

    deletePortfolio: async (id: string): Promise<void> => {
        await repository.delete(id);
    },

    getTotalBalance: async (): Promise<number> => {
        const portfolios = await repository.getAll();
        return portfolios.reduce((acc, curr) => acc + curr.value, 0);
    },

    getGlobalMetrics: async (): Promise<{ totalBalance: number; monthlyProfit: number; monthlyVariation: number }> => {
        const portfolios = await repository.getAll();
        let currentTotal = 0;
        let lastMonthTotal = 0;

        const now = new Date();
        const lastMonthDate = new Date();
        lastMonthDate.setDate(now.getDate() - 30);
        lastMonthDate.setHours(23, 59, 59, 999);

        for (const p of portfolios) {
            const items = await repository.getItems(p.id);

            const portfolioValue = Number(p.value) || 0;
            const pTotal = items.length > 0
                ? items.reduce((acc, i) => acc + calculateCurrentValue(i), 0)
                : portfolioValue;
            currentTotal += pTotal;

            if (items.length > 0) {
                const pLastMonth = getValueAtDate(items, lastMonthDate);
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
    },

    // === CUSTOM ITEMS (With Business Logic) ===

    getCustomItems: async (portfolioId: string): Promise<CustomItem[]> => {
        let items = await repository.getItems(portfolioId);

        // Sync market prices for automatic items
        try {
            // Read path must not persist mutations; consolidation/save flows handle persistence.
            items = await portfolioService.syncMarketPrices(portfolioId, items, { persist: false });
            return items;
        } catch (err) {
            console.error('Failed to sync market prices', err);
            return items;
        }
    },

    // AIDEV-NOTE: Quotes = current, Prices = historical EOD/compact.
    // Source of truth para preço atual: market_quotes
    // Fallback: market_prices (último <= hoje, priorizando 1d)
    // Use market_prices apenas para casos:
    // - Ativos sem quote disponível
    // - Períodos históricos (KPIs/linha do tempo)
    syncMarketPrices: async (portfolioId: string, items: CustomItem[], options?: { persist?: boolean }): Promise<CustomItem[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();
        const shouldPersist = options?.persist === true;

        // 1. Fetch Latest Market Prices
        const marketAssetIds = items
            .filter((i): i is CustomItem & { market_asset_id: string } =>
                !!i.market_asset_id &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.market_asset_id)
            )
            .map(i => i.market_asset_id);

        let priceMap: Record<string, number> = {};
        if (marketAssetIds.length > 0) {
            try {
                // First, try market_quotes (source of truth for current prices)
                const { data: quotes } = await supabase
                    .from('market_quotes')
                    .select('id, close')
                    .in('id', marketAssetIds);

                if (quotes) {
                    quotes.forEach(q => {
                        if (q.close != null) {
                            priceMap[q.id] = Number(q.close);
                        }
                    });
                }

                // Find assets without quotes (need fallback to market_prices)
                const assetsWithoutQuotes = marketAssetIds.filter(id => !priceMap[id]);

                if (assetsWithoutQuotes.length > 0) {
                    const today = new Date().toISOString().split('T')[0];

                    // Try granularity='1d' first (daily EOD, more recent)
                    const { data: prices1d } = await supabase
                        .from('market_prices')
                        .select('asset_id, close, date')
                        .in('asset_id', assetsWithoutQuotes)
                        .eq('granularity', '1d')
                        .lte('date', today)
                        .order('date', { ascending: false });

                    if (prices1d) {
                        // Create map of latest price per asset (1d)
                        const latest1d: Record<string, { close: number; date: string }> = {};
                        prices1d.forEach(p => {
                            if (!latest1d[p.asset_id] || p.date > latest1d[p.asset_id].date) {
                                latest1d[p.asset_id] = { close: Number(p.close), date: p.date };
                            }
                        });

                        Object.keys(latest1d).forEach(assetId => {
                            if (!priceMap[assetId]) {
                                priceMap[assetId] = latest1d[assetId].close;
                            }
                        });
                    }

                    // Find assets still without prices (try 1w)
                    const assetsStillWithoutPrices = assetsWithoutQuotes.filter(id => !priceMap[id]);

                    if (assetsStillWithoutPrices.length > 0) {
                        // Try granularity='1w' as last resort (weekly historical)
                        const { data: prices1w } = await supabase
                            .from('market_prices')
                            .select('asset_id, close, date')
                            .in('asset_id', assetsStillWithoutPrices)
                            .eq('granularity', '1w')
                            .lte('date', today)
                            .order('date', { ascending: false });

                        if (prices1w) {
                            // Create map of latest price per asset (1w)
                            const latest1w: Record<string, { close: number; date: string }> = {};
                            prices1w.forEach(p => {
                                if (!latest1w[p.asset_id] || p.date > latest1w[p.asset_id].date) {
                                    latest1w[p.asset_id] = { close: Number(p.close), date: p.date };
                                }
                            });

                            Object.keys(latest1w).forEach(assetId => {
                                if (!priceMap[assetId]) {
                                    priceMap[assetId] = latest1w[assetId].close;
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch market prices", err);
            }
        }

        // Batch resolve missing market_asset_id by ticker to avoid N+1 lookups in the item loop
        const tickerCandidates = Array.from(new Set(
            items
                .filter(item =>
                    !item.market_asset_id &&
                    item.name.length >= 4 &&
                    item.name.length <= 6 &&
                    /^[A-Z]{4}[3-6,11]$/i.test(item.name.toUpperCase())
                )
                .map(item => item.name.toUpperCase())
        ));

        const resolvedAssetByTicker: Record<string, { id: string; close?: number | null }> = {};
        if (tickerCandidates.length > 0) {
            try {
                const { data: quoteCandidates } = await supabase
                    .from('market_quotes')
                    .select('id, ticker, close, as_of_date')
                    .in('ticker', tickerCandidates)
                    .order('as_of_date', { ascending: false });

                if (quoteCandidates) {
                    for (const q of quoteCandidates as any[]) {
                        const ticker = String(q.ticker || '').toUpperCase();
                        if (!ticker || resolvedAssetByTicker[ticker]) continue;
                        resolvedAssetByTicker[ticker] = { id: q.id, close: q.close };
                    }
                }
            } catch (err) {
                console.error('Failed to batch resolve market_asset_id by ticker', err);
            }
        }

        let hasChanges = false;

        items = await Promise.all(items.map(async item => {
            let newVal = calculateCurrentValue(item);
            let updatedItem = { ...item };
            let itemChanged = false;

            // 1.5 - Ensure Quantity is correct based on transactions
            // Since this runs on getItems, transactions ARE loaded from the repository.
            // We Recalculate quantity from transactions to ensure robust sync, ignoring stale DB quantity if needed.
            let quantity = item.quantity || 0;

            if (item.transactions && item.transactions.length > 0) {
                const transactionDelta = item.transactions.reduce((acc, t) => {
                    if (t.type === 'buy') return acc + (t.quantity || 0);
                    if (t.type === 'sell') return acc - (t.quantity || 0);
                    return acc;
                }, 0);

                // AIDEV-FIX: Robust quantity calculation.
                // item.quantity is the "current" quantity stored in DB.
                // item.transactions contains buy/sell events.
                // The quantity that ISN'T in transactions is the "base lot".
                // If calculatedQty from transactions only is different from item.quantity, 
                // it might be because of the base lot (the initial quantity from 'create' event).

                // If we have transactions, the "real" quantity is: BaseLot + sum(Transactions)
                // We should only "heal" if the current quantity seems impossible or corrupted.
                // However, the reported bug is that 1 (initial) + 10 (buy) = 10 (count).
                // This means the code below was overwriting '11' with '10' because it only saw the '10' in transactions.

                const calculatedQty = transactionDelta;
                // If we assume transactions are the ONLY source of quantity, we lose the initial set.
                // Let's check if the initial creation event is missing from transactions.
                const hasCreateTx = item.transactions.some(t => t.type as any === 'create');

                if (!hasCreateTx) {
                    // If no 'create' transaction exists, then there is a "hidden" initial quantity.
                    // We don't want to blindly overwrite item.quantity if it's already higher than transactionDelta.
                }

                if (calculatedQty > quantity) {
                    // If transactions alone are more than the recorded quantity, the recorded quantity is definitely stale.
                    quantity = calculatedQty;
                    updatedItem.quantity = quantity;
                    itemChanged = true;
                }
            }

            // 2. OVERRIDE with Market Price if available and linked
            if (item.market_asset_id && priceMap[item.market_asset_id]) {
                const marketPrice = priceMap[item.market_asset_id];

                // Calculate value based on Quantity * Price
                newVal = quantity * marketPrice;
            }

            if (Math.abs(newVal - item.value) > 0.01) {
                updatedItem.value = newVal;
                itemChanged = true;
            }

            // AIDEV-FIX: Also synchronize 'market_asset_id' if missing but name matches a known ticker
            // Fixed: Use order/limit to avoid error with multiple snapshots in market_quotes
            if (!item.market_asset_id && item.name.length >= 4 && item.name.length <= 6 && /^[A-Z]{4}[3-6,11]$/.test(item.name.toUpperCase())) {
                const asset = resolvedAssetByTicker[item.name.toUpperCase()];

                if (asset) {
                    updatedItem.market_asset_id = asset.id;
                    itemChanged = true;

                    // AIDEV: If we just found the asset, let's also update the value immediately if possible
                    if (asset.close && Math.abs((quantity * Number(asset.close)) - updatedItem.value) > 0.01) {
                        updatedItem.value = Math.round(quantity * Number(asset.close) * 100) / 100;
                    }

                }
            }

            if (itemChanged) {
                hasChanges = true;
                return updatedItem;
            }
            return item;
        }));

        if (hasChanges && shouldPersist) {
            await repository.saveItems(portfolioId, items);
            const totalValue = items.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
            await repository.update(portfolioId, { value: totalValue });
        }
        return items;
    },

    saveCustomItems: async (portfolioId: string, items: CustomItem[]): Promise<void> => {
        const calculatedItems = items.map(item => ({
            ...item,
            value: calculateCurrentValue(item)
        }));
        await repository.saveItems(portfolioId, calculatedItems);
        const totalValue = calculatedItems.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
        await repository.update(portfolioId, { value: totalValue });

        // SYNC EXPENSES
        await syncRealEstateExpenses(calculatedItems);
        // SYNC INCOME
        await syncRealEstateIncome(calculatedItems);
    },

    // === BUSINESS / PRIVATE EQUITY METRICS ===
    getBusinessMetrics: (items: CustomItem[], events?: PortfolioEvent[]) => {
        return calcBusinessMetrics(items, events);
    },

    // === RENT EVENT PROCESSING (Operational) ===
    processRentEvent: async (
        portfolioId: string,
        item: CustomItem,
        action: 'start' | 'end',
        data: { date: string, amount: number, observation: string, rentIndexer?: string, rentAdjustmentMonth?: string | number }
    ): Promise<void> => {
        const items = await portfolioService.getCustomItems(portfolioId);
        const targetItem = items.find(i => i.id === item.id);
        if (!targetItem) return;

        if (action === 'start') {
            targetItem.customFields = {
                ...targetItem.customFields,
                occupancyStatus: 'Alugado',
                monthlyRent: data.amount,
                rentIndexer: data.rentIndexer || '',
                rentAdjustmentMonth: data.rentAdjustmentMonth || ''
            };

            await portfolioService.addHistoryEvent(portfolioId, {
                assetId: targetItem.id,
                assetName: targetItem.name,
                assetCategory: targetItem.category,
                date: data.date,
                type: 'rent_start',
                totalValue: data.amount,
                eventStatus: 'executed',
                observation: data.observation || `Início de contrato de aluguel: ${data.amount}`
            });

        } else {
            targetItem.customFields = {
                ...targetItem.customFields,
                occupancyStatus: 'Vago',
                monthlyRent: 0,
                rentIndexer: '',
                rentAdjustmentMonth: ''
            };

            await portfolioService.addHistoryEvent(portfolioId, {
                assetId: targetItem.id,
                assetName: targetItem.name,
                assetCategory: targetItem.category,
                date: data.date,
                type: 'rent_end',
                totalValue: 0,
                eventStatus: 'executed',
                observation: data.observation || 'Encerramento de contrato de aluguel'
            });
        }

        const newItems = items.map(i => i.id === targetItem.id ? targetItem : i);
        await portfolioService.saveCustomItems(portfolioId, newItems);
    },

    // === SCORE & ALLOCATION LOGIC ===

    calculateScore: (item: CustomItem, criteriaCount: number): { raw: number, display: number } => {
        return calcScore(item.criteriaAnswers, criteriaCount);
    },

    calculateIdealAllocation: (
        items: CustomItem[],
        criteriaCount: number,
        categoryTargets?: Record<string, number>
    ): Map<string, number> => {
        return calcIdealAllocation(items, criteriaCount, categoryTargets);
    },

    // === Real Estate Specific Metrics ===
    getRealEstateMetrics: (items: CustomItem[]) => {
        return calcRealEstateMetrics(items);
    },

    // AIDEV-NOTE: Quotes = current, Prices = historical EOD/compact.
    // Source of truth para preço atual: market_quotes
    // Fallback: market_prices (último <= hoje, priorizando 1d)
    getLatestMarketPrice: async (ticker: string): Promise<number | null> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        try {
            // 1. Try market_quotes first (source of truth for current price)
            const { data: quote } = await supabase
                .from('market_quotes')
                .select('id, close')
                .ilike('ticker', ticker)
                .maybeSingle();

            if (quote && quote.close != null) {
                return Number(quote.close);
            }

            // 2. Fallback to market_prices (historical EOD data)
            if (!quote || !quote.id) return null;

            const today = new Date().toISOString().split('T')[0];

            // Try granularity='1d' first (daily EOD, more recent)
            const { data: price1d } = await supabase
                .from('market_prices')
                .select('close')
                .eq('asset_id', quote.id)
                .eq('granularity', '1d')
                .lte('date', today)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (price1d && price1d.close != null) {
                return Number(price1d.close);
            }

            // Try granularity='1w' as last resort (weekly historical)
            const { data: price1w } = await supabase
                .from('market_prices')
                .select('close')
                .eq('asset_id', quote.id)
                .eq('granularity', '1w')
                .lte('date', today)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();

            return price1w ? Number(price1w.close) : null;
        } catch (error) {
            console.error('Error fetching market price:', error);
            return null;
        }
    },

    // === HISTORY EVENTS (With Migration Logic) ===

    addHistoryEvent: async (portfolioId: string, event: Omit<PortfolioEvent, 'id' | 'portfolioId' | 'createdAt'>): Promise<PortfolioEvent> => {
        return repository.addHistoryEvent(portfolioId, event);
    },

    migrateItemHistory: async (portfolioId: string, item: CustomItem): Promise<void> => {
        let events = await repository.getHistoryEvents(portfolioId);
        let hasChanges = false;
        const portfolio = await repository.getById(portfolioId);

        const creationExists = events.some(e => e.assetId === item.id && e.type === 'create');
        if (!creationExists) {
            events.push({
                id: crypto.randomUUID(),
                portfolioId,
                portfolioName: portfolio?.name,
                assetId: item.id,
                assetName: item.name,
                assetCategory: item.category,
                date: item.initialDate,
                createdAt: new Date().toISOString(),
                type: 'create',
                quantity: item.quantity,
                unitPrice: item.quantity ? item.initialValue / item.quantity : 0,
                totalValue: item.initialValue,
                observation: 'Migração automática de histórico (Criação)'
            });
            hasChanges = true;
        }

        if (item.transactions) {
            item.transactions.forEach(tx => {
                const exists = events.some(e => (e.id === tx.id) || (e.assetId === item.id && e.date === tx.date && e.type === tx.type && e.totalValue === tx.totalValue));
                if (!exists) {
                    events.push({
                        id: tx.id,
                        portfolioId,
                        portfolioName: portfolio?.name,
                        assetId: item.id,
                        assetName: item.name,
                        assetCategory: item.category,
                        date: tx.date,
                        createdAt: tx.createdAt,
                        type: tx.type,
                        quantity: tx.quantity,
                        unitPrice: tx.unitPrice,
                        totalValue: tx.totalValue,
                        observation: tx.observation || 'Migração automática de histórico'
                    });
                    hasChanges = true;
                }
            });
        }

        if (item.history) {
            item.history.forEach(h => {
                if (h.type === 'manual') {
                    const exists = events.some(e => e.assetId === item.id && e.date === h.date && e.type === 'manual_update' && e.totalValue === h.value);
                    if (!exists) {
                        events.push({
                            id: crypto.randomUUID(),
                            portfolioId,
                            portfolioName: portfolio?.name,
                            assetId: item.id,
                            assetName: item.name,
                            assetCategory: item.category,
                            date: h.date,
                            createdAt: new Date().toISOString(),
                            type: 'manual_update',
                            totalValue: h.value,
                            observation: h.note || 'Histórico manual migrado'
                        });
                        hasChanges = true;
                    }
                }
            });
        }

        if (hasChanges) {
            await repository.saveHistoryEvents(portfolioId, events);
        }
    },

    removeAssetIncomeHistory: async (portfolioId: string, assetId: string): Promise<void> => {
        const events = await repository.getHistoryEvents(portfolioId);
        const filtered = events.filter((event) =>
            !(event.assetId === assetId && (event.type === 'dividend' || event.type === 'jcp'))
        );

        if (filtered.length !== events.length) {
            await repository.saveHistoryEvents(portfolioId, filtered);
        }
    },

    /**
     * Calculates the reinvested total return for an asset using the backend RPC.
     */
    calculateReinvestedReturn: async (
        assetId: string,
        buyDate: string,
        buyPrice: number,
        currentPrice: number
    ): Promise<{ total_return_pct: number; simple_return_pct: number; final_qty: number }> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        try {
            const { data, error } = await supabase.rpc('calculate_reinvested_return', {
                p_asset_id: assetId,
                p_buy_date: buyDate,
                p_buy_price: buyPrice,
                p_current_price: currentPrice
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error calculating reinvested return:', error);
            // Fallback to a simple 0 if RPC fails
            return { total_return_pct: 0, simple_return_pct: 0, final_qty: 1 };
        }
    },

    calculateReinvestedReturnFromHistory: async (
        assetId: string,
        buyDate: string,
        buyPrice: number,
        currentPrice: number,
        dividendHistory: Array<{
            asset_id?: string;
            ticker?: string;
            type?: string;
            approved_on?: string | null;
            payment_date?: string | null;
            gross_rate?: number | string | null;
            rate?: number | string | null;
        }>
    ): Promise<{ total_return_pct: number; simple_return_pct: number; final_qty: number }> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        const normalizeDate = (value: unknown) => {
            if (!value) return '';
            const parsed = new Date(value as string);
            if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
            return parsed.toISOString().slice(0, 10);
        };

        const normalizedBuyDate = String(buyDate).slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        const rawHistory = dividendHistory
            .filter((row) => row && (row.asset_id === assetId || row.asset_id === undefined))
            .map((row) => {
                const exDate = normalizeDate(row.approved_on || row.payment_date || '');
                const payDate = normalizeDate(row.payment_date || row.approved_on || '');
                const rawRate = Number((row as any).gross_rate ?? row.rate ?? 0);
                if (!exDate || !payDate || !Number.isFinite(rawRate) || rawRate <= 0) return null;
                return {
                    type: String(row.type || '').toUpperCase(),
                    exDate,
                    payDate,
                    rate: rawRate,
                };
            })
            .filter((row): row is { type: string; exDate: string; payDate: string; rate: number } => !!row)
            .filter((row) => row.payDate >= normalizedBuyDate && row.payDate <= today)
            .sort((a, b) => {
                const payCmp = a.payDate.localeCompare(b.payDate);
                return payCmp !== 0 ? payCmp : a.exDate.localeCompare(b.exDate);
            });

        if (!Number.isFinite(buyPrice) || buyPrice <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
            return { total_return_pct: 0, simple_return_pct: 0, final_qty: 1 };
        }

        if (rawHistory.length === 0) {
            const simpleOnly = ((currentPrice - buyPrice) / buyPrice) * 100;
            return { total_return_pct: simpleOnly, simple_return_pct: simpleOnly, final_qty: 1 };
        }

        const earliestLookupDate = normalizedBuyDate;
        const { data: priceRows, error } = await supabase
            .from('market_prices')
            .select('date, close')
            .eq('asset_id', assetId)
            .eq('granularity', '1d')
            .gte('date', earliestLookupDate)
            .lte('date', today)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching price history for local TRI calculation:', error);
            return portfolioService.calculateReinvestedReturn(assetId, buyDate, buyPrice, currentPrice);
        }

        const prices = (priceRows || [])
            .map((row: any) => ({
                date: String(row.date).slice(0, 10),
                close: Number(row.close || 0),
            }))
            .filter((row) => row.close > 0);

        const getPriceOnOrBefore = (targetDate: string) => {
            let chosen = 0;
            for (const row of prices) {
                if (row.date <= targetDate) {
                    chosen = row.close;
                    continue;
                }
                break;
            }
            return chosen > 0 ? chosen : buyPrice;
        };

        let qty = 1;
        let cashSimple = 0;

        for (const div of rawHistory) {
            if (div.exDate < normalizedBuyDate) continue;

            const netRate = div.type === 'JCP'
                ? (div.payDate <= '2026-04-30' ? div.rate * 0.85 : div.rate * 0.825)
                : div.rate;

            cashSimple += netRate;

            const reinvestPrice = getPriceOnOrBefore(div.payDate);
            if (reinvestPrice > 0) {
                qty += (qty * netRate) / reinvestPrice;
            }
        }

        const totalReturnPct = ((qty * currentPrice - buyPrice) / buyPrice) * 100;
        const simpleReturnPct = (((currentPrice + cashSimple) - buyPrice) / buyPrice) * 100;

        return {
            total_return_pct: totalReturnPct,
            simple_return_pct: simpleReturnPct,
            final_qty: qty,
        };
    },

    getHistoryEvents: async (portfolioId: string): Promise<PortfolioEvent[]> => {
        let events = await repository.getHistoryEvents(portfolioId);
        const portfolio = await repository.getById(portfolioId);

        // Fallback/Merge for legacy items 
        // AIDEV-NOTE: Use repository directly to avoid triggering market price sync (N+1)
        const items = await repository.getItems(portfolioId);
        items.forEach(item => {
            if (item.transactions) {
                item.transactions.forEach(tx => {
                    const exists = events.some(e => (e.id === tx.id) || (e.assetId === item.id && e.date === tx.date && e.type === tx.type && e.totalValue === tx.totalValue));
                    if (!exists) {
                        events.push({
                            id: tx.id,
                            portfolioId,
                            portfolioName: portfolio?.name,
                            assetId: item.id,
                            assetName: item.name,
                            assetCategory: item.category,
                            date: tx.date,
                            createdAt: tx.createdAt,
                            type: tx.type,
                            quantity: tx.quantity,
                            unitPrice: tx.unitPrice,
                            totalValue: tx.totalValue,
                            observation: tx.observation
                        });
                    }
                });
            }

            const createExists = events.some(e => e.assetId === item.id && e.type === 'create');
            if (!createExists) {
                events.push({
                    id: `create-${item.id}`,
                    portfolioId,
                    portfolioName: portfolio?.name,
                    assetId: item.id,
                    assetName: item.name,
                    assetCategory: item.category,
                    date: item.initialDate,
                    createdAt: item.initialDate,
                    type: 'create',
                    quantity: item.quantity,
                    unitPrice: item.quantity ? item.initialValue / item.quantity : 0,
                    totalValue: item.initialValue,
                    observation: 'Criação do ativo'
                });
            }
        });

        return events.sort(portfolioService.compareEvents);
    },

    getGlobalHistoryEvents: async (): Promise<PortfolioEvent[]> => {
        let allEvents: PortfolioEvent[] = [];

        const portfolios = await repository.getAll();
        for (const p of portfolios) {
            const events = await portfolioService.getHistoryEvents(p.id);
            const items = await repository.getItems(p.id);
            const synthetic: PortfolioEvent[] = [];

            if (p.type === 'real_estate') {
                const now = new Date();
                const monthStartIso = (date: Date) => {
                    const d = new Date(date);
                    d.setDate(1);
                    d.setHours(0, 0, 0, 0);
                    return d.toISOString().split('T')[0];
                };
                const existingRentKeys = new Set(
                    (events || [])
                        .filter((e) => e.type === 'rent_income')
                        .map((e) => `${e.assetId || ''}|${monthStartIso(new Date(e.date))}|${Number(e.totalValue || 0).toFixed(2)}`)
                );

                for (const item of items) {
                    const status = String(item.customFields?.occupancyStatus || 'Vago');
                    const isRented = ['Alugado', 'Parcialmente alugado'].includes(status);
                    const monthlyRent = isRented ? Number(item.customFields?.monthlyRent || 0) : 0;
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
                                    id: `global-synth-rent-${p.id}-${item.id}-${monthDate}`,
                                    portfolioId: p.id,
                                    portfolioName: p.name,
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
                                id: `global-synth-expense-${p.id}-${item.id}-${monthDate}`,
                                portfolioId: p.id,
                                portfolioName: p.name,
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

            if (p.type !== 'real_estate' && p.type !== 'business') {
                const startDiv = new Date();
                startDiv.setFullYear(startDiv.getFullYear() - 10);
                const endDiv = new Date();
                endDiv.setFullYear(endDiv.getFullYear() + 1);
                const dividends = await portfolioService.getUserDividends(p.id, { start: startDiv, end: endDiv });

                if (dividends.length > 0) {
                    const existingDividendKeys = new Set(
                        (events || [])
                            .filter((e) => e.type === 'dividend' || e.type === 'jcp')
                            .map((e) => `${e.type}|${e.assetId || e.assetName}|${String(e.date).slice(0, 10)}|${Number(e.totalValue || 0).toFixed(2)}`)
                    );

                    const itemByMarketAssetId = new Map(
                        items.filter((i) => i.market_asset_id).map((i) => [String(i.market_asset_id), i] as const)
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
                            id: d?.id ? `global-rpc-div-${d.id}` : `global-rpc-div-${eventType}-${ticker}-${date}-${totalAmount.toFixed(2)}`,
                            portfolioId: p.id,
                            portfolioName: p.name,
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
            }

            allEvents = [...allEvents, ...events, ...synthetic];
        }

        const archiveEvents = await repository.getHistoryArchive();
        allEvents = [...allEvents, ...archiveEvents];

        const lifecycleEvents = await repository.getLifecycleEvents();
        allEvents = [...allEvents, ...lifecycleEvents];

        return allEvents.sort(portfolioService.compareEvents);
    },

    // Generates a consolidated daily time series for the entire account
    getGlobalDailySeries: async (): Promise<{ date: string; value: number; timestamp: number }[]> => {
        const portfolios = await repository.getAll();
        let allItems: CustomItem[] = [];

        for (const p of portfolios) {
            const items = await portfolioService.getCustomItems(p.id);
            allItems = [...allItems, ...items];
        }

        if (allItems.length === 0) return [];

        const timestamps = allItems.map(i => {
            const d = i.initialDate.includes('T') ? i.initialDate.split('T')[0] : i.initialDate;
            return new Date(d).getTime();
        });
        const minTime = Math.min(...timestamps);

        const startDate = new Date(minTime);
        const endDate = new Date();

        const dailySeries = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const checkDate = new Date(currentDate);
            checkDate.setHours(23, 59, 59, 999);

            const totalValue = getValueAtDate(allItems, checkDate);

            if (totalValue > 0 || dailySeries.length > 0) {
                dailySeries.push({
                    date: checkDate.toISOString(),
                    value: totalValue,
                    timestamp: checkDate.getTime()
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dailySeries;
    },

    // === DIVIDENDS ===
    getUserDividends: async (portfolioId: string | null, rangeValues: { start: Date, end: Date }): Promise<any[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        // If portfolioId is provided, fetch specifically
        // If null, we fetch for all portfolios by iterating or creating a Global RPC variant?
        // The current RPC takes a portfolio_id.
        // For Global view, we can iterate visible portfolios.

        let allDividends: any[] = [];
        const startStr = rangeValues.start.toISOString().split('T')[0];
        const endStr = rangeValues.end.toISOString().split('T')[0];

        if (portfolioId) {
            const portfolioItems = await repository.getItems(portfolioId);
            const { data } = await supabase.rpc('get_user_dividends', {
                p_portfolio_id: portfolioId,
                p_start_date: startStr,
                p_end_date: endStr
            });
            if (data) {
                allDividends = filterDividendRowsByItemAcquisition(data, portfolioItems);
            }
        } else {
            const portfolios = await repository.getAll();
            for (const p of portfolios) {
                const portfolioItems = await repository.getItems(p.id);
                const { data } = await supabase.rpc('get_user_dividends', {
                    p_portfolio_id: p.id,
                    p_start_date: startStr,
                    p_end_date: endStr
                });
                if (data) {
                    // Enrich with portfolio Name perhaps?
                    const filtered = filterDividendRowsByItemAcquisition(data, portfolioItems);
                    const enriched = filtered.map((d: any) => ({ ...d, portfolioId: p.id, portfolioName: p.name }));
                    allDividends = [...allDividends, ...enriched];
                }
            }
        }

        // Sort by payment date desc
        return allDividends.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
    },

    // === HISTORY BACKFILL & SNAPSHOTS ===

    backfillHistory: async (startYear: number = 2020): Promise<{ processed_months: number, last_month_updated: string }> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();
        const { data, error } = await supabase.rpc('patrio_backfill_history', { p_start_year: startYear });
        if (error) throw error;
        return data;
    },

    getMonthlySnapshots: async (year: number): Promise<{ month: string, total_value: number, is_final: boolean }[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();
        const { data, error } = await supabase.rpc('patrio_get_wealth_year_series', { p_year: year });
        if (error) throw error;
        return data || [];
    },

    compareEvents: (a: PortfolioEvent, b: PortfolioEvent) => {
        const dayA = Math.floor(new Date(a.date).getTime() / 86400000);
        const dayB = Math.floor(new Date(b.date).getTime() / 86400000);

        if (dayA !== dayB) {
            return dayB - dayA;
        }

        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();

        return timeB - timeA;
    },

    getItemsByCategory: (items: CustomItem[]) => {
        return calcGroupItemsByCategory(items);
    },

    // === DASHBOARD CONFIG ===

    getDashboardConfig: async (portfolioId: string): Promise<DashboardConfig> => {
        return repository.getDashboardConfig(portfolioId);
    },

    saveDashboardConfig: async (portfolioId: string, config: DashboardConfig): Promise<void> => {
        await repository.saveDashboardConfig(portfolioId, config);
    },

    // === CATEGORIES ===

    getCategories: async (): Promise<string[]> => {
        return repository.getCategories();
    },

    addCategory: async (category: string): Promise<string[]> => {
        return repository.addCategory(category);
    },

    // === EVOLUTION & ALLOCATION DATA (With Calculations) ===

    // AIDEV-NOTE: Sincroniza market_asset_id de portfolio_items com market_quotes
    // Garante que IDs desatualizados sejam corrigidos antes de buscar dados históricos
    syncMarketAssetIds: async (portfolioId?: string): Promise<void> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        try {
            // 1. Buscar todos os portfolio_items com market_asset_id
            let query = supabase
                .from('portfolio_items')
                .select('id, name, market_asset_id, portfolio_id')
                .not('market_asset_id', 'is', null);

            if (portfolioId) {
                query = query.eq('portfolio_id', portfolioId);
            }

            const { data: items, error: itemsError } = await query;

            if (itemsError) {
                console.error('Error fetching portfolio items for sync:', itemsError);
                return;
            }

            if (!items || items.length === 0) {
                return; // Nenhum item para sincronizar
            }

            // 2. Validar quais market_asset_ids ainda existem em market_quotes
            const assetIds = items.map(i => i.market_asset_id).filter(Boolean) as string[];

            if (assetIds.length === 0) {
                return;
            }

            const { data: validAssets, error: validError } = await supabase
                .from('market_quotes')
                .select('id, ticker')
                .in('id', assetIds);

            if (validError) {
                console.error('Error validating market_asset_ids:', validError);
                return;
            }

            const validAssetIds = new Set((validAssets || []).map(a => a.id));
            const updates: Array<{ id: string; market_asset_id: string | null }> = [];

            // 3. Para cada item com market_asset_id inválido, tentar encontrar pelo ticker
            for (const item of items) {
                if (!item.market_asset_id) continue;

                if (!validAssetIds.has(item.market_asset_id)) {
                    // market_asset_id inválido, buscar pelo ticker (name)
                    const normalizedName = (item.name || '').trim().toUpperCase();

                    const { data: foundAsset, error: findError } = await supabase
                        .from('market_quotes')
                        .select('id, ticker')
                        .ilike('ticker', normalizedName)
                        .order('as_of_date', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (findError) {
                        console.warn(`Error finding asset for ${item.name}:`, findError);
                    }

                    if (foundAsset) {
                        // Encontrou pelo ticker, atualizar
                        updates.push({ id: item.id, market_asset_id: foundAsset.id });
                        console.log(`Syncing ${item.name}: Updated market_asset_id from invalid ${item.market_asset_id} to ${foundAsset.id}`);
                    } else {
                        // Não encontrou, remover market_asset_id
                        updates.push({ id: item.id, market_asset_id: null });
                        console.warn(`Syncing ${item.name}: Removed invalid market_asset_id ${item.market_asset_id} (asset not found)`);
                    }
                }
            }

            // 4. Aplicar atualizações em batch
            if (updates.length > 0) {
                // Agrupar por portfolio_id para otimizar
                const updatesByPortfolio = new Map<string, typeof updates>();
                for (const item of items) {
                    if (!updatesByPortfolio.has(item.portfolio_id)) {
                        updatesByPortfolio.set(item.portfolio_id, []);
                    }
                }

                // Executar updates
                for (const update of updates) {
                    const { error: updateError } = await supabase
                        .from('portfolio_items')
                        .update({ market_asset_id: update.market_asset_id })
                        .eq('id', update.id);

                    if (updateError) {
                        console.error(`Error updating portfolio_item ${update.id}:`, updateError);
                    }
                }

                console.log(`Synced ${updates.length} portfolio_items market_asset_ids`);
            }
        } catch (error) {
            console.error('Error in syncMarketAssetIds:', error);
        }
    },

    getEvolutionData: async (portfolioId?: string, range: '3M' | '6M' | '1A' | 'ALL' = '6M'): Promise<{ name: string; value: number; fullDate: string }[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        // 1. Determine Date Range
        const now = new Date();
        const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        let startDate = new Date();
        let cachedPortfolioItems: CustomItem[] | null = null;
        let cachedGlobalPortfolios: Portfolio[] | null = null;
        let cachedGlobalItems: (CustomItem & { portfolio_id?: string })[] | null = null;

        if (portfolioId) {
            cachedPortfolioItems = await portfolioService.getCustomItems(portfolioId);
        } else {
            const [portfolios, allItems] = await Promise.all([
                repository.getAll(),
                repository.getAllItems() as Promise<(CustomItem & { portfolio_id?: string })[]>
            ]);
            cachedGlobalPortfolios = portfolios;
            cachedGlobalItems = allItems;
        }
        if (range === '3M') startDate.setMonth(now.getMonth() - 3);
        else if (range === '6M') startDate.setMonth(now.getMonth() - 6);
        else if (range === '1A') startDate.setFullYear(now.getFullYear() - 1);
        else if (range === 'ALL') {
            // AIDEV-FIX: Para 'ALL', buscar a data mais antiga dos itens do portfólio
            let oldestDate = new Date();
            if (portfolioId) {
                const allItems = cachedPortfolioItems || [];
                for (const item of allItems) {
                    if (item.initialDate) {
                        const itemDate = new Date(item.initialDate);
                        if (itemDate < oldestDate) oldestDate = itemDate;
                    }
                }
            } else {
                for (const item of (cachedGlobalItems || [])) {
                    if (item.initialDate) {
                        const itemDate = new Date(item.initialDate);
                        if (itemDate < oldestDate) oldestDate = itemDate;
                    }
                }
            }
            startDate = oldestDate;
        }

        // Ensure start of day
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        // AIDEV-PERF: Inline sync removed - data freshness now handled by useConsolidation hook
        // which runs consolidate_user_portfolios() on first daily access

        // 2. Fetch Market History (RPC) if portfolioId provided
        // If no portfolioId (Global), we might need to loop or change RPC to accept null for 'all' or loop portfolios.
        // For MVP Global, let's keep the fallback manual aggregation or call RPC per portfolio?
        // RPC per portfolio is safer for RLS.

        type DailyPoint = { date: string, value: number };
        let marketSeries: DailyPoint[] = [];

        // AIDEV-FIX: Sempre buscar histórico de mercado para ativos com market_asset_id
        // Isso garante que o gráfico mostre a evolução real dos preços
        if (portfolioId) {
            const { data, error } = await supabase.rpc('get_portfolio_market_history', {
                p_portfolio_id: portfolioId,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            });
            if (error) {
                console.error('Error fetching portfolio market history:', error);
            }
            if (data) {
                marketSeries = data.map((d: any) => ({ date: d.date, value: Number(d.value) }));
                // Debug: log para verificar se dados foram retornados
                if (data.length > 0) {
                    const nonZeroCount = marketSeries.filter(p => p.value > 0).length;
                    console.log(`Market history: ${data.length} points, ${nonZeroCount} non-zero, first: ${data[0].date}, last: ${data[data.length - 1].date}`);
                    if (nonZeroCount === 0) {
                        console.warn('Market history: All values are zero - check if market_prices has historical data for portfolio assets');
                    }
                } else {
                    console.warn('Market history returned empty - check if market_prices has data for this portfolio\'s assets');
                }
            }
        } else {
            // Global: Use optimized RPC that aggregates ALL portfolios in one call
            // AIDEV-PERF: Replaced Promise.all with get_global_portfolio_history RPC
            // This does all aggregation in the database, reducing N network calls to 1
            const { data, error } = await supabase.rpc('get_global_portfolio_history', {
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0]
            });

            if (error) {
                console.error('Error fetching global portfolio history:', error);
            }

            if (data) {
                marketSeries = data.map((d: any) => ({ date: d.date, value: Number(d.value) }));
                if (data.length > 0) {
                    const nonZeroCount = marketSeries.filter(p => p.value > 0).length;
                    console.log(`Global history: ${data.length} points, ${nonZeroCount} non-zero`);
                }
            }
        }

        // 3. Fetch Manual Items (Non-Market)
        // Ativos de mercado são calculados via marketSeries (RPC get_portfolio_market_history)
        let manualItems: CustomItem[] = [];
        let fallbackValue = 0; // For portfolios without items but with hardcoded value

        if (portfolioId) {
            const allItems = cachedPortfolioItems || [];
            manualItems = allItems.filter(i => !i.market_asset_id);
            if (allItems.length === 0) {
                const p = await repository.getById(portfolioId);
                fallbackValue = Number(p?.value) || 0;
            }
        } else {
            const portfolios = cachedGlobalPortfolios || [];
            const allItems = cachedGlobalItems || [];
            const itemsByPortfolio = new Map<string, (CustomItem & { portfolio_id?: string })[]>();

            for (const item of allItems) {
                const pid = item.portfolio_id;
                if (!pid) continue;
                if (!itemsByPortfolio.has(pid)) itemsByPortfolio.set(pid, []);
                itemsByPortfolio.get(pid)!.push(item);
            }

            manualItems = allItems.filter(i => !i.market_asset_id);

            for (const p of portfolios) {
                const pItems = itemsByPortfolio.get(p.id) || [];
                if (pItems.length === 0) {
                    fallbackValue += Number(p.value) || 0;
                }
            }
        }

        // 4. Generate Combined Series
        // We usually want a sparse series (per day or per month depending on chart).
        // The UI usually determines the ticks. 
        // For the data array, let's generate daily points for 7D, or monthly/weekly for others if needed?
        // Actually the current UI handles "formatted date name".

        const data = [];

        // If range is large (> 3M), maybe we just output monthly points to save UI processing?
        // Or strictly daily? 
        // Existing code did: 7D -> daily, others -> monthly.
        // Let's replicate the logic but using the marketSeries map.

        const getMarketValueAtDate = (d: Date) => {
            const dateStr = d.toISOString().split('T')[0];
            // Find exact or closest previous
            const point = marketSeries.find(m => m.date === dateStr);
            if (point) return point.value;

            // Fallback: finding latest before
            const sorted = marketSeries.filter(m => m.date <= dateStr).sort((a, b) => b.date.localeCompare(a.date));
            return sorted.length > 0 ? sorted[0].value : 0;
        };

        // AIDEV-FIX: Para 'ALL', NÃO usar snapshots - usar apenas dados de mercado
        // Isso garante que o gráfico mostre a evolução real dos preços históricos
        // Snapshots são úteis apenas para períodos curtos (1A) onde os dados já foram consolidados
        let snapshotMap = new Map<string, number>(); // Mapa: "YYYY-MM" -> total_value

        // 1A must use the same path as 3M/6M (market + manual composition).
        // Snapshot series can be sparse/outdated and cause the 1Y chart to collapse to zero.
        // Therefore snapshotMap intentionally stays empty for 1A and ALL.

        // Calculate months to backtrack based on range
        let monthsToBacktrack = 2;
        if (range === '3M') monthsToBacktrack = 2;
        else if (range === '6M') monthsToBacktrack = 5;
        else if (range === '1A') monthsToBacktrack = 11;
        else if (range === 'ALL') {
            // Calculate months from startDate to now
            const diffTime = now.getTime() - startDate.getTime();
            const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Approximate months
            monthsToBacktrack = Math.max(diffMonths, 1);
        }

        // Iterate months
        for (let i = monthsToBacktrack; i >= 0; i--) {
            const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);

            // Skip months before startDate
            if (targetMonthDate < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) {
                continue;
            }

            // Last day of month
            const endOfMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0);
            // Cap at today
            const checkDate = endOfMonth > now ? now : endOfMonth;
            checkDate.setHours(23, 59, 59, 999);

            const monthName = monthsShort[targetMonthDate.getMonth()];
            const year = targetMonthDate.getFullYear();
            const monthKey = `${year}-${String(targetMonthDate.getMonth() + 1).padStart(2, '0')}`;

            // AIDEV-FIX: Usar snapshot se disponível, senão calcular combinando manual + mercado
            let value: number;
            if (snapshotMap.has(monthKey)) {
                // Usar valor do snapshot (mais preciso, calculado pelo backend)
                value = snapshotMap.get(monthKey)!;
            } else {
                // Ativos manuais: calcular via getValueAtDate
                const manualVal = getValueAtDate(manualItems, checkDate) + fallbackValue;
                // Ativos de mercado: usar preços do banco (marketSeries)
                const marketVal = getMarketValueAtDate(checkDate);
                value = manualVal + marketVal;
            }

            data.push({ name: `${monthName}/${year}`, value, fullDate: checkDate.toISOString() });
        }

        // 5. Override Today's value with explicit Portfolio Total from items
        // This ensures the chart ends exactly where the Dashboard KPI says.
        let totalCurrentValue = 0;
        if (portfolioId) {
            const allItems = cachedPortfolioItems || [];
            totalCurrentValue = allItems.reduce((acc, i) => acc + calcCurrentValue(i), 0);
        } else {
            totalCurrentValue = (cachedGlobalItems || []).reduce((acc, i) => acc + calcCurrentValue(i), 0);
        }

        if (data.length > 0) {
            const lastPoint = data[data.length - 1];
            // Only override if the last point is "today" (or close enough)
            const lastDate = new Date(lastPoint.fullDate);
            const hasPositiveHistoryBeforeLast = data.slice(0, -1).some((p) => Number(p.value || 0) > 0);
            const allowLastPointOverride = data.length === 1 || hasPositiveHistoryBeforeLast || Number(lastPoint.value || 0) > 0;
            if (lastDate.toDateString() === now.toDateString() && allowLastPointOverride) {
                lastPoint.value = totalCurrentValue;
            }
        }

        return data;
    },

    // AIDEV-NEW: Specific service for Total Return Performance (Rentabilidade com reinvestimento)
    // Updated to support Two Metrics: Total Return and Price Return
    getPerformanceData: async (portfolioId?: string, range: '6M' | '1A' | 'ALL' = '6M'): Promise<{ name: string; value: number; valuePrice: number; fullDate: string }[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        // 1. Determine Date Range
        const now = new Date();
        const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let startDate = new Date();
        let cachedPortfolioItems: CustomItem[] | null = null;
        let cachedGlobalPortfolios: Portfolio[] | null = null;
        let cachedGlobalItems: (CustomItem & { portfolio_id?: string })[] | null = null;

        if (portfolioId) {
            cachedPortfolioItems = await portfolioService.getCustomItems(portfolioId);
        } else {
            const [portfolios, allItems] = await Promise.all([
                repository.getAll(),
                repository.getAllItems() as Promise<(CustomItem & { portfolio_id?: string })[]>
            ]);
            cachedGlobalPortfolios = portfolios;
            cachedGlobalItems = allItems;
        }
        if (range === '6M') startDate.setMonth(now.getMonth() - 6);
        else if (range === '1A') startDate.setFullYear(now.getFullYear() - 1);
        else if (range === 'ALL') {
            startDate.setFullYear(now.getFullYear() - 5);
            let oldestDate = new Date(startDate);
            let foundValidDate = false;
            if (portfolioId) {
                const allItems = cachedPortfolioItems || [];
                for (const item of allItems) {
                    const itemDate = parseFlexibleDate(item.initialDate);
                    if (itemDate && itemDate < oldestDate) oldestDate = itemDate;
                    if (itemDate) foundValidDate = true;
                }
            } else {
                for (const item of (cachedGlobalItems || [])) {
                    const itemDate = parseFlexibleDate(item.initialDate);
                    if (itemDate && itemDate < oldestDate) oldestDate = itemDate;
                    if (itemDate) foundValidDate = true;
                }
            }
            if (foundValidDate) {
                startDate = oldestDate;
            }
        }

        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        // AIDEV-FIX: The backend cumulative performance series can drift/corrupt in ALL/MAX.
        // Rebuild the long-range series locally from NAV + cash flows and use that as the
        // source of truth whenever we can produce a valid series.
        if (portfolioId && range === 'ALL') {
            const candidateItems = cachedPortfolioItems || [];

            try {
                const [navSeries, dividendRows] = await Promise.all([
                    portfolioService.getEvolutionData(portfolioId, 'ALL'),
                    portfolioService.getUserDividends(portfolioId, { start: startDate, end: endDate }),
                ]);

                const rebuiltSeries = buildLocalPerformanceSeriesFromNav(navSeries, candidateItems, dividendRows);
                if (rebuiltSeries.length > 0) {
                    return rebuiltSeries;
                }
            } catch (error) {
                console.warn('Local ALL performance rebuild failed, falling back to backend RPC.', error);
            }
        }

        // 2. Call new RPC
        type DailyPoint = { date: string, return_total: number, return_price: number, nav: number };
        let performanceSeries: DailyPoint[] = [];

        if (portfolioId) {
            const fetchPerformanceChunk = async (chunkStart: Date, chunkEnd: Date): Promise<DailyPoint[]> => {
                const { data, error } = await supabase.rpc('get_portfolio_performance_daily', {
                    p_portfolio_id: portfolioId,
                    p_start_date: chunkStart.toISOString().split('T')[0],
                    p_end_date: chunkEnd.toISOString().split('T')[0]
                });
                if (error) {
                    console.error('Error fetching performance history chunk:', error);
                    return [];
                }
                return (data || []).map((d: any) => ({
                    date: d.date,
                    return_total: Number(d.return_total),
                    return_price: Number(d.return_price),
                    nav: Number(d.nav)
                }));
            };

            if (range === 'ALL') {
                // Optimized path for portfolio profitability MAX chart:
                // fetch month-end points directly from portfolio_performance_daily.
                try {
                    const { data: monthlyData, error: monthlyError } = await supabase.rpc('get_portfolio_performance_monthly', {
                        p_portfolio_id: portfolioId,
                        p_start_date: startDate.toISOString().split('T')[0],
                        p_end_date: endDate.toISOString().split('T')[0]
                    });

                    if (!monthlyError && monthlyData && monthlyData.length > 0) {
                        performanceSeries = (monthlyData as any[]).map((d: any) => ({
                            date: d.date,
                            return_total: Number(d.return_total),
                            return_price: Number(d.return_price),
                            nav: Number(d.nav)
                        }));
                    } else {
                        if (monthlyError) {
                            console.warn('Monthly performance RPC failed, falling back to chunked daily RPC:', monthlyError);
                        }
                    }
                } catch (monthlyRpcErr) {
                    console.warn('Monthly performance RPC unavailable, falling back to chunked daily RPC', monthlyRpcErr);
                }

                if (performanceSeries.length === 0) {
                // Evita truncamento por limite de linhas do PostgREST/Supabase (ex.: 1000).
                // Busca em janelas menores e concatena por data.
                const merged = new Map<string, DailyPoint>();
                const cursor = new Date(startDate);
                cursor.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                const windowDays = 300;
                const windows: Array<{ chunkStart: Date; chunkEnd: Date }> = [];

                while (cursor <= end) {
                    const chunkStart = new Date(cursor);
                    const chunkEnd = new Date(cursor);
                    chunkEnd.setDate(chunkEnd.getDate() + windowDays);
                    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
                    windows.push({ chunkStart, chunkEnd });
                    cursor.setDate(cursor.getDate() + windowDays + 1);
                }

                // IMPORTANT: Do not fan out all chunks in parallel.
                // In production this can saturate the database/RPC and trigger statement timeout (57014),
                // which increases total latency dramatically due to retries/timeouts.
                for (const { chunkStart, chunkEnd } of windows) {
                    const chunk = await fetchPerformanceChunk(chunkStart, chunkEnd);
                    for (const row of chunk) {
                        const key = String(row.date).split('T')[0];
                        const prev = merged.get(key);
                        if (!prev || Math.abs(row.return_total) >= Math.abs(prev.return_total)) {
                            merged.set(key, { ...row, date: key });
                        }
                    }
                }

                performanceSeries = Array.from(merged.values());
                }
            } else {
                performanceSeries = await fetchPerformanceChunk(startDate, endDate);
            }
        } else {
            // Consistency path: when the user effectively has a single active portfolio,
            // global profitability must reuse the exact same canonical series.
            const userPortfolios = cachedGlobalPortfolios || [];
            const globalItems = cachedGlobalItems || [];
            const currentPortfolioIds = new Set(
                userPortfolios
                    .map((portfolio) => String(portfolio.id || '').trim())
                    .filter((id) => id.length > 0)
            );
            const portfolioIdsWithItems = new Set(
                globalItems
                    .map((item) => String(item.portfolio_id || '').trim())
                    .filter((id) => id.length > 0 && currentPortfolioIds.has(id))
            );

            const singlePortfolioIdWithItems =
                portfolioIdsWithItems.size === 1
                    ? Array.from(portfolioIdsWithItems)[0]
                    : null;

            if (singlePortfolioIdWithItems) {
                const portfolioBackedByItems = userPortfolios.find(
                    (portfolio) => portfolio.id === singlePortfolioIdWithItems
                ) || null;

                if (portfolioBackedByItems) {
                    const canonicalSeries = await getCanonicalPortfolioEconomicSeries(portfolioBackedByItems, range);
                    if (canonicalSeries.length > 0) {
                        return economicSeriesToPerformanceSeries(canonicalSeries);
                    }
                    return portfolioService.getPerformanceData(portfolioBackedByItems.id, range);
                }
            }

            const portfoliosBackedByItems = userPortfolios.filter((portfolio) =>
                portfolioIdsWithItems.has(portfolio.id)
            );

            if (portfoliosBackedByItems.length === 1) {
                const canonicalSeries = await getCanonicalPortfolioEconomicSeries(portfoliosBackedByItems[0], range);
                if (canonicalSeries.length > 0) {
                    return economicSeriesToPerformanceSeries(canonicalSeries);
                }
                return portfolioService.getPerformanceData(portfoliosBackedByItems[0].id, range);
            }

            const singleUserPortfolio = userPortfolios.length === 1 ? userPortfolios[0] : null;
            if (singleUserPortfolio) {
                const canonicalSeries = await getCanonicalPortfolioEconomicSeries(singleUserPortfolio, range);
                if (canonicalSeries.length > 0) {
                    return economicSeriesToPerformanceSeries(canonicalSeries);
                }
                return portfolioService.getPerformanceData(singleUserPortfolio.id, range);
            }

            // Canonical global profitability:
            // aggregate per-portfolio economic value series instead of inferring returns
            // from rollups/snapshots. This keeps the global page aligned with each
            // portfolio type's own profitability logic.
            const canonicalPortfolios = userPortfolios.filter((portfolio) => {
                if (portfolioIdsWithItems.has(portfolio.id)) return true;
                return Number(portfolio.value || 0) > 0;
            });

            const portfolioSeries = await Promise.all(
                canonicalPortfolios.map(async (portfolio) => ({
                    portfolioId: portfolio.id,
                    series: await getCanonicalPortfolioEconomicSeries(portfolio, range),
                }))
            );

            const validSeries = portfolioSeries
                .map((entry) => ({
                    portfolioId: entry.portfolioId,
                    series: entry.series
                        .filter((point) => point?.fullDate && Number.isFinite(point.economicValue) && Number.isFinite(point.investedBasis))
                        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()),
                }))
                .filter((entry) => entry.series.length > 0);

            if (validSeries.length > 0) {
                const dateKeys = Array.from(
                    new Set(
                        validSeries.flatMap((entry) =>
                            entry.series.map((point) => String(point.fullDate).slice(0, 10))
                        )
                    )
                ).sort((a, b) => a.localeCompare(b));

                const pointers = new Map<string, number>();
                for (const entry of validSeries) {
                    pointers.set(entry.portfolioId, 0);
                }

                for (const dateKey of dateKeys) {
                    let totalEconomicValue = 0;
                    let totalInvestedBasis = 0;

                    for (const entry of validSeries) {
                        const currentIdx = pointers.get(entry.portfolioId) || 0;
                        let resolvedIdx = currentIdx;

                        while (
                            resolvedIdx + 1 < entry.series.length &&
                            String(entry.series[resolvedIdx + 1].fullDate).slice(0, 10) <= dateKey
                        ) {
                            resolvedIdx += 1;
                        }

                        pointers.set(entry.portfolioId, resolvedIdx);
                        const point = entry.series[resolvedIdx];
                        if (!point || String(point.fullDate).slice(0, 10) > dateKey) continue;

                        totalEconomicValue += Number(point.economicValue || 0);
                        totalInvestedBasis += Number(point.investedBasis || 0);
                    }

                    if (totalInvestedBasis <= 0) continue;

                    performanceSeries.push({
                        date: dateKey,
                        return_total: (totalEconomicValue / totalInvestedBasis) - 1,
                        return_price: (totalEconomicValue / totalInvestedBasis) - 1,
                        nav: totalEconomicValue,
                    });
                }
            }
        }

        // 3. Preserve the true inception baseline for ALL/MAX.
        // The monthly RPC returns month-end points only, so the first row can already
        // contain accumulated return from a partial first month. Prepending a zero
        // baseline at the real start date prevents the UI from dropping that gain.
        performanceSeries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // AIDEV-FIX: Some backend rows can end with nav=0 on non-trading days (weekends/holidays),
        // which fabricates a final -100% daily return and crashes the chart/KPI.
        // Trim only trailing invalid rows, preserving legitimate historical zeros before inception.
        if (performanceSeries.length > 1) {
            let lastPositiveIndex = -1;
            for (let i = 0; i < performanceSeries.length; i += 1) {
                if (Number(performanceSeries[i].nav) > 0) {
                    lastPositiveIndex = i;
                }
            }

            if (lastPositiveIndex >= 0 && lastPositiveIndex < performanceSeries.length - 1) {
                performanceSeries = performanceSeries.slice(0, lastPositiveIndex + 1);
            }
        }

        if (range === 'ALL' && performanceSeries.length > 0) {
            const firstPointDate = String(performanceSeries[0].date).split('T')[0];
            const baselineDate = startDate.toISOString().split('T')[0];
            if (firstPointDate !== baselineDate) {
                const firstNav = Number(performanceSeries[0].nav) || 0;
                performanceSeries.unshift({
                    date: baselineDate,
                    return_total: 0,
                    return_price: 0,
                    nav: firstNav
                });
            }
        }

        // We return decimal values directly (e.g. 0.05 for 5%)
        return performanceSeries.map(p => ({
            name: `${new Date(p.date).getDate()}/${monthsShort[new Date(p.date).getMonth()]}`,
            fullDate: p.date,
            value: p.return_total, // Primary Metric (Legacy compatibility)
            valuePrice: p.return_price // Secondary Metric
        }));
    },

    getAllocationData: async (): Promise<{ name: string; value: number; color: string }[]> => {
        const portfolios = await repository.getAll();
        const map = new Map<string, number>();

        for (const p of portfolios) {
            const items = await repository.getItems(p.id);
            const pTotal = items.length > 0
                ? items.reduce((acc, i) => acc + calculateCurrentValue(i), 0)
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
    },

    getBenchmarkData: async (range: '6M' | '1A' | 'ALL' = '6M', customStartDate?: string): Promise<{
        date: string;
        cdi?: number;
        ipca?: number;
        ibov?: number;
        spx?: number;
        ifix?: number;
        idiv?: number;
        smll?: number;
        ivvb11?: number;
    }[]> => {
        const { supabaseClient } = await import('./supabaseClient');
        const supabase = supabaseClient();

        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        let startDate = new Date();
        if (range === '6M') startDate.setMonth(now.getMonth() - 6);
        else if (range === '1A') startDate.setFullYear(now.getFullYear() - 1);
        else if (range === 'ALL') {
            if (customStartDate) {
                startDate = new Date(customStartDate);
            } else {
                startDate.setFullYear(now.getFullYear() - 10);
            }
        }

        const startStr = startDate.toISOString().split('T')[0];

        try {
            // Strategy: Fetch directly from benchmark_cumulative_series with PARALLEL pagination.
            // Step 1 + 2 run in parallel. If more pages needed, fetch them all at once.

            const PAGE_SIZE = 1000;
            const selectCols = 'date, cdi_factor, ipca_factor, ibov_points, spx_points, ifix_points, idiv_points, smll_points, ivvb11_points';

            // Step 1 & 2: Fetch baseline + first page IN PARALLEL
            const t0 = Date.now();
            const [baseResult, page1Result] = await Promise.all([
                // Baseline: last row at or before start_date
                supabase
                    .from('benchmark_cumulative_series')
                    .select('*')
                    .lte('date', startStr)
                    .order('date', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                // First page of data
                supabase
                    .from('benchmark_cumulative_series')
                    .select(selectCols)
                    .gte('date', startStr)
                    .lte('date', endDate)
                    .order('date', { ascending: true })
                    .range(0, PAGE_SIZE - 1)
            ]);

            const base = baseResult.data;
            const page1 = page1Result.data || [];
            console.log(`[BENCHMARK] Baseline + Page1 (${page1.length} rows) in ${Date.now() - t0}ms`);

            if (!base) {
                console.warn('[BENCHMARK] No baseline found');
                return [];
            }
            if (page1.length === 0) return [];

            // Step 3: If first page is full, fetch remaining pages IN PARALLEL
            let allRows = [...page1];

            if (page1.length === PAGE_SIZE) {
                // Estimate ~2200 days for 6 years of calendar days — fetch up to 5 pages to be safe
                const maxPages = 5;
                const pagePromises = [];
                for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                    pagePromises.push(
                        supabase
                            .from('benchmark_cumulative_series')
                            .select(selectCols)
                            .gte('date', startStr)
                            .lte('date', endDate)
                            .order('date', { ascending: true })
                            .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
                    );
                }

                const t1 = Date.now();
                const pageResults = await Promise.all(pagePromises);
                for (const result of pageResults) {
                    if (result.data && result.data.length > 0) {
                        allRows.push(...result.data);
                    }
                }
                console.log(`[BENCHMARK] Parallel pages fetched ${allRows.length} total rows in ${Date.now() - t1}ms`);
            }

            console.log(`[BENCHMARK] Total: ${allRows.length} rows in ${Date.now() - t0}ms`);

            if (allRows.length === 0) return [];

            // Step 3: Fill-forward null equity values (LOCF)
            let lastIbov = base.ibov_points;
            let lastSpx = base.spx_points;
            let lastIfix = base.ifix_points;
            let lastIdiv = base.idiv_points;
            let lastSmll = base.smll_points;
            let lastIvvb11 = base.ivvb11_points;

            for (const row of allRows) {
                if (row.ibov_points !== null) lastIbov = row.ibov_points; else row.ibov_points = lastIbov;
                if (row.spx_points !== null) lastSpx = row.spx_points; else row.spx_points = lastSpx;
                if (row.ifix_points !== null) lastIfix = row.ifix_points; else row.ifix_points = lastIfix;
                if (row.idiv_points !== null) lastIdiv = row.idiv_points; else row.idiv_points = lastIdiv;
                if (row.smll_points !== null) lastSmll = row.smll_points; else row.smll_points = lastSmll;
                if (row.ivvb11_points !== null) lastIvvb11 = row.ivvb11_points; else row.ivvb11_points = lastIvvb11;
            }

            // Step 4: Normalize — decimal returns (0.15 = 15%)
            const firstNonNull = (key: keyof typeof allRows[number]) =>
                allRows.find((r: any) => r[key] !== null && r[key] !== undefined)?.[key];

            const baseValues = {
                cdi_factor: base.cdi_factor ?? firstNonNull('cdi_factor'),
                ipca_factor: base.ipca_factor ?? firstNonNull('ipca_factor'),
                ibov_points: base.ibov_points ?? firstNonNull('ibov_points'),
                spx_points: base.spx_points ?? firstNonNull('spx_points'),
                ifix_points: base.ifix_points ?? firstNonNull('ifix_points'),
                idiv_points: base.idiv_points ?? firstNonNull('idiv_points'),
                smll_points: base.smll_points ?? firstNonNull('smll_points'),
                ivvb11_points: base.ivvb11_points ?? firstNonNull('ivvb11_points'),
            };

            const safe = (current: any, baseVal: any): number | undefined => {
                if (current == null || baseVal == null || Number(baseVal) === 0) return undefined;
                return (Number(current) / Number(baseVal)) - 1;
            };

            return allRows.map((row: any) => ({
                date: row.date,
                cdi: safe(row.cdi_factor, baseValues.cdi_factor),
                ipca: safe(row.ipca_factor, baseValues.ipca_factor),
                ibov: safe(row.ibov_points, baseValues.ibov_points),
                spx: safe(row.spx_points, baseValues.spx_points),
                ifix: safe(row.ifix_points, baseValues.ifix_points),
                idiv: safe(row.idiv_points, baseValues.idiv_points),
                smll: safe(row.smll_points, baseValues.smll_points),
                ivvb11: safe(row.ivvb11_points, baseValues.ivvb11_points),
            })).filter((d: any) =>
                d.cdi !== undefined || d.ipca !== undefined ||
                d.ibov !== undefined || d.spx !== undefined ||
                d.ifix !== undefined || d.idiv !== undefined ||
                d.smll !== undefined || d.ivvb11 !== undefined
            );
        } catch (err) {
            console.error('Failed to fetch benchmark data', err);
            return [];
        }
    },
};
