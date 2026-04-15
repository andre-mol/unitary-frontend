import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { queryKeys } from '../../lib/queryKeys';
import { searchApp, type SearchGroup } from '../../lib/queries/search';

type SearchItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
};

const minQueryLength = 2;

export const AppSearch: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = async (term: string) => {
    const normalized = term.trim();
    if (normalized.length < minQueryLength) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextGroups = await queryClient.fetchQuery({
        queryKey: queryKeys.search(user?.id, normalized),
        queryFn: () => searchApp(normalized),
        staleTime: 2 * 60 * 1000,
      });

      setGroups(nextGroups);
      setActiveIndex(0);
    } catch {
      setGroups([]);
      setError('Nao foi possivel buscar resultados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setGroups([]);
      setError(null);
      setOpen(false);
      return;
    }

    setOpen(true);
    debounceRef.current = window.setTimeout(() => {
      void runSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = flatResults[activeIndex];
      if (selected) {
        setOpen(false);
        setQuery('');
        navigate(selected.href);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-xs sm:max-w-sm" ref={containerRef}>
      <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-full px-3 py-1.5 focus-within:border-zinc-700 transition-colors">
        <Search size={14} className="text-zinc-500 mr-2" />
        <input
          type="text"
          placeholder="Buscar por portfolio, ativo ou meta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 w-full"
        />
      </div>

      {open && (
        <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50">
          {loading ? (
            <div className="p-4 text-sm text-zinc-500">Buscando...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-400">{error}</div>
          ) : groups.length === 0 && query.trim().length >= minQueryLength ? (
            <div className="p-4 text-sm text-zinc-500">
              Nenhum resultado. Tente buscar por nome do portfolio ou categoria.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {groups.map((group, groupIndex) => (
                <div key={group.title} className="border-b border-zinc-800 last:border-b-0">
                  <p className="px-4 pt-3 pb-2 text-xs uppercase tracking-wide text-zinc-500">
                    {group.title}
                  </p>
                  <div className="pb-2">
                    {group.items.map((item: SearchItem, index: number) => {
                      const flatIndex =
                        groups
                          .slice(0, groupIndex)
                          .reduce((acc, g) => acc + g.items.length, 0) + index;
                      const isActive = flatIndex === activeIndex;
                      return (
                        <button
                          key={item.id}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/60'
                          }`}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => {
                            setOpen(false);
                            setQuery('');
                            navigate(item.href);
                          }}
                        >
                          <div className="font-medium">{item.label}</div>
                          {item.subtitle && (
                            <div className="text-xs text-zinc-500">{item.subtitle}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
