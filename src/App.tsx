import { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { ConversationView } from './components/conversation/ConversationView';
import { useConversationStore } from './features/conversations/conversationStore';
import { useWatcherEvents } from './features/conversations/useWatcherEvents';

const SIDEBAR_WIDTH = 280;
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AppInner() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const selectedId = useConversationStore((s) => s.selectedId);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useWatcherEvents();

  const visible = pinned || hovered;

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
    <div className="relative h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Hover trigger + sidebar overlay */}
      <div
        style={{
          position: 'fixed', left: 0, top: 0,
          width: visible ? SIDEBAR_WIDTH : 4,
          height: '100vh', zIndex: 50,
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
          transform: visible ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
          transition: 'transform 0.18s ease',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 1 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {pinned ? 'ctrl+b to hide' : 'ctrl+b to pin'}
            </span>
          </div>
          <SidebarContent />
        </div>
      </div>

      <main className="h-full overflow-hidden">
        {selectedId
          ? <ConversationView conversationId={selectedId} />
          : <EmptyMain />
        }
      </main>
    </div>
  );
}

function EmptyMain() {
  return (
    <div className="flex h-full items-center justify-center flex-col gap-2"
      style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
      <p style={{ fontSize: '13px' }}>
        hover left edge or press{' '}
        <kbd style={{ background: 'var(--bg-panel)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border)', fontFamily: 'monospace' }}>
          ctrl+b
        </kbd>{' '}
        to open sidebar
      </p>
      <p style={{ fontSize: '12px', opacity: 0.5 }}>select a conversation to view history</p>
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
