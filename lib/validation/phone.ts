/**
 * Validação e normalização de telefone
 * 
 * Usa libphonenumber-js para validar e normalizar números de telefone
 * para o formato E.164 (ex: +5511912345678)
 * 
 * Suporta:
 * - Telefones brasileiros (padrão)
 * - Telefones internacionais (com código +)
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface PhoneValidationResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

/**
 * Valida e normaliza um número de telefone
 * 
 * @param input - Número de telefone digitado pelo usuário
 * @param defaultCountry - País padrão para validação (padrão: 'BR')
 * @returns Resultado da validação com número normalizado em E.164 se válido
 */
export function validateAndNormalizePhone(
  input: string,
  defaultCountry: string = 'BR'
): PhoneValidationResult {
  const raw = input.trim();

  // Rejeitar strings vazias
  if (!raw) {
    return {
      ok: false,
      error: 'Digite um número de telefone válido',
    };
  }

  // Tentar parsear o número de telefone
  const phone = parsePhoneNumberFromString(raw, defaultCountry);

  // Verificar se o número é válido
  if (!phone || !phone.isValid()) {
    return {
      ok: false,
      error: 'Digite um número de telefone válido',
    };
  }

  // Retornar número normalizado em formato E.164
  return {
    ok: true,
    e164: phone.number,
  };
}
