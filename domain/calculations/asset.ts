/**
 * Asset Calculation Functions
 * Pure functions for calculating asset values and metrics
 * No localStorage, no React, no side effects
 */

import { CustomItem, ValuationMethod, Transaction } from '../../types';

/**
 * Calculates the value of a specific lot (principal + growth) based on valuation method
 */
export const calculateLotValue = (
    principal: number,
    dateStr: string,
    method: ValuationMethod
): number => {
    if (method.type === 'manual') return principal;

    if (method.type === 'periodic' && method.periodicRate) {
        const start = new Date(dateStr.includes('T') ? dateStr.split('T')[0] + 'T00:00:00' : dateStr + 'T00:00:00');
        const now = new Date();

        if (start.getTime() > now.getTime()) return principal;

        const diffTime = Math.abs(now.getTime() - start.getTime());
        const daysPassed = diffTime / (1000 * 60 * 60 * 24);

        let periods = 0;
        const rate = Number(method.periodicRate) / 100;
        const frequency = method.periodicFrequency || 'monthly';

        if (frequency === 'monthly') {
            periods = daysPassed / 30.4375;
        } else {
            periods = daysPassed / 365.25;
        }

        const newValue = principal * Math.pow((1 + rate), periods);

        return Math.round(newValue * 100) / 100;
    }

    return principal;
};

/**
 * Calculates the current value of an asset including all transactions
 */
export const calculateCurrentValue = (item: CustomItem): number => {
    // Manual valuation: use latest manual update from history
    if (item.valuationMethod.type === 'manual' && item.history?.length) {
        const latestManualUpdate = [...item.history]
            .filter(h => h.type === 'manual')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (latestManualUpdate) {
            return latestManualUpdate.value;
        }
    }

    // Automatic valuation: value is kept in sync by the service layer
    if (item.valuationMethod.type === 'automatic') {
        return item.value || 0;
    }

    const transactions = item.transactions || [];
    let transactionQtyDelta = 0;

    transactions.forEach(t => {
        if (t.type === 'buy') transactionQtyDelta += t.quantity;
        if (t.type === 'sell') transactionQtyDelta -= t.quantity;
    });

    const currentTotalQty = item.quantity || 1;
    // The baseLotQty is the quantity that existed BEFORE any transactions were recorded in the transactions array.
    // This is often 0 if the 'create' event is NOT in the transactions array but in initialValue.
    const baseLotQty = Math.max(0, currentTotalQty - transactionQtyDelta);

    let totalValue = 0;

    if (baseLotQty > 0) {
        const baseLotCurrentValue = calculateLotValue(
            item.initialValue,
            item.initialDate,
            item.valuationMethod
        );
        totalValue += baseLotCurrentValue;
    }

    if (transactions.length > 0) {
        transactions.forEach(t => {
            if (t.type === 'buy') {
                const method = t.valuationMethod || item.valuationMethod;
                const lotValue = calculateLotValue(
                    t.totalValue,
                    t.date,
                    method
                );
                totalValue += lotValue;
            } else if (t.type === 'sell') {
                totalValue -= t.totalValue;
            }
        });
    }

    return Math.round(Math.max(0, totalValue) * 100) / 100;
};

/**
 * Calculates the total amount invested in an asset (initial + buys - sells)
 */
export const calculateTotalInvested = (item: CustomItem): number => {
    const transactions = item.transactions || [];
    let transactionNetQty = 0;
    let flowTotal = 0;

    transactions.forEach((t) => {
        if (t.type === 'buy') {
            transactionNetQty += Number(t.quantity || 0);
            flowTotal += Number(t.totalValue || 0);
            return;
        }

        if (t.type === 'sell') {
            transactionNetQty -= Number(t.quantity || 0);
            flowTotal -= Number(t.totalValue || 0);
        }
    });

    // If transactions already represent full quantity, initialValue is legacy/base metadata
    // and must not be summed again, otherwise cost basis is duplicated.
    const currentQty = Number(item.quantity || 0);
    const baseLotQty = Math.max(0, currentQty - transactionNetQty);
    const baseInvested = baseLotQty > 0 ? Number(item.initialValue || 0) : 0;

    return Math.max(0, baseInvested + flowTotal);
};

/**
 * Calculates the profit/loss for an asset
 */
export const calculateProfit = (currentValue: number, invested: number): number => {
    return currentValue - invested;
};

/**
 * Calculates the profit percentage for an asset
 */
export const calculateProfitPercentage = (currentValue: number, invested: number): number => {
    if (invested <= 0) return 0;
    return ((currentValue - invested) / invested) * 100;
};

/**
 * Calculates average price per unit
 */
export const calculateAveragePrice = (invested: number, quantity: number): number => {
    if (quantity <= 0) return 0;
    return invested / quantity;
};

/**
 * Calculates the total value of MANUAL items at a specific date
 * Note: Para ativos de mercado (market_asset_id), usar get_portfolio_market_history RPC
 */
export const getValueAtDate = (items: CustomItem[], date: Date): number => {
    return items.reduce((total, item) => {
        const itemDateStr = item.initialDate.includes('T') ? item.initialDate.split('T')[0] : item.initialDate;
        const startDate = new Date(itemDateStr + 'T00:00:00');
        const targetTs = date.getTime();
        let itemTotalAtDate = 0;

        const transactions = item.transactions || [];
        let txNetIncluded = 0;
        let txNetFuture = 0;

        transactions.forEach((t) => {
            const txDate = new Date(t.date + 'T00:00:00');
            const delta =
                t.type === 'buy' ? Number(t.quantity || 0) :
                t.type === 'sell' ? -Number(t.quantity || 0) :
                0;

            if (txDate.getTime() <= targetTs) {
                txNetIncluded += delta;
            } else {
                txNetFuture += delta;
            }
        });

        const currentQty = Number(item.quantity || 0);
        const qtyAtDate = Math.max(0, currentQty - txNetFuture);
        const baseLotQtyAtDate = Math.max(0, qtyAtDate - txNetIncluded);

        if (startDate.getTime() <= date.getTime()) {
            if (baseLotQtyAtDate > 0 && item.valuationMethod.type === 'periodic' && item.valuationMethod.periodicRate) {
                const diffTime = Math.abs(date.getTime() - startDate.getTime());
                const daysPassed = diffTime / (1000 * 60 * 60 * 24);
                const rate = Number(item.valuationMethod.periodicRate) / 100;
                const frequency = item.valuationMethod.periodicFrequency || 'monthly';
                let periods = frequency === 'monthly' ? daysPassed / 30.4375 : daysPassed / 365.25;

                if (daysPassed < 0) periods = 0;

                itemTotalAtDate += item.initialValue * Math.pow((1 + rate), periods);
            } else if (baseLotQtyAtDate > 0) {
                const history = item.history || [];
                const relevantEntries = history.filter(h => new Date(h.date) <= date);
                relevantEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const lastManualOrInitial = relevantEntries.find(h => h.type === 'manual' || h.type === 'initial');

                if (lastManualOrInitial) {
                    itemTotalAtDate = lastManualOrInitial.value;
                } else {
                    itemTotalAtDate = item.initialValue;
                }
            }
        }

        // Process transactions for periodic valuation
        if (item.valuationMethod.type !== 'manual') {
            transactions.forEach(t => {
                const tDate = new Date(t.date + 'T00:00:00');
                if (tDate.getTime() <= date.getTime()) {
                    if (t.type === 'buy') {
                        const method = t.valuationMethod || item.valuationMethod;
                        if (method.type === 'periodic' && method.periodicRate) {
                            const diffTime = Math.abs(date.getTime() - tDate.getTime());
                            const daysPassed = diffTime / (1000 * 60 * 60 * 24);
                            const rate = Number(method.periodicRate) / 100;
                            const frequency = method.periodicFrequency || 'monthly';
                            let periods = frequency === 'monthly' ? daysPassed / 30.4375 : daysPassed / 365.25;

                            itemTotalAtDate += t.totalValue * Math.pow((1 + rate), periods);
                        } else {
                            itemTotalAtDate += t.totalValue;
                        }
                    } else if (t.type === 'sell') {
                        itemTotalAtDate -= t.totalValue;
                    }
                }
            });
        }

        return total + Math.max(0, itemTotalAtDate);
    }, 0);
};
