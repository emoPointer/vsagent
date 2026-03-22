import { useRef, useEffect, useCallback } from 'react';
import { ConversationView } from '../conversation/ConversationView';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  panelIds: string[];
}

export function MultiPanelArea({ panelIds }: Props) {
  const removePanel = useConversationStore((s) => s.removePanel);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to end when a new panel is added (animate left to make room)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || panelIds.length <= 1) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [panelIds.length]);

  // Non-passive wheel: convert vertical scroll to horizontal
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return; // already horizontal, let it through
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // While dragging a conversation over the panel area, scroll right to show where it'll land
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('text/conversation-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const el = containerRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, []);

  // Panel width: full when only 1, half when 2+
  const panelWidth = panelIds.length === 1 ? '100%' : '50%';

  return (
    <div
      ref={containerRef}
      className="panels-track"
      onDragOver={handleDragOver}
      style={{
        display: 'flex',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',     // Firefox
      }}
    >
      {panelIds.map((id) => (
        <div
          key={id}
          style={{
            flex: `0 0 ${panelWidth}`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Close button — only show when 2+ panels open */}
          {panelIds.length > 1 && (
            <button
              onClick={() => removePanel(id)}
              title="关闭面板"
              style={{
                position: 'absolute', top: 7, right: 44, zIndex: 10,
                width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                fontSize: 10,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              ✕
            </button>
          )}

          <ConversationView conversationId={id} />
        </div>
      ))}
    </div>
  );
}
