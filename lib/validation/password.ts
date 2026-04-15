/**
 * Validação de senha forte
 * 
 * Regras:
 * - Mínimo 10 caracteres
 * - Pelo menos 1 símbolo (não alfanumérico)
 * - Pelo menos 2 dígitos (0-9)
 */

export interface PasswordValidationResult {
  ok: boolean;
  errors: string[];
  checks: {
    minLength: boolean;
    hasSymbol: boolean;
    hasTwoDigits: boolean;
  };
}

export function validatePassword(pw: string): PasswordValidationResult {
  const checks = {
    minLength: pw.length >= 10,
    hasSymbol: /[^A-Za-z0-9]/.test(pw),
    hasTwoDigits: (pw.match(/\d/g) ?? []).length >= 2,
  };

  const errors: string[] = [];

  if (!checks.minLength) {
    errors.push('A senha deve ter pelo menos 10 caracteres.');
  }

  if (!checks.hasSymbol) {
    errors.push('A senha deve conter pelo menos 1 símbolo (ex: #, !, @).');
  }

  if (!checks.hasTwoDigits) {
    errors.push('A senha deve conter pelo menos 2 dígitos.');
  }

  return {
    ok: checks.minLength && checks.hasSymbol && checks.hasTwoDigits,
    errors,
    checks,
  };
}
