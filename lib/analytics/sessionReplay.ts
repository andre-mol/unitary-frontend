/**
 * Session Replay Safety Utilities
 * 
 * AIDEV-NOTE: Manages session replay with allowlist-based routing.
 * Only enables session replay on safe routes (login, signup) when analytics consent is granted.
 * Never records sensitive pages like dashboards or portfolio pages.
 */

import posthog from 'posthog-js';
import { isPostHogEnabled } from './index';

/**
 * Allowlist of routes where session replay is safe to enable
 * These are public/auth pages without sensitive financial data
 */
const ALLOWLISTED_ROUTES = [
  '/',
];

/**
 * Checks if a pathname is in the allowlist
 */
function isRouteAllowlisted(pathname: string): boolean {
  if (!pathname) {
    return false;
  }

  // Check exact matches
  if (ALLOWLISTED_ROUTES.includes(pathname)) {
    return true;
  }

  // Check if pathname starts with an allowlisted route
  return ALLOWLISTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Enables session replay if:
 * 1. PostHog is enabled
 * 2. Route is in allowlist
 * 3. Analytics consent is granted
 * 
 * @param pathname - Current route pathname
 * @param hasAnalyticsConsent - Whether user has consented to analytics
 */
export function enableSessionReplayIfAllowed(pathname: string, hasAnalyticsConsent: boolean): void {
  if (!isPostHogEnabled()) {
    return;
  }

  if (!hasAnalyticsConsent) {
    // Ensure session replay is disabled if no consent
    if ((posthog as any).__loaded && posthog.sessionRecording) {
      posthog.stopSessionRecording();
    }
    return;
  }

  if (!isRouteAllowlisted(pathname)) {
    // Ensure session replay is disabled for non-allowlisted routes
    if ((posthog as any).__loaded && posthog.sessionRecording) {
      posthog.stopSessionRecording();
    }
    return;
  }

  // Enable session replay with masking
  try {
    if ((posthog as any).__loaded) {
      posthog.startSessionRecording({
        maskAllInputs: true,
        maskTextSelector: '.ph-no-capture',
        maskInputSelector: '.ph-no-capture input, .ph-no-capture textarea',
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Session Replay] Failed to enable session replay:', error);
    }
  }
}

/**
 * Disables session replay
 */
export function disableSessionReplay(): void {
  if (!isPostHogEnabled()) {
    return;
  }

  try {
    if ((posthog as any).__loaded && posthog.sessionRecording) {
      posthog.stopSessionRecording();
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics Session Replay] Failed to disable session replay:', error);
    }
  }
}
