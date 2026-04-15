/**
 * Safe Markdown Renderer Component
 * 
 * AIDEV-NOTE: Security boundary. This component safely renders markdown
 * without executing HTML. react-markdown does not render raw HTML by default,
 * preventing XSS attacks. Links are validated and external links use
 * rel="noreferrer noopener" for security.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Check if a URL is an internal link (same origin)
 */
function isInternalLink(url: string): boolean {
  try {
    // Relative URLs are internal
    if (url.startsWith('/') || url.startsWith('#')) {
      return true;
    }
    
    // Check if URL is same origin
    const urlObj = new URL(url, window.location.origin);
    return urlObj.origin === window.location.origin;
  } catch {
    // Invalid URL, treat as internal to be safe
    return true;
  }
}

/**
 * Normalize and validate a URL
 */
function normalizeLink(url: string): string {
  try {
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative URL, ensure it starts with /
    if (url.startsWith('/')) {
      return url;
    }
    
    // If it's a hash link, return as is
    if (url.startsWith('#')) {
      return url;
    }
    
    // Otherwise, treat as relative and add /
    return `/${url}`;
  } catch {
    // Invalid URL, return empty string
    return '';
  }
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link component for security
          a: ({ node, href, children, ...props }) => {
            if (!href) {
              return <span {...props}>{children}</span>;
            }

            const normalizedUrl = normalizeLink(href);
            const isInternal = isInternalLink(normalizedUrl);

            if (isInternal) {
              // Internal link: use React Router Link
              return (
                <Link
                  to={normalizedUrl}
                  className="text-amber-400 hover:text-amber-300 underline"
                  {...props}
                >
                  {children}
                </Link>
              );
            } else {
              // External link: use <a> with security attributes
              return (
                <a
                  href={normalizedUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-amber-400 hover:text-amber-300 underline"
                  {...props}
                >
                  {children}
                </a>
              );
            }
          },
          // Style headings
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-white mt-6 mb-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold text-white mt-5 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />
          ),
          // Style paragraphs
          p: ({ node, ...props }) => (
            <p className="text-zinc-300 mb-4 leading-relaxed" {...props} />
          ),
          // Style lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside text-zinc-300 mb-4 space-y-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside text-zinc-300 mb-4 space-y-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-zinc-300" {...props} />
          ),
          // Style code blocks
          code: ({ node, inline, ...props }) => {
            if (inline) {
              return (
                <code
                  className="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                />
              );
            }
            return (
              <code
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-300 text-sm font-mono overflow-x-auto mb-4"
                {...props}
              />
            );
          },
          // Style blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-amber-500 pl-4 italic text-zinc-400 my-4"
              {...props}
            />
          ),
          // Style horizontal rules
          hr: ({ node, ...props }) => (
            <hr className="border-zinc-800 my-6" {...props} />
          ),
          // Style strong/bold
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-white" {...props} />
          ),
          // Style emphasis/italic
          em: ({ node, ...props }) => (
            <em className="italic text-zinc-200" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
