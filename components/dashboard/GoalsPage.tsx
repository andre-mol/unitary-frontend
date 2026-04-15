
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { planningService, Goal, Objective } from '../../lib/planningService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
    Target, Save, AlertTriangle, CheckCircle2, PieChart, 
    TrendingUp, Home, Coffee, BookOpen, Smile, Info, Flag,
    Plus, Edit2, PauseCircle, PlayCircle, CheckSquare, X, RotateCcw, Trash2
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../auth/AuthProvider';

// Icon mapping for specific categories
const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('invest')) return <TrendingUp size={18} />;
    if (lower.includes('fixo') || lower.includes('casa') || lower.includes('moradia')) return <Home size={18} />;
    if (lower.includes('meta')) return <Flag size={18} />; // New Icon for Metas
    if (lower.includes('conforto') || lower.includes('lazer')) return <Coffee size={18} />;
    if (lower.includes('conhecimento') || lower.includes('estudo') || lower.includes('educa')) return <BookOpen size={18} />;
    if (lower.includes('prazer') || lower.includes('sonho')) return <Smile size={18} />;
    return <PieChart size={18} />;
};

export const GoalsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'distribution' | 'objectives'>('distribution');

    return (
        <DashboardLayout 
            title="Minhas Metas" 
            subtitle="Defina a distribuição do salário e seus objetivos de vida."
        >
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('distribution')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'distribution' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Distribuição do Orçamento
                        </button>
                        <button
                            onClick={() => setActiveTab('objectives')}
                            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'objectives' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Meus Objetivos
                        </button>
                    </div>
                </div>

                {activeTab === 'distribution' ? <DistributionTab onSwitchToObjectives={() => setActiveTab('objectives')} /> : <ObjectivesTab />}
            </div>
        </DashboardLayout>
    );
};

type ObjectiveContributionEntry = {
    id: string;
    month: string;
    date: string;
    amount: number;
    name: string;
    observation?: string;
    source?: string;
    installmentLabel?: string;
};

// --- TAB 1: DISTRIBUTION ---

const DistributionTab: React.FC<{ onSwitchToObjectives: () => void }> = ({ onSwitchToObjectives }) => {
    const { user, loading: authLoading } = useAuth();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [activeObjectivesCount, setActiveObjectivesCount] = useState(0);

    useEffect(() => {
        // Não carregar se auth ainda está carregando ou usuário não existe
        if (authLoading || !user) {
            return;
        }
        
        const loadData = async () => {
            try {
                setInitialLoading(true);
                // Load goals 
                const loadedGoals = await planningService.getGoals();
                setGoals(loadedGoals);
                
                // Count active objectives for display in card
                const objectives = await planningService.getObjectives();
                const activeCount = objectives.filter(o => o.status === 'active').length;
                setActiveObjectivesCount(activeCount);
            } catch (err) {
                // Ignorar erros de autenticação silenciosamente
                const message = err instanceof Error ? err.message : '';
                const isAuthError = message.includes('NOT_AUTHENTICATED') || 
                                    message.includes('não autenticado');
                if (!isAuthError) {
                    console.error('DistributionTab loadData error:', err);
                }
            } finally {
                setInitialLoading(false);
            }
        };
        loadData();
    }, [user, authLoading]);

    const totalPercentage = useMemo(() => {
        return goals.reduce((acc, g) => acc + (Number(g.percentage) || 0), 0);
    }, [goals]);

    const isValid = Math.abs(totalPercentage - 100) < 0.1;
    const remaining = 100 - totalPercentage;

    const handleUpdate = (id: string, newVal: number) => {
        const sanitized = Math.max(0, Math.min(100, newVal));
        setGoals(prev => prev.map(g => g.id === id ? { ...g, percentage: sanitized } : g));
        setSavedSuccess(false);
    };

    const handleSave = async () => {
        if (!isValid) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 600));
        await planningService.saveGoals(goals);
        setLoading(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
    };

    const chartData = useMemo(() => {
        return goals.map(g => ({
            name: g.category,
            value: g.percentage,
            color: g.color
        })).filter(g => g.value > 0);
    }, [goals]);

    // Show loading state
    if (initialLoading || authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-zinc-400">Carregando metas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex gap-4 items-start">
                    <div className="bg-amber-500/10 p-3 rounded-lg text-amber-500 hidden sm:block">
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-1">Regra de Ouro</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            Antes de saber quanto você ganha, decida como seu dinheiro deve trabalhar. 
                            Estas metas serão usadas automaticamente no seu <strong>Orçamento Doméstico</strong>.
                        </p>
                    </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                        <h3 className="font-bold text-white">Distribuição Percentual</h3>
                        <span className="text-xs text-zinc-500">Categorias Padrão</span>
                    </div>
                    <div className="divide-y divide-zinc-900">
                        {goals.map((goal) => (
                            <div key={goal.id} className="p-6 hover:bg-zinc-900/30 transition-colors group">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-white transition-colors"
                                            style={{ color: goal.category === 'Investimentos' ? goal.color : goal.category === 'Metas' ? goal.color : undefined }}
                                        >
                                            {getCategoryIcon(goal.category)}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${goal.category === 'Investimentos' ? 'text-amber-500' : goal.category === 'Metas' ? 'text-cyan-500' : 'text-zinc-200'}`}>
                                                {goal.category}
                                            </h4>
                                            {goal.category === 'Metas' && (
                                                <div className="flex gap-2 items-center mt-0.5">
                                                    <span className="text-[10px] text-zinc-500">Objetivos ativos: {activeObjectivesCount}</span>
                                                    <button onClick={onSwitchToObjectives} className="text-[10px] text-cyan-500 hover:text-cyan-400 hover:underline">
                                                        Gerenciar objetivos →
                                                    </button>
                                                </div>
                                            )}
                                            {goal.category === 'Investimentos' && (
                                                <span className="text-[10px] text-zinc-500">Liberdade financeira (Longo prazo)</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={goal.percentage}
                                                onChange={(e) => handleUpdate(goal.id, parseFloat(e.target.value))}
                                                className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-right font-mono text-white focus:border-amber-500 outline-none transition-colors"
                                                min={0}
                                                max={100}
                                            />
                                            <span className="text-zinc-500 text-sm font-medium">%</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        step="1"
                                        value={goal.percentage}
                                        onChange={(e) => handleUpdate(goal.id, parseInt(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div 
                                        className="h-full rounded-full transition-all duration-100 ease-out"
                                        style={{ width: `${goal.percentage}%`, backgroundColor: goal.color }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 sticky top-24">
                    <h3 className="font-bold text-white mb-6 text-center">Resumo da Alocação</h3>
                    
                    <div className="h-64 w-full relative mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '8px', border: '1px solid #27272a' }} />
                            </RePieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className={`text-3xl font-mono font-bold ${isValid ? 'text-green-500' : totalPercentage > 100 ? 'text-red-500' : 'text-amber-500'}`}>
                                {totalPercentage}%
                            </span>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Total</span>
                        </div>
                    </div>

                    <div className={`p-4 rounded-lg border mb-6 flex items-start gap-3 transition-colors ${
                        isValid 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : totalPercentage > 100 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                        {isValid ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="shrink-0 mt-0.5" />}
                        <div className="text-sm">
                            {isValid && "Distribuição perfeita! O total é exatamente 100%."}
                            {totalPercentage > 100 && `O total ultrapassou 100% em ${(totalPercentage - 100).toFixed(0)}%. Reduza alguma categoria.`}
                            {totalPercentage < 100 && `Ainda faltam ${remaining.toFixed(0)}% para completar a distribuição.`}
                        </div>
                    </div>

                    <Button 
                        onClick={handleSave} 
                        disabled={!isValid || loading} 
                        className={`w-full ${savedSuccess ? 'bg-green-500 hover:bg-green-600 text-black' : ''}`}
                    >
                        {loading ? 'Salvando...' : savedSuccess ? 'Metas Salvas!' : 'Salvar Metas'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- TAB 2: OBJECTIVES ---

const ObjectivesTab: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [objectiveHistory, setObjectiveHistory] = useState<Record<string, ObjectiveContributionEntry[]>>({});
    const [historyLoading, setHistoryLoading] = useState(false);
    const [objectiveDetails, setObjectiveDetails] = useState<Objective | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
    const [objectiveToDelete, setObjectiveToDelete] = useState<Objective | null>(null);
    const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);

    // Form States
    const [newName, setNewName] = useState('');
    const [newTotal, setNewTotal] = useState('');
    const [newDesc, setNewDesc] = useState('');
    
    // Contribute States
    const [contribValue, setContribValue] = useState('');
    const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Não carregar se auth ainda está carregando ou usuário não existe
        if (authLoading || !user) {
            return;
        }
        loadObjectives();
    }, [user, authLoading]);

    const loadObjectives = async () => {
        try {
            const loadedObjectives = await planningService.getObjectives();
            setObjectives(loadedObjectives);
            await loadObjectiveHistory(loadedObjectives);
        } catch (err) {
            // Ignorar erros de autenticação silenciosamente
            const message = err instanceof Error ? err.message : '';
            const isAuthError = message.includes('NOT_AUTHENTICATED') || 
                                message.includes('não autenticado');
            if (!isAuthError) {
                console.error('ObjectivesTab loadObjectives error:', err);
            }
        }
    };

    const loadObjectiveHistory = async (loadedObjectives: Objective[]) => {
        if (loadedObjectives.length === 0) {
            setObjectiveHistory({});
            setHistoryLoading(false);
            return;
        }

        setHistoryLoading(true);

        try {
            const currentYear = new Date().getFullYear();
            const createdYears = loadedObjectives.map((objective) => {
                const year = Number(new Date(objective.createdAt).getFullYear());
                return Number.isFinite(year) ? year : currentYear;
            });
            const startYear = Math.min(currentYear, ...createdYears);
            const yearlyExpenseMaps = await Promise.all(
                Array.from({ length: currentYear - startYear + 1 }, (_, index) => startYear + index)
                    .map((year) => planningService.getExpensesByYearRange(year))
            );
            const allExpenses = yearlyExpenseMaps.flatMap((expenseMap) => Array.from(expenseMap.values()).flat());

            const nextHistory = loadedObjectives.reduce<Record<string, ObjectiveContributionEntry[]>>((acc, objective) => {
                const entries = allExpenses
                    .filter((expense) => expense.objectiveId === objective.id)
                    .map((expense) => ({
                        id: expense.id,
                        month: expense.month,
                        date: expense.createdAt?.slice(0, 10) || `${expense.month}-01`,
                        amount: expense.value,
                        name: expense.name,
                        observation: expense.observation,
                        source: expense.source,
                        installmentLabel: expense.installment
                            ? `${expense.installment.current}/${expense.installment.total}`
                            : undefined
                    }))
                    .sort((a, b) => {
                        const dateCompare = b.date.localeCompare(a.date);
                        if (dateCompare !== 0) return dateCompare;
                        return b.id.localeCompare(a.id);
                    });

                acc[objective.id] = entries;
                return acc;
            }, {});

            setObjectiveHistory(nextHistory);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleCreateObjective = async () => {
        const total = parseFloat(newTotal);
        if (!newName || !total) return;

        await planningService.addObjective({
            name: newName,
            totalValue: total,
            description: newDesc,
            status: 'active'
        });

        setIsAddModalOpen(false);
        setNewName('');
        setNewTotal('');
        setNewDesc('');
        loadObjectives();
    };

    const handleDeleteObjective = async () => {
        if (!objectiveToDelete) return;
        await planningService.deleteObjective(objectiveToDelete.id);
        setObjectiveToDelete(null);
        loadObjectives();
    };

    const updateStatus = async (id: string, status: 'active' | 'paused' | 'completed') => {
        await planningService.updateObjective(id, { status });
        loadObjectives();
    };

    const handleOpenContribute = (obj: Objective) => {
        setSelectedObjective(obj);
        setContribValue('');
        setIsContributeModalOpen(true);
    };

    const handleOpenObjectiveDetails = (objective: Objective) => {
        setObjectiveDetails(objective);
    };

    const handleContribute = async () => {
        if (!selectedObjective || !contribValue) return;
        const val = parseFloat(contribValue);
        
        // This creates an expense in the current month linked to the objective
        const currentMonth = contribDate.slice(0, 7); // YYYY-MM
        
        await planningService.addExpense({
            month: currentMonth,
            category: 'Metas',
            name: `Aporte: ${selectedObjective.name}`,
            value: val,
            type: 'variavel',
            objectiveId: selectedObjective.id,
            observation: 'Aporte manual direto'
        });

        setIsContributeModalOpen(false);
        loadObjectives(); // Refresh progress
    };

    const activeGoals = objectives.filter(o => o.status !== 'completed');
    const completedGoals = objectives.filter(o => o.status === 'completed');

    const renderContributionHistory = (objective: Objective) => {
        const entries = objectiveHistory[objective.id] || [];
        const lastContribution = entries[0];

        return (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Historico de Aportes</div>
                        <div className="text-xs text-zinc-400">
                            {entries.length === 0
                                ? 'Nenhum aporte registrado'
                                : `${entries.length} ${entries.length === 1 ? 'lancamento' : 'lancamentos'} vinculados`}
                        </div>
                    </div>
                    {lastContribution && (
                        <div className="text-right">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ultimo</div>
                            <div className="font-mono text-xs font-bold text-cyan-400">{formatCurrency(lastContribution.amount, 'BRL')}</div>
                        </div>
                    )}
                </div>

                {historyLoading ? (
                    <div className="text-xs text-zinc-500">Carregando historico...</div>
                ) : entries.length === 0 ? (
                    <div className="text-xs text-zinc-500">Os aportes aparecem aqui assim que forem lancados no objetivo.</div>
                ) : (
                    <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                        {entries.slice(0, 5).map((entry) => (
                            <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-zinc-200">{entry.name}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                        <span>{new Date(`${entry.date}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                                        <span>{entry.month}</span>
                                        {entry.installmentLabel && <span>Parcela {entry.installmentLabel}</span>}
                                        {entry.source && <span>{entry.source}</span>}
                                    </div>
                                    {entry.observation && (
                                        <div className="mt-1 truncate text-xs italic text-zinc-500">{entry.observation}</div>
                                    )}
                                </div>
                                <div className="shrink-0 font-mono text-sm font-bold text-cyan-400">
                                    {formatCurrency(entry.amount, 'BRL')}
                                </div>
                            </div>
                        ))}
                        {entries.length > 5 && (
                            <div className="text-[11px] text-zinc-500">
                                Exibindo os 5 aportes mais recentes de um total de {entries.length}.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderObjectiveCardSummary = (objective: Objective) => {
        const entries = objectiveHistory[objective.id] || [];
        const lastContribution = entries[0];

        return (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
                <div>
                    <div className="font-semibold uppercase tracking-[0.14em] text-zinc-500">Aportes</div>
                    <div className="mt-1 text-zinc-300">
                        {historyLoading ? 'Carregando...' : `${entries.length} ${entries.length === 1 ? 'registro' : 'registros'}`}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-semibold uppercase tracking-[0.14em] text-zinc-500">Ultimo</div>
                    <div className="mt-1 font-mono text-cyan-400">
                        {historyLoading
                            ? '--'
                            : lastContribution
                                ? formatCurrency(lastContribution.amount, 'BRL')
                                : 'Sem aporte'}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Meus Objetivos</h2>
                    <p className="text-zinc-400 max-w-2xl">
                        Acompanhe seus objetivos financeiros e quanto já foi reservado para cada um. 
                        Estes itens consomem a categoria "Metas" do seu orçamento.
                    </p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)}>
                    <Plus size={18} className="mr-2" /> Novo Objetivo
                </Button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {objectives.length === 0 && (
                    <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
                        <Flag size={48} className="mx-auto mb-4 opacity-20" />
                        <p>Nenhum objetivo cadastrado.</p>
                        <button onClick={() => setIsAddModalOpen(true)} className="text-cyan-500 font-medium hover:underline mt-2">Criar primeiro objetivo</button>
                    </div>
                )}

                {/* Active Cards */}
                {activeGoals.map(obj => {
                    const progress = Math.min(100, (obj.currentValue / obj.totalValue) * 100);
                    return (
                        <div
                            key={obj.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenObjectiveDetails(obj)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleOpenObjectiveDetails(obj);
                                }
                            }}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 relative group hover:border-cyan-500/30 transition-colors text-left w-full"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-white">{obj.name}</h3>
                                        {obj.status === 'paused' && <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Pausado</span>}
                                    </div>
                                    <p className="text-zinc-500 text-xs">{obj.description || 'Sem descrição'}</p>
                                </div>
                                <div className="flex gap-1">
                                    {obj.status === 'active' ? (
                                        <button onClick={(e) => { e.stopPropagation(); updateStatus(obj.id, 'paused'); }} title="Pausar" className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-lg"><PauseCircle size={16}/></button>
                                    ) : (
                                        <button onClick={(e) => { e.stopPropagation(); updateStatus(obj.id, 'active'); }} title="Retomar" className="p-2 text-zinc-500 hover:text-white bg-zinc-900 rounded-lg"><PlayCircle size={16}/></button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); updateStatus(obj.id, 'completed'); }} title="Concluir" className="p-2 text-zinc-500 hover:text-green-500 bg-zinc-900 rounded-lg"><CheckSquare size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); setObjectiveToDelete(obj); }} title="Excluir" className="p-2 text-zinc-500 hover:text-red-500 bg-zinc-900 rounded-lg"><Trash2 size={16}/></button>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-zinc-400 font-mono">{formatCurrency(obj.currentValue, 'BRL')}</span>
                                    <span className="text-white font-mono font-bold">{formatCurrency(obj.totalValue, 'BRL')}</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="text-right mt-1 text-[10px] text-cyan-500 font-bold">{progress.toFixed(1)}%</div>
                            </div>

                            <Button variant="secondary" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); handleOpenContribute(obj); }}>
                                + Aportar
                            </Button>

                            {renderObjectiveCardSummary(obj)}
                            <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">Clique para ver detalhes</div>
                        </div>
                    );
                })}

                {/* Completed Cards */}
                {completedGoals.map(obj => (
                    <div
                        key={obj.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenObjectiveDetails(obj)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenObjectiveDetails(obj);
                            }
                        }}
                        className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-6 opacity-70 hover:opacity-100 transition-opacity text-left w-full"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-zinc-300">{obj.name}</h3>
                                    <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded flex items-center gap-1 border border-green-500/20">
                                        <CheckCircle2 size={10} /> Concluído
                                    </span>
                                </div>
                                <p className="text-zinc-600 text-xs">Finalizado em {new Date(obj.completedAt || '').toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); updateStatus(obj.id, 'active'); }} title="Reativar" className="p-2 text-zinc-600 hover:text-white bg-zinc-900/50 rounded-lg"><RotateCcw size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setObjectiveToDelete(obj); }} title="Excluir Histórico" className="p-2 text-zinc-600 hover:text-red-500 bg-zinc-900/50 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="mb-2">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-zinc-500 font-mono">Total Acumulado</span>
                                <span className="text-green-500 font-mono font-bold">{formatCurrency(obj.currentValue, 'BRL')}</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-green-900/30">
                                <div className="h-full bg-green-600 w-full"></div>
                            </div>
                        </div>

                        {renderObjectiveCardSummary(obj)}
                        <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-600">Clique para ver detalhes</div>
                    </div>
                ))}
            </div>

            {/* OBJECTIVE DETAILS MODAL */}
            <AnimatePresence>
                {objectiveDetails && (
                    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
                        >
                            {(() => {
                                const detailProgress = Math.min(100, (objectiveDetails.currentValue / objectiveDetails.totalValue) * 100);
                                const detailEntries = objectiveHistory[objectiveDetails.id] || [];
                                const remainingValue = Math.max(0, objectiveDetails.totalValue - objectiveDetails.currentValue);

                                return (
                                    <>
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-2xl font-bold text-white">{objectiveDetails.name}</h3>
                                                    {objectiveDetails.status === 'paused' && (
                                                        <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Pausado</span>
                                                    )}
                                                    {objectiveDetails.status === 'completed' && (
                                                        <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded border border-green-500/20">Concluido</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-zinc-400">{objectiveDetails.description || 'Sem descricao adicional.'}</p>
                                            </div>
                                            <button onClick={() => setObjectiveDetails(null)} className="text-zinc-500 hover:text-white">
                                                <X size={20} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Acumulado</div>
                                                <div className="font-mono text-lg font-bold text-cyan-400">{formatCurrency(objectiveDetails.currentValue, 'BRL')}</div>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Meta Total</div>
                                                <div className="font-mono text-lg font-bold text-white">{formatCurrency(objectiveDetails.totalValue, 'BRL')}</div>
                                            </div>
                                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-2">Falta</div>
                                                <div className="font-mono text-lg font-bold text-amber-400">{formatCurrency(remainingValue, 'BRL')}</div>
                                            </div>
                                        </div>

                                        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-zinc-400 font-mono">{formatCurrency(objectiveDetails.currentValue, 'BRL')}</span>
                                                <span className="text-white font-mono font-bold">{formatCurrency(objectiveDetails.totalValue, 'BRL')}</span>
                                            </div>
                                            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-500 ${objectiveDetails.status === 'completed' ? 'bg-green-600' : 'bg-cyan-500'}`} style={{ width: `${detailProgress}%` }}></div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between text-xs">
                                                <span className="text-zinc-500">{detailEntries.length} aportes vinculados</span>
                                                <span className={`font-bold ${objectiveDetails.status === 'completed' ? 'text-green-500' : 'text-cyan-500'}`}>{detailProgress.toFixed(1)}%</span>
                                            </div>
                                        </div>

                                        {objectiveDetails.status !== 'completed' && (
                                            <div className="mb-6">
                                                <Button
                                                    variant="secondary"
                                                    className="w-full"
                                                    onClick={() => {
                                                        setObjectiveDetails(null);
                                                        handleOpenContribute(objectiveDetails);
                                                    }}
                                                >
                                                    + Aportar Neste Objetivo
                                                </Button>
                                            </div>
                                        )}

                                        {renderContributionHistory(objectiveDetails)}
                                    </>
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ADD MODAL */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{opacity: 0}} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex justify-between mb-6">
                                <h3 className="text-white font-bold text-lg">Novo Objetivo</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                            </div>
                            <div className="space-y-4">
                                <Input label="Nome do Objetivo" placeholder="Ex: Viagem Europa, Carro Novo" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                                <Input label="Valor Total (R$)" type="number" placeholder="0.00" value={newTotal} onChange={e => setNewTotal(e.target.value)} />
                                <Input label="Descrição (Opcional)" placeholder="Detalhes..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                                <div className="pt-2 flex justify-end gap-3">
                                    <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleCreateObjective} disabled={!newName || !newTotal}>Salvar</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CONTRIBUTE MODAL */}
            <AnimatePresence>
                {isContributeModalOpen && selectedObjective && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{opacity: 0}} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex justify-between mb-6">
                                <div>
                                    <h3 className="text-white font-bold text-lg">Aporte em Objetivo</h3>
                                    <p className="text-cyan-500 text-xs font-bold uppercase tracking-wider">{selectedObjective.name}</p>
                                </div>
                                <button onClick={() => setIsContributeModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                            </div>
                            <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 mb-6 text-sm text-zinc-400">
                                Este valor será registrado como um <strong>Gasto</strong> na categoria <strong>Metas</strong> do mês atual ({contribDate.slice(0,7)}).
                            </div>
                            <div className="space-y-4">
                                <Input label="Valor do Aporte (R$)" type="number" placeholder="0.00" value={contribValue} onChange={e => setContribValue(e.target.value)} autoFocus />
                                <Input label="Data" type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} />
                                <div className="pt-2 flex justify-end gap-3">
                                    <Button variant="secondary" onClick={() => setIsContributeModalOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleContribute} disabled={!contribValue}>Confirmar Aporte</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DELETE CONFIRMATION MODAL */}
            <AnimatePresence>
                {objectiveToDelete && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Excluir Objetivo?</h3>
                                <p className="text-zinc-400 text-sm">
                                    Esta ação removerá <strong>{objectiveToDelete.name}</strong> permanentemente. Todos os aportes vinculados a este objetivo também serão excluídos.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="secondary" className="w-full" onClick={() => setObjectiveToDelete(null)}>Cancelar</Button>
                                <button 
                                    onClick={handleDeleteObjective}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    Excluir
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
