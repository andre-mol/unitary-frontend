
import { TrendingUp, Building2, Briefcase, Layers } from 'lucide-react';

export const PORTFOLIO_TYPES = [
  {
    id: 'investments',
    icon: TrendingUp,
    title: 'Investimentos Financeiros',
    description: 'Ações, Fundos, Renda Fixa, Cripto e ativos no exterior.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'group-hover:border-amber-500/50'
  },
  {
    id: 'real_estate',
    icon: Building2,
    title: 'Imóveis',
    description: 'Residenciais, comerciais, terrenos e renda de aluguel.',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'group-hover:border-blue-500/50'
  },
  {
    id: 'business',
    icon: Briefcase,
    title: 'Empresas & Participações',
    description: 'Holding, empresa própria, equity privado e sociedades.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'group-hover:border-emerald-500/50'
  },
  {
    id: 'custom',
    icon: Layers,
    title: 'Portfólio Personalizado',
    description: 'Estrutura livre para organizar ativos diversos ou mistos.',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'group-hover:border-purple-500/50'
  }
];

export const CURRENCY_OPTIONS = [
  { code: 'BRL', label: 'BRL (R$)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' }
];
