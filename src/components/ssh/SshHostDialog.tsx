import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { SshHost } from '../../types';
import { api } from '../../lib/tauri';
import { useSshStore } from '../../features/ssh/sshStore';
import { useSettingsStore } from '../../features/settings/settingsStore';

interface Props {
  onClose: () => void;
}

export function SshHostDialog({ onClose }: Props) {
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useSshStore((s) => s.connect);
  const lastSshHost = useSettingsStore((s) => s.lastSshHost);

  useEffect(() => {
    api.parseSshConfig()
      .then(setHosts)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Sort: last connected host first
  const sortedHosts = useMemo(() => {
    if (!lastSshHost) return hosts;
    return [...hosts].sort((a, b) => {
      if (a.name === lastSshHost) return -1;
      if (b.name === lastSshHost) return 1;
      return 0;
    });
  }, [hosts, lastSshHost]);

  const handleConnect = async (host: SshHost) => {
    setConnecting(host.name);
    setError(null);
    try {
      await connect(host);
      onClose();
    } catch (e) {
      setError(String(e));
      setConnecting(null);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: 420,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
            SSH Hosts
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 16, padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Host list */}
        <div style={{ padding: '8px 0', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
              Loading SSH config...
            </div>
          )}

          {!loading && hosts.length === 0 && (
            <div style={{ padding: '20px 18px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
              No hosts found in ~/.ssh/config
            </div>
          )}

          {sortedHosts.map((host) => (
            <HostRow
              key={host.name}
              host={host}
              isLast={host.name === lastSshHost}
              connecting={connecting === host.name}
              onConnect={() => handleConnect(host)}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 18px',
            borderTop: '1px solid var(--border)',
            color: '#ef4444',
            fontSize: 11,
            fontFamily: 'monospace',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function HostRow({ host, isLast, connecting, onConnect }: { host: SshHost; isLast: boolean; connecting: boolean; onConnect: () => void }) {
  const [hovered, setHovered] = useState(false);

  const display = host.user
    ? `${host.user}@${host.hostname}`
    : host.hostname;
  const portStr = host.port && host.port !== 22 ? `:${host.port}` : '';

  return (
    <div
      onClick={connecting ? undefined : onConnect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 18px',
        cursor: connecting ? 'wait' : 'pointer',
        background: hovered ? 'var(--hover-bg)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'background 0.1s',
      }}
    >
      {/* Server icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          {host.name}
          {isLast && <span style={{ fontSize: 9, color: 'var(--accent)', opacity: 0.7 }}>recent</span>}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>
          {display}{portStr}
        </div>
      </div>

      {connecting && (
        <span style={{ color: 'var(--accent)', fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}>
          connecting...
        </span>
      )}
    </div>
  );
}
