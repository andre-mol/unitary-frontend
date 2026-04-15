/**
 * ============================================================
 * SUPABASE NOTIFICATIONS REPOSITORY - IMPLEMENTATION
 * ============================================================
 * 
 * Full implementation for fetching and managing user notifications.
 * 
 * FEATURES:
 * - Get combined notifications (broadcast + system) for current user
 * - Mark broadcast notifications as read
 * - Mark system notifications as read
 * 
 * MAPPING:
 * - Database uses snake_case (e.g., user_id, published_at)
 * - App uses camelCase (e.g., userId, publishedAt)
 * 
 * AIDEV-NOTE: Security boundary. All queries use authenticated client.
 * RLS enforces isolation: broadcast filtered by plan tier, system by user_id.
 * Broadcast read marks are idempotent (ON CONFLICT DO NOTHING).
 * Never bypass RLS or expose notification data across users.
 * 
 * ============================================================
 */

import { getSupabaseClient } from '../../config/supabase';
import { getRequiredUserId } from '../../config/supabaseAuth';
import { handleSupabaseError } from '../../utils/supabaseErrors';

// ============================================================
// NORMALIZED NOTIFICATION TYPE
// ============================================================

export interface NotificationItem {
  source: 'broadcast' | 'system';
  id: string;
  slug?: string;
  title: string;
  summary: string;
  contentMd?: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  date: Date;
  showReadMore: boolean;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isRead: boolean;
}

// ============================================================
// DATABASE ROW TYPES (snake_case)
// ============================================================

interface DbBroadcastNotification {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content_md: string | null;
  show_read_more: boolean;
  cta_label: string | null;
  cta_url: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  min_plan_tier: number;
  published_at: string | null;
  expires_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface DbSystemNotification {
  id: string;
  user_id: string;
  key: string;
  title: string;
  summary: string;
  content_md: string | null;
  show_read_more: boolean;
  cta_label: string | null;
  cta_url: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

interface DbReadMark {
  user_id: string;
  notification_id: string;
  read_at: string;
}

// ============================================================
// MAPPERS: Database -> Normalized
// ============================================================

function mapBroadcastToItem(
  notification: DbBroadcastNotification,
  isRead: boolean
): NotificationItem {
  return {
    source: 'broadcast',
    id: notification.id,
    slug: notification.slug,
    title: notification.title,
    summary: notification.summary,
    contentMd: notification.content_md,
    severity: notification.severity,
    date: new Date(notification.published_at || notification.created_at),
    showReadMore: notification.show_read_more,
    ctaLabel: notification.cta_label,
    ctaUrl: notification.cta_url,
    isRead,
  };
}

function mapSystemToItem(notification: DbSystemNotification): NotificationItem {
  return {
    source: 'system',
    id: notification.id,
    title: notification.title,
    summary: notification.summary,
    contentMd: notification.content_md,
    severity: notification.severity,
    date: new Date(notification.created_at),
    showReadMore: notification.show_read_more,
    ctaLabel: notification.cta_label,
    ctaUrl: notification.cta_url,
    isRead: notification.read_at !== null,
  };
}

// ============================================================
// REPOSITORY IMPLEMENTATION
// ============================================================

export class SupabaseNotificationsRepository {
  private get supabase() {
    return getSupabaseClient();
  }

  /**
   * Get all notifications for the current user (broadcast + system)
   * 
   * AIDEV-NOTE: Security boundary. RLS policies ensure:
   * - Broadcast: only published, not expired, matching plan tier
   * - System: only for auth.uid(), not dismissed
   * - Read marks: only for auth.uid()
   */
  async getMyNotifications(limit: number = 20): Promise<NotificationItem[]> {
    try {
      const userId = await getRequiredUserId();
      const now = new Date().toISOString();

      // Fetch broadcast notifications (RLS handles plan tier filtering)
      const { data: broadcastData, error: broadcastError } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('is_published', true)
        .not('published_at', 'is', null)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (broadcastError) {
        handleSupabaseError('Erro ao buscar notificações broadcast', broadcastError);
      }

      // Fetch system notifications for this user
      const { data: systemData, error: systemError } = await this.supabase
        .from('user_system_notifications')
        .select('*')
        .eq('user_id', userId)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (systemError) {
        handleSupabaseError('Erro ao buscar notificações do sistema', systemError);
      }

      // Fetch read marks for broadcast notifications
      const broadcastIds = (broadcastData || []).map((n) => n.id);
      let readMarks: Set<string> = new Set();

      if (broadcastIds.length > 0) {
        const { data: readsData, error: readsError } = await this.supabase
          .from('user_notification_reads')
          .select('notification_id')
          .eq('user_id', userId)
          .in('notification_id', broadcastIds);

        if (readsError) {
          handleSupabaseError('Erro ao buscar marcações de leitura', readsError);
        }

        readMarks = new Set((readsData || []).map((r) => r.notification_id));
      }

      // Map broadcast notifications
      const broadcastItems: NotificationItem[] = (broadcastData || []).map((n) =>
        mapBroadcastToItem(n as DbBroadcastNotification, readMarks.has(n.id))
      );

      // Map system notifications
      const systemItems: NotificationItem[] = (systemData || []).map((n) =>
        mapSystemToItem(n as DbSystemNotification)
      );

      // Merge and sort by date (newest first)
      const allItems = [...broadcastItems, ...systemItems].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      // Limit to requested amount
      return allItems.slice(0, limit);
    } catch (error) {
      // On any error, return empty array
      console.warn('[SupabaseNotificationsRepository] Erro ao buscar notificações:', error);
      return [];
    }
  }

  /**
   * Mark a broadcast notification as read
   * 
   * AIDEV-NOTE: Idempotent operation. Uses ON CONFLICT DO NOTHING
   * to prevent duplicate read marks. RLS ensures user can only
   * mark their own reads.
   */
  async markBroadcastAsRead(notificationId: string): Promise<void> {
    try {
      const userId = await getRequiredUserId();

      const { error } = await this.supabase
        .from('user_notification_reads')
        .insert({
          user_id: userId,
          notification_id: notificationId,
          read_at: new Date().toISOString(),
        });

      if (error) {
        // If it's a unique constraint violation, that's ok (idempotent)
        if (error.code === '23505') {
          return;
        }
        handleSupabaseError('Erro ao marcar notificação como lida', error);
      }
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao marcar broadcast como lida:', error);
      throw error;
    }
  }

  /**
   * Mark a system notification as read
   * 
   * AIDEV-NOTE: Security boundary. RLS ensures user can only update
   * their own system notifications (user_id = auth.uid()).
   */
  async markSystemAsRead(notificationId: string): Promise<void> {
    try {
      const userId = await getRequiredUserId();

      const { error } = await this.supabase
        .from('user_system_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError('Erro ao marcar notificação do sistema como lida', error);
      }
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao marcar system como lida:', error);
      throw error;
    }
  }

  /**
   * Get a broadcast notification by slug
   * Used for detail page
   * 
   * AIDEV-NOTE: RLS ensures user can only see published notifications
   * matching their plan tier.
   */
  async getBroadcastBySlug(slug: string): Promise<NotificationItem | null> {
    try {
      const userId = await getRequiredUserId();
      const now = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .not('published_at', 'is', null)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError('Erro ao buscar notificação', error);
      }

      if (!data) {
        return null;
      }

      // Check if read
      const { data: readData } = await this.supabase
        .from('user_notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .eq('notification_id', data.id)
        .single();

      const isRead = readData !== null;

      return mapBroadcastToItem(data as DbBroadcastNotification, isRead);
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao buscar notificação por slug:', error);
      return null;
    }
  }

  /**
   * Upsert a system notification for the current user
   * 
   * AIDEV-NOTE: Security boundary. RLS ensures user can only upsert their own
   * notifications (user_id = auth.uid()). Uses ON CONFLICT for idempotent upsert.
   * If dismissed=true, sets dismissed_at; if false, clears it to reactivate.
   */
  async upsertSystemNotification(
    key: string,
    notification: {
      title: string;
      summary: string;
      contentMd?: string | null;
      severity: 'info' | 'success' | 'warning' | 'critical';
      showReadMore: boolean;
      ctaLabel?: string | null;
      ctaUrl?: string | null;
      metadata: Record<string, unknown>;
      dismissed?: boolean;
    }
  ): Promise<void> {
    try {
      const userId = await getRequiredUserId();
      const now = new Date().toISOString();

      const notificationData = {
        user_id: userId,
        key,
        title: notification.title,
        summary: notification.summary,
        content_md: notification.contentMd || null,
        show_read_more: notification.showReadMore,
        cta_label: notification.ctaLabel || null,
        cta_url: notification.ctaUrl || null,
        severity: notification.severity,
        metadata: notification.metadata,
        updated_at: now,
        dismissed_at: notification.dismissed ? now : null,
      };

      const { error } = await this.supabase
        .from('user_system_notifications')
        .upsert(notificationData, {
          onConflict: 'user_id,key',
        });

      if (error) {
        handleSupabaseError('Erro ao criar/atualizar notificação do sistema', error);
      }
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao upsert system notification:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read (bulk operation)
   * 
   * AIDEV-NOTE: Security boundary. RLS ensures user can only mark their own notifications.
   * Broadcast: bulk insert with ON CONFLICT DO NOTHING for idempotency.
   * System: bulk update for all unread, non-dismissed system notifications.
   */
  async markAllAsRead(broadcastIds: string[]): Promise<void> {
    try {
      const userId = await getRequiredUserId();
      const now = new Date().toISOString();

      // Mark broadcast notifications as read (bulk insert)
      if (broadcastIds.length > 0) {
        const readMarks = broadcastIds.map((notificationId) => ({
          user_id: userId,
          notification_id: notificationId,
          read_at: now,
        }));

        const { error: broadcastError } = await this.supabase
          .from('user_notification_reads')
          .upsert(readMarks, {
            onConflict: 'user_id,notification_id',
          });

        if (broadcastError) {
          // If it's a unique constraint violation, that's ok (idempotent)
          if (broadcastError.code !== '23505') {
            handleSupabaseError('Erro ao marcar notificações broadcast como lidas', broadcastError);
          }
        }
      }

      // Mark all system notifications as read (bulk update)
      const { error: systemError } = await this.supabase
        .from('user_system_notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null)
        .is('dismissed_at', null);

      if (systemError) {
        handleSupabaseError('Erro ao marcar notificações do sistema como lidas', systemError);
      }
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao marcar todas como lidas:', error);
      throw error;
    }
  }

  /**
   * Dismiss a system notification
   * 
   * AIDEV-NOTE: Security boundary. RLS ensures user can only dismiss their own
   * system notifications (user_id = auth.uid()).
   */
  async dismissSystemNotification(notificationId: string): Promise<void> {
    try {
      const userId = await getRequiredUserId();

      const { error } = await this.supabase
        .from('user_system_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError('Erro ao deletar notificação do sistema', error);
      }
    } catch (error) {
      console.warn('[SupabaseNotificationsRepository] Erro ao deletar system notification:', error);
      throw error;
    }
  }
}
