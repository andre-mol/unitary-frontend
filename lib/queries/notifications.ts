import { SupabaseNotificationsRepository, type NotificationItem } from '../../infrastructure/database/SupabaseNotificationsRepository';

const repository = new SupabaseNotificationsRepository();

/**
 * Fetch notifications for the current user
 * Combines broadcast and system notifications, sorted by newest first
 */
export async function fetchNotifications(limit: number = 20): Promise<NotificationItem[]> {
  return repository.getMyNotifications(limit);
}

/**
 * Mark a notification as read
 * Handles both broadcast and system notifications
 */
export async function markNotificationAsRead(
  source: 'broadcast' | 'system',
  id: string
): Promise<void> {
  if (source === 'broadcast') {
    return repository.markBroadcastAsRead(id);
  } else {
    return repository.markSystemAsRead(id);
  }
}

/**
 * Get a broadcast notification by slug
 * Used for detail page
 */
export async function fetchNotificationBySlug(slug: string): Promise<NotificationItem | null> {
  return repository.getBroadcastBySlug(slug);
}

/**
 * Mark all notifications as read (bulk operation)
 * Broadcast: bulk insert read marks
 * System: bulk update read_at for all unread, non-dismissed
 */
export async function markAllNotificationsAsRead(broadcastIds: string[]): Promise<void> {
  return repository.markAllAsRead(broadcastIds);
}

/**
 * Dismiss a system notification
 * Sets dismissed_at=now() for the notification
 */
export async function dismissSystemNotification(notificationId: string): Promise<void> {
  return repository.dismissSystemNotification(notificationId);
}
