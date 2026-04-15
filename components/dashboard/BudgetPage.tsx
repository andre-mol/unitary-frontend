import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { Target, AlertTriangle } from 'lucide-react';
import {
    useBudget,
    MonthSelector,
    InvestmentHeroCard,
    ExpenseCard,
    ExpenseSummarySection,
    ExpenseDrawer,
} from './budget';

export const BudgetPage: React.FC = () => {
    const navigate = useNavigate();
    
    const {
        loading,
        goals,
        expenses,
        salary,
        monthKey,
        displayMonth,
        selectedCategoryGoal,
        isExpenseModalOpen,
        totalPercentage,
        numSalary,
        investmentGoal,
        expenseGoals,
        handleSalaryChange,
        handleMonthChange,
        handleInvest,
        handleOpenCategory,
        handleCloseExpenseModal,
        getCategoryStats,
    } = useBudget();

    if (loading) return <div />;

    // Block if no goals configured
    if (goals.length === 0) {
        return (
            <DashboardLayout title="Orçamento Doméstico">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                    <Target size={48} className="text-zinc-600 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Metas não definidas</h3>
                    <p className="text-zinc-400 mb-6">Você precisa configurar suas metas de distribuição antes de usar o orçamento.</p>
                    <Button onClick={() => navigate('/dashboard/metas')}>Configurar Metas</Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout 
            title="Orçamento Doméstico" 
            subtitle="Planejamento e controle de execução mensal."
        >
            <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                
                {/* 1. Header & Month Selector */}
                <MonthSelector
                    displayMonth={displayMonth}
                    salary={salary}
                    onMonthChange={handleMonthChange}
                    onSalaryChange={handleSalaryChange}
                />

                {/* 2. Investment Hero Block */}
                {investmentGoal && (
                    <InvestmentHeroCard
                        investmentGoal={investmentGoal}
                        stats={getCategoryStats(investmentGoal.category, investmentGoal.percentage)}
                        onOpenCategory={handleOpenCategory}
                        onInvest={handleInvest}
                    />
                )}

                {/* 3. Expenses Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:flex xl:flex-row xl:gap-4">
                    {expenseGoals.map((goal) => (
                        <ExpenseCard
                            key={goal.id}
                            goal={goal}
                            stats={getCategoryStats(goal.category, goal.percentage)}
                            onOpenCategory={handleOpenCategory}
                        />
                    ))}
                </div>

                {/* Warning if Total != 100% */}
                {totalPercentage !== 100 && (
                    <div className="flex items-center justify-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        <AlertTriangle size={16} />
                        <span>Atenção: A soma das suas metas é <strong>{totalPercentage}%</strong>. Ajuste para 100% na página de Metas.</span>
                    </div>
                )}

                {/* 4. Summary List Section */}
                <ExpenseSummarySection 
                    expenses={expenses} 
                    goals={goals} 
                    onOpenCategory={handleOpenCategory} 
                />
            </div>

            {/* Expense Modal */}
            {selectedCategoryGoal && (
                <ExpenseDrawer 
                    isOpen={isExpenseModalOpen}
                    onClose={handleCloseExpenseModal}
                    goal={selectedCategoryGoal}
                    monthKey={monthKey}
                    budgetSalary={numSalary}
                    allExpenses={expenses}
                />
            )}

        </DashboardLayout>
    );
};
