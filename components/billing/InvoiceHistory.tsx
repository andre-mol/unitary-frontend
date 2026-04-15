
import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { authService } from '../../lib/authService';

interface Invoice {
    id: string;
    amount_paid: number;
    amount_due: number;
    status: string;
    created: number;
    invoice_pdf: string | null;
    hosted_invoice_url: string | null;
    number: string | null;
}

interface InvoiceHistoryProps {
    className?: string;
}

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000';

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({ className }) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                setLoading(true);
                const { session } = await authService.getSession();
                const token = session?.accessToken;

                if (!token) {
                    throw new Error('Usuário não autenticado');
                }

                const response = await fetch(`${ADMIN_API_URL}/api/stripe/invoices`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Falha ao carregar faturas');
                }

                const data = await response.json();

                if (data.success) {
                    setInvoices(data.invoices);
                } else {
                    throw new Error(data.error || 'Erro desconhecido');
                }
            } catch (err) {
                console.error('Invoice fetch error:', err);
                setError('Não foi possível carregar o histórico de faturas.');
            } finally {
                setLoading(false);
            }
        };

        fetchInvoices();
    }, []);

    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(timestamp * 1000));
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(amount / 100);
    };

    const statusMap: Record<string, { label: string; color: string }> = {
        paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        open: { label: 'Aberto', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        void: { label: 'Cancelado', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
        uncollectible: { label: 'Não cobrável', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
        draft: { label: 'Rascunho', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' }
    };

    if (loading) {
        return (
            <div className={`p-8 flex justify-center items-center ${className}`}>
                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 ${className}`}>
                <AlertCircle className="text-red-400" size={18} />
                <p className="text-sm text-red-300">{error}</p>
            </div>
        );
    }

    if (invoices.length === 0) {
        return (
            <div className={`text-center py-8 ${className}`}>
                <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">Nenhuma fatura encontrada.</p>
            </div>
        );
    }

    return (
        <div className={`overflow-hidden rounded-xl border border-zinc-800 ${className}`}>
            <div className="overflow-x-auto max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <table className="w-full text-sm text-left table-auto">
                    <thead className="bg-zinc-900/80 backdrop-blur-sm text-zinc-400 font-medium border-b border-zinc-800 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Valor</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Fatura</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {invoices.map((invoice) => {
                            const status = statusMap[invoice.status] || { label: invoice.status, color: 'bg-zinc-800 text-zinc-400' };

                            return (
                                <tr key={invoice.id} className="hover:bg-zinc-900/40 transition-colors">
                                    <td className="px-4 py-3 text-white">
                                        {formatDate(invoice.created)}
                                    </td>
                                    <td className="px-4 py-3 text-white font-medium">
                                        {formatCurrency(invoice.amount_paid)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {invoice.invoice_pdf ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 border-0 hover:bg-zinc-800"
                                                onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                                                title="Baixar PDF"
                                            >
                                                <Download size={16} className="text-zinc-400 hover:text-white" />
                                            </Button>
                                        ) : (
                                            <span className="text-zinc-600">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
