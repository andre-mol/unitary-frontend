/**
 * Testes para validação de senha forte
 * 
 * Estes testes verificam a função validatePassword que valida:
 * - Mínimo 10 caracteres
 * - Pelo menos 1 símbolo (não alfanumérico)
 * - Pelo menos 2 dígitos
 */

import { validatePassword } from '../password';

describe('validatePassword', () => {
  describe('senha válida', () => {
    it('deve aceitar senha com 10+ caracteres, símbolo e 2 dígitos', () => {
      const result = validatePassword('Abcdefgh#12');
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.checks.minLength).toBe(true);
      expect(result.checks.hasSymbol).toBe(true);
      expect(result.checks.hasTwoDigits).toBe(true);
    });

    it('deve aceitar senha com múltiplos símbolos e dígitos', () => {
      const result = validatePassword('MinhaSenh@123!');
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('senha sem símbolo', () => {
    it('deve rejeitar senha sem símbolo', () => {
      const result = validatePassword('Abcdefghij');
      expect(result.ok).toBe(false);
      expect(result.checks.hasSymbol).toBe(false);
      expect(result.errors).toContain('A senha deve conter pelo menos 1 símbolo (ex: #, !, @).');
    });

    it('deve rejeitar senha com apenas letras e dígitos', () => {
      const result = validatePassword('Abcdefgh12');
      expect(result.ok).toBe(false);
      expect(result.checks.hasSymbol).toBe(false);
    });
  });

  describe('senha com apenas 1 dígito', () => {
    it('deve rejeitar senha com apenas 1 dígito', () => {
      const result = validatePassword('Abcdefgh#1');
      expect(result.ok).toBe(false);
      expect(result.checks.hasTwoDigits).toBe(false);
      expect(result.errors).toContain('A senha deve conter pelo menos 2 dígitos.');
    });
  });

  describe('senha curta', () => {
    it('deve rejeitar senha com menos de 10 caracteres', () => {
      const result = validatePassword('Abc#12');
      expect(result.ok).toBe(false);
      expect(result.checks.minLength).toBe(false);
      expect(result.errors).toContain('A senha deve ter pelo menos 10 caracteres.');
    });

    it('deve rejeitar senha vazia', () => {
      const result = validatePassword('');
      expect(result.ok).toBe(false);
      expect(result.checks.minLength).toBe(false);
      expect(result.checks.hasSymbol).toBe(false);
      expect(result.checks.hasTwoDigits).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('múltiplos erros', () => {
    it('deve retornar todos os erros quando senha falha em múltiplos requisitos', () => {
      const result = validatePassword('abc');
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors).toContain('A senha deve ter pelo menos 10 caracteres.');
      expect(result.errors).toContain('A senha deve conter pelo menos 1 símbolo (ex: #, !, @).');
      expect(result.errors).toContain('A senha deve conter pelo menos 2 dígitos.');
    });
  });
});
