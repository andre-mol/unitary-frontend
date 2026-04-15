/**
 * Sessão explícita em modo demo (sem auto-login).
 * Usa sessionStorage: novo acesso ao site = visitante na landing até autenticar.
 */
import { env } from '../config/env';
import { DEMO_USER_EMAIL } from './demoMode';

const SESSION_FLAG = 'patrio_demo_signed_in';

export function isDemoSessionActive(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setDemoSessionActive(active: boolean): void {
  try {
    if (active) sessionStorage.setItem(SESSION_FLAG, '1');
    else sessionStorage.removeItem(SESSION_FLAG);
  } catch {
    /* ignore */
  }
}

export function notifyDemoAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('patrio-demo-auth-changed'));
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * 1) Se VITE_DEMO_LOGIN_EMAIL e VITE_DEMO_LOGIN_PASSWORD estiverem definidos (local + Vercel), só essas credenciais passam.
 * 2) Caso contrário, vale o par padrão da vitrine (README): DEMO_USER_EMAIL + senha "demo" — o mesmo em dev e produção.
 */
export function validateDemoCredentials(email: string, password: string): boolean {
  const fromEnvEmail = env.DEMO_LOGIN_EMAIL;
  const fromEnvPassword = env.DEMO_LOGIN_PASSWORD;

  if (fromEnvEmail && fromEnvPassword) {
    return normEmail(email) === normEmail(fromEnvEmail) && password === fromEnvPassword;
  }

  return normEmail(email) === normEmail(DEMO_USER_EMAIL) && password === 'demo';
}
