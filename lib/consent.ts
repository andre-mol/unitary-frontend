/**
 * LGPD Consent Management
 * 
 * AIDEV-NOTE: Privacy-first consent system. Manages user consent for analytics and marketing.
 * Essential cookies (auth/session) are always enabled and not managed here.
 * Consent is stored in localStorage with versioning for future migrations.
 */

import { z } from 'zod';

/**
 * Consent data structure
 * v:1 - Initial version
 */
const consentSchema = z.object({
  essential: z.literal(true), // Always true, cannot be disabled
  analytics: z.boolean(),
  marketing: z.boolean(),
  ts: z.number(), // Timestamp of when consent was given/updated
  v: z.literal(1), // Schema version
});

export type ConsentData = z.infer<typeof consentSchema>;

export type ConsentCategory = 'essential' | 'analytics' | 'marketing';

const STORAGE_KEY = 'patrio_consent_v1';

/**
 * Get current consent from localStorage
 * Returns null if no consent has been given
 */
export function getConsent(): ConsentData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    const validated = consentSchema.safeParse(parsed);

    if (!validated.success) {
      // Invalid data, clear it
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return validated.data;
  } catch (error) {
    // Error parsing, clear corrupted data
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Set consent in localStorage
 */
export function setConsent(consent: Omit<ConsentData, 'ts' | 'v'>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const consentData: ConsentData = {
    ...consent,
    essential: true, // Always true
    ts: Date.now(),
    v: 1,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
  } catch (error) {
    // localStorage might be disabled or full
    console.error('[Consent] Failed to save consent:', error);
  }
}

/**
 * Check if user has consented to a specific category
 */
export function hasConsent(category: ConsentCategory): boolean {
  const consent = getConsent();
  if (!consent) {
    return false;
  }

  // Essential is always true
  if (category === 'essential') {
    return true;
  }

  return consent[category] === true;
}

/**
 * Clear all consent data
 * This will cause the banner to show again on next visit
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if consent has been given (any category)
 */
export function hasGivenConsent(): boolean {
  return getConsent() !== null;
}
