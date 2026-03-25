import { useMemo, useState } from 'react';
import { ConversationItem } from './ConversationItem';
import { SearchResultItem } from './SearchResultItem';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useSearchResults } from '../../features/search/useSearch';
import { useConversationStore } from '../../features/conversations/conversationStore';
import { useSshStore, RemoteConversation } from '../../features/ssh/sshStore';

interface Props {
  searchQuery: string;
}

export function SidebarContent({ searchQuery }: Props) {
  const { results: rawResults, isLoading: searchLoading } = useSearchResults(searchQuery);
  const { data: workspaces = [] } = useWorkspaces();
  const { data: conversations = [], isLoading } = useConversations();

  const sshConnected = useSshStore((s) => s.connectedHost);
  const remoteConversations = useSshStore((s) => s.remoteConversations);
  const sshLoading = useSshStore((s) => s.loading);
  const sshError = useSshStore((s) => s.error);
  const sshRefresh = useSshStore((s) => s.refresh);
  const sshDisconnect = useSshStore((s) => s.disconnect);

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

  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) =>
      (b.last_message_at ?? b.updated_at) - (a.last_message_at ?? a.updated_at)
    );
  }, [conversations]);

  const { startNewSession, selectedId, select } = useConversationStore();

  const handleNewSession = () => {
    if (sshConnected) {
      // Remote: open a new SSH panel with fresh claude session
      const ts = Date.now();
      select(`ssh-new:${ts}`);
    } else {
      const firstWs = workspaces[0];
      startNewSession(firstWs?.root_path ?? '/tmp');
    }
  };

  const handleSelectRemote = (conv: RemoteConversation) => {
    select(`ssh:${conv.id}`);
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

      {/* SSH connection indicator */}
      {sshConnected && (
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          background: 'rgba(34,197,94,0.08)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sshConnected.name}
          </span>
          <button
            onClick={() => sshRefresh()}
            title="刷新远程对话"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ↻
          </button>
          <button
            onClick={sshDisconnect}
            title="断开连接"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            ✕
          </button>
        </div>
      )}

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
            {/* Remote conversations (when SSH connected) */}
            {sshConnected && (
              <>
                <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  远程 · {sshConnected.name}
                </div>
                {sshLoading && (
                  <p style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>正在发现远程对话...</p>
                )}
                {sshError && (
                  <p style={{ padding: '8px 12px', fontSize: 11, color: '#ef4444', fontFamily: 'monospace' }}>{sshError}</p>
                )}
                {!sshLoading && remoteConversations.length === 0 && !sshError && (
                  <p style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>远程无对话</p>
                )}
                {remoteConversations.map((conv) => (
                  <RemoteConversationItem
                    key={conv.id}
                    conversation={conv}
                    selected={selectedId === `ssh:${conv.id}`}
                    onClick={() => handleSelectRemote(conv)}
                  />
                ))}

                <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  本地
                </div>
              </>
            )}

            {isLoading && (
              <p style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>加载中...</p>
            )}
            {!isLoading && sorted.length === 0 && !sshConnected && (
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

function RemoteConversationItem({ conversation, selected, onClick }: { conversation: RemoteConversation; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const label = conversation.title ?? conversation.id.slice(0, 10);
  const wsName = conversation.workspacePath?.split('/').pop();
  const panelId = `ssh:${conversation.id}`;

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/conversation-id', panelId);
        e.dataTransfer.effectAllowed = 'copy';
        document.body.style.userSelect = 'none';
      }}
      onDragEnd={() => {
        document.body.style.userSelect = '';
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        background: selected
          ? 'rgba(59,130,246,0.18)'
          : hovered ? 'var(--hover-bg)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.12s',
        userSelect: 'none',
      }}
    >
      <div className="flex items-center gap-2 w-full">
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: conversation.isActive ? '#22c55e' : 'var(--text-muted)',
          opacity: conversation.isActive ? 1 : 0.4,
        }} />
        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1" style={{ paddingLeft: 18 }}>
        {wsName && (
          <span className="truncate" style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.75 }}>{wsName}</span>
        )}
        {wsName && conversation.branchName && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.5 }}>/</span>
        )}
        {conversation.branchName && (
          <span className="truncate" style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.75 }}>{conversation.branchName}</span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto', flexShrink: 0 }}>
          {conversation.messageCount} msgs
        </span>
      </div>
    </div>
  );
}
