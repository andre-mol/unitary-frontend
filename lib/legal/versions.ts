/**
 * Legal Document Versions
 * Centralized versioning for legal pages.
 * Update these constants when legal documents are revised.
 */

export const TERMS_VERSION = '2026-01-21';
export const PRIVACY_VERSION = '2026-01-21';
export const COMMUNICATIONS_VERSION = '2026-01-21';

/**
 * Formats a version date string (YYYY-MM-DD) to Brazilian Portuguese format
 * @param versionDate - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "21 de janeiro de 2026")
 */
export function formatVersionDate(versionDate: string): string {
  const date = new Date(versionDate + 'T00:00:00');
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} de ${month} de ${year}`;
}
