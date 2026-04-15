import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../../config/supabase';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../../lib/queryKeys';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead, dismissSystemNotification } from '../../lib/queries/notifications';
import { NotificationItem } from './NotificationItem';
import type { NotificationItem as NotificationItemType } from '../../infrastructure/database/SupabaseNotificationsRepository';

export const NotificationsDropdown: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldLoadNotifications, setShouldLoadNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id || authLoading) return;

    const timer = window.setTimeout(() => {
      setShouldLoadNotifications(true);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [user?.id, authLoading]);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications(user?.id, 20),
    queryFn: () => fetchNotifications(20),
    enabled: !!user && !authLoading && shouldLoadNotifications,
    staleTime: 30000, // 30 seconds
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: ({ source, id }: { source: 'broadcast' | 'system'; id: string }) =>
      markNotificationAsRead(source, id),
    onSuccess: () => {
      // Invalidate notifications query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: (broadcastIds: string[]) => markAllNotificationsAsRead(broadcastIds),
    onSuccess: () => {
      // Invalidate notifications query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
    },
  });

  // Dismiss system notification mutation
  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) => dismissSystemNotification(notificationId),
    onSuccess: () => {
      // Invalidate notifications query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
    },
  });

  // Subscribe to real-time changes
  useEffect(() => {
    if (!user?.id || authLoading || !shouldLoadNotifications) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_system_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate notifications query to refetch
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user.id) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, authLoading, queryClient, shouldLoadNotifications]);

  // Generate system notifications on first dropdown open

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Get unread broadcast notification IDs for bulk operation
  const unreadBroadcastIds = notifications
    .filter((n) => !n.isRead && n.source === 'broadcast')
    .map((n) => n.id);

  // Handle mark as read
  const handleMarkAsRead = (notification: NotificationItemType) => {
    if (notification.isRead) {
      return;
    }

    markAsReadMutation.mutate({
      source: notification.source,
      id: notification.id,
    });
  };

  // Handle mark all as read
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      return;
    }

    markAllAsReadMutation.mutate(unreadBroadcastIds);
  };

  // Handle dismiss
  const handleDismiss = (notificationId: string) => {
    dismissMutation.mutate(notificationId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setShouldLoadNotifications(true);
          setIsOpen(!isOpen);
        }}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-zinc-950 flex items-center justify-center">
            <span className="text-[10px] font-bold text-black">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50 max-h-[500px] flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Notificações</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
                    </p>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {markAllAsReadMutation.isPending ? 'Marcando...' : 'Marcar todas'}
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-zinc-400">Carregando...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-400">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={`${notification.source}-${notification.id}`}
                    notification={notification}
                    onMarkAsRead={() => handleMarkAsRead(notification)}
                    onDismiss={
                      notification.source === 'system'
                        ? () => handleDismiss(notification.id)
                        : undefined
                    }
                    isMarkingAsRead={
                      markAsReadMutation.isPending &&
                      markAsReadMutation.variables?.id === notification.id
                    }
                    isDismissing={
                      dismissMutation.isPending &&
                      dismissMutation.variables === notification.id
                    }
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
