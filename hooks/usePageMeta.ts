import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * Hook to manage page meta tags (title, description, Open Graph)
 * Updates document.title and meta tags dynamically
 */
export function usePageMeta({ title, description, ogTitle, ogDescription }: PageMetaOptions): void {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    if (description) {
      metaDescription.setAttribute('content', description);
    }

    // Update or create Open Graph title
    let ogTitleTag = document.querySelector('meta[property="og:title"]');
    if (!ogTitleTag) {
      ogTitleTag = document.createElement('meta');
      ogTitleTag.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitleTag);
    }
    ogTitleTag.setAttribute('content', ogTitle || title);

    // Update or create Open Graph description
    if (ogDescription || description) {
      let ogDescTag = document.querySelector('meta[property="og:description"]');
      if (!ogDescTag) {
        ogDescTag = document.createElement('meta');
        ogDescTag.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescTag);
      }
      ogDescTag.setAttribute('content', ogDescription || description || '');
    }

    // Cleanup function to restore default title if needed
    return () => {
      // Optionally restore default title on unmount
      // For now, we'll leave the title as is since navigation will update it
    };
  }, [title, description, ogTitle, ogDescription]);
}
