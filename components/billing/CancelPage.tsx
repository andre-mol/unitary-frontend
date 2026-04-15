import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { safeCapture } from '../../lib/analytics';

export function CancelPage() {
    const navigate = useNavigate();

    useEffect(() => {
        safeCapture('checkout_return', { status: 'canceled' });
    }, []);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                >
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
                            <XCircle className="w-16 h-16 text-red-500 relative z-10" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white">Pagamento cancelado</h1>
                        <p className="text-zinc-400">
                            Nenhuma cobrança foi realizada. Se você teve algum problema ou dúvida,
                            nossa equipe de suporte está à disposição.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => navigate('/dashboard/planos')}
                        >
                            Tentar novamente
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate('/dashboard')}
                        >
                            Voltar ao Dashboard
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
