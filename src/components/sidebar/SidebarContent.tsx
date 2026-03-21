import { useMemo } from 'react';
import { WorkspaceGroup } from './WorkspaceGroup';
import { SearchResultItem } from './SearchResultItem';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useSearchResults } from '../../features/search/useSearch';
import { api } from '../../lib/tauri';

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

  // Use home dir for top-level "new session"; workspace-level "+" uses workspace.root_path
  const handleNewSession = () => {
    const firstWs = workspaces[0];
    api.openInTerminal(firstWs?.root_path ?? '~');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Fixed top: New Session button */}
      <div style={{
        padding: '10px 10px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={handleNewSession}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '8px 0',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.35)',
            borderRadius: 6,
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.25)';
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新建会话
        </button>
      </div>

      {/* Scrollable conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        {searchQuery.length >= 2 ? (
          <>
            {searchLoading && (
              <p style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>搜索中...</p>
            )}
            {!searchLoading && results.length === 0 && (
              <p style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>没有找到结果</p>
            )}
            {results.map((r) => (
              <SearchResultItem key={r.message_id} result={r} />
            ))}
          </>
        ) : (
          <>
            {isLoading && (
              <p style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>加载中...</p>
            )}
            {!isLoading && conversations.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无 Claude Code 会话</p>
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
          </>
        )}
      </div>
    </div>
  );
}
