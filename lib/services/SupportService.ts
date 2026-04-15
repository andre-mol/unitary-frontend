
import { SupabaseSupportRepository, Ticket, TicketMessage } from '../../infrastructure/database/SupabaseSupportRepository';

const repository = new SupabaseSupportRepository();

export const SupportService = {
    createTicket: async (data: {
        title: string;
        category: string;
        priority: string;
        body: string;
    }) => {
        return repository.createTicket({
            title: data.title,
            category: data.category,
            priority: data.priority,
            body: data.body
        });
    },

    sendMessage: async (ticketId: string, body: string, attachments?: File[]) => {
        let attachmentMetadata: any[] = [];

        // 1. Process Attachments if any
        if (attachments && attachments.length > 0) {
            // sign
            const signedUrls = await repository.signUploadUrls(ticketId, attachments.map(f => ({
                fileName: f.name,
                mimeType: f.type,
                size: f.size
            })));

            // upload
            await Promise.all(attachments.map(async (file, idx) => {
                const s = signedUrls[idx];
                await repository.uploadToSignedUrl(s.uploadUrl, file, file.type);
                attachmentMetadata.push({
                    storage_path: s.storagePath,
                    file_name: file.name,
                    mime_type: file.type,
                    size_bytes: file.size
                });
            }));
        }

        // 2. Send Message with Metadata
        return repository.sendMessage(ticketId, body, attachmentMetadata);
    },

    getMyTickets: async () => {
        return repository.getMyTickets();
    },

    getTicketDetails: async (ticketId: string) => {
        return repository.getTicketDetails(ticketId);
    },

    getAttachmentUrl: async (path: string) => {
        return repository.getAttachmentUrl(path);
    },

    closeTicket: async (ticketId: string, reason: string) => {
        return repository.closeTicket(ticketId, reason);
    },

    reopenTicket: async (ticketId: string) => {
        return repository.reopenTicket(ticketId);
    },

    markAsRead: async (ticketId: string) => {
        return repository.markAsRead(ticketId);
    }
};
