import { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { ConversationView } from './components/conversation/ConversationView';
import { useConversationStore } from './features/conversations/conversationStore';
import { useWatcherEvents } from './features/conversations/useWatcherEvents';

const SIDEBAR_WIDTH = 280;
const TITLEBAR_H = 36;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function TitleBar({ searchQuery, onSearch }: { searchQuery: string; onSearch: (q: string) => void }) {
  const win = getCurrentWindow();
  return (
    <div
      data-tauri-drag-region
      style={{
        height: TITLEBAR_H,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        flexShrink: 0,
        gap: 0,
      }}
    >
      {/* Left: app name */}
      <div data-tauri-drag-region style={{ paddingLeft: 14, paddingRight: 12, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
        vsagent
      </div>

      {/* Center: search box — must opt out of drag region */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <input
          type="text"
          placeholder="Search conversations and messages..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 480,
            height: 22,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: '0 10px',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Right: window controls — must opt out of drag region */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4, gap: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {[
          { label: '─', action: () => win.minimize(), hover: '#444' },
          { label: '□', action: () => win.toggleMaximize(), hover: '#444' },
          { label: '✕', action: () => win.close(), hover: '#c42b1c' },
        ].map(({ label, action, hover }) => (
          <button
            key={label}
            onClick={action}
            style={{
              width: 38, height: TITLEBAR_H, border: 'none', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            } as React.CSSProperties}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = hover; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AppInner() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedId = useConversationStore((s) => s.selectedId);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useWatcherEvents();

  const visible = pinned || hovered;

  // Auto-show sidebar when searching
  const effectiveVisible = visible || searchQuery.length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setPinned((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered(true);
  }, []);

  const onLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setHovered(false), 150);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <TitleBar searchQuery={searchQuery} onSearch={setSearchQuery} />

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Hover trigger + sidebar overlay */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0,
            width: effectiveVisible ? SIDEBAR_WIDTH : 4,
            height: '100%', zIndex: 50,
            transition: 'width 0.18s ease',
            overflow: 'hidden',
          }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <div style={{
            width: SIDEBAR_WIDTH, height: '100%',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            transform: effectiveVisible ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
            transition: 'transform 0.18s ease',
            display: 'flex', flexDirection: 'column',
          }}>
            <SidebarContent searchQuery={searchQuery} />
          </div>
        </div>

        {/* Main content */}
        <main style={{ height: '100%', overflow: 'hidden' }}>
          {selectedId
            ? <ConversationView conversationId={selectedId} />
            : <EmptyMain />
          }
        </main>
      </div>
    </div>
  );
}

function EmptyMain() {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
      <p style={{ fontSize: 13 }}>hover left edge or <kbd style={{ background: 'var(--bg-panel)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border)' }}>ctrl+b</kbd> to open sidebar</p>
      <p style={{ fontSize: 12, opacity: 0.5 }}>select a conversation to view history</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
