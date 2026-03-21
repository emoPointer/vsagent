import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Accepts external query, only responsible for fetching results
export function useSearchResults(query: string) {
  const debouncedQuery = useDebounced(query, 300);
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.searchMessages(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });
  return { results, isLoading };
}

// Legacy usage (kept for compatibility, but SidebarContent will no longer use it)
export function useSearch() {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useSearchResults(query);
  return { query, setQuery, results, isLoading };
}
