/**
 * ============================================================
 * FONTE ÚNICA DE VERDADE - SISTEMA DE PLANOS PATRIÔ
 * ============================================================
 * 
 * Este arquivo é a única fonte de verdade para:
 * - IDs canônicos dos planos
 * - Preços (em centavos)
 * - Limites e features de cada plano
 * - Funções utilitárias para trabalhar com planos
 * 
 * IMPORTANTE: Todo o sistema deve consumir apenas este arquivo
 * ============================================================
 */

// ============================================================
// TIPOS E CONSTANTES
// ============================================================

/**
 * IDs canônicos dos planos (usados no backend/banco)
 */
export type PlanId = 'inicial' | 'essencial' | 'patrio_pro'

/**
 * Nomes de marketing dos planos (usados na UI)
 */
export type PlanDisplayName = 'Inicial' | 'Essencial' | 'Unitary Pro'

/**
 * Features disponíveis nos planos
 */
export type PlanFeature =
  | 'unlimited_assets'
  | 'real_estate_companies'
  | 'export_csv_pdf'
  | 'goals_objectives'
  | 'budget_domestic'
  | 'timeline'
  | 'full_history'
  | 'priority_support'
  | 'unlimited_portfolios'
  | 'early_access'

/**
 * Status possÃ­veis de assinatura
 */
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'

/**
 * Mapeamento de hierarquia dos planos
 */
export const planRank: Record<PlanId, number> = {
  inicial: 0,
  essencial: 1,
  patrio_pro: 2,
}

/**
 * Configuração completa de um plano
 */
/**
 * Configuração completa de um plano
 */
export interface PlanConfig {
  id: PlanId
  displayName: PlanDisplayName
  priceInCents: number // Mantido para compatibilidade (preço mensal padrão)
  monthlyPriceInCents: number
  annualPriceInCents: number
  portfolioLimit: number | 'unlimited'
  features: PlanFeature[]
  marketingFeatures: string[]
  isPopular?: boolean
  savingsDescription?: string
}

// ============================================================
// DEFINIÇÃO DOS PLANOS
// ============================================================

export const PLANS: Record<PlanId, PlanConfig> = {
  inicial: {
    id: 'inicial',
    displayName: 'Inicial',
    priceInCents: 0,
    monthlyPriceInCents: 0,
    annualPriceInCents: 0,
    portfolioLimit: 1,
    features: ['unlimited_assets'],
    marketingFeatures: [
      'Ativos ilimitados',
      'Até 1 portfólio',
      'Cadastro manual simplificado',
      'Evolução patrimonial',
      'Alocação por classes',
      'Suporte por ticket',
    ],
  },
  essencial: {
    id: 'essencial',
    displayName: 'Essencial',
    priceInCents: 2900,
    monthlyPriceInCents: 2900, // R$ 29,00
    annualPriceInCents: 28800, // R$ 288,00 (R$ 24/mês)
    portfolioLimit: 3,
    features: [
      'unlimited_assets',
      'real_estate_companies',
      'export_csv_pdf',
      'goals_objectives',
      'budget_domestic',
      'timeline',
      'full_history',
      'priority_support',
    ],
    marketingFeatures: [
      'Ativos ilimitados',
      'Até 3 portfólios independentes',
      'Cadastro manual simplificado',
      'Evolução patrimonial',
      'Alocação por classes',
      'Gestão de Ações, Imóveis, Empresas',
      'Histórico patrimonial completo (mês a mês)',
      'Exportação de dados (CSV/PDF)',
      'Separação por objetivos e metas',
      'Linha do tempo financeira completa',
      'Orçamento doméstico',
      'Suporte prioritário',
    ],
    isPopular: true,
    savingsDescription: 'R$ 60/ano',
  },
  patrio_pro: {
    id: 'patrio_pro',
    displayName: 'Unitary Pro',
    priceInCents: 5900,
    monthlyPriceInCents: 5900, // R$ 59,00
    annualPriceInCents: 58800, // R$ 588,00 (R$ 49/mês)
    portfolioLimit: 'unlimited',
    features: [
      'unlimited_assets',
      'real_estate_companies',
      'export_csv_pdf',
      'goals_objectives',
      'budget_domestic',
      'timeline',
      'full_history',
      'priority_support',
      'unlimited_portfolios',
      'early_access',
    ],
    marketingFeatures: [
      'Tudo do Essencial',
      'Ativos ilimitados',
      'Portfólios ilimitados',
      'Suporte prioritário',
      'Acesso antecipado a recursos',
    ],
    savingsDescription: 'R$ 120/ano',
  },
}

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================

/**
 * Obter configuração completa de um plano por ID
 */
export function getPlanById(planId: PlanId): PlanConfig {
  const plan = PLANS[planId]
  if (!plan) {
    // Fallback para inicial se plano inválido
    return PLANS.inicial
  }
  return plan
}

/**
 * Obter nome de exibição de um plano
 */
export function getPlanDisplayName(planId: PlanId): PlanDisplayName {
  return getPlanById(planId).displayName
}

/**
 * Obter preço de um plano em centavos
 */
export function getPlanPriceInCents(planId: PlanId): number {
  return getPlanById(planId).priceInCents
}

/**
 * Formatar centavos para R$ (BRL)
 */
export function formatBRLFromCents(cents: number): string {
  const reais = Math.abs(cents) / 100
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais)
  return cents < 0 ? `R$-${formatted}` : `R$ ${formatted}`
}

/**
 * Formatar centavos para R$ sem decimais (para exibição em cards)
 */
export function formatBRLFromCentsNoDecimals(cents: number): string {
  const reais = Math.abs(cents) / 100
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(reais)
  return cents < 0 ? `R$-${formatted}` : `R$ ${formatted}`
}

/**
 * Verificar se um plano tem uma feature específica
 */
export function hasFeature(planId: PlanId, feature: PlanFeature): boolean {
  const plan = getPlanById(planId)
  return plan.features.includes(feature)
}

/**
 * Verificar se um plano atende ou excede um plano requerido
 * Hierarquia: inicial < essencial < patrio_pro
 */
export function isPlanAtLeast(
  userPlan: PlanId,
  requiredPlan: PlanId
): boolean {
  return planRank[userPlan] >= planRank[requiredPlan]
}

/**
 * Obter limite de portfólios de um plano
 */
export function getPortfolioLimit(
  planId: PlanId
): number | 'unlimited' {
  return getPlanById(planId).portfolioLimit
}

/**
 * Verificar se um plano tem acesso a features de planejamento
 * (metas, orçamento, linha do tempo)
 */
export function canAccessPlanning(planId: PlanId): boolean {
  return (
    hasFeature(planId, 'goals_objectives') &&
    hasFeature(planId, 'budget_domestic') &&
    hasFeature(planId, 'timeline')
  )
}

/**
 * Verificar se um plano pode gerenciar imóveis e empresas
 */
export function canManageRealEstateCompanies(planId: PlanId): boolean {
  return hasFeature(planId, 'real_estate_companies')
}

/**
 * Verificar se um plano pode exportar dados
 */
export function canExportData(planId: PlanId): boolean {
  return hasFeature(planId, 'export_csv_pdf')
}

/**
 * Obter todos os planos em ordem (inicial, essencial, patrio_pro)
 */
export function getAllPlans(): PlanConfig[] {
  return [PLANS.inicial, PLANS.essencial, PLANS.patrio_pro]
}

/**
 * Obter planos pagos (não gratuitos)
 */
export function getPaidPlans(): PlanConfig[] {
  return [PLANS.essencial, PLANS.patrio_pro]
}

/**
 * Verificar se um plano é pago
 */
export function isPaidPlan(planId: PlanId): boolean {
  return planId !== 'inicial'
}

/**
 * Retorna o plano efetivo de acordo com status e validade da assinatura
 */
export function getEffectivePlan(input: {
  plan: PlanId
  status: SubscriptionStatus
  currentPeriodEnd?: string | null
}): PlanId {
  if (input.status !== 'active' && input.status !== 'trialing') {
    return 'inicial'
  }

  if (!input.currentPeriodEnd) {
    return input.plan
  }

  const expiresAt = Date.parse(input.currentPeriodEnd)
  if (Number.isNaN(expiresAt)) {
    return 'inicial'
  }

  return expiresAt > Date.now() ? input.plan : 'inicial'
}

/**
 * Obter preço mensal equivalente ao plano anual
 */
export function getAnnualEquivalentMonthlyPrice(planId: PlanId): number {
  const plan = getPlanById(planId)
  if (plan.annualPriceInCents === 0) return 0
  return Math.round(plan.annualPriceInCents / 12)
}

/**
 * Obter economia anual (em centavos)
 */
export function getAnnualSavings(planId: PlanId): number {
  const plan = getPlanById(planId)
  if (plan.annualPriceInCents === 0) return 0
  const annualRegularPrice = plan.monthlyPriceInCents * 12
  return annualRegularPrice - plan.annualPriceInCents
}


