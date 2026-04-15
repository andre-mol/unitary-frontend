/**
 * Financial Calculation Functions
 * Pure functions for general financial calculations
 * No localStorage, no React, no side effects
 */

/**
 * Converts annual rate to monthly rate using geometric mean
 * Formula: (1 + annualRate)^(1/12) - 1
 */
export const annualToMonthlyRate = (annualRate: number): number => {
    return Math.pow(1 + (annualRate / 100), 1 / 12) - 1;
};

/**
 * Converts monthly rate to annual rate
 * Formula: (1 + monthlyRate)^12 - 1
 */
export const monthlyToAnnualRate = (monthlyRate: number): number => {
    return (Math.pow(1 + monthlyRate, 12) - 1) * 100;
};

/**
 * Calculates compound interest
 * Formula: P * (1 + r)^n
 */
export const calculateCompoundInterest = (
    principal: number,
    rate: number,
    periods: number
): number => {
    return principal * Math.pow(1 + rate, periods);
};

/**
 * Calculates future value with regular contributions
 * Formula: PV * (1 + r)^n + PMT * [((1 + r)^n - 1) / r]
 */
export const calculateFutureValueWithContributions = (
    presentValue: number,
    monthlyContribution: number,
    monthlyRate: number,
    totalMonths: number
): number => {
    if (monthlyRate === 0) {
        return presentValue + (monthlyContribution * totalMonths);
    }
    
    const compoundedPrincipal = presentValue * Math.pow(1 + monthlyRate, totalMonths);
    const contributionFactor = (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
    const compoundedContributions = monthlyContribution * contributionFactor;
    
    return compoundedPrincipal + compoundedContributions;
};

/**
 * Brazilian regressive IR tax rate based on investment period
 */
export const getRegressiveTaxRate = (periodDays: number): number => {
    if (periodDays <= 180) return 0.225;  // 22.5%
    if (periodDays <= 360) return 0.20;   // 20%
    if (periodDays <= 720) return 0.175;  // 17.5%
    return 0.15;  // 15%
};

/**
 * IOF rate based on investment period (simplified)
 */
export const getIOFRate = (periodDays: number): number => {
    if (periodDays < 30) return 0.96; // Worst case approximation
    return 0;
};

/**
 * Applies Brazilian taxation to investment returns
 */
export const applyTaxation = (
    grossValue: number,
    totalInvested: number,
    regime: 'isento' | 'regressivo' | 'acao' | 'fii' | 'bruto',
    periodDays: number
): number => {
    const profit = grossValue - totalInvested;
    if (profit <= 0) return grossValue;

    let tax = 0;

    switch (regime) {
        case 'isento':
        case 'bruto':
            tax = 0;
            break;
        case 'acao':
            tax = profit * 0.15;
            break;
        case 'fii':
            tax = profit * 0.20;
            break;
        case 'regressivo':
            const rate = getRegressiveTaxRate(periodDays);
            tax = profit * rate;
            break;
        default:
            tax = 0;
    }

    return grossValue - tax;
};

/**
 * Calculates Brazilian Poupança (savings) monthly rate
 * Rule: If Selic > 8.5% -> 0.5% per month. Else 70% of Selic
 */
export const calculatePoupancaMonthlyRate = (selicAnnualRate: number): number => {
    if (selicAnnualRate > 8.5) {
        return 0.005; // 0.5% per month
    }
    return annualToMonthlyRate(selicAnnualRate * 0.70);
};

/**
 * Calculates periods passed between two dates
 */
export const calculatePeriodsBetweenDates = (
    startDate: Date,
    endDate: Date,
    frequency: 'monthly' | 'yearly'
): number => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const daysPassed = diffTime / (1000 * 60 * 60 * 24);

    if (frequency === 'monthly') {
        return daysPassed / 30.4375;
    }
    return daysPassed / 365.25;
};

