/**
 * Analytics Module - Central Exports
 * 
 * AIDEV-NOTE: Central export point for all analytics utilities.
 * Provides privacy-first analytics instrumentation without capturing sensitive data.
 */

// Re-export sanitization utilities
export { sanitizeUrl, sanitizePathname, getPageGroup } from './sanitization';

// Re-export attribution utilities
export { captureAttribution, getAttributionProperties, restoreAttribution } from './attribution';

// Re-export identification utilities
export { identifyUser, resetUser } from './identification';

// Re-export pageview utilities
export { capturePageview } from './pageviews';

// Re-export session replay utilities
export { enableSessionReplayIfAllowed, disableSessionReplay } from './sessionReplay';

// Re-export event helpers
export {
  captureSignupStarted,
  captureSignupCompleted,
  captureLoginCompleted,
  captureLogout,
  captureOnboardingStepViewed,
  captureOnboardingStepCompleted,
  captureSidebarNavClicked,
  capturePortfolioCreated,
  captureAssetAdded,
  captureTransactionAdded,
  captureReportGenerated,
  captureCheckoutStarted,
  captureSubscriptionActivated,
} from './events';

// Re-export core utilities from analytics.ts
export { isPostHogEnabled, safeCapture } from '../analytics';
