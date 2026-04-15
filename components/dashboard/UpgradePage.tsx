import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../ui/Button';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { Lock, ArrowRight, Crown, Zap } from 'lucide-react';
import { getPlanDisplayName, type PlanId } from '../../lib/plans';

interface LimitInfo {
    current: number;
    limit: number;
    plan: PlanId;
}

interface UpgradePageProps {
    /** Name of the feature that requires upgrade */
    featureName: string;
    /** Required plan level */
    requiredPlan: 'essencial' | 'patrio_pro';
    /** Optional: Information about portfolio limit (when blocking due to limit) */
    limitInfo?: LimitInfo;
}

export const UpgradePage: React.FC<UpgradePageProps> = ({ featureName, requiredPlan, limitInfo }) => {
    const navigate = useNavigate();
    const { plan } = useSubscription();

    // Get plan display name using lib/plans.ts
    const getPlanName = (planType: PlanId) => {
        return getPlanDisplayName(planType);
    };

    // Get plan badge color
    const getPlanBadgeColor = (planType: PlanId) => {
        switch (planType) {
            case 'inicial':
                return 'bg-zinc-700 text-zinc-300';
            case 'essencial':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'patrio_pro':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default:
                return 'bg-zinc-700 text-zinc-300';
        }
    };

    return (
        <DashboardLayout
            title="Upgrade Necessário"
            subtitle="Esta funcionalidade requer um plano superior"
        >
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Lock Icon */}
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full"></div>
                    <div className="relative bg-zinc-900 border border-zinc-800 rounded-full p-6">
                        <Lock size={48} className="text-amber-500" />
                    </div>
                </div>

                {/* Current Plan Badge */}
                <div className="mb-4">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${getPlanBadgeColor(plan)}`}>
                        {plan === 'essencial' && <Zap size={16} />}
                        {plan === 'patrio_pro' && <Crown size={16} />}
                        Seu plano atual: {getPlanName(plan)}
                    </span>
                </div>

                {/* Title */}
                <h2 className="text-3xl font-bold text-white mb-4">
                    Funcionalidade Bloqueada
                </h2>

                {/* Feature Name */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 max-w-md">
                    <p className="text-zinc-400 text-lg mb-2">Você está tentando acessar:</p>
                    <p className="text-white text-xl font-semibold">{featureName}</p>
                </div>

                {/* Required Plan Info */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 max-w-md">
                    {limitInfo ? (
                        <>
                            <p className="text-zinc-400 mb-3">
                                Você já possui <span className="text-white font-semibold">{limitInfo.current} portfólio{limitInfo.current !== 1 ? 's' : ''}</span> no plano <span className="text-amber-400 font-semibold">{getPlanName(limitInfo.plan)}</span>.
                            </p>
                            <p className="text-zinc-400 mb-3">
                                O plano <span className="text-amber-400 font-semibold">{getPlanName(limitInfo.plan)}</span> permite apenas <span className="text-white font-semibold">{limitInfo.limit} portfólio{limitInfo.limit !== 1 ? 's' : ''}</span>.
                            </p>
                            <p className="text-zinc-500 text-sm">
                                Faça upgrade para o plano <span className="text-amber-400 font-semibold">{getPlanName(requiredPlan)}</span> para criar mais portfólios.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-zinc-400 mb-3">
                                Esta funcionalidade está disponível apenas no plano <span className="text-amber-400 font-semibold">{getPlanName(requiredPlan)}</span> ou superior.
                            </p>
                            <p className="text-zinc-500 text-sm">
                                Faça upgrade para desbloquear esta e outras funcionalidades premium.
                            </p>
                        </>
                    )}
                </div>

                {/* CTA Button */}
                <Button
                    onClick={() => navigate('/dashboard/planos')}
                    size="lg"
                    className="group"
                >
                    Ver Planos e Preços
                    <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>

                {/* Additional Info */}
                <p className="text-zinc-500 text-sm mt-6 max-w-md">
                    Ao fazer upgrade, você terá acesso imediato a todas as funcionalidades do plano escolhido.
                </p>
            </div>
        </DashboardLayout>
    );
};

