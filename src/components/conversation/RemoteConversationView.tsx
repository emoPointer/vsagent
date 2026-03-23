import { useState, useCallback } from 'react';
import { TerminalView } from '../terminal/TerminalView';
import { useSshStore, RemoteConversation } from '../../features/ssh/sshStore';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  conversation: RemoteConversation;
  /** Optional env vars to inject (KEY=VALUE lines) */
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

function buildRemoteParts(
  cwd: string | null,
  envText?: string,
): string[] {
  const parts: string[] = [];

  if (envText) {
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        parts.push(`export ${trimmed}`);
      }
    }
  }

  if (cwd) {
    parts.push(`cd ${shellEscape(cwd)}`);
  }

  return parts;
}

function buildFullSshCommand(
  hostName: string,
  user: string | null,
  port: number | null,
  remoteCmd: string,
): string {
  const sshTarget = user ? `${user}@${hostName}` : hostName;
  const portArgs = port && port !== 22 ? `-p ${port} ` : '';
  const escapedForBash = remoteCmd.replace(/'/g, "'\\''");
  return `ssh -t ${portArgs}${sshTarget} "bash -l -c '${escapedForBash}'"`;
}

/** Overlay shown when PTY exits */
function SessionEndedOverlay({ onReconnect, onClose }: { onReconnect: () => void; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 10,
    }}>
      <button
        onClick={onReconnect}
        style={{
          padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
          background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)',
          borderRadius: 4, color: 'var(--accent)', cursor: 'pointer',
        }}
      >
        重新连接
      </button>
      <button
        onClick={onClose}
        style={{
          padding: '6px 16px', fontSize: 12, fontFamily: 'monospace',
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
        }}
      >
        关闭
      </button>
    </div>
  );
}

export function RemoteConversationView({ conversation, envText }: Props) {
  const host = useSshStore((s) => s.connectedHost);
  const removePanel = useConversationStore((s) => s.removePanel);
  const [ended, setEnded] = useState(false);
  const [revision, setRevision] = useState(0);

  const panelId = `ssh:${conversation.id}`;

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
  parts.push(`exec claude --resume "${conversation.id}"`);
  const remoteCmd = parts.join(' && ');
  const fullCommand = buildFullSshCommand(host.name, host.user, host.port, remoteCmd);

  // revision in sessionId forces TerminalView remount on reconnect
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

          <div className="text-xs flex items-center gap-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {conversation.messageCount > 0 && <span>{conversation.messageCount} msgs</span>}
          </div>
        </div>
      </div>

      {/* Terminal */}
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
      {/* Header */}
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

      {/* Terminal */}
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
