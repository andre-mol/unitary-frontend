/**
 * URL Sanitization Utilities
 * 
 * AIDEV-NOTE: Sanitizes URLs and pathnames to remove sensitive data (UUIDs, IDs, query params)
 * before sending to analytics. Never captures internal IDs or query parameters.
 */

/**
 * UUID pattern (8-4-4-4-12 hex digits)
 */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Long numeric ID pattern (6+ digits, likely database IDs)
 */
const NUMERIC_ID_PATTERN = /\/(\d{6,})\//g;

/**
 * Sanitizes a URL by:
 * - Removing query strings
 * - Replacing UUIDs with ':id'
 * - Replacing long numeric IDs with ':id'
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    // Remove query string and hash
    const urlObj = new URL(url, window.location.origin);
    let sanitized = urlObj.pathname;

    // Replace UUIDs with :id
    sanitized = sanitized.replace(UUID_PATTERN, ':id');

    // Replace long numeric IDs with :id
    sanitized = sanitized.replace(NUMERIC_ID_PATTERN, '/:id/');

    return sanitized;
  } catch {
    // If URL parsing fails, try simple string replacement
    let sanitized = url.split('?')[0].split('#')[0];
    sanitized = sanitized.replace(UUID_PATTERN, ':id');
    sanitized = sanitized.replace(NUMERIC_ID_PATTERN, '/:id/');
    return sanitized;
  }
}

/**
 * Sanitizes a pathname by removing IDs
 */
export function sanitizePathname(pathname: string): string {
  if (!pathname || typeof pathname !== 'string') {
    return '';
  }

  let sanitized = pathname;

  // Replace UUIDs with :id
  sanitized = sanitized.replace(UUID_PATTERN, ':id');

  // Replace long numeric IDs with :id
  sanitized = sanitized.replace(NUMERIC_ID_PATTERN, '/:id/');

  return sanitized;
}

/**
 * Maps pathname to page group for analytics
 */
export function getPageGroup(pathname: string): string {
  if (!pathname) {
    return 'unknown';
  }

  const sanitized = sanitizePathname(pathname);

  // Onboarding
  if (sanitized.includes('/onboarding') || sanitized.includes('/cadastro')) {
    return 'onboarding';
  }

  // Auth
  if (sanitized.includes('/login') || sanitized.includes('/recuperar-senha')) {
    return 'auth';
  }

  // Dashboard
  if (sanitized === '/dashboard' || sanitized.startsWith('/dashboard/')) {
    if (sanitized.includes('/portfolio/')) {
      return 'portfolio';
    }
    if (sanitized.includes('/configuracoes') || sanitized.includes('/settings')) {
      return 'settings';
    }
    if (sanitized.includes('/privacidade')) {
      return 'privacy';
    }
    return 'dashboard';
  }

  // Billing
  if (sanitized.includes('/pricing') || sanitized.includes('/precos') || sanitized.includes('/checkout')) {
    return 'billing';
  }

  // Public
  if (sanitized === '/' || sanitized === '') {
    return 'home';
  }

  return 'other';
}
