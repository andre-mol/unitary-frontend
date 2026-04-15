import { supabaseClient } from '../supabaseClient';

export type SearchItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
};

export type SearchGroup = {
  title: string;
  items: SearchItem[];
};

const PAGE_RESULTS: SearchItem[] = [
  { id: 'page-dashboard', label: 'Dashboard', subtitle: 'Visao geral', href: '/dashboard' },
  { id: 'page-portfolios', label: 'Portfolios', subtitle: 'Lista de portfolios', href: '/dashboard/portfolios' },
  { id: 'page-reports', label: 'Relatorios', subtitle: 'Relatorios financeiros', href: '/reports' },
  { id: 'page-goals', label: 'Metas', subtitle: 'Planejamento', href: '/dashboard/metas' },
  { id: 'page-budget', label: 'Orcamento', subtitle: 'Planejamento mensal', href: '/dashboard/orcamento' },
  { id: 'page-timeline', label: 'Linha do tempo', subtitle: 'Planejamento', href: '/dashboard/linha-tempo' },
  { id: 'page-settings', label: 'Configuracoes', subtitle: 'Preferencias', href: '/settings' },
];

export async function searchApp(term: string): Promise<SearchGroup[]> {
  const normalized = term.trim();
  const ilikeQuery = `%${normalized}%`;
  const supabase = supabaseClient();

  const pages = PAGE_RESULTS.filter((item) =>
    item.label.toLowerCase().includes(normalized.toLowerCase())
  );

  const [portfoliosRes, itemsRes, categoriesRes, goalsRes] = await Promise.all([
    supabase.from('portfolios').select('id, name').ilike('name', ilikeQuery).limit(5),
    supabase
      .from('portfolio_items')
      .select('id, name, category, portfolio_id')
      .ilike('name', ilikeQuery)
      .limit(5),
    supabase.from('portfolio_categories').select('name').ilike('name', ilikeQuery).limit(5),
    supabase.from('planning_goals').select('id, category').ilike('category', ilikeQuery).limit(5),
  ]);

  if (portfoliosRes.error) throw portfoliosRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (goalsRes.error) throw goalsRes.error;

  const portfolioMap = new Map(
    (portfoliosRes.data || []).map((p) => [p.id, p.name])
  );

  const missingPortfolioIds = (itemsRes.data || [])
    .map((item) => item.portfolio_id)
    .filter((id) => id && !portfolioMap.has(id));

  if (missingPortfolioIds.length > 0) {
    const { data: extraPortfolios } = await supabase
      .from('portfolios')
      .select('id, name')
      .in('id', missingPortfolioIds);

    (extraPortfolios || []).forEach((p) => {
      portfolioMap.set(p.id, p.name);
    });
  }

  const nextGroups: SearchGroup[] = [];

  if (pages.length > 0) {
    nextGroups.push({ title: 'Paginas', items: pages });
  }

  const portfolioItems: SearchItem[] = (portfoliosRes.data || []).map((p) => ({
    id: `portfolio-${p.id}`,
    label: p.name,
    subtitle: 'Portfolio',
    href: `/dashboard/portfolio/${p.id}`,
  }));
  if (portfolioItems.length > 0) {
    nextGroups.push({ title: 'Portfolios', items: portfolioItems });
  }

  const assetItems: SearchItem[] = (itemsRes.data || []).map((item) => ({
    id: `asset-${item.id}`,
    label: item.name,
    subtitle: `${item.category || 'Sem categoria'} - ${portfolioMap.get(item.portfolio_id) || 'Portfolio'}`,
    href: `/dashboard/portfolio/${item.portfolio_id}`,
  }));
  if (assetItems.length > 0) {
    nextGroups.push({ title: 'Ativos', items: assetItems });
  }

  const categoryItems: SearchItem[] = (categoriesRes.data || []).map((row) => ({
    id: `category-${row.name}`,
    label: row.name,
    subtitle: 'Categoria',
    href: '/dashboard/portfolios',
  }));
  if (categoryItems.length > 0) {
    nextGroups.push({ title: 'Categorias', items: categoryItems });
  }

  const goalItems: SearchItem[] = (goalsRes.data || []).map((goal) => ({
    id: `goal-${goal.id}`,
    label: goal.category,
    subtitle: 'Meta',
    href: '/dashboard/metas',
  }));
  if (goalItems.length > 0) {
    nextGroups.push({ title: 'Metas', items: goalItems });
  }

  return nextGroups;
}
