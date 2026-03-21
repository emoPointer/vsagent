import { useMemo } from 'react';
import { WorkspaceGroup } from './WorkspaceGroup';
import { SearchResultItem } from './SearchResultItem';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useSearchResults } from '../../features/search/useSearch';

interface Props {
  searchQuery: string;
}

export function SidebarContent({ searchQuery }: Props) {
  const { results: rawResults, isLoading: searchLoading } = useSearchResults(searchQuery);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: conversations = [], isLoading } = useConversations();

  const results = useMemo(() => {
    const seen = new Set<string>();
    return rawResults.filter((r) => {
      if (seen.has(r.conversation_id)) return false;
      seen.add(r.conversation_id);
      return true;
    });
  }, [rawResults]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof conversations>();
    for (const conv of conversations) {
      if (conv.workspace_id) {
        const list = map.get(conv.workspace_id) ?? [];
        list.push(conv);
        map.set(conv.workspace_id, list);
      }
    }
    return map;
  }, [conversations]);

  return (
    <div className="flex flex-col h-full" style={{ paddingTop: '8px' }}>
      {searchQuery.length >= 2 ? (
        <div className="flex-1 overflow-y-auto">
          {searchLoading && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>Searching...</p>
          )}
          {!searchLoading && results.length === 0 && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>No results found.</p>
          )}
          {results.map((r) => (
            <SearchResultItem key={r.message_id} result={r} />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          )}
          {!isLoading && conversations.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No Claude Code sessions found.</p>
            </div>
          )}
          {workspaces.map((ws) => (
            <WorkspaceGroup
              key={ws.id}
              workspace={ws}
              conversations={grouped.get(ws.id) ?? []}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
