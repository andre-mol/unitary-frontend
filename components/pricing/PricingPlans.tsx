import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Zap, Crown, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
    getAllPlans,
    formatBRLFromCentsNoDecimals,
    getAnnualEquivalentMonthlyPrice,
    getAnnualSavings,
    formatBRLFromCents,
    type PlanId,
    type PlanConfig
} from '../../lib/plans';
import { safeCapture } from '../../lib/analytics';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../lib/authService';
import { startCheckout, CheckoutError } from '../../lib/billing/startCheckout';
import { useToast } from '../ui/Toast';

type BillingCycle = 'monthly' | 'annual';

const PlanFeature: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active = true }) => (
    <div className={`flex items-start gap-3 text-sm ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
        {active ? (
            <Check className="w-5 h-5 text-amber-500 shrink-0" />
        ) : (
            <X className="w-5 h-5 text-zinc-700 shrink-0" />
        )}
        <span className="leading-tight">{children}</span>
    </div>
);

export const PricingPlans: React.FC<{ isPublic?: boolean }> = ({ isPublic = false }) => {
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const { plan: currentPlan } = useSubscription();
    // Use explicit auth check
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const handleCycleChange = (cycle: BillingCycle) => {
        setBillingCycle(cycle);
        safeCapture('pricing_toggle_changed', { cycle });
    };

    const handleCtaClick = async (plan: PlanConfig) => {
        safeCapture('pricing_cta_clicked', {
            plan: plan.id,
            cycle: billingCycle,
            location: 'pricing_page'
        });

        // 1. If user is NOT logged in, redirect to signup
        if (!user) {
            navigate('/cadastro');
            return;
        }

        // 2. User is logged in
        // If user already has this plan (and it's the free plan), do nothing.
        // If they have a paid plan, we allow the click so they can reach the management portal.
        if (currentPlan === plan.id && currentPlan === 'inicial') return;

        // If trying to downgrade to free manually
        if (plan.id === 'inicial') {
            return; // No self-service downgrade UI here yet
        }

        // 3. Checkout Flow (Upgrade/Change)
        if (plan.id === 'essencial' || plan.id === 'patrio_pro') {
            try {
                setLoadingPlan(plan.id);

                // Get fresh session token
                const { session } = await authService.getSession();
                const token = session?.accessToken;

                await startCheckout(plan.id, billingCycle, token);
            } catch (error) {
                if (error instanceof CheckoutError) {
                    if (error.code === 'AUTH') {
                        // Should technically not happen due to !user check, 
                        // but handle session expiry
                        navigate('/login');
                        addToast({
                            type: 'info',
                            title: 'Sessão expirada',
                            message: 'Faça login novamente para continuar.'
                        });
                    } else if (error.code === 'NETWORK') {
                        addToast({
                            type: 'error',
                            title: 'Erro de conexão',
                            message: 'Verifique sua internet e tente novamente.'
                        });
                    } else {
                        addToast({
                            type: 'error',
                            title: 'Erro no pagamento',
                            message: 'Não foi possível iniciar o checkout. Tente novamente.'
                        });
                    }
                } else {
                    console.error('Checkout error:', error);
                    addToast({
                        type: 'error',
                        title: 'Erro inesperado',
                        message: 'Ocorreu um erro. Tente recarregar a página.'
                    });
                }
            } finally {
                setLoadingPlan(null);
            }
        }
    };

    // Helper para determinar o estado do botão
    const getButtonState = (planId: PlanId) => {
        // Loading state matches
        if (loadingPlan === planId) {
            return {
                text: 'Processando...',
                disabled: true,
                variant: 'primary' as const,
                loading: true
            };
        }

        // Disable others while loading
        if (loadingPlan) {
            return {
                text: 'Aguarde...',
                disabled: true,
                variant: 'outline' as const
            };
        }

        // If NOT LOGGED IN: Show conversion buttons
        if (!user) {
            return {
                text: planId === 'inicial' ? 'Criar conta gratuita' : 'Começar agora',
                disabled: false,
                variant: 'primary' as const
            };
        }

        // IF LOGGED IN:
        // 1. Current Plan disabled
        if (currentPlan === planId) {
            return {
                text: 'Plano atual',
                disabled: true,
                variant: 'outline' as const
            };
        }

        // 2. Rank logic
        const ranks: Record<PlanId, number> = { inicial: 0, essencial: 1, patrio_pro: 2 };
        const currentRank = ranks[currentPlan];
        const planRank = ranks[planId];

        if (planRank > currentRank) {
            // Upgrade available
            return {
                text: 'Fazer upgrade',
                disabled: false,
                variant: 'primary' as const
            };
        }

        if (planRank < currentRank) {
            // Downgrade available (via manual flow or support)
            // But let's show it as superior for now
            return {
                text: 'Seu plano é superior',
                disabled: true,
                variant: 'outline' as const
            };
        }

        // Default fallback (should be covered)
        return {
            text: 'Começar agora',
            disabled: false,
            variant: 'primary' as const
        };
    };

    return (
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-white mb-4">Planos e preços</h2>
                <p className="text-zinc-400 text-lg">
                    Destrave histórico confiável, metas e orçamento — tudo em um só lugar.
                </p>
            </div>

            {/* Toggle */}
            <div className="flex justify-center mb-16">
                <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex items-center relative">
                    <button
                        onClick={() => handleCycleChange('annual')}
                        className={`relative z-10 px-6 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${billingCycle === 'annual' ? 'text-white' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        Anual
                    </button>
                    <button
                        onClick={() => handleCycleChange('monthly')}
                        className={`relative z-10 px-6 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${billingCycle === 'monthly' ? 'text-white' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        Mensal
                    </button>

                    {/* Background Pill */}
                    <motion.div
                        className="absolute top-1 bottom-1 bg-zinc-800 rounded-lg shadow-sm"
                        initial={false}
                        animate={{
                            left: billingCycle === 'annual' ? '4px' : '50%',
                            width: 'calc(50% - 4px)',
                            transform: billingCycle === 'monthly' ? 'translateX(0)' : 'translateX(0)'
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />

                    {/* Discount Badge */}
                    <div className="absolute -top-3 left-6 z-20 pointer-events-none">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wide">
                            17% OFF
                        </span>
                    </div>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {getAllPlans().map((plan) => {
                    const buttonState = getButtonState(plan.id);
                    // @ts-ignore - buttonState generic
                    const isLoading = buttonState.loading;

                    return (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 h-full ${plan.isPopular
                                ? 'bg-zinc-900/60 border-amber-500/50 shadow-[0_0_40px_-15px_rgba(245,158,11,0.2)] scale-105 z-10'
                                : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                                }`}
                        >
                            {plan.isPopular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg whitespace-nowrap">
                                    Mais Popular
                                </div>
                            )}

                            <div className="mb-6">
                                {/* Title & Icon */}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-xl font-bold ${plan.isPopular ? 'text-white' : 'text-zinc-200'}`}>
                                        {plan.displayName}
                                    </h3>
                                    <div className={`${plan.isPopular ? 'text-amber-500' : 'text-zinc-600'}`}>
                                        {plan.id === 'essencial' && <Zap size={24} />}
                                        {plan.id === 'patrio_pro' && <Crown size={24} />}
                                        {plan.id === 'inicial' && <ShieldCheck size={24} />}
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="min-h-[80px]">
                                    {plan.id === 'inicial' ? (
                                        <>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold text-white">R$ 0</span>
                                                <span className="text-zinc-500 text-sm font-medium">/mês</span>
                                            </div>
                                            <p className="text-zinc-500 text-xs mt-2">Para sempre gratuito</p>
                                        </>
                                    ) : (
                                        <div className="flex flex-col">
                                            {/* Strikethrough Old Price */}
                                            {billingCycle === 'annual' && plan.annualPriceInCents > 0 && (
                                                <span className="text-sm text-zinc-500 line-through mb-1">
                                                    {formatBRLFromCentsNoDecimals(plan.monthlyPriceInCents * 12)}/ano
                                                </span>
                                            )}

                                            {/* Main Price Display */}
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-4xl font-bold text-white">
                                                    {billingCycle === 'annual'
                                                        ? formatBRLFromCentsNoDecimals(getAnnualEquivalentMonthlyPrice(plan.id))
                                                        : formatBRLFromCentsNoDecimals(plan.monthlyPriceInCents)
                                                    }
                                                </span>
                                                <span className="text-zinc-500 text-sm font-medium">/mês</span>
                                            </div>

                                            {/* Subtext */}
                                            {billingCycle === 'annual' ? (
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-zinc-400 text-xs font-medium">
                                                        {formatBRLFromCentsNoDecimals(plan.annualPriceInCents)}/ano debitado hoje
                                                    </p>
                                                    <p className="text-emerald-500 text-xs">
                                                        Economize {formatBRLFromCentsNoDecimals(getAnnualSavings(plan.id))}/ano
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-zinc-500 text-xs mt-2">
                                                    Cobrança mensal. Cancele quando quiser.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Features */}
                            <div className="flex-1 space-y-3 mb-8">
                                {plan.marketingFeatures?.map((feature, idx) => (
                                    <PlanFeature key={idx}>{feature}</PlanFeature>
                                ))}
                            </div>

                            {/* CTA */}
                            <div className="mt-auto space-y-3">
                                <Button
                                    variant={plan.isPopular ? buttonState.variant : 'outline'}
                                    className={`w-full justify-center ${plan.isPopular && !buttonState.disabled ? 'shadow-lg shadow-amber-500/20' : ''}`}
                                    size="lg"
                                    disabled={buttonState.disabled}
                                    onClick={() => handleCtaClick(plan)}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        buttonState.text === 'Começar agora' && billingCycle === 'annual' && plan.id !== 'inicial'
                                            ? 'Começar com desconto anual'
                                            : buttonState.text === 'Começar agora' && billingCycle === 'monthly' && plan.id === 'patrio_pro'
                                                ? 'Assinar Pro mensal'
                                                : buttonState.text
                                    )}
                                </Button>

                                {/* Microcopy Legal */}
                                {plan.id !== 'inicial' && (
                                    <div className="text-[10px] text-zinc-600 text-center leading-tight">
                                        {billingCycle === 'annual' ? (
                                            <>
                                                Cobrança anual. Renovação automática.<br />
                                                Direito de arrependimento em 7 dias.
                                            </>
                                        ) : (
                                            <>Cobrança recorrente mensal.</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    );
};
