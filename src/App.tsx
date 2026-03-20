import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';
import { ResizeHandle } from './components/layout/ResizeHandle';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { ConversationView } from './components/conversation/ConversationView';
import { useConversationStore } from './features/conversations/conversationStore';
import { useWatcherEvents } from './features/conversations/useWatcherEvents';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AppInner() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const selectedId = useConversationStore((s) => s.selectedId);
  useWatcherEvents();

  const handleResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(500, w + delta)));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar width={sidebarWidth}>
        <SidebarContent />
      </Sidebar>
      <ResizeHandle onResize={handleResize} />
      <MainPanel>
        {selectedId
          ? <ConversationView conversationId={selectedId} />
          : <EmptyMain />
        }
      </MainPanel>
    </div>
  );
}

function EmptyMain() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
      <div className="text-4xl">⚡</div>
      <p className="text-sm">Select a conversation to view history</p>
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
