import { z } from 'zod';
import { validateBugScreenshot } from '../bugScreenshotValidation';
import { validatePassword } from './password';
import { validateAndNormalizePhone } from './phone';

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const signupSchema = z.object({
  name: z.string().min(1, 'Por favor, insira seu nome.').trim().superRefine((name, ctx) => {
    // AIDEV-NOTE: Validação de nome completo - requer pelo menos 2 palavras
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Por favor, insira seu nome completo (nome e sobrenome).',
      });
    }
  }),
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.').superRefine((pw, ctx) => {
    const result = validatePassword(pw);
    if (!result.ok) {
      result.errors.forEach((error) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        });
      });
    }
  }),
  confirmPassword: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.'),
  phone: z.string().min(1, 'O telefone é obrigatório.').superRefine((phone, ctx) => {
    const result = validateAndNormalizePhone(phone);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Digite um número de telefone válido',
      });
    }
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
});

export type SignupFormData = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.'),
  confirmPassword: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas n\u00e3o coincidem.',
  path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Por favor, informe seu nome.').max(120).trim(),
  phone: z.string().max(30).trim().optional(),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

export const changePasswordSchema = z.object({
  password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.'),
  confirmPassword: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas n\u00e3o coincidem.',
  path: ['confirmPassword'],
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const userSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  currency: z.literal('BRL'),
  locale: z.literal('pt-BR'),
  notificationsEmail: z.boolean(),
  notificationsProductUpdates: z.boolean(),
  marketingEmailsOptIn: z.boolean(),
  productUpdatesOptIn: z.boolean(),
  termsAcceptedAt: z.string().nullable().optional(),
  termsVersion: z.string().nullable().optional(),
  privacyVersion: z.string().nullable().optional(),
  communicationsVersion: z.string().nullable().optional(),
});

export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

// ============================================================
// PORTFOLIO SCHEMAS
// ============================================================

export const createPortfolioSchema = z.object({
  name: z.string().min(1, 'O nome do portfólio é obrigatório.').trim(),
  type: z.enum(['investments', 'real_estate', 'business', 'custom']),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  description: z.string().optional(),
  criteria: z.array(z.string()).optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
});

export type CreatePortfolioFormData = z.infer<typeof createPortfolioSchema>;

// ============================================================
// ITEM SCHEMAS
// ============================================================

export const customFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const itemCustomFieldsSchema = z.record(z.string(), customFieldValueSchema).optional();

export const createItemSchema = z.object({
  name: z.string().min(1, 'O nome do ativo é obrigatório.').trim(),
  category: z.string().min(1, 'A categoria é obrigatória.'),
  description: z.string().optional(),
  currency: z.string(),
  initialValue: z.number().min(0, 'O valor inicial deve ser positivo.'),
  initialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida.'),
  value: z.number().min(0, 'O valor atual deve ser positivo.'),
  quantity: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  customFields: itemCustomFieldsSchema,
});

export type CreateItemFormData = z.infer<typeof createItemSchema>;

// ============================================================
// TRANSACTION SCHEMAS
// ============================================================

export const transactionBaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida.'),
  totalValue: z.number(),
  observation: z.string().optional(),
});

export const rentTransactionSchema = transactionBaseSchema.extend({
  type: z.literal('rent_start').or(z.literal('rent_end')),
  rentIndexer: z.string().optional(),
  rentAdjustmentMonth: z.number().optional(),
});

export const dividendTransactionSchema = transactionBaseSchema.extend({
  type: z.literal('dividend').or(z.literal('jcp')).or(z.literal('profit_registered')).or(z.literal('profit_distribution')),
  period: z.string().optional(),
});

export const transactionSchema = z.union([
  transactionBaseSchema.extend({
    type: z.enum(['buy', 'sell', 'manual_update', 'income', 'expense']),
  }),
  rentTransactionSchema,
  dividendTransactionSchema,
]);

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ============================================================
// BUG REPORT SCHEMA
// ============================================================

export const bugReportSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório.').trim(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres.').trim(),
  screenshot: z
    .instanceof(File)
    .nullable()
    .optional()
    .superRefine((file, ctx) => {
      const result = validateBugScreenshot(file ?? undefined);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message,
        });
      }
    }),
});

export type BugReportFormData = z.infer<typeof bugReportSchema>;

// ============================================================
// CONTRIBUTION SCHEMAS
// ============================================================

export const contributionBudgetSchema = z.object({
  budget: z.string().regex(/^\d+([.,]\d{2})?$/, 'Valor inválido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida.'),
});

export type ContributionBudgetFormData = z.infer<typeof contributionBudgetSchema>;

