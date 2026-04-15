import React, { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../../lib/queryKeys';
import { fetchNotificationBySlug, markNotificationAsRead } from '../../lib/queries/notifications';
import { SafeMarkdown } from './SafeMarkdown';

const severityConfig = {
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NotificationDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const hasMarkedAsReadRef = useRef<string | null>(null);

  // Fetch notification
  const { data: notification, isLoading, error } = useQuery({
    queryKey: queryKeys.notificationBySlug(slug || ''),
    queryFn: () => fetchNotificationBySlug(slug || ''),
    enabled: !!slug && !!user && !authLoading,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: () => {
      if (!notification) {
        throw new Error('Notification not found');
      }
      return markNotificationAsRead(notification.source, notification.id);
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationBySlug(slug || '') });
    },
  });

  // Auto-mark as read when viewing (if not read)
  // AIDEV-NOTE: Security boundary. Only marks broadcast notifications as read.
  // Errors are handled silently to avoid leaking information.
  useEffect(() => {
    if (
      notification &&
      !notification.isRead &&
      notification.source === 'broadcast' &&
      hasMarkedAsReadRef.current !== notification.id &&
      !markAsReadMutation.isPending
    ) {
      hasMarkedAsReadRef.current = notification.id;
      markAsReadMutation.mutate(undefined, {
        onError: () => {
          // Silently handle errors - don't leak details
          // Reset ref on error so it can retry if needed
          hasMarkedAsReadRef.current = null;
        },
      });
    }
  }, [notification?.id, notification?.isRead, notification?.source, markAsReadMutation]);

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-900 rounded w-32" />
            <div className="h-64 bg-zinc-900 rounded" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // 404 Handling - Don't leak error details
  // AIDEV-NOTE: Security boundary. Never show "forbidden" or other error details.
  // Always show generic "not found" to prevent information leakage.
  if (error || !notification) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto text-zinc-500 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-white mb-2">Notificação não encontrada</h2>
            <p className="text-zinc-400 text-sm mb-6">
              A notificação que você está procurando não existe ou não está mais disponível.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ArrowLeft size={16} />
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const config = severityConfig[notification.severity];
  const Icon = config.icon;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}
            >
              <Icon size={24} className={config.color} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">{notification.title}</h1>
              <p className="text-sm text-zinc-400">{formatDate(notification.date)}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-300">{notification.summary}</p>
          </div>
        </div>

        {/* Content (if available) */}
        {notification.showReadMore && notification.contentMd && (
          <div className="mb-6">
            <SafeMarkdown content={notification.contentMd} />
          </div>
        )}

        {/* CTA */}
        {notification.ctaLabel && notification.ctaUrl && (() => {
          // Validate and normalize CTA URL
          const ctaUrl = notification.ctaUrl.trim();
          if (!ctaUrl) return null;

          // Check if it's an internal link
          const isInternal = ctaUrl.startsWith('/') || ctaUrl.startsWith('#');
          
          if (isInternal) {
            return (
              <div className="mt-6">
                <Link
                  to={ctaUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
                >
                  {notification.ctaLabel}
                </Link>
              </div>
            );
          }

          // External link - validate URL
          try {
            new URL(ctaUrl);
            return (
              <div className="mt-6">
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
                >
                  {notification.ctaLabel}
                  <ExternalLink size={16} />
                </a>
              </div>
            );
          } catch {
            // Invalid URL, don't render CTA
            return null;
          }
        })()}
      </div>
    </DashboardLayout>
  );
};
