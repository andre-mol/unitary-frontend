
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { SupportService } from '../../../lib/services/SupportService';
import { Ticket } from '../../../infrastructure/database/SupabaseSupportRepository';
import { DashboardLayout } from '../DashboardLayout';

// Badge map
const statusMap: Record<string, { label: string; color: string }> = {
    new: { label: 'Novo', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    triage: { label: 'Em Análise', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    in_progress: { label: 'Em Andamento', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    waiting_customer: { label: 'Aguardando Você', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
    resolved: { label: 'Resolvido', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    closed: { label: 'Fechado', color: 'bg-zinc-800 text-zinc-500 border-zinc-800' },
};

export const SupportListPage: React.FC = () => {
    const navigate = useNavigate();

    const { data: tickets = [], isLoading, error } = useQuery({
        queryKey: ['my-tickets'],
        queryFn: () => SupportService.getMyTickets(),
    });

    return (
        <DashboardLayout
            title="Suporte"
            subtitle="Gerencie seus chamados e tire dúvidas com nossa equipe."
        >
            <div className="space-y-8">
                <div className="flex justify-end">
                    <Link
                        to="/dashboard/suporte/novo"
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Novo Ticket
                    </Link>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    {isLoading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-zinc-500" size={32} />
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center text-red-400">
                            Erro ao carregar tickets. Tente recarregar a página.
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare size={32} className="text-zinc-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Nenhum ticket encontrado</h3>
                            <p className="text-zinc-400 max-w-sm mx-auto mb-6">
                                Você ainda não abriu nenhum chamado de suporte. Se precisar de ajuda, estamos à disposição.
                            </p>
                            <Link
                                to="/dashboard/suporte/novo"
                                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-zinc-700"
                            >
                                <Plus size={18} />
                                Abrir Primeiro Ticket
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Assunto</th>
                                        <th className="px-6 py-4">Categoria</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Última Atualização</th>
                                        <th className="px-6 py-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {tickets.map((ticket) => {
                                        const status = statusMap[ticket.status] || { label: ticket.status, color: 'bg-zinc-800 text-zinc-400' };
                                        const date = new Date(ticket.last_message_at || ticket.updated_at);

                                        return (
                                            <tr
                                                key={ticket.id}
                                                className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/dashboard/suporte/${ticket.id}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{ticket.title}</div>
                                                    <div className="text-xs text-zinc-500 md:hidden mt-1">{new Date(ticket.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4 text-zinc-300 text-sm capitalize">
                                                    {ticket.category.replace('_', ' ')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-zinc-400 text-sm">
                                                    {date.toLocaleDateString()} <span className="text-zinc-600">às</span> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-zinc-500 hover:text-white transition-colors">
                                                        <ArrowRight size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};
