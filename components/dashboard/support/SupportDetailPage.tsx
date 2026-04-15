
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Paperclip, Loader2, File as FileIcon, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { SupportService } from '../../../lib/services/SupportService';
import { useToast } from '../../ui/Toast';
import { compressImage } from '../../../lib/utils/imageUtils';
import { TicketAttachment } from '../../../infrastructure/database/SupabaseSupportRepository';
import { getSupabaseClient } from '../../../config/supabase';
import { DashboardLayout } from '../DashboardLayout';
// Removed Dialog import as it does not exist

export const SupportDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const supabase = getSupabaseClient();
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [closeReason, setCloseReason] = useState('resolved');
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Fetch Details
    const { data, isLoading, error } = useQuery({
        queryKey: ['ticket', id],
        queryFn: async () => {
            if (!id) throw new Error('No ID');
            return SupportService.getTicketDetails(id);
        },
        refetchInterval: 5000,
    });

    const { ticket, messages = [] } = data || {};

    // Mark Read & Scroll
    useEffect(() => {
        if (!ticket || !id) return;

        // Mark read logic
        const markRead = async () => {
            await SupportService.markAsRead(id);
            // Optimistic update locally if needed, or rely on refetch
        };
        markRead();

        if (messages) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.last_message_at, id]); // Re-run on new message


    // Real-time Subscription
    useEffect(() => {
        if (!id) return;
        const channel = supabase.channel(`ticket:${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${id}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, queryClient, supabase]);

    // Mutations
    const sendMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            const processedFiles = await Promise.all(files.map(async f => {
                try { return await compressImage(f); } catch { return f; }
            }));
            await SupportService.sendMessage(id, message, processedFiles);
        },
        onSuccess: () => {
            setMessage('');
            setFiles([]);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        },
        onError: (err: any) => addToast({ message: err.message || 'Erro ao enviar', type: 'error' }),
        onSettled: () => setIsSubmitting(false)
    });

    const closeMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            await SupportService.closeTicket(id, closeReason);
        },
        onSuccess: () => {
            setIsCloseModalOpen(false);
            addToast({ message: 'Ticket fechado com sucesso.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        },
        onError: (err: any) => addToast({ message: err.message || 'Erro ao fechar', type: 'error' })
    });

    const reopenMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            await SupportService.reopenTicket(id);
        },
        onSuccess: () => {
            addToast({ message: 'Ticket reaberto.', type: 'success' });
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        },
        onError: (err: any) => addToast({ message: err.message || 'Erro ao reabrir', type: 'error' })
    });

    const handleSend = () => {
        if ((!message.trim() && files.length === 0) || isSubmitting) return;
        setIsSubmitting(true);
        sendMutation.mutate();
    };

    // ... (keep handleFileSelect, removeFile, StatusBadge, AttachmentLink helpers) ...

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            // ... (keep existing validation logic)
            // Simplifying for brevity in replacement, but effectively same logic
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            const typeValidFiles = newFiles.filter(f => allowedTypes.includes(f.type));

            if (typeValidFiles.length !== newFiles.length) {
                addToast({ message: 'Apenas imagens JPG e PNG são permitidas.', type: 'error' });
            }

            const MAX_FILE_SIZE = 5 * 1024 * 1024;
            const sizeValidFiles = typeValidFiles.filter(f => f.size <= MAX_FILE_SIZE);
            if (sizeValidFiles.length !== typeValidFiles.length) {
                addToast({ message: 'Alguns arquivos excedem o limite de 5MB.', type: 'error' });
            }

            if (files.length + sizeValidFiles.length > 5) {
                addToast({ message: 'Máximo de 5 arquivos por mensagem.', type: 'warning' });
                const remaining = 5 - files.length;
                if (remaining > 0) {
                    setFiles(prev => [...prev, ...sizeValidFiles.slice(0, remaining)]);
                }
            } else {
                const currentTotal = files.reduce((acc, f) => acc + f.size, 0);
                const newTotal = sizeValidFiles.reduce((acc, f) => acc + f.size, 0);
                if (currentTotal + newTotal > 20 * 1024 * 1024) {
                    addToast({ message: 'O total de anexos não pode exceder 20MB.', type: 'error' });
                    return;
                }
                setFiles(prev => [...prev, ...sizeValidFiles]);
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: Record<string, string> = {
            new: 'bg-blue-500/10 text-blue-500',
            in_progress: 'bg-amber-500/10 text-amber-500',
            resolved: 'bg-green-500/10 text-green-500', // Changed Resolved to Green
            closed: 'bg-zinc-800 text-zinc-500',
            waiting_customer: 'bg-amber-500 text-black font-bold', // Highlight
        };
        const label = {
            new: 'Novo', in_progress: 'Em Andamento', resolved: 'Resolvido', closed: 'Fechado', waiting_customer: 'Aguardando Você'
        }[status] || status;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'text-zinc-400'}`}>{label}</span>;
    };

    const AttachmentLink = ({ att }: { att: TicketAttachment }) => {
        const handleDownload = async (e: React.MouseEvent) => {
            e.preventDefault();
            const url = await SupportService.getAttachmentUrl(att.storage_path);
            if (url) window.open(url, '_blank');
            else addToast({ message: 'Erro ao abrir anexo.', type: 'error' });
        };
        return (
            <button
                onClick={handleDownload}
                className="flex items-center gap-2 p-2 bg-zinc-950/50 rounded border border-zinc-800 hover:bg-zinc-800 transition-colors text-xs text-zinc-300 mt-2 max-w-full truncate"
            >
                <FileIcon size={14} />
                <span className="truncate">{att.file_name}</span>
            </button>
        );
    };

    if (isLoading) return <DashboardLayout title="Carregando..." subtitle="Buscando detalhes do ticket..."><div className="p-12 flex justify-center"><Loader2 className="animate-spin text-zinc-500" /></div></DashboardLayout>;
    if (error || !ticket) return <DashboardLayout title="Erro" subtitle="Ocorreu um problema ao carregar o ticket."><div className="p-12 text-center text-red-500">Erro ao carregar ticket.</div></DashboardLayout>;

    const hasNewReply = ticket.last_read_at_user &&
        ticket.last_message_at &&
        new Date(ticket.last_message_at) > new Date(ticket.last_read_at_user) &&
        ticket.last_message_by !== ticket.user_id;

    return (
        <DashboardLayout
            title="Detalhes do Ticket"
            subtitle="Acompanhe sua solicitação em tempo real."
        >
            {/* Modal de Fechamento (Inline Simples) */}
            {isCloseModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white">Fechar Ticket?</h3>
                        <p className="text-sm text-zinc-400">Tem certeza que deseja fechar este atendimento? Você poderá reabrí-lo se necessário.</p>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-500 uppercase">Motivo</label>
                            <select
                                value={closeReason}
                                onChange={(e) => setCloseReason(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:ring-amber-500 focus:border-amber-500"
                            >
                                <option value="resolved">Problema Resolvido</option>
                                <option value="duplicate">Duplicado</option>
                                <option value="gave_up">Desisti / Não preciso mais</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setIsCloseModalOpen(false)}
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => closeMutation.mutate()}
                                disabled={closeMutation.isPending}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
                            >
                                {closeMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                                Confirmar Fechamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col h-[calc(100vh-280px)] max-w-5xl mx-auto bg-black border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative">

                {/* Status Banner */}
                {ticket.status === 'closed' && (
                    <div className="bg-zinc-900/80 border-b border-zinc-800 p-2 text-center text-xs text-zinc-500 font-medium">
                        Este ticket foi fechado em {new Date(ticket.closed_at!).toLocaleDateString()}.
                    </div>
                )}
                {ticket.status === 'waiting_customer' && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 p-2 flex items-center justify-center gap-2 text-center text-xs text-amber-500 font-medium">
                        <AlertCircle size={14} />
                        Aguardando sua resposta
                    </div>
                )}

                {/* Internal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950/50 z-10">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard/suporte" className="text-zinc-500 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-xs flex items-center gap-2">
                                    {hasNewReply && (
                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Nova resposta" />
                                    )}
                                    {ticket.title}
                                </h1>
                                <StatusBadge status={ticket.status} />
                            </div>
                            <p className="text-[10px] text-zinc-500 font-mono">ID: {ticket.id}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {ticket.status === 'closed' ? (
                            <button
                                onClick={() => reopenMutation.mutate()}
                                disabled={reopenMutation.isPending}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
                            >
                                {reopenMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                Reabrir
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsCloseModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 text-xs font-medium rounded-lg border border-zinc-800 hover:border-red-900/50 transition-colors"
                            >
                                <CheckCircle size={14} />
                                Fechar
                            </button>
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-zinc-950/20">
                    {messages.length === 0 && (
                        <div className="text-center text-zinc-500 my-8 italic">O ticket foi criado. Aguardando primeira resposta.</div>
                    )}

                    {messages.map((msg) => {
                        const isMe = msg.user_id === ticket.user_id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${isMe
                                    ? 'bg-amber-500/10 text-amber-50 rounded-tr-sm border border-amber-500/20'
                                    : 'bg-zinc-800 text-zinc-100 rounded-tl-sm border border-zinc-700'
                                    }`}>
                                    <div className="text-sm sm:text-base whitespace-pre-wrap font-sans">{msg.body}</div>

                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {msg.attachments.map(att => (
                                                <AttachmentLink key={att.id} att={att} />
                                            ))}
                                        </div>
                                    )}

                                    <div className={`text-[10px] mt-2 ${isMe ? 'text-amber-500/60' : 'text-zinc-500'}`}>
                                        {isMe ? 'Você' : 'Suporte'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                {/* Composer */}
                <div className="p-4 bg-zinc-900/50 border-t border-zinc-900">
                    {ticket.status === 'closed' ? (
                        <div className="text-center text-zinc-500 p-2 bg-zinc-900 rounded-lg text-sm border border-zinc-800 font-medium">
                            Este ticket está fechado e não aceita mais mensagens.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {files.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="relative group bg-zinc-800 p-2 rounded border border-zinc-700 min-w-[100px] w-[100px]">
                                            <div className="text-xs text-zinc-300 truncate">{f.name}</div>
                                            <div className="text-[10px] text-zinc-500">{(f.size / 1024).toFixed(0)}KB</div>
                                            <button
                                                onClick={() => removeFile(i)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800 focus-within:border-amber-500/50 transition-colors shadow-inner">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-zinc-500 hover:text-amber-500 transition-colors self-end"
                                    title="Anexar imagem"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="file"
                                    hidden
                                    ref={fileInputRef}
                                    accept="image/png, image/jpeg"
                                    multiple
                                    onChange={handleFileSelect}
                                />
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-600 resize-none max-h-32 py-2 text-sm sm:text-base"
                                    rows={1}
                                    maxLength={2000}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={(!message.trim() && files.length === 0) || isSubmitting}
                                    className="p-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end shadow-lg"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                </button>
                            </div>
                            <div className="text-[10px] text-zinc-600 px-1 font-medium">
                                Use Enter para enviar. Shift+Enter para quebra de linha.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};
