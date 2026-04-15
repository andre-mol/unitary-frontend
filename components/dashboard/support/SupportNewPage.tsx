
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { SupportService } from '../../../lib/services/SupportService';
import { useToast } from '../../ui/Toast';
import { DashboardLayout } from '../DashboardLayout';

const schema = z.object({
    title: z.string().min(5, 'O título deve ter pelo menos 5 caracteres').max(100, 'Máximo 100 caracteres'),
    category: z.enum(['billing', 'technical', 'feature_request', 'other']),
    body: z.string().min(10, 'Descreva seu problema com mais detalhes (mínimo 10 caracteres)'),
});

type FormValues = z.infer<typeof schema>;

export const SupportNewPage: React.FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true);
        try {
            const ticketId = await SupportService.createTicket({
                title: data.title,
                category: data.category,
                priority: 'normal',
                body: data.body,
            });

            addToast({ message: 'Ticket criado com sucesso!', type: 'success' });
            navigate(`/dashboard/suporte/${ticketId}`);
        } catch (error: any) {
            console.error(error);
            if (error?.message?.includes('Rate limit')) {
                addToast({ message: 'Limite de tickets atingido. Aguarde um pouco.', type: 'error' });
            } else {
                addToast({ message: 'Erro ao criar ticket. Tente novamente.', type: 'error' });
            }
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout
            title="Novo Ticket"
            subtitle="Preencha os dados abaixo para iniciar um atendimento."
        >
            <div className="space-y-8">
                <Link to="/dashboard/suporte" className="flex items-center text-zinc-400 hover:text-white transition-colors gap-2 text-sm font-medium w-fit">
                    <ArrowLeft size={16} /> Voltar para lista
                </Link>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-xl shadow-lg">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Categoria</label>
                        <select
                            {...register('category')}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        >
                            <option value="">Selecione...</option>
                            <option value="technical">Suporte Técnico</option>
                            <option value="billing">Financeiro / Assinatura</option>
                            <option value="feature_request">Sugestão de Melhoria</option>
                            <option value="other">Outros assuntos</option>
                        </select>
                        {errors.category && <p className="text-red-400 text-xs">{errors.category.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Resumo do Problema (Título)</label>
                        <input
                            {...register('title')}
                            placeholder="Ex: Não consigo gerar relatório de ações"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-600"
                        />
                        {errors.title && <p className="text-red-400 text-xs">{errors.title.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Descrição Detalhada</label>
                        <textarea
                            {...register('body')}
                            rows={6}
                            placeholder="Descreva o que aconteceu, passos para reproduzir, etc..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-600 resize-none"
                        />
                        {errors.body && <p className="text-red-400 text-xs">{errors.body.message}</p>}
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard/suporte')}
                            className="mr-4 px-6 py-2 text-zinc-400 hover:text-white transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-6 py-2 rounded-lg transition-all"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            Criar Ticket
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};
