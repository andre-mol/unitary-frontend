/**
 * OverviewKPIs - KPI cards section based on portfolio type
 */

import React from 'react';
import {
    Coins, FileSignature, TrendingUp, Building,
    Banknote, LayoutGrid, Percent, Briefcase
} from 'lucide-react';
import { DetailsKPICard } from './DetailsKPICard';

interface RealEstateKPIsProps {
    currency: string;
    reMetrics: {
        totalMarketValue: number;
        monthlyNetIncome: number;
        monthlyGrossRent: number;
        vacancyRate: number;
        netYield: number;
        monthlyCosts: number;
        totalUnits: number;
    };
}

export const RealEstateKPIs: React.FC<RealEstateKPIsProps> = ({ currency, reMetrics }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DetailsKPICard
            title="Valor de Mercado Total"
            value={reMetrics.totalMarketValue.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<Building size={18} />}
        />
        <DetailsKPICard
            title="Renda Mensal Líquida"
            value={reMetrics.monthlyNetIncome.toLocaleString('pt-BR', { style: 'currency', currency })}
            valueColor={reMetrics.monthlyNetIncome < 0 ? 'text-red-500' : undefined}
            icon={<Banknote size={18} />}
            trend={reMetrics.monthlyGrossRent > 0 ? (reMetrics.monthlyNetIncome / reMetrics.monthlyGrossRent * 100) : 0}
        />
        {reMetrics.totalUnits > 0 ? (
            <DetailsKPICard
                title="Vacância Média"
                value={`${reMetrics.vacancyRate.toFixed(1)}%`}
                valueColor={reMetrics.vacancyRate < 10 ? 'text-green-500' : reMetrics.vacancyRate < 30 ? 'text-amber-500' : 'text-red-500'}
                icon={<LayoutGrid size={18} />}
            />
        ) : (
            <div className="relative group">
                <DetailsKPICard
                    title="Yield Líquido (a.a.)"
                    value={`${reMetrics.netYield.toFixed(2)}%`}
                    valueColor={reMetrics.netYield < 0 ? 'text-red-500' : undefined}
                    icon={<Percent size={18} />}
                />
            </div>
        )}
        <DetailsKPICard
            title="Custos Mensais (Equiv.)"
            value={reMetrics.monthlyCosts.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<FileSignature size={18} />}
        />
    </div>
);

interface BusinessKPIsProps {
    currency: string;
    businessMetrics: {
        totalEquityValueUser: number;
        totalDistributionsUser: number;
        totalInvestedCapital: number;
        totalReturnValue: number;
        totalReturnPct: number;
        netProfit12m: number;
    };
}

export const BusinessKPIs: React.FC<BusinessKPIsProps> = ({ currency, businessMetrics }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <DetailsKPICard
            title="Sua Participação (Equity)"
            value={businessMetrics.totalEquityValueUser.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<Briefcase size={18} />}
        />
        <DetailsKPICard
            title="Total Recebido (Distribuições)"
            value={businessMetrics.totalDistributionsUser.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<Banknote size={18} />}
        />
        <DetailsKPICard
            title="Capital Investido"
            value={businessMetrics.totalInvestedCapital.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<Coins size={18} />}
        />
        <DetailsKPICard
            title="Retorno Total"
            value={businessMetrics.totalReturnValue.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<TrendingUp size={18} />}
            trend={businessMetrics.totalReturnPct}
            valueColor={businessMetrics.totalReturnValue >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        <DetailsKPICard
            title="Lucro Líquido Informado (12m)"
            value={businessMetrics.netProfit12m.toLocaleString('pt-BR', { style: 'currency', currency })}
            icon={<TrendingUp size={18} />}
            valueColor={businessMetrics.netProfit12m >= 0 ? 'text-emerald-500' : 'text-red-500'}
        />
    </div>
);

interface InvestmentKPIsProps {
    currency: string;
    totalValue: number;
    totalInvested: number;
    dividendsReceived: number;
    profitabilityValue: number;
    profitabilityPct: number;
    variation: number;
    targetTotalReturnPct?: number | null;
    displayedReturnPct?: number | null;
    displayedReturnValue?: number | null;
}

export const InvestmentKPIs: React.FC<InvestmentKPIsProps> = ({
    currency, totalValue, totalInvested, dividendsReceived, profitabilityValue, profitabilityPct, variation, targetTotalReturnPct = null, displayedReturnPct = null, displayedReturnValue = null
}) => {
    const fallbackProfitabilityValue = (totalValue + dividendsReceived) - totalInvested;
    const effectiveProfitabilityPct = displayedReturnPct !== null && displayedReturnPct !== undefined
        ? Number(displayedReturnPct)
        : targetTotalReturnPct !== null && targetTotalReturnPct !== undefined
            ? Number(targetTotalReturnPct)
            : totalInvested > 0
                ? (fallbackProfitabilityValue / totalInvested) * 100
                : profitabilityPct;
    const effectiveProfitabilityValue = displayedReturnValue !== null && displayedReturnValue !== undefined
        ? Number(displayedReturnValue)
        : totalInvested > 0
            ? totalInvested * (effectiveProfitabilityPct / 100)
            : profitabilityValue;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <DetailsKPICard title="Valor Total" value={totalValue.toLocaleString('pt-BR', { style: 'currency', currency })} icon={<Coins size={18} />} trend={variation} />
            <DetailsKPICard title="Custo de Aquisição" value={totalInvested.toLocaleString('pt-BR', { style: 'currency', currency })} icon={<FileSignature size={18} />} />
            <DetailsKPICard title="Dividendos Recebidos" value={dividendsReceived.toLocaleString('pt-BR', { style: 'currency', currency })} icon={<Banknote size={18} />} />
            <DetailsKPICard title="Rentabilidade no Período" value={effectiveProfitabilityValue.toLocaleString('pt-BR', { style: 'currency', currency })} icon={<TrendingUp size={18} />} trend={effectiveProfitabilityPct} />
        </div>
    );
};
