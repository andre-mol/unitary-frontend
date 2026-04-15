/**
 * Executado antes de qualquer módulo que importe o cliente Supabase.
 * Em modo demo, remove sessões antigas do Auth do Supabase no localStorage
 * para evitar que o SDK tente refresh em um projeto real (requisições /auth/v1/token).
 */
import { isDemoMode } from './mocks/demoMode';

function clearSupabaseAuthStorage(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && isDemoMode()) {
  clearSupabaseAuthStorage();
}
