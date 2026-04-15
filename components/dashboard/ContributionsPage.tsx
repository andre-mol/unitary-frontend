import React from 'react';
import { 
    useContributions,
    BudgetInputPhase,
    ManualSelectionPhase,
    PreviewPhase,
    ExecutionPhase,
} from './contributions';

export const ContributionsPage: React.FC = () => {
    const {
        // State
        portfolios,
        loading,
        flowStep,
        setFlowStep,
        globalBudget,
        setGlobalBudget,
        portfolioQueue,
        currentQueueIndex,
        selectedPortfolio,
        items,
        totalContribution,
        setTotalContribution,
        overrides,
        priceOverrides,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        confirmedAssets,
        expandedCategories,
        isCommitting,
        isSavingStrategy,
        
        // Computed
        numericContribution,
        categoryAnalysis,
        assetSuggestions,
        
        // Handlers
        handleBudgetSubmit,
        startExecution,
        startManualExecution,
        skipCurrentPortfolio,
        handleOverride,
        handlePriceOverride,
        handleQuantityOverride,
        toggleCategory,
        handleConfirm,
        toggleConfirmAsset,
        executeCommit,
        handleSaveStrategy,
    } = useContributions();

    // Loading state
    if (loading) {
        return null;
    }

    // PHASE 1: INPUT BUDGET
    if (flowStep === 'input') {
        return (
            <BudgetInputPhase
                globalBudget={globalBudget}
                setGlobalBudget={setGlobalBudget}
                onSubmit={handleBudgetSubmit}
                setFlowStep={setFlowStep}
            />
        );
    }

    // PHASE 1.5: MANUAL SELECTION
    if (flowStep === 'manual_selection') {
        return (
            <ManualSelectionPhase
                portfolios={portfolios}
                setFlowStep={setFlowStep}
                startManualExecution={startManualExecution}
            />
        );
    }

    // PHASE 2: PREVIEW / MACRO PLAN
    if (flowStep === 'preview') {
        return (
            <PreviewPhase
                globalBudget={globalBudget}
                portfolioQueue={portfolioQueue}
                setFlowStep={setFlowStep}
                startExecution={startExecution}
            />
        );
    }

    // PHASE 3: EXECUTION
    if (flowStep === 'execution' && selectedPortfolio) {
        return (
            <ExecutionPhase
                selectedPortfolio={selectedPortfolio}
                portfolioQueue={portfolioQueue}
                currentQueueIndex={currentQueueIndex}
                totalContribution={totalContribution}
                setTotalContribution={setTotalContribution}
                categoryAnalysis={categoryAnalysis}
                assetSuggestions={assetSuggestions}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                overrides={overrides}
                priceOverrides={priceOverrides}
                handleOverride={handleOverride}
                handlePriceOverride={handlePriceOverride}
                handleQuantityOverride={handleQuantityOverride}
                numericContribution={numericContribution}
                handleConfirm={handleConfirm}
                skipCurrentPortfolio={skipCurrentPortfolio}
                setFlowStep={setFlowStep}
                isConfirmModalOpen={isConfirmModalOpen}
                setIsConfirmModalOpen={setIsConfirmModalOpen}
                confirmedAssets={confirmedAssets}
                toggleConfirmAsset={toggleConfirmAsset}
                executeCommit={executeCommit}
                isCommitting={isCommitting}
                isSavingStrategy={isSavingStrategy}
                handleSaveStrategy={handleSaveStrategy}
                items={items}
            />
        );
    }

    return null;
};
