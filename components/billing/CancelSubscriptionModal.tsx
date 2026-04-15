import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { cancelSubscription, CancelFeedback } from '../../lib/billing/cancelSubscription';

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Reason definitions with optional follow-ups
const REASONS = [
    {
        id: 'too_expensive',
        label: 'Achei muito caro',
        followUp: {
            type: 'select',
            label: 'Qual preço faria sentido para você?',
            options: [
                { value: 'under_20', label: 'Menos de R$ 20/mês' },
                { value: '20_30', label: 'Entre R$ 20 e R$ 30/mês' },
                { value: '30_40', label: 'Entre R$ 30 e R$ 40/mês' },
                { value: 'other', label: 'Outro valor' }
            ]
        }
    },
    { id: 'missing_features', label: 'Faltam funcionalidades' },
    { id: 'difficult_to_use', label: 'Achei difícil de usar' },
    {
        id: 'bugs',
        label: 'Tive problemas técnicos/bugs',
        followUp: {
            type: 'select',
            label: 'Onde você encontrou problemas?',
            options: [
                { value: 'dashboard', label: 'Painel principal' },
                { value: 'reports', label: 'Relatórios' },
                { value: 'integrations', label: 'Integrações/Conexões' },
                { value: 'mobile', label: 'Uso no celular' },
                { value: 'other', label: 'Outro lugar' }
            ]
        }
    },
    { id: 'dont_trust_data', label: 'Não confiei nos dados' },
    {
        id: 'switching_tool',
        label: 'Estou mudando para outra ferramenta',
        followUp: {
            type: 'text',
            label: 'Para qual ferramenta você está mudando? (Opcional)'
        }
    },
    { id: 'not_using_enough', label: 'Não estou usando o suficiente' },
    { id: 'other', label: 'Outro motivo' },
];

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<'survey' | 'confirm'>('survey');
    const [loading, setLoading] = useState(false);

    // Form State
    const [reason, setReason] = useState<string>('');
    const [followUpAnswer, setFollowUpAnswer] = useState<string>('');
    const [details, setDetails] = useState('');
    const [allowContact, setAllowContact] = useState(false);

    // Get current reason object
    const selectedReason = useMemo(() => REASONS.find(r => r.id === reason), [reason]);

    // Validation
    const isValid = useMemo(() => {
        if (!reason) return false;
        if (details.length > 1000) return false;
        // If follow up is required (like price selection), you could check it here.
        // For now we keep follow-ups optional or "soft" required depending on UX preference.
        return true;
    }, [reason, details]);

    const handleSubmit = async () => {
        if (!isValid) return;

        setLoading(true);
        try {
            // AIDEV-NOTE: Do not cancel via client; backend reads subscription id from DB.
            if (!supabase) throw new Error('Cliente Supabase não inicializado');
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('Sessão inválida. Por favor faça login novamente.');
            }

            const feedback: CancelFeedback = {
                reasonCode: reason,
                // Merge follow-up into details or a separate field if schema supported it. 
                // Using reasonDetails map for flexible storage.
                reasonDetails: selectedReason?.followUp ? {
                    question: selectedReason.followUp.label,
                    answer: followUpAnswer
                } : undefined,
                freeText: details,
                allowContact,
            };

            await cancelSubscription(feedback, session.access_token);

            addToast({
                type: 'success',
                title: 'Assinatura cancelada',
                message: 'Seu acesso continua até o fim do período atual.',
            });
            onSuccess(); // Should trigger a refresh
            onClose();
        } catch (error: any) {
            console.error('Cancellation error', error); // Minimal log
            addToast({
                type: 'error',
                title: 'Erro ao cancelar',
                message: error.message || 'Ocorreu um erro. Tente novamente.',
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setStep('survey');
        setReason('');
        setFollowUpAnswer('');
        setDetails('');
        setAllowContact(false);
    };

    // Handle closing with reset
    const handleClose = () => {
        resetForm();
        onClose();
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
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden relative"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        Antes de você ir...
                                    </h3>
                                    <p className="text-zinc-400 text-sm mt-1">
                                        Isso nos ajuda a melhorar. Leva menos de 30 segundos.
                                    </p>
                                </div>
                                <button
                                    onClick={handleClose}
                                    className="text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                                {step === 'survey' ? (
                                    <div className="space-y-6">
                                        {/* Reasons */}
                                        <div className="space-y-3">
                                            {REASONS.map((r) => (
                                                <div key={r.id}>
                                                    <label
                                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${reason === r.id
                                                            ? 'bg-amber-500/10 border-amber-500/50 text-white'
                                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                                            }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="cancel_reason"
                                                            value={r.id}
                                                            checked={reason === r.id}
                                                            onChange={(e) => {
                                                                setReason(e.target.value);
                                                                setFollowUpAnswer(''); // Reset follow up on change
                                                            }}
                                                            className="w-4 h-4 text-amber-500 border-zinc-700 focus:ring-amber-500 bg-transparent"
                                                        />
                                                        <span className="text-sm font-medium">{r.label}</span>
                                                    </label>

                                                    {/* Follow Up Question */}
                                                    {reason === r.id && r.followUp && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            className="ml-8 mt-3"
                                                        >
                                                            <label className="block text-xs text-zinc-400 mb-2">
                                                                {r.followUp.label}
                                                            </label>
                                                            {r.followUp.type === 'select' && r.followUp.options ? (
                                                                <select
                                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                                                                    value={followUpAnswer}
                                                                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                                                                >
                                                                    <option value="">Selecione uma opção...</option>
                                                                    {r.followUp.options.map(opt => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                                                                    placeholder="Digite aqui..."
                                                                    value={followUpAnswer}
                                                                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                                                                />
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Free Text */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm text-zinc-400">
                                                    Algum detalhe adicional? (Opcional)
                                                </label>
                                                <span className={`text-xs ${details.length > 1000 ? 'text-red-500' : 'text-zinc-600'}`}>
                                                    {details.length}/1000
                                                </span>
                                            </div>
                                            <textarea
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all resize-none h-24 text-sm"
                                                placeholder="Evite compartilhar dados pessoais sensíveis."
                                                value={details}
                                                onChange={(e) => setDetails(e.target.value)}
                                                maxLength={1000}
                                            />
                                        </div>

                                        {/* Contact Permission */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowContact}
                                                onChange={(e) => setAllowContact(e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500"
                                            />
                                            <span className="text-sm text-zinc-400">
                                                Você pode entrar em contato comigo para entender melhor.
                                            </span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-center py-4">
                                        <div className="bg-red-500/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
                                            <AlertTriangle className="text-red-500 w-8 h-8" />
                                        </div>
                                        <h4 className="text-lg font-bold text-white">
                                            Confirmar cancelamento
                                        </h4>
                                        <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                                            Ao cancelar, sua assinatura continuará ativa até o fim do período de cobrança. Depois disso, você perderá acesso aos recursos Premium.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3 rounded-b-xl">
                                <Button
                                    variant="outline"
                                    onClick={() => (step === 'confirm' ? setStep('survey') : handleClose())}
                                    disabled={loading}
                                >
                                    {step === 'confirm' ? 'Voltar' : 'Manter Assinatura'}
                                </Button>

                                {step === 'survey' ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setStep('confirm')}
                                        disabled={!isValid}
                                        className={!isValid ? 'opacity-50 cursor-not-allowed' : ''}
                                    >
                                        Continuar
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        className="bg-red-600 hover:bg-red-700 text-white border-none shadow-none"
                                        onClick={handleSubmit}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Cancelando...
                                            </>
                                        ) : (
                                            'Confirmar Cancelamento'
                                        )}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
