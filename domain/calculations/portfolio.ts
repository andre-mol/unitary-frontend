/**
 * Portfolio Calculation Functions
 * Pure functions for portfolio-level metrics and scoring
 * No localStorage, no React, no side effects
 * 
 * AIDEV-NOTE: Financial math rules. Use precise decimal math when appropriate.
 * Avoid rounding interest/index rates prematurely. Indexes like IGPM can be
 * fractional and must not be rounded to whole percentages. Always state assumptions
 * (periodicity, compounding frequency, inflation mode).
 */

import { CustomItem, PortfolioEvent } from '../../types';
import { calculateCurrentValue, calculateTotalInvested, getValueAtDate } from './asset';

/**
 * Calculates variation percentage between two values
 */
export const calculateVariationPercentage = (currentValue: number, previousValue: number): number => {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
};

/**
 * Calculates the previous value based on current value and variation percentage
 */
export const calculatePreviousValue = (currentValue: number, variationPercentage: number): number => {
    if (variationPercentage === -100) return 0;
    return currentValue / (1 + (variationPercentage / 100));
};

/**
 * Calculates global portfolio metrics (total balance, monthly variation)
 */
export const calculateGlobalMetrics = (
    portfolioItems: { portfolioId: string; items: CustomItem[] }[]
): { totalBalance: number; monthlyProfit: number; monthlyVariation: number } => {
    let currentTotal = 0;
    let lastMonthTotal = 0;

    const now = new Date();
    const lastMonthDate = new Date();
    lastMonthDate.setDate(now.getDate() - 30);
    lastMonthDate.setHours(23, 59, 59, 999);

    portfolioItems.forEach(({ items }) => {
        const pTotal = items.reduce((acc, i) => acc + calculateCurrentValue(i), 0);
        currentTotal += pTotal;

        const pLastMonth = getValueAtDate(items, lastMonthDate);
        lastMonthTotal += pLastMonth;
    });

    const profit = currentTotal - lastMonthTotal;
    const percentage = lastMonthTotal > 0 ? (profit / lastMonthTotal) * 100 : 0;

    return {
        totalBalance: currentTotal,
        monthlyProfit: profit,
        monthlyVariation: percentage
    };
};

/**
 * Calculates the conviction score for an asset based on criteria answers
 * Returns both raw score and normalized display score (0-10)
 */
export const calculateScore = (
    criteriaAnswers: boolean[] | undefined,
    criteriaCount: number
): { raw: number; display: number } => {
    if (!criteriaAnswers || criteriaAnswers.length === 0 || criteriaCount === 0) {
        return { raw: 0, display: 0 };
    }

    let rawScore = 0;
    for (let i = 0; i < criteriaCount; i++) {
        const answer = criteriaAnswers[i];
        rawScore += (answer === true ? 1 : -1);
    }

    // Normalized Display Score (0 to 10)
    // Formula: ((Raw + MaxPossible) / (2 * MaxPossible)) * 10
    const normalized = ((rawScore + criteriaCount) / (2 * criteriaCount)) * 10;

    return {
        raw: rawScore,
        display: Math.max(0, Math.min(10, normalized)) // Clamp
    };
};

/**
 * Calculates the ideal allocation for items based on their scores and category targets
 */
export const calculateIdealAllocation = (
    items: CustomItem[],
    criteriaCount: number,
    categoryTargets?: Record<string, number>
): Map<string, number> => {
    const allocationMap = new Map<string, number>();

    if (items.length === 0) return allocationMap;

    const hasStrategy = categoryTargets && Object.values(categoryTargets).some(t => t > 0);

    if (hasStrategy && categoryTargets) {
        const itemsByCategory: Record<string, CustomItem[]> = {};
        items.forEach(i => {
            const cat = i.category || 'Geral';
            if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
            itemsByCategory[cat].push(i);
        });

        Object.entries(itemsByCategory).forEach(([category, catItems]) => {
            const catTargetPct = categoryTargets[category] || 0;

            if (catItems.length === 0) return;

            if (catTargetPct === 0) {
                catItems.forEach(i => allocationMap.set(i.id, 0));
                return;
            }

            let sumCatWeights = 0;
            const catItemWeights = new Map<string, number>();

            catItems.forEach(item => {
                let note = 5;
                if (item.criteriaAnswers && item.criteriaAnswers.length > 0) {
                    const { display } = calculateScore(item.criteriaAnswers, criteriaCount);
                    note = display;
                }
                const factor = 0.5 + (note / 10);
                catItemWeights.set(item.id, factor);
                sumCatWeights += factor;
            });

            catItems.forEach(item => {
                const weight = catItemWeights.get(item.id) || 0;
                const idealPct = sumCatWeights > 0 ? (weight / sumCatWeights) * catTargetPct : 0;
                allocationMap.set(item.id, idealPct);
            });
        });

    } else {
        let sumGlobalWeights = 0;
        const itemWeights = new Map<string, number>();

        items.forEach(item => {
            let note = 5;
            if (item.criteriaAnswers && item.criteriaAnswers.length > 0) {
                const { display } = calculateScore(item.criteriaAnswers, criteriaCount);
                note = display;
            }
            const factor = 0.5 + (note / 10);
            itemWeights.set(item.id, factor);
            sumGlobalWeights += factor;
        });

        items.forEach(item => {
            const weight = itemWeights.get(item.id) || 0;
            const idealPct = sumGlobalWeights > 0 ? (weight / sumGlobalWeights) * 100 : 0;
            allocationMap.set(item.id, idealPct);
        });
    }

    return allocationMap;
};

/**
 * Calculates progress percentage towards a goal
 */
export const calculateProgressPercentage = (current: number, total: number): number => {
    if (total <= 0) return 0;
    return Math.min(100, (current / total) * 100);
};

/**
 * Calculates portfolio score based on average asset scores and user conviction
 */
export const calculatePortfolioScore = (
    items: CustomItem[],
    criteriaCount: number,
    userConvictionScore: number = 5
): number => {
    let totalAssetScore = 0;
    let countEvaluated = 0;

    items.forEach(item => {
        if (item.criteriaAnswers && item.criteriaAnswers.length > 0) {
            const { display } = calculateScore(item.criteriaAnswers, criteriaCount);
            totalAssetScore += display;
            countEvaluated++;
        }
    });

    const avgAssetScore = countEvaluated > 0 ? totalAssetScore / countEvaluated : 0;

    // Formula: (Average Asset Score * 0.7) + (User Score * 0.3)
    return (avgAssetScore * 0.7) + (userConvictionScore * 0.3);
};

/**
 * Groups items by category and calculates totals
 */
export const groupItemsByCategory = (
    items: CustomItem[]
): { category: string; totalValue: number; items: CustomItem[] }[] => {
    const groups: Record<string, { category: string; totalValue: number; items: CustomItem[] }> = {};
    
    items.forEach(item => {
        // Group by Property Type if Real Estate, Structure for Businesses
        let cat = item.category || 'Geral';
        if (item.customFields?.propertyType) {
            const propertyType = item.customFields.propertyType;
            cat = typeof propertyType === 'string' ? propertyType : cat;
        } else if (item.customFields?.structureType) {
            const structureType = item.customFields.structureType;
            cat = typeof structureType === 'string' ? structureType : cat;
        }

        if (!groups[cat]) groups[cat] = { category: cat, totalValue: 0, items: [] };
        groups[cat].items.push(item);
        groups[cat].totalValue += calculateCurrentValue(item);
    });
    
    return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue);
};

/**
 * Calculates business/private equity metrics
 */
export const calculateBusinessMetrics = (
    items: CustomItem[],
    events?: PortfolioEvent[]
): {
    totalPatrimonialValue: number;
    totalInvestedCapital: number;
    patrimonialVariation: number;
    lastValuationDate: Date | null;
    totalAccumulatedProfit: number;
    totalDistributed: number;
    totalEquityValueUser: number;
    totalDistributionsUser: number;
    totalCapitalCalls: number;
    totalReturnValue: number;
    totalReturnPct: number;
    equityReturnValue: number;
    equityReturnPct: number;
    cashReturnValue: number;
    cashReturnPct: number;
    reportedRevenue: number;
    reportedGrossProfit: number;
    reportedNetProfit: number;
    distributions12m: number;
    capitalCalls12m: number;
    netProfit12m: number;
    cashFlowMonthly: Array<{ month: string; distributions: number; capitalCalls: number }>;
    performanceMonthly: Array<{ month: string; totalReturnPct: number; equityReturnPct: number; cashReturnPct: number }>;
    netProfitMonthly: Array<{ month: string; netProfit: number }>;
} => {
    const toOwnershipFactor = (item: CustomItem): number => {
        const raw = Number(item.customFields?.ownershipPercentage ?? 100);
        if (!Number.isFinite(raw)) return 1;
        return Math.max(0, Math.min(raw, 100)) / 100;
    };

    const eventAmountToUser = (event: PortfolioEvent): number => {
        const payload = event.payload || {};
        const amountToUser = Number((payload as any).amount_to_user);
        if (Number.isFinite(amountToUser) && amountToUser > 0) return amountToUser;

        const amountTotal = Number((payload as any).amount_total_company);
        if (Number.isFinite(amountTotal) && amountTotal > 0) {
            const owner = items.find((item) => item.id === event.assetId);
            const factor = owner ? toOwnershipFactor(owner) : 1;
            return amountTotal * factor;
        }

        return Number(event.totalValue) || 0;
    };

    const capitalCallAmountToUser = (event: PortfolioEvent): number => {
        const payload = event.payload || {};
        const amountToUser = Number((payload as any).amount_to_user);
        if (Number.isFinite(amountToUser) && amountToUser > 0) return amountToUser;

        const amountTotal = Number((payload as any).amount_total_company);
        if (Number.isFinite(amountTotal) && amountTotal > 0) {
            const owner = items.find((item) => item.id === event.assetId);
            const factor = owner ? toOwnershipFactor(owner) : 1;
            return amountTotal * factor;
        }

        return Number(event.totalValue) || 0;
    };

    const approxEqual = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

    const currentValueToUser = (item: CustomItem, rawCurrentValue: number): number => {
        // In this app, initialValue and most business transactions are entered as the user's stake.
        // ownershipPercentage should only be applied when we can confidently infer the stored current
        // value represents the whole company (e.g. explicit "companyCurrentValue" field).
        const companyCurrentValue = Number(item.customFields?.companyCurrentValue);
        if (Number.isFinite(companyCurrentValue) && companyCurrentValue > 0) {
            if (approxEqual(rawCurrentValue, companyCurrentValue, Math.max(0.01, companyCurrentValue * 0.001))) {
                return rawCurrentValue * toOwnershipFactor(item);
            }
        }
        return rawCurrentValue;
    };

    const isCapitalCallDuplicatedInItemCost = (event: PortfolioEvent, amountToUser: number): boolean => {
        if (!(amountToUser > 0)) return false;
        const owner = items.find((item) => item.id === event.assetId);
        if (!owner) return false;

        const eventDate = String(event.date || '').slice(0, 10);
        const initialDate = String(owner.initialDate || '').slice(0, 10);

        // Matches the initial lot already embedded in initialValue
        if (
            initialDate &&
            eventDate &&
            initialDate === eventDate &&
            approxEqual(Number(owner.initialValue || 0), amountToUser, 0.01)
        ) {
            return true;
        }

        // Matches a buy transaction already included in calculateTotalInvested(item)
        const txs = owner.transactions || [];
        for (const tx of txs) {
            if (tx.type !== 'buy') continue;
            const txDate = String(tx.date || '').slice(0, 10);
            const txAmountToUser = Number(tx.totalValue || 0);
            if (txDate === eventDate && approxEqual(txAmountToUser, amountToUser, 0.01)) {
                return true;
            }
        }

        return false;
    };

    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let totalPatrimonialValue = 0;
    let totalInvestedCapital = 0;
    let lastValuationDate: Date | null = null;
    let totalAccumulatedProfit = 0;
    let totalDistributed = 0;
    let totalEquityValueUser = 0;
    let totalCapitalCalls = 0;
    let totalCapitalCallsIncludedInBasis = 0;
    let totalDistributionsUser = 0;
    let reportedRevenue = 0;
    let reportedGrossProfit = 0;
    let reportedNetProfit = 0;
    let distributions12m = 0;
    let capitalCalls12m = 0;
    let netProfit12m = 0;
    const cashFlowByMonth = new Map<string, { distributions: number; capitalCalls: number }>();
    const capitalCallsBasisByMonth = new Map<string, number>();
    const netProfitByMonth = new Map<string, number>();

    items.forEach(item => {
        const currentVal = calculateCurrentValue(item);
        const invested = calculateTotalInvested(item);
        const currentValueUser = currentValueToUser(item, currentVal);

        totalPatrimonialValue += currentVal;
        totalInvestedCapital += invested;
        totalEquityValueUser += currentValueUser;

        // Find latest update date
        const itemUpdate = new Date(item.updatedAt || item.initialDate);
        if (!lastValuationDate || itemUpdate > lastValuationDate) {
            lastValuationDate = itemUpdate;
        }
    });

    if (events) {
        const now = new Date();
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        events.forEach(e => {
            const eventDate = new Date(e.date);
            const inLast12m = !Number.isNaN(eventDate.getTime()) && eventDate >= twelveMonthsAgo && eventDate <= now;

            if (e.type === 'profit_registered' || e.type === 'profit_report') {
                const payload = e.payload || {};
                const revenue = Number((payload as any).revenue ?? 0);
                const grossProfit = Number((payload as any).gross_profit ?? 0);
                const netProfit = Number((payload as any).net_profit ?? e.totalValue ?? 0);

                totalAccumulatedProfit += netProfit;
                reportedRevenue += Number.isFinite(revenue) ? revenue : 0;
                reportedGrossProfit += Number.isFinite(grossProfit) ? grossProfit : 0;
                reportedNetProfit += Number.isFinite(netProfit) ? netProfit : 0;
                if (inLast12m) netProfit12m += Number.isFinite(netProfit) ? netProfit : 0;
                const key = monthKey(eventDate);
                const currentNet = netProfitByMonth.get(key) || 0;
                netProfitByMonth.set(key, currentNet + (Number.isFinite(netProfit) ? netProfit : 0));
            } else if (e.type === 'profit_distribution' || e.type === 'distribution') {
                const amountToUser = eventAmountToUser(e);
                totalDistributed += amountToUser;
                totalDistributionsUser += amountToUser;
                if (inLast12m) distributions12m += amountToUser;

                const key = monthKey(eventDate);
                const current = cashFlowByMonth.get(key) || { distributions: 0, capitalCalls: 0 };
                current.distributions += amountToUser;
                cashFlowByMonth.set(key, current);
            } else if (e.type === 'capital_call') {
                const callValue = capitalCallAmountToUser(e);
                const duplicatedInItemCost = isCapitalCallDuplicatedInItemCost(e, callValue);
                totalCapitalCalls += callValue;
                if (!duplicatedInItemCost) {
                    totalInvestedCapital += callValue;
                    totalCapitalCallsIncludedInBasis += callValue;
                }
                if (inLast12m) capitalCalls12m += callValue;

                const key = monthKey(eventDate);
                const current = cashFlowByMonth.get(key) || { distributions: 0, capitalCalls: 0 };
                current.capitalCalls += callValue;
                cashFlowByMonth.set(key, current);

                if (!duplicatedInItemCost) {
                    const basisCurrent = capitalCallsBasisByMonth.get(key) || 0;
                    capitalCallsBasisByMonth.set(key, basisCurrent + callValue);
                }
            }
        });
    }

    const patrimonialVariation = totalPatrimonialValue - totalInvestedCapital;
    const equityReturnValue = totalEquityValueUser - totalInvestedCapital;
    const cashReturnValue = totalDistributionsUser;
    const totalReturnValue = equityReturnValue + cashReturnValue;
    const equityReturnPct = totalInvestedCapital > 0 ? (equityReturnValue / totalInvestedCapital) * 100 : 0;
    const cashReturnPct = totalInvestedCapital > 0 ? (cashReturnValue / totalInvestedCapital) * 100 : 0;
    const totalReturnPct = totalInvestedCapital > 0 ? (totalReturnValue / totalInvestedCapital) * 100 : 0;

    const monthKeys = Array.from(cashFlowByMonth.keys()).sort();
    const performanceMonthly: Array<{ month: string; totalReturnPct: number; equityReturnPct: number; cashReturnPct: number }> = [];
    const cashFlowMonthly: Array<{ month: string; distributions: number; capitalCalls: number }> = [];
    const netProfitMonthly: Array<{ month: string; netProfit: number }> = [];
    let cumulativeDistributions = 0;
    let cumulativeCalls = 0;
    let cumulativeCallsForBasis = 0;
    for (const key of monthKeys) {
        const row = cashFlowByMonth.get(key)!;
        cumulativeDistributions += row.distributions;
        cumulativeCalls += row.capitalCalls;
        cumulativeCallsForBasis += Number(capitalCallsBasisByMonth.get(key) || 0);
        const investedCum = Math.max(totalInvestedCapital - totalCapitalCallsIncludedInBasis + cumulativeCallsForBasis, 0);
        const equityPct = investedCum > 0 ? (equityReturnValue / investedCum) * 100 : 0;
        const cashPct = investedCum > 0 ? (cumulativeDistributions / investedCum) * 100 : 0;
        cashFlowMonthly.push({ month: key, distributions: row.distributions, capitalCalls: row.capitalCalls });
        performanceMonthly.push({
            month: key,
            equityReturnPct: equityPct,
            cashReturnPct: cashPct,
            totalReturnPct: equityPct + cashPct
        });
        netProfitMonthly.push({
            month: key,
            netProfit: Number(netProfitByMonth.get(key) || 0),
        });
    }

    return {
        totalPatrimonialValue,
        totalInvestedCapital,
        patrimonialVariation,
        lastValuationDate,
        totalAccumulatedProfit,
        totalDistributed,
        totalEquityValueUser,
        totalDistributionsUser,
        totalCapitalCalls,
        totalReturnValue,
        totalReturnPct,
        equityReturnValue,
        equityReturnPct,
        cashReturnValue,
        cashReturnPct,
        reportedRevenue,
        reportedGrossProfit,
        reportedNetProfit,
        distributions12m,
        capitalCalls12m,
        netProfit12m,
        cashFlowMonthly,
        performanceMonthly,
        netProfitMonthly
    };
};
