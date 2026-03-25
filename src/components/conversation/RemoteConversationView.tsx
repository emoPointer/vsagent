import { useState, useCallback, useEffect } from 'react';
import { TerminalView } from '../terminal/TerminalView';
import { MessageList } from './MessageList';
import { useSshStore, RemoteConversation } from '../../features/ssh/sshStore';
import { useConversationStore } from '../../features/conversations/conversationStore';
import { parseRemoteMessages } from '../../features/ssh/parseRemoteMessages';
import { api } from '../../lib/tauri';
import type { Message } from '../../types';

interface Props {
  conversation: RemoteConversation;
  envText?: string;
}

function truncatePath(p: string): string {
  const home = p.match(/^\/home\/[^/]+/) ?? p.match(/^\/Users\/[^/]+/);
  if (home) return '~' + p.slice(home[0].length);
  return p.length > 40 ? '...' + p.slice(-38) : p;
}

function shellEscape(s: string): string {
  if (/^[a-zA-Z0-9/_.-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function buildRemoteParts(cwd: string | null, envText?: string): string[] {
  const parts: string[] = [];
  if (envText) {
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        parts.push(`export ${trimmed}`);
      }
    }
  }
  if (cwd) parts.push(`cd ${shellEscape(cwd)}`);
  return parts;
}

function buildFullSshCommand(hostName: string, user: string | null, port: number | null, remoteCmd: string): string {
  const sshTarget = user ? `${user}@${hostName}` : hostName;
  const portArgs = port && port !== 22 ? `-p ${port} ` : '';
  const escapedForBash = remoteCmd.replace(/'/g, "'\\''");
  return `ssh -t ${portArgs}${sshTarget} "bash -l -c '${escapedForBash}'"`;
}

/** Mode toggle: 历史 / 终端 */
function ModeToggle({ mode, setMode }: { mode: 'history' | 'terminal'; setMode: (m: 'history' | 'terminal') => void }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0"
      style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      {(['history', 'terminal'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          style={{
            padding: '2px 10px', fontSize: 11, cursor: 'pointer',
            background: mode === m ? 'var(--accent)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-muted)',
            border: 'none',
          }}
        >
          {m === 'history' ? '历史' : '终端'}
        </button>
      ))}
    </div>
  );
}

function SessionEndedOverlay({ onReconnect, onClose }: { onReconnect: () => void; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 10,
    }}>
      <button onClick={onReconnect} style={{
        padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
        background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)',
        borderRadius: 4, color: 'var(--accent)', cursor: 'pointer',
      }}>重新连接</button>
      <button onClick={onClose} style={{
        padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
        borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
      }}>关闭</button>
    </div>
  );
}

/** Hook: fetch full JSONL via SSH on demand and parse into messages */
function useRemoteMessages(conversation: RemoteConversation, enabled: boolean) {
  const host = useSshStore((s) => s.connectedHost);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!enabled || !host || fetched) return;
    setLoading(true);
    api.sshExec(host.name, host.user, host.port, `cat ${shellEscape(conversation.jsonlPath)}`)
      .then((content) => {
        setMessages(parseRemoteMessages(content, conversation.id));
        setFetched(true);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [enabled, host, conversation.jsonlPath, conversation.id, fetched]);

  return { messages, loading };
}

export function RemoteConversationView({ conversation, envText }: Props) {
  const host = useSshStore((s) => s.connectedHost);
  const removePanel = useConversationStore((s) => s.removePanel);
  const [mode, setMode] = useState<'history' | 'terminal'>('terminal');
  const [ended, setEnded] = useState(false);
  const [revision, setRevision] = useState(0);

  const panelId = `ssh:${conversation.id}`;
  const { messages, loading: historyLoading } = useRemoteMessages(conversation, mode === 'history');

  const handleExit = useCallback(() => setEnded(true), []);
  const handleReconnect = useCallback(() => {
    setEnded(false);
    setRevision((r) => r + 1);
  }, []);
  const handleClose = useCallback(() => removePanel(panelId), [removePanel, panelId]);

  if (!host) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>SSH 未连接</p>
      </div>
    );
  }

  const parts = buildRemoteParts(conversation.workspacePath, envText);
  parts.push(`exec claude --resume "${conversation.sessionId}"`);
  const remoteCmd = parts.join(' && ');
  const fullCommand = buildFullSshCommand(host.name, host.user, host.port, remoteCmd);
  const sessionId = `ssh-${conversation.id}-r${revision}`;

  return (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', fontFamily: 'monospace' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: '#22c55e', marginRight: 6, fontSize: 10 }}>SSH</span>
              {conversation.title ?? conversation.id.slice(0, 16)}
            </h1>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {host.name}
              {conversation.workspacePath && (
                <span style={{ marginLeft: 8 }}>{truncatePath(conversation.workspacePath)}</span>
              )}
              {conversation.branchName && (
                <span style={{ color: 'var(--accent)', marginLeft: 8 }}>#{conversation.branchName}</span>
              )}
            </p>
          </div>

          <ModeToggle mode={mode} setMode={setMode} />

          <div className="text-xs flex items-center gap-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {conversation.messageCount > 0 && <span>{conversation.messageCount} msgs</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Terminal — show/hide via CSS to keep it alive */}
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          display: mode === 'terminal' ? 'flex' : 'none',
          flexDirection: 'column',
        }}>
          <TerminalView
            key={revision}
            sessionId={sessionId}
            cwd="/tmp"
            command={fullCommand}
            onExit={handleExit}
          />
          {ended && <SessionEndedOverlay onReconnect={handleReconnect} onClose={handleClose} />}
        </div>

        {/* History */}
        {mode === 'history' && (
          historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>正在从远程加载历史...</p>
            </div>
          ) : (
            <MessageList messages={messages} />
          )
        )}
      </div>
    </div>
  );
}

/**
 * New remote session — SSH into remote and open a shell.
 */
export function NewRemoteSessionView({ sessionKey }: { sessionKey: string }) {
  const host = useSshStore((s) => s.connectedHost);
  const removePanel = useConversationStore((s) => s.removePanel);
  const [ended, setEnded] = useState(false);
  const [revision, setRevision] = useState(0);

  const handleExit = useCallback(() => setEnded(true), []);
  const handleReconnect = useCallback(() => {
    setEnded(false);
    setRevision((r) => r + 1);
  }, []);
  const handleClose = useCallback(() => removePanel(sessionKey), [removePanel, sessionKey]);

  if (!host) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>SSH 未连接</p>
      </div>
    );
  }

  const sshTarget = host.user ? `${host.user}@${host.name}` : host.name;
  const portArgs = host.port && host.port !== 22 ? `-p ${host.port} ` : '';
  const fullCommand = `ssh -t ${portArgs}${sshTarget}`;
  const sessionId = `ssh-new-${sessionKey}-r${revision}`;

  return (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      <div className="px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', fontFamily: 'monospace' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              <span style={{ color: '#22c55e', marginRight: 6, fontSize: 10 }}>SSH</span>
              远程终端
            </h1>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {host.name}
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TerminalView
          key={revision}
          sessionId={sessionId}
          cwd="/tmp"
          command={fullCommand}
          onExit={handleExit}
        />
        {ended && <SessionEndedOverlay onReconnect={handleReconnect} onClose={handleClose} />}
      </div>
    </div>
  );
}
