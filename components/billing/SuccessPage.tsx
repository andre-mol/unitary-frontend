import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSubscription } from '../subscription/SubscriptionProvider';
import { useToast } from '../ui/Toast';
import { safeCapture } from '../../lib/analytics';

/**
 * Success Page
 * 
 * Handles redirect from Stripe Checkout.
 * Polls user_subscriptions until the plan status updates.
 */
export function SuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { plan, refreshPlan } = useSubscription();
    const { addToast } = useToast();
    const [status, setStatus] = useState<'processing' | 'success' | 'timeout'>('processing');

    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        // Track analytics on mount
        safeCapture('checkout_return', { status: 'success', session_id: sessionId });
    }, [sessionId]);

    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 30; // 60 seconds (2s interval)
        const intervalMs = 2000;
        let timer: NodeJS.Timeout;

        const checkSubscription = async () => {
            attempts++;

            // Refresh local state from DB
            await refreshPlan();

            // If plan is no longer 'inicial' (free), it means upgrade succeeded
            // Note: In real app, we might also check for specific plan ID if needed
            if (plan !== 'inicial') {
                setStatus('success');
                safeCapture('subscription_activated', { plan });

                addToast({
                    type: 'success',
                    title: 'Assinatura confirmada!',
                    message: 'Seu plano foi ativado com sucesso.',
                });

                // Redirect after brief delay to show success state
                setTimeout(() => {
                    navigate('/dashboard?upgraded=true');
                }, 2000);

                return true; // Stop polling
            }

            if (attempts >= maxAttempts) {
                setStatus('timeout');
                return true; // Stop polling
            }

            return false; // Continue polling
        };

        // Start polling loop
        const runLoop = async () => {
            const stop = await checkSubscription();
            if (!stop) {
                timer = setTimeout(runLoop, intervalMs);
            }
        };

        runLoop();

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, addToast, plan]); // Only re-run if these deps change (refreshPlan is stable)

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">

                {status === 'processing' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <div className="flex justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                                <Loader2 className="w-16 h-16 text-amber-500 animate-spin relative z-10" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Processando sua assinatura...</h1>
                            <p className="text-zinc-400">
                                Estamos confirmando o pagamento com o banco. Isso geralmente leva alguns segundos.
                            </p>
                        </div>
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <div className="flex justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                                <CheckCircle className="w-16 h-16 text-emerald-500 relative z-10" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Tudo pronto!</h1>
                            <p className="text-zinc-400">
                                Sua assinatura foi ativada. Redirecionando...
                            </p>
                        </div>
                    </motion.div>
                )}

                {status === 'timeout' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <div className="flex justify-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-zinc-500/20 blur-xl rounded-full" />
                                <AlertCircle className="w-16 h-16 text-zinc-500 relative z-10" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Demorou um pouco...</h1>
                            <p className="text-zinc-400">
                                O pagamento está demorando para confirmar, mas não se preocupe.
                                Assim que processado, seu plano será atualizado automaticamente.
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => navigate('/dashboard')}
                        >
                            Ir para o Dashboard
                        </Button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
