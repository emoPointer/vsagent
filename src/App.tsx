import { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { MultiPanelArea } from './components/panels/MultiPanelArea';
import { TerminalView } from './components/terminal/TerminalView';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useConversationStore } from './features/conversations/conversationStore';
import { useWatcherEvents } from './features/conversations/useWatcherEvents';
import { useSettingsStore } from './features/settings/settingsStore';

const SIDEBAR_WIDTH = 280;
const TITLEBAR_H = 36;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function TitleBar({ searchQuery, onSearch, onSettings }: { searchQuery: string; onSearch: (q: string) => void; onSettings: () => void }) {
  const win = getCurrentWindow();
  const handleDragMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('input, button, a')) {
      win.startDragging();
    }
  };
  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleDragMouseDown}
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
      {/* Left: app name — draggable */}
      <div data-tauri-drag-region style={{ paddingLeft: 14, paddingRight: 12, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0, minWidth: 80 }}>
        vsagent
      </div>

      {/* Center drag spacer */}
      <div data-tauri-drag-region style={{ flex: 1 }} />

      {/* Search box — fixed width, centered, opts out of drag */}
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <input
          type="text"
          placeholder="Search conversations and messages..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: 360,
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

      {/* Right drag spacer */}
      <div data-tauri-drag-region style={{ flex: 1 }} />

      {/* Right: settings + window controls — must opt out of drag region */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4, gap: 0, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onSettings}
          title="设置"
          style={{
            width: 36, height: TITLEBAR_H, border: 'none', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          } as React.CSSProperties}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
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
  const [showSettings, setShowSettings] = useState(false);
  const newSessionCwd = useConversationStore((s) => s.newSessionCwd);
  const newSessionId = useConversationStore((s) => s.newSessionId);
  const panels = useConversationStore((s) => s.panels);
  const addPanel = useConversationStore((s) => s.addPanel);
  const [dropActive, setDropActive] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, fontSize } = useSettingsStore();
  useWatcherEvents();

  // Apply theme and font size to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
  }, [theme, fontSize]);

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
      <TitleBar searchQuery={searchQuery} onSearch={setSearchQuery} onSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

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

        {/* Main content — drop zone for conversations */}
        <main
          style={{ height: '100%', overflow: 'hidden', outline: dropActive ? '2px solid var(--accent)' : 'none', outlineOffset: -2 }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/conversation-id')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setDropActive(true);
            }
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            const id = e.dataTransfer.getData('text/conversation-id');
            if (id) addPanel(id);
          }}
        >
          {newSessionCwd && newSessionId
            ? <TerminalView sessionId={newSessionId} cwd={newSessionCwd} />
            : panels.length > 0
            ? <MultiPanelArea panelIds={panels} />
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
