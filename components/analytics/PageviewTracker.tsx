/**
 * Pageview Tracker Component
 * 
 * AIDEV-NOTE: Tracks pageviews with sanitized URLs and page_group classification.
 * Automatically captures pageviews on route changes.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from '../../lib/analytics';

export function PageviewTracker() {
  const location = useLocation();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = location.pathname;

    // Only capture if pathname changed
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname;
      
      // Capture sanitized pageview
      capturePageview(pathname);
    }
  }, [location.pathname]);

  return null;
}
