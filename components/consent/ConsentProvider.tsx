/**
 * Consent Context Provider
 * 
 * AIDEV-NOTE: Provides consent state and management functions throughout the app.
 * PostHog and other analytics tools should use this to check consent before initializing.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getConsent, setConsent, clearConsent, type ConsentData, type ConsentCategory } from '../../lib/consent';
import { captureAttribution, restoreAttribution } from '../../lib/analytics';

interface ConsentContextValue {
  consent: ConsentData | null;
  hasConsent: (category: ConsentCategory) => boolean;
  updateConsent: (category: ConsentCategory, value: boolean) => void;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  clearAll: () => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

interface ConsentProviderProps {
  children: ReactNode;
}

export function ConsentProvider({ children }: ConsentProviderProps) {
  const [consent, setConsentState] = useState<ConsentData | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = getConsent();
    setConsentState(stored);
    // Show banner if no consent has been given
    setShowBanner(stored === null);
  }, []);

  const updateConsent = (category: ConsentCategory, value: boolean) => {
    if (category === 'essential') {
      // Essential cannot be disabled
      return;
    }

    const current = consent || {
      essential: true,
      analytics: false,
      marketing: false,
    };

    const updated: ConsentData = {
      ...current,
      [category]: value,
      ts: Date.now(),
      v: 1,
    };

    setConsent(updated);
    setConsentState(updated);
    setShowBanner(false);

    // AIDEV-NOTE: Capture attribution when analytics/marketing consent is granted
    if ((category === 'analytics' || category === 'marketing') && value) {
      captureAttribution();
      restoreAttribution();
    }
  };

  const acceptAll = () => {
    const allAccepted: ConsentData = {
      essential: true,
      analytics: true,
      marketing: true,
      ts: Date.now(),
      v: 1,
    };

    setConsent(allAccepted);
    setConsentState(allAccepted);
    setShowBanner(false);

    // AIDEV-NOTE: Capture attribution when all consent is granted
    captureAttribution();
    restoreAttribution();
  };

  const rejectNonEssential = () => {
    const rejected: ConsentData = {
      essential: true,
      analytics: false,
      marketing: false,
      ts: Date.now(),
      v: 1,
    };

    setConsent(rejected);
    setConsentState(rejected);
    setShowBanner(false);
  };

  const clearAll = () => {
    clearConsent();
    setConsentState(null);
    setShowBanner(true);
  };

  const hasConsentFor = (category: ConsentCategory): boolean => {
    if (category === 'essential') {
      return true;
    }
    return consent?.[category] === true;
  };

  const value: ConsentContextValue = {
    consent,
    hasConsent: hasConsentFor,
    updateConsent,
    acceptAll,
    rejectNonEssential,
    clearAll,
    showBanner,
    setShowBanner,
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/**
 * Hook to use consent context
 */
export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}
