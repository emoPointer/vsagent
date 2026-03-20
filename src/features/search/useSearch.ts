import { useState, useEffect } from 'react';
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

export function useSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 300);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.searchMessages(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return { query, setQuery, results, isLoading };
}
