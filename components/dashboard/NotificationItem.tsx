import React from 'react';
import { Check, ExternalLink, X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NotificationItem as NotificationItemType } from '../../infrastructure/database/SupabaseNotificationsRepository';

interface NotificationItemProps {
  notification: NotificationItemType;
  onMarkAsRead: () => void;
  onDismiss?: () => void;
  isMarkingAsRead?: boolean;
  isDismissing?: boolean;
}

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
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Agora';
  }
  if (diffMins < 60) {
    return `${diffMins}min atrás`;
  }
  if (diffHours < 24) {
    return `${diffHours}h atrás`;
  }
  if (diffDays < 7) {
    return `${diffDays}d atrás`;
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getReadMoreUrl(notification: NotificationItemType): string | null {
  if (notification.source === 'broadcast' && notification.slug) {
    return `/notificacoes/${notification.slug}`;
  }

  if (notification.source === 'system') {
    if (notification.slug) {
      return `/notificacoes/${notification.slug}`;
    }
    if (notification.ctaUrl) {
      return notification.ctaUrl;
    }
  }

  // Fallback to showReadMore if specifically requested but no URL determined yet
  // though usually one of the above would be true if showReadMore is true.
  return null;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  isMarkingAsRead = false,
  isDismissing = false,
}) => {
  const config = severityConfig[notification.severity];
  const Icon = config.icon;
  const readMoreUrl = getReadMoreUrl(notification);

  const content = (
    <div className="flex items-start gap-3">
      {/* Severity Indicator */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}
      >
        <Icon size={16} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-sm font-medium text-white truncate">{notification.title}</h4>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 bg-amber-500 rounded-full mt-1.5" />
          )}
        </div>

        <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{notification.summary}</p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">{formatDate(notification.date)}</span>

          <div className="flex items-center gap-2">
            {/* Mark as Read Button */}
            {!notification.isRead && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkAsRead();
                }}
                disabled={isMarkingAsRead}
                className="text-xs text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Check size={12} />
                Marcar como lida
              </button>
            )}

            {/* Dismiss Button (System notifications only) */}
            {notification.source === 'system' && onDismiss && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDismiss();
                }}
                disabled={isDismissing}
                className="text-xs text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <X size={12} />
                Dispensar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const className = `block p-4 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30 transition-colors ${!notification.isRead ? 'bg-zinc-900/50' : ''
    }`;

  if (readMoreUrl) {
    return (
      <Link to={readMoreUrl} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
};
