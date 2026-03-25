import { useMemo, useState } from 'react';
import { useMessages } from '../../features/conversations/useMessages';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';
import { MessageList } from './MessageList';
import { TerminalView } from '../terminal/TerminalView';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props { conversationId: string; }

function formatDate(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function truncatePath(p: string): string {
  const home = p.match(/^\/home\/[^/]+/) ?? p.match(/^\/Users\/[^/]+/);
  if (home) return '~' + p.slice(home[0].length);
  return p.length > 40 ? '...' + p.slice(-38) : p;
}

export function ConversationView({ conversationId }: Props) {
  const [mode, setMode] = useState<'history' | 'terminal'>('terminal');
  const { data: messages = [], isLoading } = useMessages(conversationId);

  const { data: conv } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.listConversations(),
    select: (convs) => convs.find((c) => c.id === conversationId),
  });

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.listWorkspaces(),
    select: (wss) => wss.find((w) => w.id === conv?.workspace_id),
    enabled: !!conv?.workspace_id,
  });

  const { data: envText = '' } = useQuery({
    queryKey: ['conversation-env', conversationId],
    queryFn: () => api.getConversationEnv(conversationId),
  });

  const ptyRevision = useConversationStore((s) => s.ptyRevisions[conversationId] ?? 0);

  const stats = useMemo(() => {
    const totalTokens = messages.reduce((sum, m) =>
      sum + (m.token_count_input ?? 0) + (m.token_count_output ?? 0), 0);
    const toolCalls = messages.filter((m) => {
      try { return m.content_json && JSON.parse(m.content_json).some((b: { type: string }) => b.type === 'tool_use'); }
      catch { return false; }
    }).length;
    return { totalTokens, toolCalls, msgCount: messages.length };
  }, [messages]);

  const workspacePath = workspace?.root_path;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', fontFamily: 'monospace' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {conv?.title ?? conversationId.slice(0, 16)}
            </h1>
            {workspace && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {truncatePath(workspace.root_path)}
                {conv?.branch_name && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>#{conv.branch_name}</span>}
              </p>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 flex-shrink-0"
            style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {(['history', 'terminal'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                }}
              >
                {m === 'history' ? '历史' : '终端'}
              </button>
            ))}
          </div>

          <div className="text-xs flex items-center gap-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {stats.msgCount > 0 && <span>{stats.msgCount} msgs</span>}
            {stats.toolCalls > 0 && <span>{stats.toolCalls} tools</span>}
            {stats.totalTokens > 0 && <span>{(stats.totalTokens / 1000).toFixed(1)}k tok</span>}
            {conv?.last_message_at && <span>{formatDate(conv.last_message_at)}</span>}
          </div>
        </div>
      </div>

      {/* Content — overflow hidden is critical for xterm fit */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Terminal: mounted once workspace is ready, shown/hidden via CSS to avoid
            listener accumulation that occurs when TerminalView unmounts and remounts */}
        {workspacePath ? (
          <div style={{
            flex: 1, minHeight: 0, overflow: 'hidden',
            display: mode === 'terminal' ? 'flex' : 'none',
            flexDirection: 'column',
          }}>
            <TerminalView
              key={ptyRevision}
              sessionId={`${conversationId}-r${ptyRevision}`}
              cwd={workspacePath}
              command={`claude --resume "${conversationId}"`}
              envText={envText}
            />
          </div>
        ) : mode === 'terminal' ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {wsLoading || !conv ? '正在加载工作区...' : '无法找到工作区路径'}
            </p>
          </div>
        ) : null}

        {/* History: always rendered on demand */}
        {mode === 'history' && (
          isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading messages...</p>
            </div>
          ) : (
            <MessageList messages={messages} />
          )
        )}
      </div>
    </div>
  );
}
