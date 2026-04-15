/**
 * Real Estate Calculation Functions
 * Pure functions for real estate specific metrics
 * No localStorage, no React, no side effects
 */

import { CustomItem } from '../../types';
import { calculateCurrentValue, calculateTotalInvested } from './asset';

export interface RealEstateMetrics {
    totalMarketValue: number;
    totalAcquisitionCost: number;
    monthlyGrossRent: number;
    monthlyCosts: number;
    monthlyNetIncome: number;
    netYield: number;
    grossYield: number;
    occupancyStats: {
        rented: number;
        vacant: number;
        own_use: number;
        other: number;
        total: number;
    };
    vacancyRate: number;
    totalUnits: number;
}

/**
 * Calculates net income from rent after costs
 */
export const calculateNetIncome = (
    rent: number,
    condoFee: number,
    propertyTax: number,
    insurance: number,
    maintenance: number
): number => {
    const totalCosts = condoFee + propertyTax + insurance + maintenance;
    return rent - totalCosts;
};

/**
 * Calculates annual yield percentage
 */
export const calculateAnnualYield = (monthlyNetIncome: number, marketValue: number): number => {
    if (marketValue <= 0) return 0;
    return ((monthlyNetIncome * 12) / marketValue) * 100;
};

/**
 * Calculates gross yield percentage
 */
export const calculateGrossYield = (monthlyGrossRent: number, marketValue: number): number => {
    if (marketValue <= 0) return 0;
    return ((monthlyGrossRent * 12) / marketValue) * 100;
};

/**
 * Multi-unit subtypes that use explicit units for vacancy
 */
const MULTI_UNIT_SUBTYPES = ['Prédio', 'Conjunto', 'Prédio Comercial'];

/**
 * Gets units for vacancy calculation based on property subtype
 * - Multi-unit properties: use unitsTotal/unitsRented (or legacy totalUnits/rentedUnits)
 * - Single-unit properties: 1 unit, rented based on occupancy status
 * - Land: excluded from vacancy (returns 0 total to be filtered)
 */
export const getUnitsForVacancy = (item: CustomItem): { total: number; rented: number } => {
    const propertyType = item.customFields?.propertyType as string || '';
    const subtype = item.customFields?.propertySubtype as string || '';
    const status = item.customFields?.occupancyStatus as string || 'Vago';

    // Land is excluded from vacancy calculations
    if (propertyType === 'Terreno') {
        return { total: 0, rented: 0 };
    }

    // Determine if this is a multi-unit property
    const isMultiUnit = MULTI_UNIT_SUBTYPES.includes(subtype) ||
        // Legacy support: Commercial with totalUnits > 1 is multi-unit
        (propertyType === 'Comercial' && Number(item.customFields?.totalUnits) > 1);

    if (isMultiUnit) {
        // Use new field names with fallback to legacy names
        const total = Number(item.customFields?.unitsTotal) ||
            Number(item.customFields?.totalUnits) || 1;
        const rented = Math.min(
            Number(item.customFields?.unitsRented) ||
            Number(item.customFields?.rentedUnits) || 0,
            total
        );
        return { total, rented };
    }

    // Single-unit property: 1 unit, rented or not based on status
    const isRented = ['Alugado', 'Parcialmente alugado'].includes(status);
    return { total: 1, rented: isRented ? 1 : 0 };
};

/**
 * Calculates vacancy rate
 */
export const calculateVacancyRate = (totalUnits: number, rentedUnits: number): number => {
    if (totalUnits <= 0) return 0;
    return (1 - (rentedUnits / totalUnits)) * 100;
};

/**
 * Comprehensive real estate metrics calculation for a collection of items
 */
export const calculateRealEstateMetrics = (items: CustomItem[]): RealEstateMetrics => {
    let totalMarketValue = 0;
    let totalAcquisitionCost = 0;
    let monthlyGrossRent = 0;
    let monthlyCosts = 0;

    const occupancyStats = {
        rented: 0,
        vacant: 0,
        own_use: 0,
        other: 0,
        total: 0
    };

    let totalUnitsPortfolio = 0;
    let rentedUnitsPortfolio = 0;

    items.forEach(item => {
        // Market Value (Current Valuation)
        const marketValue = calculateCurrentValue(item);
        totalMarketValue += marketValue;

        // Acquisition Cost (Initial + Improvements)
        const acquisition = calculateTotalInvested(item);
        totalAcquisitionCost += acquisition;

        // Operational Data from Custom Fields
        const status = item.customFields?.occupancyStatus || 'other';

        // Strict Rent Logic: Only count rent if status implies active income
        let rent = 0;
        if (status === 'Alugado' || status === 'Parcialmente alugado') {
            rent = Number(item.customFields?.monthlyRent) || 0;
        }

        // Costs Logic
        const condoFee = Number(item.customFields?.condoFee) || 0;
        const maintenance = Number(item.customFields?.maintenance) || 0;
        const annualTax = Number(item.customFields?.propertyTax) || 0;
        const annualInsurance = Number(item.customFields?.insurance) || 0;

        // Convert annual costs to monthly equivalent
        // UPDATED BUSINESS RULE: User inputs are treated as monthly values directly
        const monthlyEquivalentCosts = condoFee + maintenance + annualTax + annualInsurance;

        // Status Counting
        occupancyStats.total++;
        if (status === 'Alugado' || status === 'Parcialmente alugado') {
            occupancyStats.rented++;
            monthlyGrossRent += rent;
        } else if (status === 'Vago' || status === 'Em negociação') {
            occupancyStats.vacant++;
        } else if (status === 'Uso Próprio') {
            occupancyStats.own_use++;
        } else {
            occupancyStats.other++;
        }

        // Costs apply regardless of status
        monthlyCosts += monthlyEquivalentCosts;

        // Vacancy Calculation - use subtype-aware helper
        const units = getUnitsForVacancy(item);
        totalUnitsPortfolio += units.total;
        rentedUnitsPortfolio += units.rented;
    });

    const monthlyNetIncome = monthlyGrossRent - monthlyCosts;
    const annualNetIncome = monthlyNetIncome * 12;

    // Yield Calculations
    const netYield = totalMarketValue > 0 ? (annualNetIncome / totalMarketValue) * 100 : 0;
    const grossYield = totalMarketValue > 0 ? ((monthlyGrossRent * 12) / totalMarketValue) * 100 : 0;

    // Vacancy Rate
    const vacancyRate = totalUnitsPortfolio > 0
        ? (1 - (rentedUnitsPortfolio / totalUnitsPortfolio)) * 100
        : 0;

    return {
        totalMarketValue,
        totalAcquisitionCost,
        monthlyGrossRent,
        monthlyCosts,
        monthlyNetIncome,
        netYield,
        grossYield,
        occupancyStats,
        vacancyRate,
        totalUnits: totalUnitsPortfolio
    };
};

