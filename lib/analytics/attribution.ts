/**
 * Ads Attribution Utilities
 * 
 * AIDEV-NOTE: Captures UTM parameters and click IDs for attribution tracking.
 * Only captures after user has consented to analytics/marketing.
 * Stores as persistent properties in PostHog.
 */

import posthog from 'posthog-js';
import { isPostHogEnabled } from './index';

/**
 * UTM parameter keys
 */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * Click ID keys (Google, Facebook, Microsoft, TikTok)
 */
const CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid', 'ttclid'];

/**
 * Storage keys for persistence
 */
const STORAGE_UTM_KEY = 'patrio_utm_params';
const STORAGE_CLICK_IDS_KEY = 'patrio_click_ids';

/**
 * Captures UTM parameters and click IDs from current URL
 * Only captures if PostHog is enabled and user has consented
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined' || !isPostHogEnabled()) {
    return;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams: Record<string, string> = {};
    const clickIds: Record<string, string> = {};

    // Capture UTM parameters
    UTM_KEYS.forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        utmParams[key] = value;
      }
    });

    // Capture click IDs
    CLICK_ID_KEYS.forEach((key) => {
      const value = urlParams.get(key);
      if (value) {
        clickIds[key] = value;
      }
    });

    // Store in sessionStorage for persistence
    if (Object.keys(utmParams).length > 0) {
      sessionStorage.setItem(STORAGE_UTM_KEY, JSON.stringify(utmParams));
    }
    if (Object.keys(clickIds).length > 0) {
      sessionStorage.setItem(STORAGE_CLICK_IDS_KEY, JSON.stringify(clickIds));
    }

    // Register with PostHog as persistent properties
    if (Object.keys(utmParams).length > 0 || Object.keys(clickIds).length > 0) {
      posthog.register({
        ...utmParams,
        ...clickIds,
      });
    }
  } catch (error) {
    // Silently fail
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Attribution] Failed to capture attribution:', error);
    }
  }
}

/**
 * Gets current attribution properties from storage
 */
export function getAttributionProperties(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const utmStr = sessionStorage.getItem(STORAGE_UTM_KEY);
    const clickIdsStr = sessionStorage.getItem(STORAGE_CLICK_IDS_KEY);

    const attribution: Record<string, string> = {};

    if (utmStr) {
      Object.assign(attribution, JSON.parse(utmStr));
    }
    if (clickIdsStr) {
      Object.assign(attribution, JSON.parse(clickIdsStr));
    }

    return attribution;
  } catch {
    return {};
  }
}

/**
 * Restores attribution from storage and registers with PostHog
 */
export function restoreAttribution(): void {
  if (typeof window === 'undefined' || !isPostHogEnabled()) {
    return;
  }

  try {
    const attribution = getAttributionProperties();
    if (Object.keys(attribution).length > 0) {
      posthog.register(attribution);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Attribution] Failed to restore attribution:', error);
    }
  }
}
