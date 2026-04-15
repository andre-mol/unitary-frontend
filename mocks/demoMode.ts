const _isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export function isDemoMode(): boolean {
  return _isDemoMode;
}

export const DEMO_USER_ID = 'demo-user-00000000-0000-0000-0000-000000000001';
export const DEMO_USER_EMAIL = 'demo@unitary.app';
export const DEMO_USER_NAME = 'André (Demo)';
