/**
 * Event Taxonomy Helpers
 * 
 * AIDEV-NOTE: Curated event helpers for product analytics.
 * Each helper ensures only safe, non-sensitive data is captured.
 */

import { safeCapture } from '../analytics';
import { getAttributionProperties } from './attribution';

/**
 * Auth Events
 */

export function captureSignupStarted(): void {
  const attribution = getAttributionProperties();
  safeCapture('auth:signup_started', attribution);
}

export function captureSignupCompleted(): void {
  const attribution = getAttributionProperties();
  safeCapture('auth:signup_completed', attribution);
}

export function captureLoginCompleted(): void {
  const attribution = getAttributionProperties();
  safeCapture('auth:login_completed', attribution);
}

export function captureLogout(): void {
  safeCapture('auth:logout');
}

/**
 * Onboarding Events
 */

export function captureOnboardingStepViewed(step: string): void {
  safeCapture('onboarding:onboarding_step_viewed', { step });
}

export function captureOnboardingStepCompleted(step: string): void {
  safeCapture('onboarding:onboarding_step_completed', { step });
}

/**
 * Navigation Events
 */

export function captureSidebarNavClicked(label: string): void {
  // AIDEV-NOTE: Only captures label, never IDs or sensitive route data
  safeCapture('navigation:sidebar_nav_clicked', { label });
}

/**
 * Portfolio Events
 */

export function capturePortfolioCreated(portfolioType: string): void {
  // AIDEV-NOTE: Only captures type, never IDs, values, or names
  safeCapture('portfolio:portfolio_created', { portfolio_type: portfolioType });
}

export function captureAssetAdded(assetType: string): void {
  // AIDEV-NOTE: Only captures asset type, never IDs, values, or amounts
  safeCapture('portfolio:asset_added', { asset_type: assetType });
}

export function captureTransactionAdded(transactionType: string): void {
  // AIDEV-NOTE: Only captures transaction type (buy/sell/dividend), never values or amounts
  safeCapture('portfolio:transaction_added', { transaction_type: transactionType });
}

/**
 * Reports Events
 */

export function captureReportGenerated(reportType: string): void {
  // AIDEV-NOTE: Only captures report type, never data or values
  safeCapture('reports:report_generated', { report_type: reportType });
}

/**
 * Billing Events
 */

export function captureCheckoutStarted(plan: string): void {
  const attribution = getAttributionProperties();
  safeCapture('billing:checkout_started', {
    plan,
    ...attribution,
  });
}

export function captureSubscriptionActivated(plan: string): void {
  const attribution = getAttributionProperties();
  safeCapture('billing:subscription_activated', {
    plan,
    ...attribution,
  });
}
