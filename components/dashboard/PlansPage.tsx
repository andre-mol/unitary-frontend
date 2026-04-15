import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { getPlanDisplayName, isPaidPlan } from '../../lib/plans';
import { ShieldCheck, Zap, Crown, XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { PricingPlans } from '../pricing/PricingPlans';
import { Button } from '../ui/Button';
import { CancelSubscriptionModal } from '../billing/CancelSubscriptionModal';
import { reactivateSubscription } from '../../lib/billing/reactivateSubscription';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

export const PlansPage: React.FC = () => {
    const {
        plan: currentPlan,
        loading: loadingSubscription,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        refreshPlan
    } = useSubscription();
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [reactivating, setReactivating] = useState(false);

    const isPaid = isPaidPlan(currentPlan);
    const { addToast } = useToast();

    const handleReactivate = async () => {
        if (!confirm('Tem certeza que deseja reativar sua assinatura? Ela será renovada automaticamente ao fim do período atual.')) {
            return;
        }

        setReactivating(true);
        try {
            if (!supabase) throw new Error('Cliente Supabase não inicializado');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessão expirada');

            await reactivateSubscription(session.access_token);

            addToast({
                type: 'success',
                title: 'Assinatura reativada!',
                message: 'A renovação automática foi habilitada novamente.'
            });
            await refreshPlan();
        } catch (error: any) {
            addToast({
                type: 'error',
                title: 'Erro',
                message: error.message
            });
        } finally {
            setReactivating(false);
        }
    };

    return (
        <DashboardLayout title="Planos" subtitle="Veja seu plano atual e compare benefícios">
            <div className="space-y-8 animate-in fade-in duration-500">

                {/* Current Plan Highlight */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${currentPlan === 'patrio_pro' ? 'bg-purple-500/20 text-purple-400' :
                            currentPlan === 'essencial' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-zinc-700/20 text-zinc-400'
                            }`}>
                            {currentPlan === 'patrio_pro' ? <Crown size={24} /> : currentPlan === 'essencial' ? <Zap size={24} /> : <ShieldCheck size={24} />}
                        </div>
                        <div>
                            <p className="text-zinc-400 text-sm mb-1">Seu plano atual</p>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                {getPlanDisplayName(currentPlan)}
                                {cancelAtPeriodEnd && (
                                    <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded-full border border-red-500/20">
                                        Cancelamento agendado
                                    </span>
                                )}
                            </h2>
                            <p className="text-zinc-500 text-xs mt-1">
                                {cancelAtPeriodEnd
                                    ? `Acesso disponível até ${new Date(currentPeriodEnd!).toLocaleDateString('pt-BR')}`
                                    : ` Renovação em ${new Date(currentPeriodEnd!).toLocaleDateString('pt-BR')}`
                                }
                            </p>
                        </div>
                    </div>

                    {isPaid && !loadingSubscription && !cancelAtPeriodEnd && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300"
                            onClick={() => setIsCancelModalOpen(true)}
                        >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancelar assinatura
                        </Button>
                    )}

                    {isPaid && !loadingSubscription && cancelAtPeriodEnd && (
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white border-none shadow-lg shadow-green-900/20"
                            onClick={handleReactivate}
                            disabled={reactivating}
                        >
                            {reactivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                            Reativar assinatura
                        </Button>
                    )}
                </div>

                {/* Unified Plans Logic */}
                {/* We override the inner padding/width of PricingPlans to fit dashboard */}
                <div className="-mx-4 md:mx-0">
                    <PricingPlans />
                </div>

                {/* Note */}
                <div className="text-center text-zinc-500 text-sm max-w-2xl mx-auto pt-8 border-t border-zinc-900">
                    <p>
                        Precisa de ajuda com seu plano? <a href="mailto:suporte@unitary.com.br" className="text-amber-500 hover:underline">Entre em contato com o suporte</a>.
                    </p>
                </div>

                <CancelSubscriptionModal
                    isOpen={isCancelModalOpen}
                    onClose={() => setIsCancelModalOpen(false)}
                    onSuccess={() => {
                        // Optimistically close. Subscription provider should poll or we can force reload window
                        window.location.reload();
                    }}
                />
            </div>
        </DashboardLayout>
    );
};
