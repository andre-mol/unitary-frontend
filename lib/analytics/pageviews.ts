/**
 * Pageview Tracking Utilities
 * 
 * AIDEV-NOTE: Captures sanitized pageviews with page_group classification.
 * Never captures IDs or query parameters in URLs.
 */

import posthog from 'posthog-js';
import { isPostHogEnabled } from './index';
import { sanitizePathname, getPageGroup } from './sanitization';
import { getAttributionProperties } from './attribution';

/**
 * Captures a sanitized pageview event
 * 
 * @param pathname - Current pathname (will be sanitized)
 * @param properties - Optional additional properties (will be sanitized)
 */
export function capturePageview(pathname: string, properties?: Record<string, any>): void {
  if (!isPostHogEnabled() || !pathname) {
    return;
  }

  try {
    // Sanitize pathname
    const sanitizedPath = sanitizePathname(pathname);
    const pageGroup = getPageGroup(pathname);

    // Get attribution properties if available
    const attribution = getAttributionProperties();

    // Build pageview properties
    const pageviewProperties: Record<string, any> = {
      $pathname: sanitizedPath,
      page_group: pageGroup,
      ...attribution,
      ...properties,
    };

    // Capture pageview
    posthog.capture('$pageview', pageviewProperties);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Pageviews] Failed to capture pageview:', error);
    }
  }
}
