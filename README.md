# Unitary — Wealth Management System

Sistema de gestão patrimonial pessoal construído com **React + TypeScript + Vite + Tailwind CSS**.

> **Demo estática com dados mockados.** O backend (Supabase) não está incluído neste repositório. Todas as funcionalidades de rede estão desabilitadas e substituídas por dados de demonstração.

## Stack

- **React 18** com TypeScript
- **Vite 6** (build & dev server)
- **Tailwind CSS 4** (estilização)
- **TanStack React Query** (gerenciamento de estado assíncrono)
- **React Router 6** (navegação SPA)
- **Recharts** (gráficos)
- **Framer Motion** (animações)
- **Zod** (validação de schemas)
- **React Hook Form** (formulários)

## Funcionalidades

- Dashboard com visão geral do patrimônio
- Portfólios independentes (investimentos, imóveis, empresas)
- Gestão de ativos com múltiplos métodos de avaliação
- Histórico de transações e eventos
- Sistema de metas e alocação por categorias
- Orçamento doméstico
- Linha do tempo financeira
- Calculadoras financeiras (juros compostos, aluguel vs compra, etc.)
- Sistema de planos com gating de funcionalidades
- Tema escuro nativo

## Rodar Localmente

```bash
npm install
npm run dev
```

O app inicia em modo demo automaticamente (dados mockados, sem necessidade de backend).

## Deploy (Vercel)

1. Importe este repositório na Vercel
2. Configure a variável de ambiente: `VITE_DEMO_MODE=true`
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

## Estrutura

```
├── components/       # Componentes React (pages, UI, auth, billing, etc.)
├── config/           # Configuração (env, storage, supabase client)
├── domain/           # Interfaces de domínio (repositories)
├── hooks/            # React hooks customizados
├── infrastructure/   # Implementações (auth, database, storage)
├── lib/              # Services, queries, utilitários
├── mocks/            # Dados e clientes mockados (modo demo)
├── types/            # TypeScript types globais
└── utils/            # Funções utilitárias
```
