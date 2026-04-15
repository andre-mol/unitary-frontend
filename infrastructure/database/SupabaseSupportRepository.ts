
import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import { handleSupabaseError } from '../../utils/supabaseErrors';

export interface Ticket {
    id: string;
    title: string;
    user_id: string;
    category: string;
    status: 'new' | 'triage' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
    priority_level: 'low' | 'normal' | 'high' | 'urgent';
    created_at: string;
    updated_at: string;
    last_message_at: string;
    last_message_by?: string;
    // New fields
    closed_at?: string;
    closed_reason?: string;
    reopened_at?: string;
    last_read_at_user?: string;
    last_read_at_admin?: string;
}

export interface TicketMessage {
    id: string;
    body: string;
    is_internal: boolean; // Should always be false for user fetch, but typed for completeness
    user_id: string;
    created_at: string;
    attachments?: TicketAttachment[];
}

export interface TicketAttachment {
    id: string;
    file_name: string;
    size_bytes: number;
    mime_type: string;
    storage_path: string;
}

export class SupabaseSupportRepository {
    private get supabase() {
        return getSupabaseClient();
    }

    /**
     * Create a new support ticket via RPC (enforces rate limits)
     */
    async createTicket(data: {
        title: string;
        category: string;
        priority: string;
        body: string;
    }): Promise<string> {
        try {
            await getRequiredUserId(); // Ensure auth

            const { data: ticketId, error } = await this.supabase.rpc('create_support_ticket', {
                p_title: data.title,
                p_category: data.category,
                p_priority: data.priority,
                p_body: data.body,
            });

            if (error) throw error;
            return ticketId;
        } catch (error) {
            handleSupabaseError('Erro ao criar ticket', error);
            throw error;
        }
    }

    /**
     * Send a message to an existing ticket via RPC (enforces rate limits)
     */
    async sendMessage(ticketId: string, body: string, attachments: any[] = []): Promise<string> {
        try {
            await getRequiredUserId();

            const { data: messageId, error } = await this.supabase.rpc('send_support_message', {
                p_ticket_id: ticketId,
                p_body: body,
                p_attachments: attachments
            });

            if (error) throw error;
            return messageId;
        } catch (error) {
            handleSupabaseError('Erro ao enviar mensagem', error);
            throw error;
        }
    }

    /**
     * List tickets for the current user
     */
    async getMyTickets(): Promise<Ticket[]> {
        try {
            const userId = await getRequiredUserId();

            const { data, error } = await this.supabase
                .from('support_tickets')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data as Ticket[];
        } catch (error) {
            handleSupabaseError('Erro ao buscar tickets', error);
            throw error;
        }
    }

    /**
     * Get ticket details with messages and attachments
     */
    async getTicketDetails(ticketId: string): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
        try {
            const userId = await getRequiredUserId();

            // Parallel fetch: Ticket + Messages
            const [ticketResult, messagesResult] = await Promise.all([
                this.supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
                this.supabase
                    .from('support_messages')
                    .select(`
            *,
            support_attachments (*)
          `)
                    .eq('ticket_id', ticketId)
                    .order('created_at', { ascending: true }),
            ]);

            if (ticketResult.error) throw ticketResult.error;
            if (messagesResult.error) throw messagesResult.error;

            // Transform messages to map attachments cleanly
            const messages = messagesResult.data.map((msg: any) => ({
                ...msg,
                attachments: msg.support_attachments,
            }));

            return {
                ticket: ticketResult.data as Ticket,
                messages: messages as TicketMessage[],
            };
        } catch (error) {
            handleSupabaseError('Erro ao buscar detalhes do ticket', error);
            throw error;
        }
    }

    /**
     * Check if user can upload (RPC check)
     */
    async checkUploadLimit(): Promise<void> {
        try {
            await getRequiredUserId();
            const { error } = await this.supabase.rpc('check_support_attachment_limit');
            if (error) throw error;
        } catch (error) {
            handleSupabaseError('Limite de upload excedido', error);
            throw error;
        }
    }

    /**
     * Record upload success (RPC)
     */
    async recordUpload(): Promise<void> {
        try {
            await this.supabase.rpc('record_support_attachment_upload');
        } catch (error) {
            // Non-blocking
            console.warn('Failed to record upload stats', error);
        }
    }

    /**
     * Get signed upload URLs for multiple files
     */
    async signUploadUrls(ticketId: string, files: { fileName: string, mimeType: string, size: number }[]): Promise<{
        attachmentId: string;
        uploadUrl: string;
        storagePath: string;
        token: string;
    }[]> {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch(`/api/support/attachments/sign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ ticketId, files })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to sign upload URLs');
            }

            const { signedUrls } = await response.json();
            return signedUrls;
        } catch (error) {
            handleSupabaseError('Erro ao autorizar upload', error);
            throw error;
        }
    }

    /**
     * Upload a file directly to a signed URL
     */
    async uploadToSignedUrl(uploadUrl: string, file: Blob, mimeType: string): Promise<void> {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': mimeType }
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }
    }

    /**
     * Legacy upload method - replaced by signed flow
     */
    async uploadAttachment(
        ticketId: string,
        messageId: string,
        file: File
    ): Promise<void> {
        console.warn('SupabaseSupportRepository.uploadAttachment is deprecated. Use signUploadUrls + uploadToSignedUrl');
        // Redacted original implementation to encourage migration
    }

    /**
     * Get signed URL for attachment
     */
    async getAttachmentUrl(path: string): Promise<string | null> {
        try {
            const { data } = await this.supabase.storage
                .from('support_attachments')
                .createSignedUrl(path, 3600); // 1 hour

            return data?.signedUrl || null;
        } catch (error) {
            console.warn('Error getting signed url', error);
            return null;
        }
    }

    /**
     * Close a ticket via RPC
     */
    async closeTicket(ticketId: string, reason: string): Promise<void> {
        try {
            await getRequiredUserId();
            const { error } = await this.supabase.rpc('close_support_ticket', {
                p_ticket_id: ticketId,
                p_reason: reason
            });
            if (error) throw error;
        } catch (error) {
            handleSupabaseError('Erro ao fechar ticket', error);
            throw error;
        }
    }

    /**
     * Reopen a ticket via RPC
     */
    async reopenTicket(ticketId: string): Promise<void> {
        try {
            await getRequiredUserId();
            const { error } = await this.supabase.rpc('reopen_support_ticket', {
                p_ticket_id: ticketId
            });
            if (error) throw error;
        } catch (error) {
            handleSupabaseError('Erro ao reabrir ticket', error);
            throw error;
        }
    }

    /**
     * Mark ticket as read by user
     */
    async markAsRead(ticketId: string): Promise<void> {
        try {
            await getRequiredUserId();
            const { error } = await this.supabase.rpc('mark_ticket_read_user', {
                p_ticket_id: ticketId
            });
            if (error) throw error;
        } catch (error) {
            console.warn('Failed to mark read', error);
        }
    }
}
