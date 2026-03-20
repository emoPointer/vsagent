import { useMemo } from 'react';
import { SearchBar } from './SearchBar';
import { WorkspaceGroup } from './WorkspaceGroup';
import { SearchResultItem } from './SearchResultItem';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useSearch } from '../../features/search/useSearch';

export function SidebarContent() {
  const { query, setQuery, results, isLoading: searchLoading } = useSearch();
  const { data: workspaces = [] } = useWorkspaces();
  const { data: conversations = [], isLoading } = useConversations();

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        vsagent
      </div>
      <SearchBar value={query} onChange={setQuery} />

      {query.length >= 2 ? (
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
        /* Conversation list */
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          )}
          {!isLoading && conversations.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No Claude Code sessions found.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Start a session with Claude Code to see history here.
              </p>
            </div>
          )}
          {workspaces.map((ws) => (
            <WorkspaceGroup
              key={ws.id}
              workspace={ws}
              conversations={grouped.get(ws.id) ?? []}
              searchQuery={query}
            />
          ))}
        </div>
      )}
    </div>
  );
}
