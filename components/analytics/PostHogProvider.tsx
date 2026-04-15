/**
 * PostHog Analytics Provider
 * 
 * AIDEV-NOTE: Privacy-first PostHog integration with LGPD consent gating.
 * Only initializes if:
 * 1. VITE_POSTHOG_ENABLED === 'true'
 * 2. User has consented to 'analytics' category
 * Never captures PII (user IDs, emails, tokens, financial values).
 * Autocapture and session recording are disabled by default for financial app security.
 */

import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import posthog from 'posthog-js';
import { env } from '../../config/env';
import { useConsent } from '../consent/ConsentProvider';
import { enableSessionReplayIfAllowed, disableSessionReplay } from '../../lib/analytics';

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const { hasConsent } = useConsent();
  const location = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const previousConsentRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Check if analytics consent is given
    const analyticsConsent = hasConsent('analytics');

    // Only initialize if explicitly enabled AND user has consented
    if (!env.POSTHOG_ENABLED) {
      return;
    }

    // Validate required config
    if (!env.POSTHOG_KEY || !env.POSTHOG_HOST) {
      // Silently fail - don't log in production to avoid exposing config issues
      if (env.isDevelopment) {
        console.warn('[PostHog] Missing POSTHOG_KEY or POSTHOG_HOST');
      }
      return;
    }

    // If user revoked consent (true -> false), opt out and reset
    if (previousConsentRef.current === true && !analyticsConsent) {
      if ((posthog as any).__loaded) {
        posthog.opt_out_capturing();
        posthog.reset();
        setIsInitialized(false);
      }
      previousConsentRef.current = false;
      return;
    }

    // If user has not consented, do not initialize
    if (!analyticsConsent) {
      previousConsentRef.current = false;
      return;
    }

    // If already initialized elsewhere (StrictMode or another mount), just opt-in
    if ((posthog as any).__loaded) {
      posthog.opt_in_capturing();
      setIsInitialized(true);
      previousConsentRef.current = true;
      return;
    }

    // Initialize PostHog with privacy-first defaults
    posthog.init(env.POSTHOG_KEY, {
      api_host: env.POSTHOG_HOST,
      // Privacy settings
      autocapture: false, // AIDEV-NOTE: Disabled to avoid PII. Use manual capture only or data-ph-capture="true" for specific elements.
      capture_pageview: false, // AIDEV-NOTE: Manual pageview control via capturePageview()
      disable_session_recording: true, // AIDEV-NOTE: Enabled conditionally via enableSessionReplayIfAllowed() only on allowlisted routes
      // Use memory persistence to reduce storage footprint when consent is revoked
      persistence: 'memory',
      // Debug only in development
      debug: env.isDevelopment && env.POSTHOG_DEBUG,
      // Use stable defaults
      defaults: {
        '2025-11-30': true,
      },
      // Additional privacy settings
      loaded: (posthog) => {
        // Ensure no PII is captured
        posthog.config.persistence_properties = posthog.config.persistence_properties?.filter(
          (prop) => !['email', 'user_id', 'id', 'token'].includes(prop.toLowerCase())
        );
      },
    });

    setIsInitialized(true);
    previousConsentRef.current = true;

  }, [hasConsent, isInitialized]);

  // Manage session replay based on route and consent
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const analyticsConsent = hasConsent('analytics');
    const pathname = location.pathname;

    // Enable/disable session replay based on route and consent
    enableSessionReplayIfAllowed(pathname, analyticsConsent);
  }, [location.pathname, hasConsent, isInitialized]);

  // Always render children, regardless of PostHog initialization status
  return <>{children}</>;
}
