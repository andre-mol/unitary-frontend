/**
 * User Identification Utilities
 * 
 * AIDEV-NOTE: Identifies users in PostHog using Supabase user.id as distinct_id.
 * NEVER sends email, even with analytics consent. Only sends safe properties:
 * plan, role, onboarding_completed, created_at.
 */

import posthog from 'posthog-js';
import { isPostHogEnabled } from './index';
import { sanitizeProperties } from '../analytics';

/**
 * Allowed properties for user identification
 * These are safe to send and don't contain PII
 */
const ALLOWED_PROPERTIES = [
  'plan',
  'role',
  'onboarding_completed',
  'created_at',
] as const;

type AllowedProperty = typeof ALLOWED_PROPERTIES[number];

/**
 * Sanitizes properties to only include allowed keys
 */
function sanitizeUserProperties(properties?: Record<string, any>): Record<string, any> {
  if (!properties) {
    return {};
  }

  const sanitized: Record<string, any> = {};

  for (const key of ALLOWED_PROPERTIES) {
    if (key in properties && properties[key] !== undefined && properties[key] !== null) {
      sanitized[key] = properties[key];
    }
  }

  return sanitized;
}

/**
 * Identifies a user in PostHog
 * 
 * @param userId - Supabase user.id (UUID) - used as distinct_id
 * @param properties - Optional user properties (only allowed properties are sent)
 * 
 * AIDEV-NOTE: Email is NEVER sent, even if provided in properties.
 * Only plan, role, onboarding_completed, created_at are allowed.
 */
export function identifyUser(userId: string, properties?: Record<string, any>): void {
  if (!isPostHogEnabled() || !userId) {
    return;
  }

  try {
    // Sanitize properties to only include allowed keys
    const sanitizedProperties = sanitizeUserProperties(properties);

    // Additional sanitization pass to remove any PII that might have slipped through
    const finalProperties = sanitizeProperties(sanitizedProperties);

    // Identify user with Supabase UUID as distinct_id
    posthog.identify(userId, finalProperties);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Identification] Failed to identify user:', error);
    }
  }
}

/**
 * Resets user identification (call on logout)
 */
export function resetUser(): void {
  if (!isPostHogEnabled()) {
    return;
  }

  try {
    posthog.reset();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Identification] Failed to reset user:', error);
    }
  }
}
