import { useMemo } from 'react';
import { ConversationItem } from './ConversationItem';
import { SearchResultItem } from './SearchResultItem';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useSearchResults } from '../../features/search/useSearch';
import { useConversationStore } from '../../features/conversations/conversationStore';

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

  const workspaceMap = useMemo(() => {
    return new Map(workspaces.map((ws) => [ws.id, ws.name]));
  }, [workspaces]);

  // Flat list sorted by most recently active
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) =>
      (b.last_message_at ?? b.updated_at) - (a.last_message_at ?? a.updated_at)
    );
  }, [conversations]);

  const { startNewSession, selectedId, select } = useConversationStore();

  const handleNewSession = () => {
    const firstWs = workspaces[0];
    startNewSession(firstWs?.root_path ?? '/tmp');
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
            {!isLoading && sorted.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>暂无 Claude Code 会话</p>
              </div>
            )}
            {sorted.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                workspaceName={conv.workspace_id ? workspaceMap.get(conv.workspace_id) : undefined}
                selected={selectedId === conv.id}
                onClick={() => select(conv.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
