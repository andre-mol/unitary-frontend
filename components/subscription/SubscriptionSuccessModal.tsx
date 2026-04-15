
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, Zap, X, Calendar, ShieldCheck } from 'lucide-react';
import { useSubscription } from './SubscriptionProvider';
import { useAuth } from '../auth/AuthProvider';
import { getPlanById, formatBRLFromCents } from '../../lib/plans';
import { Button } from '../ui/Button';

interface SubscriptionSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionSuccessModal: React.FC<SubscriptionSuccessModalProps> = ({ isOpen, onClose }) => {
    const { plan, subscription } = useSubscription();
    const { user } = useAuth();

    if (!isOpen) return null;

    const planConfig = getPlanById(plan);
    const isPro = plan === 'patrio_pro';
    const isEssencial = plan === 'essencial';

    // Format date
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Renovação mensal';
        try {
            return new Date(dateString).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={onClose}
                    >
                        {/* Modal Container */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header Gradient */}
                            <div className={`h-32 w-full absolute top-0 left-0 bg-gradient-to-b ${isPro ? 'from-amber-500/20' : 'from-indigo-500/20'
                                } to-transparent pointer-events-none`} />

                            <div className="p-8 relative z-10">
                                {/* Success Icon */}
                                <div className="flex justify-center mb-6">
                                    <div className={`relative p-4 rounded-full ${isPro ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'
                                        }`}>
                                        <div className={`absolute inset-0 rounded-full blur-xl ${isPro ? 'bg-amber-500/20' : 'bg-indigo-500/20'
                                            }`} />
                                        {isPro ? <Crown size={48} /> : <Zap size={48} />}
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-center mb-8">
                                    <h2 className="text-3xl font-bold text-white mb-2">
                                        Parabéns, {user?.name?.split(' ')[0] || 'Investidor'}!
                                    </h2>
                                    <p className="text-zinc-400">
                                        Você agora é assinante <span className={`font-semibold ${isPro ? 'text-amber-500' : 'text-indigo-400'
                                            }`}>{planConfig.displayName}</span>
                                    </p>
                                </div>

                                {/* Plan Details Card */}
                                <div className="bg-zinc-950/50 rounded-xl p-6 border border-zinc-800/50 mb-8 space-y-4">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="text-zinc-500" size={20} />
                                            <div>
                                                <p className="text-sm font-medium text-zinc-300">Próxima renovação</p>
                                                <p className="text-xs text-zinc-500">
                                                    Sua assinatura está ativa até esta data
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-white font-medium block">
                                                {formatDate(subscription?.currentPeriodEnd)}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                                            O QUE VOCÊ DESBLOQUEOU
                                        </p>
                                        <ul className="space-y-3">
                                            {planConfig.marketingFeatures.slice(0, 5).map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
                                                    <div className={`mt-0.5 rounded-full p-0.5 ${isPro ? 'bg-amber-500/20 text-amber-500' : 'bg-indigo-500/20 text-indigo-500'
                                                        }`}>
                                                        <Check size={12} strokeWidth={3} />
                                                    </div>
                                                    {feature}
                                                </li>
                                            ))}
                                            {planConfig.marketingFeatures.length > 5 && (
                                                <li className="text-zinc-500 text-xs pl-6">
                                                    + {planConfig.marketingFeatures.length - 5} outros benefícios
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>

                                <Button
                                    className={`w-full ${isPro ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                    onClick={onClose}
                                >
                                    Começar a usar
                                </Button>
                            </div>

                            {/* Close Button X */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
