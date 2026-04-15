/**
 * Domain Calculations - Central Export
 * Pure calculation functions without side effects
 */

// Asset calculations
export {
    calculateLotValue,
    calculateCurrentValue,
    calculateTotalInvested,
    calculateProfit,
    calculateProfitPercentage,
    calculateAveragePrice,
    getValueAtDate
} from './asset';

// Portfolio calculations
export {
    calculateVariationPercentage,
    calculatePreviousValue,
    calculateGlobalMetrics,
    calculateScore,
    calculateIdealAllocation,
    calculateProgressPercentage,
    calculatePortfolioScore,
    groupItemsByCategory,
    calculateBusinessMetrics
} from './portfolio';

// Real estate calculations
export {
    calculateNetIncome,
    calculateAnnualYield,
    calculateGrossYield,
    calculateVacancyRate,
    calculateRealEstateMetrics,
    getUnitsForVacancy
} from './real-estate';
export type { RealEstateMetrics } from './real-estate';

// Financial calculations
export {
    annualToMonthlyRate,
    monthlyToAnnualRate,
    calculateCompoundInterest,
    calculateFutureValueWithContributions,
    getRegressiveTaxRate,
    getIOFRate,
    applyTaxation,
    calculatePoupancaMonthlyRate,
    calculatePeriodsBetweenDates
} from './finance';

// Budget calculations
export {
    calculateCategoryStats,
    calculateTotalExpenses,
    calculatePeriodResult,
    calculatePercentageOfTotal,
    groupExpensesByCategory,
    isCategoryOverBudget,
    calculateTotalPercentage
} from './budget';
export type { CategoryStats } from './budget';

