/**
 * System Notifications Generation Service
 * 
 * AIDEV-NOTE: Security boundary. This service only generates notifications
 * for the authenticated user (auth.uid()). RLS ensures user isolation.
 * All operations are idempotent via upsert on (user_id, key).
 * 
 * No PII/IDs are logged. Errors are handled silently.
 */

import { SupabaseNotificationsRepository } from '../../infrastructure/database/SupabaseNotificationsRepository';
import { SupabaseSubscriptionRepository } from '../../infrastructure/database/SupabaseSubscriptionRepository';
import { fetchProfile } from '../queries/user';
import { getPlanDisplayName } from '../plans';
import { getSupabaseClient } from '../../config/supabase';

const repository = new SupabaseNotificationsRepository();
const subscriptionRepository = new SupabaseSubscriptionRepository();

// Configuration
const SUBSCRIPTION_EXPIRY_WARNING_DAYS = 7;
const REQUIRED_PROFILE_FIELDS = ['name'] as const; // phone is optional but recommended

/**
 * Check if subscription is expiring soon
 */
function isSubscriptionExpiring(
  currentPeriodEnd: string | undefined,
  plan: string,
  status: string
): { isExpiring: boolean; daysLeft: number | null } {
  // Only check paid plans
  if (plan === 'inicial') {
    return { isExpiring: false, daysLeft: null };
  }

  // Only check active subscriptions
  if (status !== 'active') {
    return { isExpiring: false, daysLeft: null };
  }

  if (!currentPeriodEnd) {
    return { isExpiring: false, daysLeft: null };
  }

  const endDate = new Date(currentPeriodEnd);
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Check if expiring within warning period
  if (diffDays > 0 && diffDays <= SUBSCRIPTION_EXPIRY_WARNING_DAYS) {
    return { isExpiring: true, daysLeft: diffDays };
  }

  return { isExpiring: false, daysLeft: null };
}

/**
 * Check if profile is incomplete
 */
function checkProfileCompleteness(profile: { name: string | null; phone: string | null } | null): {
  isIncomplete: boolean;
  missingFields: string[];
} {
  if (!profile) {
    return { isIncomplete: true, missingFields: ['name', 'phone'] };
  }

  const missingFields: string[] = [];

  if (!profile.name || profile.name.trim().length === 0) {
    missingFields.push('name');
  }

  // Phone is optional but recommended
  if (!profile.phone || profile.phone.trim().length === 0) {
    // Don't add to missingFields for phone since it's optional
  }

  return {
    isIncomplete: missingFields.length > 0,
    missingFields,
  };
}

/**
 * Generate system notifications for the current user
 * 
 * Checks subscription expiry and profile completeness,
 * then upserts notifications accordingly.
 */
export async function generateSystemNotifications(userId: string): Promise<void> {
  try {
    // Fetch subscription
    const subscription = await subscriptionRepository.getMySubscription();

    // Check subscription expiry
    const { isExpiring, daysLeft } = isSubscriptionExpiring(
      subscription.currentPeriodEnd,
      subscription.plan,
      subscription.status
    );

    if (isExpiring && daysLeft !== null && subscription.currentPeriodEnd) {
      const planName = getPlanDisplayName(subscription.plan as 'inicial' | 'essencial' | 'patrio_pro');
      await repository.upsertSystemNotification('subscription_expiring', {
        title: 'Sua assinatura está expirando em breve',
        summary: `Seu plano ${planName} expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}. Renove para manter o acesso.`,
        severity: 'warning',
        showReadMore: true,
        ctaLabel: 'Gerenciar assinatura',
        ctaUrl: '/dashboard/configuracoes',
        metadata: {
          end_at: subscription.currentPeriodEnd,
          days_left: daysLeft,
          plan: subscription.plan,
        },
        dismissed: false,
      });
    } else {
      // Subscription not expiring - dismiss notification if it exists
      // Only update dismissed_at, don't create empty notification
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('user_system_notifications')
          .delete()
          .eq('user_id', userId)
          .eq('key', 'subscription_expiring');
      } catch {
        // Silently handle errors - don't leak details
      }
    }

    // Fetch profile
    let profile: { name: string | null; phone: string | null } | null = null;
    try {
      profile = await fetchProfile(userId);
    } catch {
      // If profile fetch fails, treat as incomplete
      profile = null;
    }

    // Check profile completeness
    const { isIncomplete, missingFields } = checkProfileCompleteness(profile);

    if (isIncomplete) {
      const missingFieldsText = missingFields.length === 1
        ? 'informação obrigatória'
        : 'informações obrigatórias';

      await repository.upsertSystemNotification('profile_incomplete', {
        title: 'Complete seu perfil',
        summary: `Algumas ${missingFieldsText} estão faltando. Finalize a configuração para desbloquear a experiência completa.`,
        severity: 'info',
        showReadMore: true,
        ctaLabel: 'Completar perfil',
        ctaUrl: '/dashboard/configuracoes',
        metadata: {
          missing_fields: missingFields,
        },
        dismissed: false,
      });
    } else {
      // Profile is complete - dismiss notification if it exists
      // Only update dismissed_at, don't create empty notification
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('user_system_notifications')
          .delete()
          .eq('user_id', userId)
          .eq('key', 'profile_incomplete');
      } catch {
        // Silently handle errors
      }
    }
  } catch (error) {
    // Silently handle errors - don't leak details
    // No console.log to prevent ID/email leaks
  }
}
