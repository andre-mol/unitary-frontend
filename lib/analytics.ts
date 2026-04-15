/**
 * Analytics Utilities
 * 
 * AIDEV-NOTE: Privacy-first analytics helpers. Never captures PII, user IDs, emails, tokens,
 * or sensitive financial values. All event capture is opt-in and manually controlled.
 */

import posthog from 'posthog-js';
import { env } from '../config/env';
import { hasConsent } from './consent';

/**
 * Check if PostHog is enabled and loaded
 */
export function isPostHogEnabled(): boolean {
  if (!env.POSTHOG_ENABLED || typeof window === 'undefined') {
    return false;
  }
  // Check if PostHog is loaded (using type assertion for internal property)
  return (posthog as any).__loaded === true;
}

/**
 * List of PII/sensitive keys that should never be captured
 */
const SENSITIVE_KEYS = [
  'user_id',
  'id',
  'email',
  'token',
  'password',
  'secret',
  'key',
  'auth',
  'session',
  'cookie',
  'portfolio_value',
  'asset_value',
  'balance',
  'amount',
  'price',
  'revenue',
  'income',
  'expense',
];

/**
 * Remove sensitive data from properties object
 * 
 * AIDEV-NOTE: Exported for use in other analytics modules
 */
export function sanitizeProperties(properties: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!properties) {
    return undefined;
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(properties)) {
    const lowerKey = key.toLowerCase();
    
    // Skip sensitive keys
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      continue;
    }

    // Skip if value looks like an ID (UUID, numeric ID, etc.)
    if (typeof value === 'string' && (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) || value.match(/^[0-9]+$/))) {
      continue;
    }

    // Skip if value looks like an email
    if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = sanitizeProperties(value);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Safely capture an event with PostHog
 * Only captures if PostHog is enabled and removes any PII/sensitive data
 */
export function safeCapture(eventName: string, properties?: Record<string, any>): void {
  if (!isPostHogEnabled()) {
    return;
  }

  try {
    const sanitized = sanitizeProperties(properties);
    posthog.capture(eventName, sanitized);
  } catch (error) {
    // Silently fail - don't log errors in production to avoid exposing issues
    if (env.isDevelopment) {
      console.warn('[Analytics] Failed to capture event:', error);
    }
  }
}

/**
 * Capture UTM parameters and click IDs from URL
 * Stores them in sessionStorage and registers with PostHog
 */
export function captureUTMParams(): void {
  if (typeof window === 'undefined' || !isPostHogEnabled()) {
    return;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {};
    const clickIds: Record<string, string> = {};

    // Capture UTM parameters
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    utmKeys.forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        utmParams[key] = value;
      }
    });

    // Capture click IDs (Google, Facebook, etc.)
    const clickIdKeys = ['gclid', 'fbclid', 'msclkid', 'ttclid'];
    clickIdKeys.forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        clickIds[key] = value;
      }
    });

    // Store in sessionStorage for persistence
    if (Object.keys(utmParams).length > 0) {
      sessionStorage.setItem('posthog_utm_params', JSON.stringify(utmParams));
    }
    if (Object.keys(clickIds).length > 0) {
      sessionStorage.setItem('posthog_click_ids', JSON.stringify(clickIds));
    }

    // Register with PostHog if we have any params
    if (Object.keys(utmParams).length > 0 || Object.keys(clickIds).length > 0) {
      posthog.register({
        ...utmParams,
        ...clickIds,
      });
    }
  } catch (error) {
    // Silently fail
    if (env.isDevelopment) {
      console.warn('[Analytics] Failed to capture UTM params:', error);
    }
  }
}

/**
 * Restore UTM params from sessionStorage (useful after navigation)
 */
export function restoreUTMParams(): void {
  if (typeof window === 'undefined' || !isPostHogEnabled()) {
    return;
  }

  try {
    const utmParamsStr = sessionStorage.getItem('posthog_utm_params');
    const clickIdsStr = sessionStorage.getItem('posthog_click_ids');

    if (utmParamsStr || clickIdsStr) {
      const params: Record<string, string> = {};
      if (utmParamsStr) {
        Object.assign(params, JSON.parse(utmParamsStr));
      }
      if (clickIdsStr) {
        Object.assign(params, JSON.parse(clickIdsStr));
      }

      if (Object.keys(params).length > 0) {
        posthog.register(params);
      }
    }
  } catch (error) {
    // Silently fail
    if (env.isDevelopment) {
      console.warn('[Analytics] Failed to restore UTM params:', error);
    }
  }
}

/**
 * Capture logout event and reset PostHog identity
 * AIDEV-NOTE: Never send PII. Only capture if analytics consent is granted.
 */
export function captureLogout(): void {
  const hasAnalyticsConsent = hasConsent('analytics');

  if (!hasAnalyticsConsent) {
    if ((posthog as any).__loaded) {
      posthog.reset();
    }
    return;
  }

  if (!isPostHogEnabled()) {
    return;
  }

  try {
    posthog.capture('logout');
    posthog.reset();
  } catch (error) {
    if (env.isDevelopment) {
      console.warn('[Analytics] Failed to capture logout:', error);
    }
  }
}

// Re-export new modular analytics functions for backward compatibility
// AIDEV-NOTE: This allows existing imports from 'lib/analytics' to work with new modular structure
export {
  sanitizeUrl,
  sanitizePathname,
  getPageGroup,
  captureAttribution,
  getAttributionProperties,
  restoreAttribution,
  identifyUser,
  resetUser,
  capturePageview,
  enableSessionReplayIfAllowed,
  disableSessionReplay,
  captureSignupStarted,
  captureSignupCompleted,
  captureLoginCompleted,
  captureOnboardingStepViewed,
  captureOnboardingStepCompleted,
  captureSidebarNavClicked,
  capturePortfolioCreated,
  captureAssetAdded,
  captureTransactionAdded,
  captureReportGenerated,
  captureCheckoutStarted,
  captureSubscriptionActivated,
} from './analytics/index';
