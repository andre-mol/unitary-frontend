/**
 * PortfolioDetailsPage - Refactored
 * Main orchestration component using extracted hooks and subcomponents
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { portfolioService } from '../../lib/portfolioService';
import { getSafeCurrency } from '../../utils/formatters';
import { rebaseSeries, EvolutionPoint } from '../../utils/chartHelpers';

// Hook
import { usePortfolioDetails } from './details/hooks/usePortfolioDetails';
import { usePortfolioHistorySync } from './details/hooks/usePortfolioHistorySync';

// Subcomponents
import { PortfolioHeader } from './details/components/PortfolioHeader';
import { PortfolioTabs } from './details/components/PortfolioTabs';
import { RealEstateKPIs, BusinessKPIs, InvestmentKPIs } from './details/components/OverviewKPIs';
import { OverviewCharts } from './details/components/OverviewCharts';
import { AssetModulesSection } from './details/components/AssetModulesSection';
import { DeleteConfirmModal } from './details/components/DeleteConfirmModal';

// Existing Modals & Components
import { EditItemModal } from './details/modals/EditItemModal';
import { AddItemModal } from './details/modals/AddItemModal';
import { AddTransactionModal } from './details/modals/AddTransactionModal';
import { StrategyModal } from './details/modals/StrategyModal';
import { PortfolioSettingsModal } from './details/modals/PortfolioSettingsModal';
import { SmartActionModal } from './details/modals/SmartActionModal';
import { PortfolioDividends } from './details/PortfolioDividends';
import { PortfolioHistory } from './details/PortfolioHistory';
import { PortfolioProfitability } from './details/PortfolioProfitability';

export const PortfolioDetailsPage: React.FC = () => {
    const {
        // Core Data
        portfolio,
        items,
        historyEvents,
        historyEventsForDisplay,
        categories,
        dividends, // NEW
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

        // Handlers
        handleSaveEditItem,
        handleSaveStrategy,
        handleSaveSettings,
        handleManualUpdate,
        handleCreateItem,
        handleSaveTransaction,
        confirmDelete,
        refreshItems,
    } = usePortfolioDetails();

    // --- SMART ACTION LOGIC STATE ---
    const [isSmartModalOpen, setIsSmartModalOpen] = React.useState(false);
    const [transactionPreSelectId, setTransactionPreSelectId] = React.useState<string | undefined>(undefined);

    // Sync History on Load
    usePortfolioHistorySync();

    // Loading State - Show skeleton while loading
    if (loading || !portfolio) {
        return (
            <DashboardLayout title="Carregando..." subtitle="">
                <div className="space-y-6">
                    <Skeleton className="h-24 rounded-2xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Skeleton className="h-32 rounded-xl" />
                        <Skeleton className="h-32 rounded-xl" />
                        <Skeleton className="h-32 rounded-xl" />
                        <Skeleton className="h-32 rounded-xl" />
                    </div>
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-48 rounded-2xl" />
                </div>
            </DashboardLayout>
        );
    }

    // Invalid Type Fallback
    if (portfolio.type !== 'custom' && portfolio.type !== 'investments' && portfolio.type !== 'real_estate' && portfolio.type !== 'business') {
        return (
            <DashboardLayout title={portfolio.name} subtitle="Visão Geral">
                <div className="p-6 text-zinc-500">
                    Tipo de portfólio desconhecido.
                </div>
            </DashboardLayout>
        );
    }

    const currency = getSafeCurrency(portfolio.currency);
    const isRealEstate = portfolio.type === 'real_estate';
    const isBusiness = portfolio.type === 'business';
    const isInvestments = portfolio.type === 'investments';
    const isMarketPortfolio = !isRealEstate && !isBusiness;
    const effectiveDividendsReceived = isInvestments ? Number(periodMetrics.dividendsReceived || 0) : 0;
    const effectiveProfitabilityValue = (Number(totalValue || 0) + effectiveDividendsReceived) - Number(totalInvested || 0);
    const effectiveProfitabilityPct = totalInvested > 0
        ? (effectiveProfitabilityValue / totalInvested) * 100
        : 0;
    let displayedInvestmentReturnPct = effectiveProfitabilityPct;
    let latestSeriesReturn = NaN;

    if (performanceData.length > 0) {
        const sortedSeries = [...performanceData]
            .filter((point) => point?.fullDate)
            .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()) as EvolutionPoint[];

        if (sortedSeries.length > 0) {
            const effectiveSeries = timeRange === 'ALL'
                ? sortedSeries
                : rebaseSeries(sortedSeries, new Date(sortedSeries[0].fullDate));

            latestSeriesReturn = Number(effectiveSeries[effectiveSeries.length - 1]?.value);
        }
    }

    if (Number.isFinite(latestSeriesReturn)) {
        displayedInvestmentReturnPct = latestSeriesReturn * 100;
    } else if (portfolioTotalReturnPct !== null && portfolioTotalReturnPct !== undefined && Number.isFinite(Number(portfolioTotalReturnPct))) {
        displayedInvestmentReturnPct = Number(portfolioTotalReturnPct);
    }

    const displayedInvestmentReturnValue = totalInvested > 0 && Number.isFinite(displayedInvestmentReturnPct)
        ? totalInvested * (displayedInvestmentReturnPct / 100)
        : effectiveProfitabilityValue;

    const openAddModal = (newItemData?: Partial<typeof newItem>) => {
        setIsAddModalOpen(true);
        setNewItem(newItemData || {
            currency,
            valuationMethod: { type: 'manual' },
            metadata: {},
            customFields: {},
            initialDate: new Date().toISOString().split('T')[0],
            quantity: 1,
            tags: []
        });
    };

    // --- SMART ACTION LOGIC HANDLERS ---

    const handleOpenSmartAction = () => {
        // Reset pre-selection
        setTransactionPreSelectId(undefined);
        setIsSmartModalOpen(true);
    };

    const handleSelectExisting = (item: any) => {
        setIsSmartModalOpen(false);
        setTransactionPreSelectId(item.id);
        setIsTransactionModalOpen(true);
    };

    const handleSelectNew = (tickerOrName: string) => {
        setIsSmartModalOpen(false);
        openAddModal({
            name: tickerOrName,
            // Attempt to categorize based on portfolio type to save user a click
            category: isRealEstate ? 'Imóvel' : isBusiness ? 'Empresa' : undefined
        });
    };

    const handleSelectManual = () => {
        setIsSmartModalOpen(false);
        openAddModal();
    };

    return (
        <DashboardLayout title={portfolio.name} subtitle="Visão Geral">
            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium mb-2">{error}</p>
                            <Button
                                onClick={() => refreshItems()}
                                size="sm"
                                variant="secondary"
                                className="mt-2"
                            >
                                Tentar novamente
                            </Button>
                        </div>
                        <button
                            onClick={() => {
                                // AIDEV-NOTE: Limpar erro manualmente não é necessário pois refreshItems já limpa
                                refreshItems();
                            }}
                            className="text-red-400/60 hover:text-red-400 transition-colors"
                            aria-label="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <PortfolioHeader
                portfolio={portfolio}
                onOpenStrategy={() => setIsStrategyModalOpen(true)}
                onOpenTransaction={() => {
                    setTransactionPreSelectId(undefined);
                    setIsTransactionModalOpen(true);
                }}
                onOpenAddItem={() => openAddModal()}
                onOpenSmartAction={handleOpenSmartAction}
            />

            {/* Tabs */}
            <PortfolioTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                showDividends={isInvestments}
            />

            {/* Tab Content */}
            {activeTab === 'dividends' ? (
                <PortfolioDividends
                    portfolio={portfolio}
                    items={items}
                    events={historyEvents}
                    dividends={dividends}
                />
            ) : activeTab === 'profitability' ? (
                <PortfolioProfitability
                    portfolio={portfolio}
                    items={items}
                    evolutionData={performanceData}
                    navData={evolutionData}
                    businessMetrics={isBusiness ? businessMetrics : undefined}
                    rentIncomeEvents={realEstateNetIncomeEvents}
                    acquisitionCost={totalInvested}
                    performanceLoading={performanceLoading}
                    targetTotalReturnPct={portfolioTotalReturnPct}
                    benchmarks={benchmarks}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                />
            ) : activeTab === 'history' ? (
                <PortfolioHistory
                    portfolio={portfolio}
                    events={historyEventsForDisplay}
                    businessMetrics={isBusiness ? businessMetrics : undefined}
                    onAddEvent={isBusiness ? () => {
                        setTransactionPreSelectId(undefined);
                        setIsTransactionModalOpen(true);
                    } : undefined}
                />
            ) : (
                /* Overview Tab */
                <>
                    {/* KPIs */}
                    {isRealEstate ? (
                        <RealEstateKPIs currency={currency} reMetrics={reMetrics} />
                    ) : isBusiness ? (
                        <BusinessKPIs currency={currency} businessMetrics={businessMetrics} />
                    ) : (
                        <InvestmentKPIs
                            currency={currency}
                            totalValue={totalValue}
                            totalInvested={totalInvested}
                            dividendsReceived={effectiveDividendsReceived}
                            profitabilityValue={effectiveProfitabilityValue}
                            profitabilityPct={effectiveProfitabilityPct}
                            variation={variation}
                            targetTotalReturnPct={portfolioTotalReturnPct}
                            displayedReturnPct={displayedInvestmentReturnPct}
                            displayedReturnValue={displayedInvestmentReturnValue}
                        />
                    )}

                    {/* Charts */}
                    <OverviewCharts
                        portfolio={portfolio}
                        currency={currency}
                        evolutionData={evolutionData}
                        businessEquitySeries={businessEquitySeries}
                        performanceData={performanceData}
                        targetTotalReturnPct={portfolioTotalReturnPct}
                        dividendsReceived={effectiveDividendsReceived}
                        rentIncomeEvents={realEstateNetIncomeEvents}
                        groupedItems={groupedItems}
                        cashFlowData={cashFlowData}
                        businessCashFlowData={businessCashFlowData}
                        items={items}
                        totalUnits={totalUnits}
                        timeRange={timeRange}
                        onTimeRangeChange={setTimeRange}
                        onOpenSettings={() => setIsSettingsModalOpen(true)}
                        isRealEstate={isRealEstate}
                        isBusiness={isBusiness}
                        benchmarks={benchmarks}
                    />

                    {/* Asset Modules */}
                    <AssetModulesSection
                        portfolio={portfolio}
                        groupedItems={groupedItems}
                        items={items}
                        totalValue={totalValue}
                        currency={currency}
                        idealAllocationMap={idealAllocationMap}
                        isRealEstate={isRealEstate}
                        indexedMirrorReturnPct={null}
                        displayedPortfolioReturnPct={isMarketPortfolio ? displayedInvestmentReturnPct : null}
                        onEditItem={(item) => { setSelectedItem(item); setIsEditModalOpen(true); }}
                        onOpenAddModal={openAddModal}
                        dividends={dividends}
                    />
                </>
            )}

            {/* Modals */}
            {isEditModalOpen && selectedItem && (
                <EditItemModal
                    item={selectedItem}
                    type={portfolio.type}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveEditItem}
                    onDeleteRequest={() => setIsDeleteConfirmOpen(true)}
                    setItem={setSelectedItem}
                    onManualUpdate={handleManualUpdate}
                />
            )}

            {isTransactionModalOpen && (
                <AddTransactionModal
                    items={items}
                    currency={currency}
                    type={portfolio.type}
                    onClose={() => setIsTransactionModalOpen(false)}
                    onSave={handleSaveTransaction}
                    initialAssetId={transactionPreSelectId}
                />
            )}

            {isSmartModalOpen && (
                <SmartActionModal
                    items={items}
                    onClose={() => setIsSmartModalOpen(false)}
                    onSelectExisting={handleSelectExisting}
                    onSelectNew={handleSelectNew}
                    onSelectManual={handleSelectManual}
                    portfolioType={portfolio.type}
                />
            )}

            <DeleteConfirmModal
                isOpen={isDeleteConfirmOpen}
                item={selectedItem}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDelete}
            />

            {isAddModalOpen && (
                <AddItemModal
                    newItem={newItem}
                    type={portfolio.type}
                    setNewItem={setNewItem}
                    onClose={() => setIsAddModalOpen(false)}
                    onSave={handleCreateItem}
                    currency={currency}
                    categories={categories}
                    validationErrors={validationErrors}
                    onAddCategory={(newCat) => {
                        const updated = portfolioService.addCategory(newCat);
                        setNewItem({ ...newItem, category: newCat });
                    }}
                />
            )}

            {isStrategyModalOpen && portfolio && (
                <StrategyModal
                    portfolio={portfolio}
                    categories={usedCategories}
                    onClose={() => setIsStrategyModalOpen(false)}
                    onSave={handleSaveStrategy}
                />
            )}

            {isSettingsModalOpen && portfolio && (
                <PortfolioSettingsModal
                    portfolio={portfolio}
                    onClose={() => setIsSettingsModalOpen(false)}
                    onSave={handleSaveSettings}
                />
            )}
        </DashboardLayout>
    );
};
